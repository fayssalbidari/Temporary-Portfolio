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
  appear: number; // 0 → 1 : les cartes apparaissent, empilées, avec un masque centre → bords (step 1)
  spread: number; // 0 → 1 : la pile se décale en diagonale (fin du step 1)
  expand: number; // 0 → 1 : la pile s'ouvre en cercle (step 2)
  spin: number; // 0 → 1 : le cercle tourne en ralentissant, jusqu'à sa position du Figma
  fly: number; // 0 → 1 : les cartes rejoignent le slider
  unit: number; // échelle du Figma (1 à 1440 px de large)
  shear: number;
  bend: number;
  dt: number; // durée de l'image précédente (s) : sert à mesurer la vitesse de chaque bande
  hoverEnabled: boolean; // le survol d'une bande l'agrandit (désactivé pendant l'intro et le glissé)
};

// Cartes du loader (Figma) : 96 × 76 px.
const CARD_W = 96;
const CARD_H = 76;

// Position des 12 cartes du cercle (step 2 du Figma), relative au centre de l'écran, en px Figma.
// L'ordre suit le cercle dans le sens horaire à partir du haut : c'est aussi l'ordre dans lequel
// les cartes quittent la pile (comme sur Madrepunk, elles se suivent le long du contour).
const RING: [number, number][] = [
  [-1, -140],
  [86, -121],
  [108, -71],
  [117, -16],
  [100, 37],
  [60, 75],
  [4, 89],
  [-49, 79],
  [-92, 45],
  [-115, -6],
  [-110, -64],
  [-80, -109],
];

// Angle parcouru par les cartes le long du contour du cercle (step 2).
// Agrandissement d'une bande au survol.
// Écart entre deux bandes voisines (largeur + espace, px Figma).
const pitch = 76;
const HOVER_SCALE = 0.04; // gain de hauteur (la largeur ne change pas)
// Effet « escalier » : les bandes voisines de la bande survolée grandissent moins, de plus
// en plus faiblement en s'éloignant (poids par nombre de bandes d'écart).
const HOVER_STEPS = [1, 0.5, 0.22, 0.08];
// Déformation au clic (px à 1440 px de large). Elle suit la vitesse de l'ouverture de la bande
// (même courbe que le CSS) : faible au début, maximale au milieu, puis elle retombe.
// Déformation au mouvement : chaque bande se courbe selon sa propre vitesse à l'écran
// (défilement, mais aussi décalage des projets quand l'un d'eux s'ouvre ou se ferme).
const WARP_GAIN = 0.0075;
const WARP_MAX = 22;
const PULSE_PX = 10;
const PULSE_OPEN = { ms: 900, curve: [0.77, 0, 0.175, 1] as const };
const PULSE_CLOSE = { ms: 750, curve: [0.55, 0, 0.2, 1] as const };

const SWEEP = 1.3;
// Rotation totale du cercle (en radians) avant qu'il se cale à sa position finale.
const SPIN = 3.4;

// Pile de cartes (step 1) : les cartes s'ajoutent en diagonale (vers le bas à droite), de 4 px en 4 px.
const STACK_CARDS = 6;
const stackOffset = (k: number) => -10 + 4 * Math.min(k, STACK_CARDS - 1);

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
  uniform float uWarp;
  varying vec2 vUv;
  varying vec2 vPos;

  void main() {
    vUv = uv;
    vPos = position.xy;
    vec4 world = modelMatrix * vec4(position, 1.0);

    float nx = (world.x - uViewport.x * 0.5) / (uViewport.x * 0.5);
    world.y += nx * nx * uBend;
    world.y += position.x * uSize.x * uShear;

    // Déformation au défilement : les extrémités de l'image (haut et bas) sont décalées
    // par rapport au centre, ce qui courbe les bords en arc. Elle suit la vitesse.
    float ny = position.y * 2.0;
    world.x += uWarp * ny * ny;

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform vec2 uSize;
  uniform vec2 uImage;
  uniform float uOpacity;
  uniform float uMaskC; // masque depuis le centre : 0 → 1
  uniform float uMaskB; // masque depuis le bas : 0 → 1
  varying vec2 vUv;
  varying vec2 vPos;

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

    // Masque centre → bords (rectangle) et masque bas → haut.
    float inCenter = step(abs(vPos.x), 0.5 * uMaskC) * step(abs(vPos.y), 0.5 * uMaskC);
    float inBottom = step(0.5 - uMaskB, vPos.y);
    if (inCenter * inBottom < 0.5) discard;

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
  hover: number; // 0 → 1 : survol de la bande, lissé
  pulseAt: number; // instant du dernier clic sur la bande (ms)
  pulseSign: number; // sens de la déformation au clic
  pulseClose: boolean; // fermeture seule (plus rapide) ou ouverture
  prevLeft: number | null; // position gauche de la bande à l'image précédente
  velocity: number; // vitesse horizontale lissée (px/s)
};

// Poids de l'effet escalier selon la distance (en nombre de bandes), interpolé entre les paliers.
const stepWeight = (distance: number) => {
  const i = Math.floor(distance);
  if (i >= HOVER_STEPS.length - 1) return 0;
  return lerp(HOVER_STEPS[i], HOVER_STEPS[i + 1], distance - i);
};

