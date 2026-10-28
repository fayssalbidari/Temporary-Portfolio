import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from "ogl";

// Rendu WebGL du slider.
// Principe : le slider reste du HTML (accessible, cliquable, SEO). Chaque bande a un <img>
// dans le DOM ; ici on dessine ces mêmes images sur un canvas plein écran, à la position
// exacte de la bande, avec une légère courbure et une inclinaison liée à la vitesse du scroll.

export type GLItem = {
  el: HTMLElement; // la bande dans le DOM (sert à lire la position)
  img: HTMLImageElement; // l'image source de la texture
  project: number; // index du projet
  index: number; // index de la bande dans le projet
};

export type FrameState = {
  appear: number; // 0 → 1 : les cartes apparaissent en cercle
  spread: number; // 0 → 1 : les cartes s'ouvrent en bandes
  shear: number; // inclinaison liée à la vitesse (≈ -1 → 1)
  bend: number; // courbure maximale en px
};

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform vec2 uViewport;
  uniform vec2 uSize;
  uniform float uBend;
  uniform float uShear;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);

    // Position horizontale normalisée : -1 (bord gauche) → 1 (bord droit).
    float nx = (world.x - uViewport.x * 0.5) / (uViewport.x * 0.5);

    // Courbure : les bords de l'écran descendent légèrement.
    world.y += nx * nx * uBend;

    // Inclinaison : les bandes se penchent quand on scrolle vite.
    world.y += position.x * uSize.x * uShear;

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform vec2 uSize;
  uniform vec2 uImage;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    // Équivalent de object-fit: cover.
    float planeRatio = uSize.x / uSize.y;
    float imageRatio = uImage.x / uImage.y;
    vec2 scale = vec2(1.0);
    if (planeRatio > imageRatio) {
      scale.y = imageRatio / planeRatio;
    } else {
      scale.x = planeRatio / imageRatio;
    }
    vec2 uv = (vUv - 0.5) * scale + 0.5;

    vec3 color = texture2D(tMap, uv).rgb;
    gl_FragColor = vec4(color * uOpacity, uOpacity);
  }
`;

type Entry = {
  item: GLItem;
  mesh: Mesh;
  program: Program;
  texture: Texture;
  loaded: number; // 0 → 1, fondu d'apparition de l'image
  ready: boolean;
};

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export class SliderGL {
  private renderer: Renderer;
  private gl: Renderer["gl"];
  private camera: Camera;
  private scene = new Transform();
  private entries: Entry[] = [];
  private width = 0;
  private height = 0;
  private projectCount = 1;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, items: GLItem[]) {
    this.renderer = new Renderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);

    this.camera = new Camera(this.gl);
    this.camera.position.z = 5;

    const geometry = new Plane(this.gl, { widthSegments: 16, heightSegments: 1 });
    this.projectCount = items.reduce((max, it) => Math.max(max, it.project + 1), 1);

    for (const item of items) {
      const texture = new Texture(this.gl, { generateMipmaps: true, flipY: false });
      const program = new Program(this.gl, {
        vertex,
        fragment,
        transparent: true,
        cullFace: false,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tMap: { value: texture },
          uViewport: { value: [1, 1] },
          uSize: { value: [1, 1] },
          uImage: { value: [1, 1] },
          uBend: { value: 0 },
          uShear: { value: 0 },
          uOpacity: { value: 0 },
        },
      });
      program.setBlendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

      const mesh = new Mesh(this.gl, { geometry, program });
      mesh.visible = false;
      mesh.setParent(this.scene);

      const entry: Entry = { item, mesh, program, texture, loaded: 0, ready: false };
      this.entries.push(entry);

      const upload = () => {
        if (this.destroyed || !item.img.naturalWidth) return;
        texture.image = item.img;
        program.uniforms.uImage.value = [item.img.naturalWidth, item.img.naturalHeight];
        entry.ready = true;
      };
      if (item.img.complete && item.img.naturalWidth) upload();
      else item.img.addEventListener("load", upload, { once: true });
    }

    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    // Axe Y vers le bas, comme le DOM.
    this.camera.orthographic({ left: 0, right: width, bottom: height, top: 0, near: 0.1, far: 100 });
  }

  // Nombre d'images dont la texture est prête (sert à attendre avant l'intro).
  get readyCount() {
    return this.entries.filter((e) => e.ready).length;
  }

  render(state: FrameState) {
    if (this.destroyed) return;
    const { width: W, height: H } = this;
    const n = this.projectCount;
    const stagger = 0.55;

    // Cercle d'intro : une carte par projet.
    const radius = Math.min(W, H) * 0.28;
    const cardW = clamp(Math.min(W, H) * 0.13, 70, 150);
    const cardH = cardW * 1.35;
    const cx = W / 2;
    const cy = H / 2;
    const ringTurn = (1 - easeOut(state.appear)) * 1.4 + state.spread * 0.6;
    const appearEase = easeOut(state.appear);
    const introDone = state.appear >= 1 && state.spread >= 1;

    for (const entry of this.entries) {
      const { item, mesh, program } = entry;
      const rect = item.el.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top + rect.height / 2;
      let w = rect.width;
      let h = rect.height;
      let rotation = 0;
      let opacity = 1;
      let bend = state.bend;

      if (!introDone) {
        const p = item.project;
        const t = easeInOut(
          clamp(state.spread * (1 + stagger) - stagger * (p / Math.max(1, n - 1))),
        );
        const angle = -Math.PI / 2 + (p / n) * Math.PI * 2 + ringTurn;
        const ringX = cx + Math.cos(angle) * radius;
        const ringY = cy + Math.sin(angle) * radius;
        const ringScale = lerp(0.6, 1, appearEase);

        x = lerp(ringX, x, t);
        y = lerp(ringY, y, t);
        w = lerp(cardW * ringScale, w, t);
        h = lerp(cardH * ringScale, h, t);
        rotation = lerp(angle + Math.PI / 2, 0, t);
        opacity = item.index === 0 ? appearEase : appearEase * smoothstep(0.05, 0.6, t);
        bend *= t;
      }

      // Hors écran : on ne dessine pas.
      const offscreen = x + w / 2 < -60 || x - w / 2 > W + 60;
      if (offscreen || !entry.ready || w < 1 || h < 1) {
        mesh.visible = false;
        continue;
      }

      entry.loaded = Math.min(1, entry.loaded + 0.05);
      mesh.visible = true;
      mesh.position.set(x, y, 0);
      mesh.scale.set(w, h, 1);
      mesh.rotation.z = rotation;

      const u = program.uniforms;
      u.uViewport.value = [W, H];
      u.uSize.value = [w, h];
      u.uBend.value = bend;
      u.uShear.value = state.shear * (introDone ? 1 : 0);
      u.uOpacity.value = opacity * easeOut(entry.loaded);
    }

    this.renderer.render({ scene: this.scene, camera: this.camera });
  }

  destroy() {
    this.destroyed = true;
    for (const entry of this.entries) {
      this.gl.deleteTexture(entry.texture.texture);
    }
    this.entries = [];
  }
}
