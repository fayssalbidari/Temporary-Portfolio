import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from "ogl";

// Rendu WebGL du slider.
// Principe : le slider reste du HTML (accessible, cliquable, SEO). Chaque bande a un <img>
// dans le DOM ; ici on dessine ces mêmes images sur un canvas plein écran, à la position
// exacte de la bande. Le même canvas sert au loader : pile de cartes (step 1), cercle de
// 10 cartes (step 2), puis envol des cartes vers leur bande dans le slider.

export type GLItem = {
  el: HTMLElement; // la bande dans le DOM (sert à lire la position)
  img: HTMLImageElement; // l'image source de la texture
  project: number; // index du projet
  index: number; // index de la bande dans le projet
};

export type FrameState = {
  appear: number; // 0 → 1 : la pile de cartes apparaît (step 1)
  expand: number; // 0 → 1 : la pile s'ouvre en cercle (step 2)
  fly: number; // 0 → 1 : les cartes rejoignent le slider
  unit: number; // échelle du Figma (1 à 1440 px de large)
  shear: number;
  bend: number;
};

// Cartes du loader (Figma) : 96 × 76 px.
const CARD_W = 96;
const CARD_H = 76;

// Position des 10 cartes du cercle (step 2), relative au centre de l'écran, en px Figma.
// L'ordre est aussi l'ordre d'empilement (la dernière est au-dessus).
const RING: [number, number][] = [
  [-80, -109],
  [-110, -64],
  [-115, -6],
  [-92, 45],
  [-49, 79],
  [4, 89],
  [60, 75],
  [100, 37],
  [117, -16],
  [108, -71],
];

// Pile de cartes (step 1) : 5 cartes décalées de 4 px en diagonale.
const stackOffset = (k: number) => 8 - 4 * Math.min(k, 4);

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

    float nx = (world.x - uViewport.x * 0.5) / (uViewport.x * 0.5);
    world.y += nx * nx * uBend;
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
  ringK: number; // position dans le cercle (-1 : cette bande ne fait pas partie du loader)
  order: number; // 0 → 1 : ordre gauche → droite, sert à décaler les départs
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
// Progression d'un élément parmi plusieurs, décalés les uns des autres.
const staggered = (progress: number, order: number, spread: number) =>
  clamp(progress * (1 + spread) - spread * order);

export class SliderGL {
  private renderer: Renderer;
  private gl: Renderer["gl"];
  private camera: Camera;
  private scene = new Transform();
  private entries: Entry[] = [];
  private width = 0;
  private height = 0;
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

      const entry: Entry = {
        item,
        mesh,
        program,
        texture,
        loaded: 0,
        ready: false,
        ringK: -1,
        order: 0,
      };
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

  // Choisit les bandes qui forment les 10 cartes du loader : celles visibles au départ,
  // réparties régulièrement. À appeler une fois la mise en page faite, avant l'intro.
  prepareIntro() {
    const W = window.innerWidth;
    const all = this.entries
      .map((entry) => {
        const rect = entry.item.el.getBoundingClientRect();
        return { entry, x: rect.left + rect.width / 2 };
      })
      .sort((a, b) => a.x - b.x);

    all.forEach(({ entry }, i) => {
      entry.order = all.length > 1 ? i / (all.length - 1) : 0;
      entry.ringK = -1;
    });

    const visible = all.filter(({ x }) => x > 0 && x < W);
    const count = Math.min(RING.length, visible.length);
    if (count === 0) return;

    // Positions du cercle triées de gauche à droite, réparties sur le nombre de cartes.
    const positions = RING.map((p, k) => ({ k, x: p[0] })).sort((a, b) => a.x - b.x);
    for (let i = 0; i < count; i++) {
      const pick = visible[Math.round((i * (visible.length - 1)) / Math.max(1, count - 1))];
      const position = positions[Math.round((i * (positions.length - 1)) / Math.max(1, count - 1))];
      pick.entry.ringK = position.k;
    }
  }

  render(state: FrameState) {
    if (this.destroyed) return;
    const { width: W, height: H } = this;
    const cx = W / 2;
    const cy = H / 2;
    const u = state.unit;
    const introDone = state.appear >= 1 && state.expand >= 1 && state.fly >= 1;

    for (const entry of this.entries) {
      const { item, mesh, program } = entry;
      const rect = item.el.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top + rect.height / 2;
      let w = rect.width;
      let h = rect.height;
      let opacity = 1;
      let order = 0;

      if (!introDone) {
        const flight = staggered(state.fly, entry.order, 0.55);
        const t = easeInOut(flight);

        if (entry.ringK >= 0) {
          const k = entry.ringK;
          order = k + 1;

          // Pile (step 1) → cercle (step 2) → bande du slider.
          const stackX = cx + stackOffset(k) * u;
          const stackY = cy + stackOffset(k) * u;
          const expand = easeInOut(staggered(state.expand, k / (RING.length - 1), 0.5));
          const ringX = cx + RING[k][0] * u;
          const ringY = cy + RING[k][1] * u;

          const cardX = lerp(stackX, ringX, expand);
          const cardY = lerp(stackY, ringY, expand);

          x = lerp(cardX, x, t);
          y = lerp(cardY, y, t);
          w = lerp(CARD_W * u, w, t);
          h = lerp(CARD_H * u, h, t);

          // Les 5 premières cartes forment la pile ; les autres sortent de la pile en s'ouvrant.
          opacity = k < 5 ? easeOut(state.appear) : smoothstep(0, 0.35, expand);
        } else {
          // Les autres bandes glissent légèrement et apparaissent derrière les cartes.
          opacity = smoothstep(0.05, 0.75, flight);
          x += (1 - t) * 40 * u;
        }
      }

      const offscreen = x + w / 2 < -60 || x - w / 2 > W + 60;
      if (offscreen || !entry.ready || w < 1 || h < 1 || opacity <= 0) {
        mesh.visible = false;
        continue;
      }

      entry.loaded = Math.min(1, entry.loaded + 0.05);
      mesh.visible = true;
      mesh.renderOrder = order;
      mesh.position.set(x, y, 0);
      mesh.scale.set(w, h, 1);

      const uniforms = program.uniforms;
      uniforms.uViewport.value = [W, H];
      uniforms.uSize.value = [w, h];
      uniforms.uBend.value = state.bend;
      uniforms.uShear.value = state.shear;
      uniforms.uOpacity.value = opacity * easeOut(entry.loaded);
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