// Courbe de Bézier cubique (comme cubic-bezier() en CSS) : renvoie y pour un temps t entre 0 et 1.
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}

// Vitesse de la courbe (dérivée), ramenée à 1 au maximum : c'est la forme de la déformation.
function velocityProfile(curve: readonly [number, number, number, number]) {
  const ease = cubicBezier(...curve);
  const h = 0.02;
  const raw = (p: number) => {
    const a = Math.max(0, p - h);
    const b = Math.min(1, p + h);
    return (ease(b) - ease(a)) / (b - a);
  };
  let peak = 0;
  for (let i = 0; i <= 50; i++) peak = Math.max(peak, raw(i / 50));
  return (p: number) => raw(clamp(p)) / peak;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const openVelocity = velocityProfile(PULSE_OPEN.curve);
const closeVelocity = velocityProfile(PULSE_CLOSE.curve);
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
  // Envoi des textures au GPU, étalé sur plusieurs images : tout envoyer d'un coup fige la page.
  private uploadQueue: Array<{ entry: Entry; run: () => void }> = [];
  private frame = 0;
  private mobile = false;

  constructor(canvas: HTMLCanvasElement, items: GLItem[]) {
    // Sur mobile, un canvas plein écran en haute densité coûte cher : on limite la définition
    // et on coupe l'antialiasing (inutile à cette densité) pour garder 60 images par seconde.
    this.mobile = window.matchMedia("(max-width: 900px)").matches;
    this.renderer = new Renderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      antialias: !this.mobile,
      dpr: Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2),
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);

    this.camera = new Camera(this.gl);
    this.camera.position.z = 5;

    const geometry = new Plane(this.gl, { widthSegments: 1, heightSegments: 28 });

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
          uWarp: { value: 0 },
          uOpacity: { value: 0 },
          uMaskC: { value: 1 },
          uMaskB: { value: 1 },
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
        hover: 0,
        pulseAt: -1e9,
        pulseSign: 0,
        pulseClose: false,
        prevLeft: null,
        velocity: 0,
      };
      this.entries.push(entry);

      const upload = () => {
        if (this.destroyed || !item.img.naturalWidth) return;
        // On décode l'image avant de l'envoyer au GPU : sinon Safari la décode au moment de
        // l'envoi, sur le thread principal, et la page fige.
        const decoded = item.img.decode ? item.img.decode().catch(() => undefined) : Promise.resolve();
        void decoded.then(() => {
          if (this.destroyed || !item.img.naturalWidth) return;
          this.uploadQueue.push({
            entry,
            run: () => {
              if (this.destroyed || !item.img.naturalWidth) return;
              texture.image = item.img;
              program.uniforms.uImage.value = [item.img.naturalWidth, item.img.naturalHeight];
              entry.ready = true;
            },
          });
        });
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
    // Une texture par image au maximum (une image sur deux sur mobile), pour ne jamais bloquer le
    // thread principal. On envoie d'abord celles qui sont le plus près du centre de l'écran.
    this.frame++;
    if (this.uploadQueue.length > 0 && (!this.mobile || this.frame % 2 === 0)) {
      const queue = this.uploadQueue;
      let pick = 0;
      if (queue.length > 1) {
        const mid = window.innerWidth / 2;
        let best = Infinity;
        for (let i = 0; i < queue.length; i++) {
          const rect = queue[i].entry.item.el.getBoundingClientRect();
          const distance = Math.abs(rect.left + rect.width / 2 - mid);
          if (distance < best) {
            best = distance;
            pick = i;
          }
        }
      }
      queue.splice(pick, 1)[0].run();
    }
    if (this.destroyed) return;
    const { width: W, height: H } = this;
    const cx = W / 2;
    const cy = H / 2;
    const u = state.unit;
    const introDone =
      state.appear >= 1 &&
      state.spread >= 1 &&
      state.expand >= 1 &&
      state.spin >= 1 &&
      state.fly >= 1;

    // Bande actuellement survolée (son centre sert de repère pour l'effet escalier).
    let hoverX: number | null = null;
    if (introDone && state.hoverEnabled) {
      for (const entry of this.entries) {
        if (entry.item.el.dataset.open !== "true" && entry.item.el.matches(":hover")) {
          const rect = entry.item.el.getBoundingClientRect();
          hoverX = rect.left + rect.width / 2;
          break;
        }
      }
    }
    const now = performance.now();

    for (const entry of this.entries) {
      const { item, mesh, program } = entry;
      const rect = item.el.getBoundingClientRect();

      // Vitesse de la bande à l'écran (ignore les sauts du bouclage infini, hors écran).
      if (introDone && entry.prevLeft !== null && state.dt > 0) {
        const dx = rect.left - entry.prevLeft;
        const instant = Math.abs(dx) < 500 ? dx / state.dt : 0;
        entry.velocity += (instant - entry.velocity) * (1 - Math.pow(1 - 0.14, state.dt * 60));
      } else {
        entry.velocity = 0;
      }
      entry.prevLeft = rect.left;

      let x = rect.left + rect.width / 2;
      let y = rect.top + rect.height / 2;
      let w = rect.width;
      let h = rect.height;
      const opacity = 1;
      let order = 0;
      let maskC = 1;
      let maskB = 1;
      let rotation = 0;

      if (!introDone) {
        const flight = staggered(state.fly, entry.order, 0.6);
        const t = easeInOut(flight);

        if (entry.ringK >= 0) {
          const k = entry.ringK;
          order = k + 1;

          // Step 1 : les cartes se posent l'une après l'autre au centre (sans décalage), puis la
          // pile s'ouvre en diagonale.
          const spread = easeInOut(state.spread);
          const stackX = stackOffset(k) * spread * u;
          const stackY = stackOffset(k) * spread * u;

          // Step 2 : les cartes quittent la pile l'une après l'autre et glissent le long du
          // contour du cercle (toujours droites) jusqu'à leur place.
          const order2 = k / (RING.length - 1);
          const w2 = easeInOut(staggered(state.expand, order2, 0.9));
          const ringRadius = Math.hypot(RING[k][0], RING[k][1]) * u;
          const ringAngle = Math.atan2(RING[k][1], RING[k][0]);
          const angle = ringAngle - SPIN * (1 - state.spin) - SWEEP * (1 - w2);
          const cardX = cx + stackX * (1 - w2) + Math.cos(angle) * ringRadius * w2;
          const cardY = cy + stackY * (1 - w2) + Math.sin(angle) * ringRadius * w2;

          x = lerp(cardX, x, t);
          y = lerp(cardY, y, t);
          w = lerp(CARD_W * u, w, t);
          h = lerp(CARD_H * u, h, t);

          // Légère inclinaison de chaque carte (comme sur Madrepunk), qui se redresse en arrivant.
          rotation = Math.sin(k * 2.3 + 1) * 0.09 * (1 - t);

          // Les premières cartes forment la pile (masque depuis le centre, une par une) ;
          // les suivantes sortent de la pile au début du step 2.
          maskC =
            k < STACK_CARDS
              ? easeOut(staggered(state.appear, k / (STACK_CARDS - 1), 1.6))
              : easeOut(smoothstep(0, 0.2, state.expand));
        } else {
          // Les autres bandes se construisent du bas vers le haut, de gauche à droite.
          maskB = easeInOut(clamp((flight - 0.25) / 0.75));
        }
      }

      // Survol en escalier : la bande survolée grandit le plus, ses voisines un peu moins.
      const weight =
        introDone && hoverX !== null
          ? stepWeight(Math.abs(rect.left + rect.width / 2 - hoverX) / (pitch * u))
          : 0;
      const target = item.el.dataset.open === "true" ? 0 : weight;
      entry.hover += (target - entry.hover) * 0.14;
      if (entry.hover < 0.001) entry.hover = 0;
      if (entry.hover > 0) {
        // Seule la hauteur augmente (autour du centre de la bande).
        h *= 1 + HOVER_SCALE * easeOut(entry.hover);
        order = 40 + Math.round(entry.hover * 10);
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
      mesh.rotation.z = rotation;

      const uniforms = program.uniforms;
      uniforms.uViewport.value = [W, H];
      uniforms.uSize.value = [w, h];
      uniforms.uBend.value = state.bend;
      uniforms.uShear.value = state.shear;
      // Au clic : impulsion de déformation, en cloche, comme au scroll.
      const pulseSpec = entry.pulseClose ? PULSE_CLOSE : PULSE_OPEN;
      const pulseProgress = (now - entry.pulseAt) / pulseSpec.ms;
      const pulse =
        pulseProgress >= 0 && pulseProgress < 1
          ? entry.pulseSign *
            PULSE_PX *
            u *
            (entry.pulseClose ? closeVelocity : openVelocity)(pulseProgress)
          : 0;
      // Les extrémités traînent derrière le centre : elles vont à l'opposé du mouvement.
      const maxWarp = WARP_MAX * u;
      const warp = clamp(-entry.velocity * WARP_GAIN * u, -maxWarp, maxWarp);
      uniforms.uWarp.value = introDone ? warp + pulse : 0;
      uniforms.uMaskC.value = maskC;
      uniforms.uMaskB.value = maskB;
      uniforms.uOpacity.value = opacity * easeOut(entry.loaded);
    }

    this.renderer.render({ scene: this.scene, camera: this.camera });
  }

  // Déclenche la déformation d'une bande (au clic). sign : -1 à l'ouverture, +1 à la fermeture ; close : fermeture seule (plus rapide).
  pulse(project: number, index: number, sign: number, close = false) {
    const entry = this.entries.find(
      (e) => e.item.project === project && e.item.index === index,
    );
    if (!entry) return;
    entry.pulseAt = performance.now();
    entry.pulseSign = sign;
    entry.pulseClose = close;
  }

  destroy() {
    this.destroyed = true;
    for (const entry of this.entries) {
      this.gl.deleteTexture(entry.texture.texture);
    }
    this.entries = [];
  }
}
