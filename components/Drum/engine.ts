import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform, Triangle } from "ogl";

// La chute. Défiler fait tomber la caméra : les projets sont des feuilles de papier (l'image
// seule) qui flottent dans l'espace et remontent devant nous. Elles se courbent vraiment, comme
// une feuille autour d'un cylindre : en vol, en diagonale ; posées, elles respirent à peine.
// Les titres forment deux marquees courbés (vue de l'intérieur d'un tambour) : en défilant,
// la ligne du haut part à gauche, celle du bas à droite.
//
// L'ouverture d'un projet est une séquence :
// 1. la feuille se soulève vers nous, à peine ;
// 2. elle vole jusqu'à sa place de slide, flotte et se pose comme une feuille, pendant que,
//    derrière elle, son image s'étale en peinture et sèche en noir ;
// 3. un paysage de montagnes en fil de fer se lève, et les autres feuilles du projet sortent
//    de la profondeur pour former le slider.
// La fermeture joue la même séquence à l'envers.

export type DrumProject = {
  title: string;
  type: string;
  images: string[];
};

type Strip = { texture: Texture; width: number; text: number; lead: number };
type Pic = { texture: Texture; w: number; h: number; ready: boolean };
type Kind = "main" | "section" | "slide";
type Pose = { x: number; y: number; z: number; w: number; rx: number; ry: number; rz: number; curl: number; angle: number };
type Hit = { image: number; x0: number; y0: number; x1: number; y1: number; order: number };
type Paper = {
  kind: Kind;
  mesh: Mesh;
  program: Program;
  project: number;
  image: number; // -1 : la feuille principale (l'image retenue du projet)
  front: boolean; // devant les titres (sinon derrière)
  offset: number; // place dans la chute, en projets
  side: number;
  x: number;
  z: number;
  size: number;
  spin: [number, number, number];
  phase: number;
  y: number; // place au repos (sections), px à 1440
  pose?: Pose;
  hover?: number;
};

// Mesures à 1440 px de large (multipliées par l'unité u = largeur / 1440).
export const CAP = 240;
export const PITCH = 278;
// Colonnes de la grille (12 colonnes, marges 48, gouttières 24) : le début du titre se cale sur
// la colonne 1, sa fin sur la colonne 12.
export const MARGIN = 48;
// La feuille au repos fait 4 colonnes (colonnes 5 à 8) ; ouverte, une image fait 8 colonnes
// (colonnes 3 à 10), séparées par une gouttière.
export const PIC_W = 4 * 90 + 3 * 24;
export const PIC_RATIO = 0.64;
export const COL = 90;
export const GUTTER = 24;
// Projet ouvert : un ruban sans fin de sections, toutes à la même taille (5 colonnes), posées
// à l'intérieur d'un grand tambour comme les titres. On le fait défiler librement.
const RIBBON_W = 5 * COL + 4 * GUTTER;
const RIBBON_R = 1500;
const DRIFT = 0.05; // dérive lente du ruban au repos (sections / s)
const wrap = (v: number, l: number) => (((v + l / 2) % l) + l) % l - l / 2;

const BEND = 0.42;
const BEND_SPEED = 0.06;
const BEND_MAX = 0.2;
const WHEEL = 1 / 700;
const FOLLOW_DRAG = 14;
const IDLE_MS = 220; // fin du geste (laisse finir l'inertie du pavé)
const NUDGE = 0.18;
const DETENT = 0.4; // force des crans pendant le défilement libre (0 = aucun, 1 = marches) // un petit geste volontaire avance quand même d'un projet
// La chute suit le geste avec un ressort amorti (pas d'à-coup de vitesse). Une fois le geste
// fini, l'aimant vers le projet le plus proche est plus doux, et garde l'élan du geste.
const SPRING_INPUT = 8.5;
const SPRING_DRAG = 16;
const SPRING_SNAP = 7;
const SNAP_DAMP = 1.12; // un peu plus qu'amorti : l'aimant pose sans rebondir ni tirer en arrière
const COAST = 0.24; // où l'élan aurait mené (s) : c'est ce projet-là qu'on vise
const FOV = 30;
export const FALL = 1.6; // distance entre deux projets dans la chute (en hauteurs d'écran)
// Les sections du site flottent autour de la feuille : place (px depuis le centre, y vers le haut),
// profondeur, taille (part de la feuille), devant ou derrière les titres.
// Deux seulement, dans les coins vides : une devant les titres en haut à gauche, une derrière
// en bas à droite. Les autres sections se voient à l'ouverture.
const SECTIONS = [
  { x: -500, y: 215, z: 60, s: 0.36, front: true },
  { x: 520, y: -200, z: -520, s: 0.46, front: false },
];
// Liquide : commence au-delà d'un pas normal (~2,5 projets/s), plein vers 6.
const LIQUID_ON = 2.6;
const LIQUID_FULL = 6;
// Page À propos : le portrait sur les colonnes 1–4, sous l'en-tête.
const PORTRAIT_W = 4 * COL + 3 * GUTTER;
const PORTRAIT_RATIO = 1.36;
const PORTRAIT_TOP = 150;
// Vitesse de chaque colonne de la grille pendant la chute (1 = la vitesse des feuilles).
const PARALLAX = [1.55, 1.3, 1.1, 0.92, 0.76, 0.62, 0.62, 0.76, 0.92, 1.1, 1.3, 1.55];
const OPEN_S = 1.7; // durée de la séquence d'ouverture
const CLOSE_S = 1.1;

const RED = [196 / 255, 22 / 255, 28 / 255];
const CLEAN = [245 / 255, 244 / 255, 241 / 255];
const INK = [23 / 255, 9 / 255, 9 / 255];
const BLACK = [32 / 255, 32 / 255, 32 / 255]; // #202020, le noir neutre du site (projet ouvert, préchargement)
const EMPTY = [0.9, 0.89, 0.87];

const mod = (k: number, n: number) => ((k % n) + n) % n;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const ramp = (a: number, b: number, v: number) => clamp((v - a) / (b - a), 0, 1);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2);
const easeInCubic = (t: number) => t ** 3;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// La couleur d'un projet : la teinte vive la plus présente dans son image, rendue assez
// sombre et saturée pour tenir sur le papier clair. Image sans couleur : l'encre.
function dominantColor(img: HTMLImageElement): number[] {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, 48, 48);
    const d = ctx.getImageData(0, 0, 48, 48).data;
    const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255;
      const g = d[i + 1] / 255;
      const b = d[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max > 0 ? (max - min) / max : 0;
      if (sat < 0.35 || max < 0.25) continue;
      let h = 0;
      if (max === r) h = ((g - b) / (max - min) + 6) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      const bin = bins[Math.floor((h / 6) * 24) % 24];
      // Les teintes claires (jaunes, cyans) tiennent mal sur le papier : elles comptent moins.
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const w = sat * sat * max * (1 - lum) * (1 - lum);
      bin.w += w;
      bin.r += r * w;
      bin.g += g * w;
      bin.b += b * w;
    }
    // Le jaune assombri vire au kaki : on prend la teinte suivante quand il y en a une.
    const ranked = bins.map((b, i) => ({ ...b, i })).sort((a, b) => b.w - a.w);
    const best = ranked.find((b) => (b.i < 3 || b.i > 4) && b.w >= 0.8) ?? ranked[0];
    if (best.w < 0.8) return INK;
    const rgb = [best.r / best.w, best.g / best.w, best.b / best.w];
    // En HSL : saturation forte, clarté bornée pour le contraste sur le fond clair.
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    const l = (max + min) / 2;
    const target = clamp(l, 0.32, 0.46);
    const mid = (max + min) / 2;
    const out = rgb.map((v) => clamp(target + ((v - mid) / Math.max(max - min, 1e-3)) * Math.min(target, 1 - target) * 1.9, 0, 1));
    // Contraste minimal sur le fond clair : on assombrit ce qui reste trop lumineux.
    const y = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
    return y > 0.38 ? out.map((v) => v * (0.38 / y)) : out;
  } catch {
    return RED;
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const band = (a: number, b: number, v: number) => smooth(clamp((v - a) / (b - a), 0, 1));
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const fullscreenVertex = /* glsl */ `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Bruit partagé par la peinture et les montagnes.
const NOISE = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
`;

// ---------- les titres : deux marquees courbés ----------

function textFragment(n: number) {
  const samplers = Array.from({ length: n }, (_, i) => `uniform sampler2D uT${i};`).join("\n");
  const pick = Array.from(
    { length: n },
    (_, i) => `${i === 0 ? "" : "else "}if (i == ${i}) return textureGrad(uT${i}, uv, gx, gy).a;`,
  ).join("\n  ");
  return /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;

#define N ${n}
${samplers}
uniform float uW[N];
uniform float uSA[N];
uniform float uSB[N];
uniform float uL;
uniform float uXA;
uniform float uXB;
uniform vec2 uRes;
uniform float uPitch;
uniform float uBend;
uniform float uCx;
uniform float uReveal;
uniform float uOpen;
uniform vec3 uRed;
// Défilement fort : les titres deviennent liquides (ondulation, traînée visqueuse), puis se calment.
uniform float uLiquid;
uniform float uDir;
uniform float uTime;
${NOISE}

float sampleTitle(int i, vec2 uv, vec2 gx, vec2 gy) {
  ${pick}
  return 0.0;
}

// Une ligne : le marquee de tous les titres, bout à bout, qui se répète à l'infini.
float row(float X, float y, float starts[N], vec2 dX, vec2 dY) {
  X = mod(X, uL);
  for (int i = 0; i < N; i++) {
    if (X >= starts[i] && X < starts[i] + uW[i]) {
      vec2 k = vec2(1.0 / uW[i], 1.0 / uPitch);
      return sampleTitle(i, vec2((X - starts[i]) / uW[i], y / uPitch), dX * k, dY * k);
    }
  }
  return 0.0;
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float u = (p.x - uCx) / (uRes.x * 0.5);
  float s = 1.0 - uBend * (1.0 - u * u);
  float yf = (p.y - uRes.y * 0.5) / s;
  // Dérivées prises avant tout branchement : sinon les sauts entre titres et entre lignes
  // font choisir le mauvais niveau de mipmap (pointillés).
  vec2 dX = vec2(dFdx(p.x), dFdx(yf));
  vec2 dY = vec2(dFdy(p.x), dFdy(yf));

  // Projet ouvert : les deux lignes sortent complètement de l'écran, en haut et en bas.
  float o = uOpen * (uRes.y * 0.5 + uPitch) / max(s, 0.5);
  float h = uPitch * uReveal;
  float aa = 1.0 / s;
  float x = p.x - uRes.x * 0.5;
  // Liquide : la lettre ondule comme vue à travers l'eau, et son ventre traîne derrière le geste.
  float L = uLiquid;
  vec2 wv = vec2(0.0);
  if (L > 0.001) {
    wv.x = sin(yf * 0.028 + uTime * 5.5 + p.x * 0.004) * L * uPitch * 0.14
      + (noise(vec2(p.x * 0.0025, yf * 0.006 + uTime * 0.7)) - 0.5) * L * uPitch * 0.6;
    wv.y = sin(p.x * 0.011 - uTime * 4.5) * L * uPitch * 0.045;
  }

  float a = 0.0;
  if (yf < 0.0) {
    float l = yf + o;
    float win = smoothstep(-h - aa, -h + aa, l) * (1.0 - smoothstep(-aa, aa, l));
    float bow = uDir * L * uPitch * 0.4 * sin(3.14159 * clamp((l + uPitch) / uPitch, 0.0, 1.0));
    if (win > 0.0) a = row(x + uXA + wv.x - bow, l + uPitch + wv.y, uSA, dX, dY) * win;
  } else {
    float l = yf - o;
    float win = smoothstep(-aa, aa, l) * (1.0 - smoothstep(h - aa, h + aa, l));
    float bow = -uDir * L * uPitch * 0.4 * sin(3.14159 * clamp(l / uPitch, 0.0, 1.0));
    if (win > 0.0) a = row(x + uXB + wv.x - bow, l + wv.y, uSB, dX, dY) * win;
  }
  color = vec4(uRed * a, a);
}
`;
}

// ---------- la grille : la paroi du puits ----------

// Les 12 colonnes, coupées toutes les 6 modules, chacune à sa vitesse (parallaxe). En tombant,
// les coupes filent en traînées, les colonnes prennent la couleur du projet, et le centre de
// l'écran s'assombrit comme le fond d'un trou ; à l'arrêt, tout revient au papier.
const gridFragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;
uniform vec2 uRes;
uniform float uM;
uniform float uCol;
uniform float uGut;
uniform float uFall;
uniform float uK[12];
uniform float uDepth;   // 0 au repos, 1 en pleine chute
uniform float uShow;    // touche G
uniform float uOpen;    // projet ouvert : la grille s'efface sous la peinture
uniform float uIntro[12];
uniform vec3 uTint;
uniform vec3 uBg;
uniform vec3 uInk;
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float pitch = uCol + uGut;
  float t = (p.x - uM) / pitch;
  int i = int(clamp(floor(t), 0.0, 11.0));
  float fx = (t - floor(t)) * pitch;
  float inCol = step(0.0, t) * step(t, 12.0) * smoothstep(-0.5, 0.5, fx) * (1.0 - smoothstep(uCol - 0.5, uCol + 0.5, fx));

  // Les coupes : une gouttière toutes les 6 modules, étirée en traînée par la vitesse.
  float run = 6.0 * pitch;
  float yy = mod(p.y - uFall * uK[i] - float(i) * 53.0, run);
  float soft = 0.5 + uDepth * 90.0 * uK[i];
  float cut = smoothstep(run - uGut - soft, run - uGut + soft, yy) * (1.0 - smoothstep(run - soft, run + soft, yy))
    + (1.0 - smoothstep(-soft, soft, yy)) * step(yy, soft);
  // Au repos : des colonnes pleines, rien d'autre. Les coupes n'apparaissent qu'en tombant.
  float field = inCol * (1.0 - clamp(cut, 0.0, 1.0) * smoothstep(0.0, 0.35, uDepth)) * step(p.y, uIntro[i] * uRes.y);

  // Le trou : plus on tombe vite, plus le centre se creuse dans l'ombre.
  vec2 q = (p - uRes * 0.5) / uRes.y;
  float hole = uDepth * (1.0 - smoothstep(0.05, 0.85, length(q * vec2(0.8, 1.0))));
  vec3 bg = mix(uBg, mix(uBg, uTint, 0.12), uDepth);
  // L'ombre du trou est celle du projet : sa couleur, très sombre, jamais un gris.
  bg = mix(bg, mix(uInk, uTint * 0.45, 0.6), hole * 0.3);
  vec3 col = mix(uInk, uTint, uDepth);
  // Au repos, à peine là : une ambiance, pas un quadrillage.
  float a = mix(0.018, 0.12, uDepth) * uShow * (1.0 - uOpen);
  color = vec4(mix(bg, col, field * a), 1.0);
}
`;

// ---------- les feuilles : une vraie courbure de papier ----------

const paperVertex = /* glsl */ `#version 300 es
in vec3 position;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uSize;      // taille de la feuille (px)
uniform float uCurl;     // -1 … 1 : la feuille s'enroule jusqu'à un quart de cylindre à ses bords
uniform float uAngle;    // direction de l'enroulement
uniform float uFlutter;  // ondulation en vol (px)
uniform float uTime;
uniform float uPhase;
out vec2 vUv;
out float vShade;
void main() {
  vUv = uv;
  vec2 px = position.xy * uSize;
  float z = 0.0;
  vec2 dir = vec2(cos(uAngle), sin(uAngle));
  float s = dot(px, dir);
  // Demi-étendue de la feuille dans la direction de l'enroulement.
  float halfLen = dot(abs(dir), uSize * 0.5) + 1.0;
  float k = uCurl * 1.5707963 / halfLen;
  float phi = s * k;
  if (abs(k) > 1e-6) {
    float r = 1.0 / k;
    px += dir * (r * sin(phi) - s);
    z += r * (1.0 - cos(phi));
  }
  // Ondulation qui traverse la feuille, perpendiculaire à l'enroulement.
  vec2 perp = vec2(-dir.y, dir.x);
  float t = dot(position.xy * uSize, perp) / (dot(abs(perp), uSize * 0.5) + 1.0);
  z += sin(t * 2.2 + uTime * 2.4 + uPhase) * uFlutter * (0.4 + 0.6 * abs(t));
  vShade = sin(phi);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(px / uSize, z, 1.0);
}
`;

const paperFragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in float vShade;
out vec4 color;
uniform sampler2D tMap;
uniform vec2 uSize;
uniform vec2 uImage;
uniform float uReady;
uniform float uOpacity;
uniform float uDim;      // 0 : pleine lumière, 1 : la feuille se fond dans le fond
uniform vec3 uGround;
uniform vec3 uEmpty;
uniform sampler2D tBack;  // le verso (le portrait, pour la page À propos)
uniform vec2 uBackImage;
uniform float uHasBack;
vec2 cover(vec2 img) {
  float rb = uSize.x / uSize.y;
  float ri = img.x / img.y;
  vec2 sc = vec2(1.0);
  if (rb > ri) sc.y = ri / rb; else sc.x = rb / ri;
  return sc;
}
void main() {
  bool back = !gl_FrontFacing && uHasBack > 0.5;
  vec2 st = vec2(back ? 1.0 - vUv.x : vUv.x, 1.0 - vUv.y);
  vec2 uv = (st - 0.5) * cover(back ? uBackImage : uImage) + 0.5;
  vec3 c = back ? texture(tBack, uv).rgb : uReady > 0.5 ? texture(tMap, uv).rgb : uEmpty;
  // La lumière glisse sur la courbure : le pli s'assombrit, le dos de la feuille aussi.
  c *= 1.0 - 0.22 * vShade * vShade + 0.05 * vShade;
  if (!gl_FrontFacing && !back) c *= 0.72;
  c = mix(c, uGround, uDim * 0.6);
  color = vec4(c * uOpacity, uOpacity);
}
`;

// ---------- l'éclat de peinture : l'image s'étale et l'écran devient noir ----------

const paintFragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;
uniform sampler2D tMap;
uniform vec2 uImage;
uniform vec2 uRes;
uniform vec4 uRect;   // la feuille à l'écran : centre x, y, demi-largeur, demi-hauteur
uniform float uInk;   // 0 → 1
uniform float uTime;
uniform vec3 uBlack;
uniform vec3 uTint;
${NOISE}
void main() {
  if (uInk <= 0.0) { color = vec4(0.0); return; }
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 q = (p - uRect.xy) / uRect.zw;
  float n = fbm(p * 0.0045 + uTime * 0.04);
  float n2 = fbm(p * 0.018 - uTime * 0.07);
  // Distance au bord de la feuille, qui devient une tache aux bords irréguliers.
  float boxD = max(abs(q.x), abs(q.y));
  float d = mix(boxD, length(q) * 0.82, smoothstep(0.0, 0.5, uInk)) + (n - 0.5) * 1.1 * uInk + (n2 - 0.5) * 0.25;
  float far = length(uRes) / min(uRect.z, uRect.w);
  float reach = mix(0.6, far * 1.1, pow(uInk, 1.6));
  float mask = 1.0 - smoothstep(reach - 0.12, reach + 0.12, d);
  // La couleur : celle du projet, une encre qui varie à peine (jamais une copie de l'image).
  vec3 paint = uTint * (0.78 + 0.4 * n2) * (0.85 + 0.3 * n);
  // Derrière le front de la tache, la peinture sèche en noir ; tout finit noir.
  float front = smoothstep(reach - 1.4, reach - 0.05, d);
  float dark = max(smoothstep(0.45, 0.95, uInk), (1.0 - front) * smoothstep(0.15, 0.55, uInk));
  vec3 c = mix(paint, uBlack, dark);
  color = vec4(c * mask, mask);
}
`;

// ---------- le ciel du paysage : du noir, neutre ----------

// Rien qu'un souffle de gris à l'horizon, pour que les crêtes se détachent du noir.
const skyFragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;
uniform float uAlpha;
uniform float uLight;
uniform float uHorizon;  // hauteur de l'horizon à l'écran (0–1, depuis le haut)
uniform vec3 uBlack;
void main() {
  float y = 1.0 - vUv.y;
  float up = clamp((uHorizon - y) / uHorizon, 0.0, 1.0);
  vec3 c = mix(vec3(0.055) * (0.8 + 0.2 * uLight), uBlack, pow(up, 0.6));
  color = vec4(c * uAlpha, uAlpha);
}
`;

// ---------- le paysage : montagnes en fil de fer ----------

// Le paysage. Fait pour être calme : le relief est fixe (rien ne glisse sous le maillage, donc
// rien ne « bouillonne ») et c'est la caméra qui dérive lentement. Deux échelles seulement :
// des collines douces devant, une grande chaîne au fond, aux crêtes larges (pas d'aiguilles).
const mountainVertex = /* glsl */ `#version 300 es
in vec3 position;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform float uRise;
uniform float uSeed;
out vec2 vGrid;
out float vDepth;
out vec3 vNormal;
${NOISE}
// Crête arrondie : 1 - |bruit| au carré, sur 3 octaves qui s'atténuent vite.
float ridge(vec2 p) {
  float h = 0.0;
  float a = 0.62;
  for (int i = 0; i < 3; i++) {
    float r = 1.0 - abs(noise(p) * 2.0 - 1.0);
    h += a * r * r;
    p = p * 2.0 + 5.17;
    a *= 0.32;
  }
  return h;
}
float heightAt(vec2 w) {
  vec2 o = vec2(uSeed * 3.1, uSeed * 1.7);
  // Une vallée dégagée au centre, sous le ruban.
  float valley = mix(0.12, 1.0, smoothstep(300.0, 2400.0, abs(w.x)));
  float near = ridge(w * 0.00045 + o) * 700.0 * valley;
  float range = ridge(w * 0.00022 + o + 11.0) * 2600.0 * smoothstep(-2500.0, -6500.0, w.y);
  return (near * smoothstep(400.0, -1800.0, w.y) + range) * uRise;
}
void main() {
  vec2 world = position.xy * 10000.0 - vec2(0.0, 3000.0);
  float h = heightAt(world);
  float e = 40.0;
  float hx = heightAt(world + vec2(e, 0.0)) - heightAt(world - vec2(e, 0.0));
  float hz = heightAt(world + vec2(0.0, e)) - heightAt(world - vec2(0.0, e));
  vNormal = normalize(normalMatrix * normalize(vec3(-hx, 2.0 * e, -hz)));
  vec3 p = vec3(world.x, h - 520.0, world.y);
  // La grille suit le sol (une case = 4 mailles du maillage) : les traits épousent le relief.
  vGrid = world / 166.6667;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

// Fil de fer « vue technique » : faces noires (les lignes cachées restent cachées), quadrillage
// anti-crénelé d'épaisseur constante. Quand les traits deviennent plus serrés que les pixels,
// ils s'effacent au lieu de grésiller (c'est ce qui faisait « glitcher » le lointain).
const mountainFragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vGrid;
in float vDepth;
in vec3 vNormal;
out vec4 color;
uniform float uAlpha;
uniform float uLight;
uniform vec3 uBlack;
float grid(vec2 g) {
  vec2 w = fwidth(g);
  vec2 d = abs(fract(g - 0.5) - 0.5) / max(w, 1e-5);
  float line = 1.0 - min(min(d.x, d.y), 1.0);
  // Densité : au-delà d'environ une case pour 4 px, le trait s'efface.
  float dense = smoothstep(0.12, 0.28, max(w.x, w.y));
  return line * (1.0 - dense);
}
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, normalize(vec3(-0.5, 0.65, 0.4))), 0.0);
  float lines = grid(vGrid);
  // Les arêtes vives se lisent un peu plus : le relief se dessine sans éclairage.
  float slope = 1.0 - n.y;
  float near = 1.0 - smoothstep(3000.0, 11000.0, vDepth);
  float ink = lines * near * (0.07 + 0.08 * diff + 0.07 * slope) * uLight;
  vec3 c = uBlack + vec3(ink);
  color = vec4(c * uAlpha, uAlpha);
}
`;

export type DrumEvents = {
  onChange: (i: number) => void;
  onSlide: (i: number) => void;
  onMoving: (moving: boolean) => void;
  onOpen: (open: boolean) => void;
  onFrame: (pos: number, open: number) => void;
  // Préchargement : avancée du chargement (0 → 1), puis la fin de l'entrée dans la Home.
  onBoot?: (progress: number) => void;
};

export class DrumGL {
  private renderer: Renderer;
  private gl: Renderer["gl"];
  private camera: Camera;
  private landCamera: Camera;
  private textProgram: Program;
  private gridProgram: Program;
  private skyProgram: Program;
  private skyMesh: Mesh;
  private light = 1;
  private yaw = 0;
  private hoverSlide = -1;
  // Page À propos : la feuille se retourne et devient le portrait.
  private aboutOn = false;
  private aboutClock = 0; // > 0 tant qu'À propos est affiché ou en transition
  private aboutT = 1; // avancée du mouvement en cours (entrée ou sortie), 0 → 1
  private aboutIn = false; // sens du mouvement en cours
  private portrait: Pic | null = null;
  private gridMesh: Mesh;
  private depth = 0;
  private showGrid = 1;
  private gridOn = true;
  private textMesh: Mesh;
  private paintProgram: Program;
  private paintMesh: Mesh;
  private mountainProgram: Program;
  private mountains: Mesh;
  private land = new Transform();
  private back = new Transform();
  private front = new Transform();
  private stage = new Transform(); // le slider ouvert, au-dessus de la peinture
  private papers: Paper[] = [];
  private strips: Strip[] = [];
  private pics = new Map<string, Pic>();
  private blank: Texture;
  private projects: DrumProject[];
  private n: number;
  private W = 1;
  private H = 1;
  private u = 1;
  private raf = 0;
  private last = 0;
  private t = 0;
  private destroyed = false;

  private startsA: number[] = [];
  private startsB: number[] = [];
  private loop = 1;

  private pos = -0.6; // départ au-dessus du premier projet : on tombe dessus à l'ouverture
  private target = 0;
  private velocity = 0;
  private posVel = 0;
  private intent = 0; // le geste de molette accumulé, en projets
  private wheeling = false;
  private settling = false;
  // Mise au point (console) : la vitesse maximale atteinte.
  peak = 0;
  private liquid = 0;
  private dir = 1;
  private colors: number[][] = [];
  private dragging = false;
  private dragY = 0;
  private dragStart = 0;
  private dragMoved = 0;
  private lastInput = -1e9;
  private gestureStart: number | null = null;
  private gestureDir = 0;
  private mouseX = 0.5;
  private cx = 0.5;
  private mouseY = 0.5;
  private cy = 0.5;
  private revealStart = 0;
  private current = -1;
  private moving = false;
  private hovered = false;
  private lift = 0;
  private hoverSection = -1;
  private from: Pose | null = null; // d'où part la feuille qui devient la section au centre
  private fromSection = false;
  private paintImage = -1;
  private sectionHits: Hit[] = [];
  private slideHits: Hit[] = [];

  private opened = false;
  private clock = 0; // 0 → 1 : la séquence d'ouverture
  private slidePos = 0;
  private slideTarget = 0;
  private slideVel = 0;
  private slideGesture: number | null = null;
  private slideDir = 0;
  private anchor = 0; // l'image de la feuille cliquée
  private anchorK = 0; // sa feuille dans le ruban
  private slideShown = -1;
  private fly = 0;

  private picIndex: number[];
  private ev: DrumEvents;

  // Préchargement (l'affiche rouge, en HTML, par-dessus) : la Home attend dessous, la première
  // feuille déjà posée à sa place, les titres pas encore entrés. reveal() lance leur entrée au
  // moment où l'affiche se découpe en bandes et s'en va.
  private booting = false;
  private bootNeed = new Set<string>();

  constructor(canvas: HTMLCanvasElement, projects: DrumProject[], events: DrumEvents, boot = false) {
    this.projects = projects;
    this.n = projects.length;
    this.picIndex = projects.map(() => 0);
    this.ev = events;

    this.renderer = new Renderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.camera = new Camera(this.gl, { fov: FOV, near: 10, far: 20000 });
    this.landCamera = new Camera(this.gl, { fov: 50, near: 10, far: 20000 });
    this.blank = new Texture(this.gl);

    const textUniforms: Record<string, { value: unknown }> = {
      uW: { value: projects.map(() => 1) },
      uSA: { value: projects.map(() => 0) },
      uSB: { value: projects.map(() => 0) },
      uL: { value: 1 },
      uXA: { value: 0 },
      uXB: { value: 0 },
      uRes: { value: [1, 1] },
      uPitch: { value: PITCH },
      uBend: { value: BEND },
      uCx: { value: 0 },
      uReveal: { value: 0 },
      uOpen: { value: 0 },
      uRed: { value: RED },
      uLiquid: { value: 0 },
      uDir: { value: 1 },
      uTime: { value: 0 },
    };
    projects.forEach((_, i) => (textUniforms[`uT${i}`] = { value: this.blank }));
    const triangle = new Triangle(this.gl);
    this.textProgram = this.overlay(textFragment(this.n), textUniforms);
    this.textMesh = new Mesh(this.gl, { geometry: triangle, program: this.textProgram });

    this.gridProgram = this.overlay(gridFragment, {
      uRes: { value: [1, 1] },
      uM: { value: MARGIN },
      uCol: { value: COL },
      uGut: { value: GUTTER },
      uFall: { value: 0 },
      uK: { value: PARALLAX },
      uDepth: { value: 0 },
      uShow: { value: 1 },
      uOpen: { value: 0 },
      uIntro: { value: new Array(12).fill(0) },
      uTint: { value: RED },
      uBg: { value: CLEAN },
      uInk: { value: INK },
    });
    this.gridMesh = new Mesh(this.gl, { geometry: triangle, program: this.gridProgram });

    this.paintProgram = this.overlay(paintFragment, {
      tMap: { value: this.blank },
      uImage: { value: [1, 1] },
      uRes: { value: [1, 1] },
      uRect: { value: [0, 0, 1, 1] },
      uInk: { value: 0 },
      uTime: { value: 0 },
      uBlack: { value: BLACK },
      uTint: { value: RED },
    });
    this.paintMesh = new Mesh(this.gl, { geometry: triangle, program: this.paintProgram });
    this.skyProgram = this.overlay(skyFragment, {
      uAlpha: { value: 0 },
      uLight: { value: 1 },
      uHorizon: { value: 0.27 },
      uBlack: { value: BLACK },
    });
    this.skyMesh = new Mesh(this.gl, { geometry: triangle, program: this.skyProgram });


    this.mountainProgram = new Program(this.gl, {
      vertex: mountainVertex,
      fragment: mountainFragment,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      cullFace: false,
      uniforms: {
        uRise: { value: 0 },
        uAlpha: { value: 0 },
        uLight: { value: 1 },
        uSeed: { value: 0 },
        uBlack: { value: BLACK },
      },
    });
    this.mountainProgram.setBlendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.mountains = new Mesh(this.gl, {
      geometry: new Plane(this.gl, { width: 1, height: 1, widthSegments: 240, heightSegments: 240 }),
      program: this.mountainProgram,
    });
    // Le relief est calculé dans le shader : la boîte englobante du plan (un carré de 1 à l'origine)
    // ne dit rien de sa taille réelle. Sans ça, la caméra haute « rate » l'origine et tout disparaît.
    this.mountains.frustumCulled = false;
    this.mountains.setParent(this.land);

    this.buildPapers();
    if (boot) {
      this.booting = true;
      this.pos = this.target = 0;
      projects.forEach((p) => p.images[0] && this.bootNeed.add(p.images[0]));
    }
    this.resize();
    this.bind();
  }

  private overlay(fragment: string, uniforms: Record<string, { value: unknown }>) {
    const program = new Program(this.gl, {
      vertex: fullscreenVertex,
      fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms,
    });
    program.setBlendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    return program;
  }

  async start() {
    const face = new FontFace("Monument Drum", "url(/fonts/MonumentExtended-Ultrabold.otf)");
    try {
      await face.load();
      document.fonts.add(face);
    } catch {
      /* la police système prend le relais */
    }
    if (this.destroyed) return;
    this.buildStrips();
    this.projects.forEach((p) => p.images[0] && this.loadPic(p.images[0]));
    this.projects.forEach((p) => p.images.slice(1).forEach((src) => this.loadPic(src)));
    this.revealStart = performance.now();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  // ---------- construction ----------

  private buildStrips() {
    for (const strip of this.strips) this.gl.deleteTexture(strip.texture.texture);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cap = CAP * this.u;
    const pitch = PITCH * this.u;
    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = `100px "Monument Drum"`;
    const capRatio = measure.measureText("H").actualBoundingBoxAscent / 100 || 0.7;
    const size = cap / capRatio;

    this.strips = this.projects.map((project) => {
      const text = project.title.toUpperCase();
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      ctx.font = `${size * dpr}px "Monument Drum"`;
      const gap = ctx.measureText(" ").width * 1.1;
      const m = ctx.measureText(text);
      c.width = Math.ceil(m.width + gap);
      c.height = Math.ceil(pitch * dpr);
      ctx.font = `${size * dpr}px "Monument Drum"`;
      ctx.fillStyle = "#fff";
      ctx.fillText(text, gap / 2, (pitch - (pitch - cap) / 2) * dpr);
      const texture = new Texture(this.gl, {
        image: c,
        wrapS: this.gl.CLAMP_TO_EDGE,
        wrapT: this.gl.CLAMP_TO_EDGE,
        generateMipmaps: true,
        minFilter: this.gl.LINEAR_MIPMAP_LINEAR,
        anisotropy: 8,
        flipY: false,
        premultiplyAlpha: false,
      });
      const lead = (gap / 2 + (m.actualBoundingBoxLeft < 0 ? -m.actualBoundingBoxLeft : 0)) / dpr;
      return { texture, width: c.width / dpr, text: m.width / dpr, lead };
    });

    // Ligne du haut : titres dans l'ordre (le suivant à droite, la ligne part à gauche).
    // Ligne du bas : ordre inverse (le suivant à gauche, la ligne part à droite).
    let x = 0;
    this.startsA = this.strips.map((s) => {
      const start = x;
      x += s.width;
      return start;
    });
    this.loop = x;
    this.startsB = new Array(this.n).fill(0);
    x = 0;
    for (let k = this.n - 1; k >= 0; k--) {
      this.startsB[k] = x;
      x += this.strips[k].width;
    }
    const uni = this.textProgram.uniforms;
    this.strips.forEach((s, i) => (uni[`uT${i}`].value = s.texture));
    uni.uW.value = this.strips.map((s) => s.width);
    uni.uSA.value = this.startsA;
    uni.uSB.value = this.startsB;
    uni.uL.value = this.loop;
  }

  private buildPapers() {
    const geometry = new Plane(this.gl, { widthSegments: 40, heightSegments: 26 });
    const add = (paper: Omit<Paper, "mesh" | "program">) => {
      const program = new Program(this.gl, {
        vertex: paperVertex,
        fragment: paperFragment,
        transparent: true,
        cullFace: false,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tMap: { value: this.blank },
          uSize: { value: [1, 1] },
          uImage: { value: [1, 1] },
          uReady: { value: 0 },
          uOpacity: { value: 1 },
          uDim: { value: 0 },
          uGround: { value: CLEAN },
          uCurl: { value: 0 },
          uAngle: { value: 0 },
          uFlutter: { value: 0 },
          uTime: { value: 0 },
          uPhase: { value: paper.phase },
          uEmpty: { value: EMPTY },
          tBack: { value: this.blank },
          uBackImage: { value: [1, 1] },
          uHasBack: { value: 0 },
        },
      });
      program.setBlendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
      const mesh = new Mesh(this.gl, { geometry, program });
      this.papers.push({ ...paper, mesh, program });
    };

    const base = { offset: 0, x: 0, y: 0, z: 0, size: 1, spin: [0, 0, 0] as [number, number, number] };
    this.projects.forEach((project, k) => {
      add({ ...base, kind: "main", project: k, image: -1, front: true, side: k % 2 ? 1 : -1, phase: k * 1.7 });
      project.images.slice(1, 1 + SECTIONS.length).forEach((_, j) => {
        const seed = k * 10 + j;
        const slot = SECTIONS[j];
        add({
          kind: "section",
          project: k,
          image: j + 1,
          front: slot.front,
          offset: 0,
          side: slot.x > 0 ? 1 : -1,
          x: slot.x,
          y: slot.y,
          z: slot.z,
          size: slot.s,
          spin: [(hash(seed + 4) - 0.5) * 0.3, (hash(seed + 5) - 0.5) * 0.5, (hash(seed + 6) - 0.5) * 0.24],
          phase: hash(seed + 7) * 6.28,
        });
      });
    });

    // Assez de feuilles pour que le ruban d'un projet à 4 images fasse le tour de l'écran sans trou.
    const most = Math.max(...this.projects.map((p) => p.images.length));
    for (let j = 0; j < Math.max(16, most * 2); j++) {
      add({ ...base, kind: "slide", project: 0, image: j, front: true, side: j % 2 ? 1 : -1, phase: j * 2.3 });
    }
  }

  private loadPic(src: string) {
    if (this.pics.has(src)) return;
    const texture = new Texture(this.gl, { generateMipmaps: true, flipY: false, anisotropy: 8 });
    const pic: Pic = { texture, w: 1, h: 1, ready: false };
    this.pics.set(src, pic);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = src;
    img
      .decode()
      .then(() => {
        if (this.destroyed) return;
        texture.image = img;
        pic.w = img.naturalWidth;
        pic.h = img.naturalHeight;
        pic.ready = true;
        this.projects.forEach((p, k) => {
          if (p.images[0] === src) this.colors[k] = dominantColor(img);
        });
      })
      .catch(() => undefined);
  }

  private picOf(project: number, image: number) {
    const list = this.projects[project].images;
    const i = image < 0 ? this.picIndex[project] : image;
    const src = list[clamp(i, 0, list.length - 1)];
    return src ? this.pics.get(src) : undefined;
  }

  // ---------- entrées ----------

  private bind() {
    window.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("resize", this.onResize);
  }

  private beginGesture(dir: number) {
    this.settling = false;
    if (this.gestureStart === null) {
      this.gestureStart = Math.round(this.target);
      this.intent = this.gestureStart;
    }
    if (dir) this.gestureDir = dir;
    this.lastInput = performance.now();
  }

  private beginSlideGesture(dir: number) {
    if (this.slideGesture === null) this.slideGesture = Math.round(this.slideTarget);
    if (dir) this.slideDir = dir;
    this.lastInput = performance.now();
  }

  private slideCount() {
    return this.projects[mod(Math.round(this.pos), this.n)].images.length;
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? this.H : 1;
    const raw = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    const delta = clamp(raw, -160, 160);
    if (this.opened) {
      this.beginSlideGesture(Math.sign(delta));
      this.slideTarget += delta / 600;
      return;
    }
    if (this.clock > 0 || this.aboutClock > 0) return; // pendant la fermeture ou sur À propos, on ne tombe pas
    this.beginGesture(Math.sign(delta));
    // À la molette, on défile librement ; chaque projet exerce seulement une légère attraction
    // (des crans doux). L'aimant ne pose la feuille qu'à la fin du geste.
    this.wheeling = true;
    this.intent += delta * WHEEL;
    this.target = this.intent - (DETENT * Math.sin(2 * Math.PI * this.intent)) / (2 * Math.PI);
  };

  private onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("a,button:not([data-stage])")) return;
    if (this.aboutClock > 0 || this.booting) return;
    this.wheeling = false;
    this.dragging = true;
    this.dragY = this.opened ? e.clientX : e.clientY;
    this.dragStart = this.dragY;
    this.dragMoved = 0;
    if (this.opened) this.beginSlideGesture(0);
    else this.beginGesture(0);
  };

  private onMove = (e: PointerEvent) => {
    this.mouseX = e.clientX / this.W;
    this.mouseY = e.clientY / this.H;
    if (!this.dragging) return;
    if (this.opened) {
      const dx = this.dragY - e.clientX;
      this.dragY = e.clientX;
      this.dragMoved = Math.abs(e.clientX - this.dragStart);
      this.beginSlideGesture(Math.sign(dx));
      this.slideTarget += dx / ((RIBBON_W + GUTTER) * this.u);
      return;
    }
    const dy = this.dragY - e.clientY;
    this.dragY = e.clientY;
    this.dragMoved = Math.abs(e.clientY - this.dragStart);
    this.beginGesture(Math.sign(dy));
    this.target += (dy / this.H) * 1.6;
  };

  private onUp = () => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.opened) this.slideTarget += clamp(this.slideVel * 0.15, -1.5, 1.5);
    else this.target += clamp(this.velocity * 0.18, -1.5, 1.5);
    this.lastInput = performance.now();
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.aboutClock > 0 || this.booting) return;
    // Les touches d'activation restent aux boutons et aux liens.
    const el = e.target as HTMLElement;
    if (el.closest("input,textarea,[contenteditable]")) return;
    if ((e.key === "Enter" || e.key === " ") && el.closest("a,button")) return;
    if (this.opened) {
      if (e.key === "Escape") this.close();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        this.slideStep(e.key === "ArrowRight" ? 1 : -1);
      }
      return;
    }
    const next = ["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key);
    const prev = ["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key);
    if (!next && !prev) return;
    e.preventDefault();
    this.step(next ? 1 : -1);
  };

  private onResize = () => {
    this.resize();
    this.buildStrips();
  };

  get wasDrag() {
    return this.dragMoved > 6;
  }

  // Le chargement est fini : la feuille se déplie dans son cadre, puis on entre dans la Home.
  reveal() {
    if (!this.booting) return;
    this.booting = false;
    this.revealStart = performance.now();
  }

  get isBooting() {
    return this.booting;
  }

  bootProgress() {
    if (!this.bootNeed.size) return 1;
    let done = 0;
    for (const src of this.bootNeed) if (this.pics.get(src)?.ready) done++;
    return done / this.bootNeed.size;
  }

  get isOpen() {
    return this.opened;
  }

  step(dir: number) {
    if (this.clock > 0) return;
    this.gestureStart = null;
    this.target = Math.round(this.target) + dir;
    this.lastInput = -1e9;
  }

  goTo(index: number, instant = false) {
    const from = mod(Math.round(this.target), this.n);
    let d = index - from;
    if (d > this.n / 2) d -= this.n;
    if (d < -this.n / 2) d += this.n;
    this.gestureStart = null;
    this.target = Math.round(this.target) + d;
    if (instant) {
      this.pos = this.target;
      this.posVel = 0;
    }
    this.lastInput = -1e9;
  }

  setHover(on: boolean) {
    this.hovered = on;
  }

  setHoverSlide(k: number) {
    this.hoverSlide = k;
  }

  setAbout(on: boolean, instant = false) {
    this.aboutOn = on;
    if (on !== this.aboutIn) {
      // Demi-tour en plein vol : on reprend l'autre mouvement à l'endroit symétrique.
      this.aboutT = 1 - this.aboutT;
      this.aboutIn = on;
    }
    if (instant) this.aboutT = 1;
    this.aboutClock = on || this.aboutT < 1 ? 1 : 0;
  }

  setPortrait(src: string) {
    this.loadPic(src);
    this.portrait = this.pics.get(src) ?? null;
  }

  setGrid(on: boolean) {
    this.gridOn = on;
  }

  setHoverSection(image: number) {
    this.hoverSection = image;
  }

  // Ouvre le projet courant (à l'arrêt seulement ; pendant la chute, il attend d'être posé).
  // Sans image : depuis la feuille du centre ; avec : depuis la section flottante cliquée.
  open(image?: number) {
    if (this.opened || this.booting) return false;
    if (Math.abs(this.target - this.pos) > 0.05) {
      this.target = Math.round(this.target);
      return false;
    }
    const i = mod(Math.round(this.pos), this.n);
    this.target = Math.round(this.target);
    this.opened = true;
    this.fromSection = image !== undefined;
    this.anchor = image ?? this.picIndex[i];
    const src = this.fromSection
      ? this.papers.find((p) => p.kind === "section" && p.project === i && this.shownImage(p) === image)
      : this.papers.find((p) => p.kind === "main" && p.project === i);
    this.from = src?.pose ?? null;
    this.paintImage = this.anchor;
    this.anchorK = this.anchor;
    this.slidePos = this.slideTarget = this.anchor;
    this.slideShown = -1;
    this.ev.onOpen(true);
    return true;
  }

  close() {
    if (!this.opened) return;
    const i = mod(Math.round(this.pos), this.n);
    this.opened = false;
    const count = this.slideCount();
    this.slideTarget = Math.round(this.slideTarget);
    this.anchorK = mod(this.slideTarget, this.ribbonLoop(count));
    this.anchor = mod(this.slideTarget, count);
    this.picIndex[i] = this.anchor; // la feuille revient avec l'image où l'on s'est arrêté
    this.paintImage = this.anchor;
    // Retour : la section au centre redevient la feuille posée.
    this.fromSection = false;
    this.from = null;
    this.ev.onOpen(false);
  }

  // Amène au centre la feuille k du ruban, par le plus court chemin.
  slideTo(k: number) {
    this.slideGesture = null;
    this.lastInput = performance.now();
    this.slideTarget += wrap(k - this.slideTarget, this.ribbonLoop(this.slideCount()));
  }

  slideStep(dir: number) {
    this.slideGesture = null;
    this.lastInput = performance.now();
    this.slideTarget = Math.round(this.slideTarget) + dir;
  }

  private hitTest(hits: Hit[], x: number, y: number) {
    let best: Hit | null = null;
    for (const h of hits) if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1 && (!best || h.order > best.order)) best = h;
    return best ? best.image : -1;
  }

  // Projet ouvert : la section sous le pointeur (son index), ou le fond (-1).
  slideAt(clientX: number, clientY: number) {
    return this.opened ? this.hitTest(this.slideHits, clientX, clientY) : -1;
  }

  // Au repos : la section flottante sous le pointeur (l'image qu'elle montre), ou -1.
  sectionAt(clientX: number, clientY: number) {
    return this.opened || this.clock > 0 || this.aboutClock > 0 || this.moving ? -1 : this.hitTest(this.sectionHits, clientX, clientY);
  }

  // Une section ne montre pas l'image déjà posée au centre : elle prend alors la première.
  private shownImage(p: Paper) {
    return p.image === this.picIndex[p.project] ? 0 : p.image;
  }

  // ---------- rendu ----------

  private resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.u = this.W / 1440;
    this.renderer.setSize(this.W, this.H);
    // Caméra placée pour qu'une unité = un pixel à la profondeur 0.
    this.camera.perspective({ aspect: this.W / this.H });
    this.camera.position.set(0, 0, this.H / 2 / Math.tan((FOV * Math.PI) / 360));
    // Le paysage : on survole les crêtes, le regard vers l'horizon.
    this.landCamera.perspective({ aspect: this.W / this.H });
    // Vu d'en haut, le regard plonge : l'horizon passe au-dessus du ruban (vers 25 % de l'écran)
    // et les sommets lointains se découpent dans le ciel, au-dessus des sections.
    this.landCamera.position.set(0, 760, 900);
    this.landCamera.lookAt([0, 60, -2400]);
  }

  // Position d'une ligne entre deux projets. Au repos, le titre commence sur la colonne 1
  // (ligne du haut) ou finit sur la colonne 12 (ligne du bas).
  private marquee(starts: number[], top: boolean) {
    const k0 = Math.floor(this.pos);
    const f = this.pos - k0;
    const a = mod(k0, this.n);
    const b = mod(k0 + 1, this.n);
    const u = this.u;
    const at = (k: number) => {
      const s = this.strips[k];
      return top
        ? starts[k] + s.lead - (MARGIN * u - this.W / 2)
        : starts[k] + s.lead + s.text - (this.W - MARGIN * u - this.W / 2);
    };
    const xa = at(a);
    let xb = at(b);
    if (top && xb < xa) xb += this.loop;
    if (!top && xb > xa) xb -= this.loop;
    return xa + (xb - xa) * f;
  }

  private titleColor() {
    const k0 = Math.floor(this.pos);
    const f = smooth(this.pos - k0);
    const a = this.colors[mod(k0, this.n)] ?? RED;
    const b = this.colors[mod(k0 + 1, this.n)] ?? RED;
    return a.map((v, i) => v + (b[i] - v) * f);
  }

  // La feuille posée au centre, au repos.
  private restPose(): Pose {
    const side = this.current % 2 ? 1 : -1;
    return { x: 0, y: 0, z: 0, w: PIC_W * this.u, rx: 0, ry: 0, rz: 0, curl: 0, angle: 0.7 * side };
  }

  // Combien de feuilles tournent dans le ruban : les images du projet, répétées s'il le faut
  // pour qu'il couvre l'écran sans trou.
  private ribbonLoop(count: number) {
    const pitch = (RIBBON_W + GUTTER) * this.u;
    return count * Math.max(1, Math.ceil((this.W + 2 * RIBBON_W * this.u) / (count * pitch)));
  }

  // Une section du ruban à r places du centre : sur l'intérieur d'un tambour, les bords viennent
  // vers nous et se tournent vers le centre, comme les titres.
  private slidePose(r: number, phase: number): Pose {
    const u = this.u;
    const R = RIBBON_R * u;
    const th = (r * (RIBBON_W + GUTTER) * u) / R;
    const near = clamp(1 - Math.abs(r), 0, 1);
    return {
      x: Math.sin(th) * R,
      y: Math.sin(this.t * 0.5 + phase) * 4 * u * (1 - near),
      z: (1 - Math.cos(th)) * R * 0.55,
      w: RIBBON_W * u,
      rx: 0,
      ry: -th * 0.8,
      rz: 0,
      curl: clamp(-this.slideVel * 0.1, -0.25, 0.25),
      angle: 0,
    };
  }

  private tick = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const u = this.u;

    if (!this.dragging && now - this.lastInput > IDLE_MS && this.gestureStart !== null) {
      // Molette : le projet le plus proche de là où le geste s'est arrêté.
      // Glisser : celui où l'élan aurait mené. Un petit geste volontaire avance d'un projet.
      const end = this.wheeling ? this.intent : this.pos + this.posVel * COAST;
      const moved = end - this.gestureStart;
      let snap = Math.round(end);
      if (snap === this.gestureStart && Math.abs(moved) > NUDGE) snap += Math.sign(moved || this.gestureDir);
      this.target = snap;
      this.gestureStart = null;
      this.settling = true;
    }

    // Slider ouvert : même physique, sur l'axe horizontal, bornée aux images du projet.
    const count = this.slideCount();
    // Le ruban est sans fin : pas de bornes. À la fin d'un geste, il se pose doucement sur la
    // section la plus proche ; puis, laissé seul, il dérive lentement.
    const loop = this.ribbonLoop(count);
    if (!this.dragging && now - this.lastInput > IDLE_MS && this.slideGesture !== null) {
      this.slideTarget = Math.round(this.slideTarget);
      this.slideGesture = null;
    }
    if (this.opened && !this.dragging && this.clock >= 1 && now - this.lastInput > 2500) this.slideTarget += DRIFT * dt;
    const slidePrev = this.slidePos;
    this.slidePos += (this.slideTarget - this.slidePos) * (1 - Math.exp(-dt * (this.dragging ? FOLLOW_DRAG : 5)));
    this.slideVel += ((dt > 0 ? (this.slidePos - slidePrev) / dt : 0) - this.slideVel) * (1 - Math.exp(-dt * 10));
    const shownSlide = mod(Math.round(this.slidePos), count);
    if (this.opened && shownSlide !== this.slideShown) {
      this.slideShown = shownSlide;
      this.ev.onSlide(shownSlide);
    }

    // La séquence d'ouverture avance (ou recule) à son rythme.
    this.clock = clamp(this.clock + (this.opened ? dt / OPEN_S : -dt / CLOSE_S), 0, 1);
    if (this.booting) {
      // Les titres attendent l'affiche : leur entrée part de reveal().
      this.revealStart = now;
      this.ev.onBoot?.(this.bootProgress());
    }
    const c = this.clock;
    // Minutage (en part de la séquence) :
    // 0–14 %  la feuille se soulève vers nous (anticipation) ;
    // 8–70 %  elle vole jusqu'à sa place de slide, flotte, se balance et se pose à plat ;
    // 10–70 % derrière elle, la peinture s'étale puis sèche en noir ;
    // 42–100 % le paysage se lève et les autres feuilles sortent de la profondeur.
    const lift = band(0, 0.14, c) * (1 - band(0.14, 0.42, c));
    const morph = clamp((c - 0.08) / 0.62, 0, 1);
    const ink = band(0.1, 0.7, c);
    const rise = band(0.42, 1, c);
    const titlesOut = band(0.02, 0.38, c);
    // À propos. Deux mouvements écrits séparément (jouer l'entrée à l'envers donnerait des
    // fins brusques) :
    // Entrée, 1,5 s : la feuille se soulève (0–12 %), les titres partent en accélérant (0–34 %),
    //   la feuille vole vers les colonnes 1–4 (6–80 %) en se retournant (14–70 %), puis se pose
    //   avec un léger balancement ; le texte se lève à partir d'1 s (côté HTML).
    // Sortie, 1,2 s : le texte part d'abord (HTML, 0,3 s), la feuille se retourne (12–62 %) et
    //   revient au centre (10–80 %), les titres rentrent en freinant (45–100 %).
    this.aboutT = clamp(this.aboutT + dt / (this.aboutIn ? 1.5 : 1.2), 0, 1);
    const at = this.aboutT;
    const going = this.aboutIn;
    this.aboutClock = going || at < 1 ? 1 : 0;
    const ab = this.aboutClock;
    // Une seule courbe par mouvement, posée sur une rampe linéaire (une courbe sur une courbe
    // écrase le départ et précipite le milieu).
    const abOut = going ? easeInCubic(ramp(0, 0.34, at)) : 1 - easeOutCubic(ramp(0.45, 1, at));
    const abFly = going ? easeInOutQuart(ramp(0.04, 0.72, at)) : 1 - easeInOutQuart(ramp(0.1, 0.8, at));
    const abTurn = going ? easeInOutCubic(ramp(0.12, 0.64, at)) : 1 - easeInOutCubic(ramp(0.12, 0.62, at));
    const abLift = going ? Math.sin(Math.PI * ramp(0, 0.3, at)) : 0;
    const landT = going ? ramp(0.68, 1, at) : ramp(0.76, 1, at);
    const abWobble = Math.sin(landT * Math.PI * 2.2) * (1 - landT) ** 2 * (landT > 0 ? 1 : 0);
    const abShift = going ? easeInOutCubic(ramp(0, 0.85, at)) : 1 - easeInOutCubic(ramp(0.05, 0.9, at));
    const abSections = going ? easeInCubic(ramp(0, 0.3, at)) : 1 - easeOutCubic(ramp(0.55, 0.95, at));

    const prev = this.pos;
    // Ressort critique, en deux sous-pas pour rester stable aux images lentes.
    const w = this.dragging ? SPRING_DRAG : this.settling ? SPRING_SNAP : SPRING_INPUT;
    for (let k = 0; k < 2; k++) {
      const h = dt / 2;
      this.posVel += (w * w * (this.target - this.pos) - 2 * w * (this.settling && !this.dragging ? SNAP_DAMP : 1) * this.posVel) * h;
      this.pos += this.posVel * h;
    }
    if (Math.abs(this.target - this.pos) < 1e-4 && Math.abs(this.posVel) < 1e-3) {
      this.pos = this.target;
      this.posVel = 0;
    }
    const instant = dt > 0 ? (this.pos - prev) / dt : 0;
    this.velocity += (instant - this.velocity) * (1 - Math.exp(-dt * 10));
    const speed = Math.abs(this.velocity);

    const current = mod(Math.round(this.pos), this.n);
    if (current !== this.current) {
      this.current = current;
      this.ev.onChange(current);
    }
    const moving = c === 0 && (Math.abs(this.target - this.pos) > 0.02 || speed > 0.15);
    if (moving !== this.moving) {
      this.moving = moving;
      this.ev.onMoving(moving);
    }

    this.lift += ((this.hovered && !moving && c === 0 ? 1 : 0) - this.lift) * (1 - Math.exp(-dt * 7));
    this.cx += (this.mouseX - this.cx) * (1 - Math.exp(-dt * 3));
    this.cy += (this.mouseY - this.cy) * (1 - Math.exp(-dt * 3));
    // Parallaxe à la souris (au repos seulement) : -0,5 … 0,5.
    const mx = (this.cx - 0.5) * (c === 0 ? 1 : 0);
    const my = (this.cy - 0.5) * (c === 0 ? 1 : 0);
    const reveal = easeOutQuart(clamp((now - this.revealStart) / 1500, 0, 1));

    // Titres
    const tu = this.textProgram.uniforms;
    tu.uRes.value = [this.W, this.H];
    tu.uPitch.value = PITCH * u;
    tu.uBend.value = BEND + Math.min(speed * BEND_SPEED, BEND_MAX);
    tu.uCx.value = this.W * (0.5 + (this.cx - 0.5) * 0.06);
    tu.uReveal.value = reveal;
    tu.uOpen.value = Math.max(titlesOut, abOut);
    tu.uXA.value = this.marquee(this.startsA, true);
    tu.uXB.value = this.marquee(this.startsB, false);
    this.peak = Math.max(this.peak, speed);
    // Le liquide monte vite au lancer et se calme lentement, comme une surface qui retombe.
    const wave = c === 0 ? band(LIQUID_ON, LIQUID_FULL, speed) : 0;
    this.liquid += (wave - this.liquid) * (1 - Math.exp(-dt * (wave > this.liquid ? 10 : 1.8)));
    if (Math.abs(this.velocity) > 0.3) this.dir = Math.sign(this.velocity);
    tu.uLiquid.value = this.liquid;
    tu.uDir.value = this.dir;
    tu.uTime.value = this.t;
    // La couleur des titres est celle du projet (tirée de son image), en fondu pendant la chute.
    tu.uRed.value = this.titleColor();

    // Grille : la profondeur monte vite quand on tombe, retombe doucement à l'arrêt.
    const deep = c === 0 && ab === 0 ? band(0.4, 4.5, speed) : 0;
    this.depth += (deep - this.depth) * (1 - Math.exp(-dt * (deep > this.depth ? 6 : 2.2)));
    this.showGrid += ((this.gridOn ? 1 : 0) - this.showGrid) * (1 - Math.exp(-dt * 8));
    const gu = this.gridProgram.uniforms;
    gu.uRes.value = [this.W, this.H];
    gu.uM.value = MARGIN * u;
    gu.uCol.value = COL * u;
    gu.uGut.value = GUTTER * u;
    // En passant à À propos, les parois du puits remontent d'un demi-écran (chaque colonne à sa vitesse).
    gu.uFall.value = -this.pos * FALL * this.H - abShift * this.H * 0.5;
    gu.uDepth.value = this.depth;
    gu.uShow.value = this.showGrid;
    gu.uOpen.value = ink;
    gu.uTint.value = tu.uRed.value;
    const since = (now - this.revealStart) / 1000;
    gu.uIntro.value = PARALLAX.map((_, i) => easeOutQuart(clamp((since - i * 0.04) / 1.2, 0, 1)));

    // Feuilles
    const fall = FALL * this.H;
    const picW = PIC_W * u;
    const stretch = 1 + Math.min(speed, 4) * 0.05;
    const order: { paper: Paper; z: number; layer: Transform }[] = [];
    const sectionHits: Hit[] = [];
    const slideHits: Hit[] = [];
    for (const paper of this.papers) {
      let d = paper.project + paper.offset - this.pos;
      d = mod(d + this.n / 2, this.n) - this.n / 2;
      const ad = Math.abs(d);
      const { mesh, program } = paper;
      const pu = program.uniforms;
      let x: number, y: number, z: number, w: number;
      let rx: number, ry: number, rz: number;
      let curl: number, angle: number, flutter: number;
      let opacity = 1;
      let dim = 0;
      let ratio = PIC_RATIO;
      let layer = paper.front ? this.front : this.back;

      if (paper.kind === "slide") {
        // Les feuilles du projet sortent de la profondeur, l'une après l'autre, puis se rangent.
        const k = paper.image;
        paper.project = this.current;
        const isAnchor = k === this.anchorK;
        if (c <= 0 || k >= loop || (!isAnchor && rise <= 0)) {
          mesh.visible = false;
          continue;
        }
        const r = wrap(k - this.slidePos, loop);
        const stagger = 0.16;
        const pj = smooth(clamp(rise * (1 + stagger * 3) - stagger * Math.min(Math.abs(r), 3), 0, 1));
        const t = this.slidePose(r, paper.phase);
        const near = clamp(1 - Math.abs(r), 0, 1);
        x = t.x;
        y = t.y + (1 - pj) * paper.side * 60 * u;
        z = t.z - (1 - pj) * 2200;
        w = t.w;
        rx = t.rx + (1 - pj) * 0.5;
        ry = t.ry - (1 - pj) * paper.side * 0.6;
        rz = t.rz + (1 - pj) * paper.side * 0.25;
        // En glissant, la feuille plie dans le sens du geste ; en arrivant, elle est encore roulée.
        curl = t.curl + (1 - pj) * 0.7 * paper.side;
        angle = t.angle;
        // En défilant, chaque feuille ondule comme du papier tenu par un bord ; la vague la
        // traverse avec un temps de retard d'une feuille à l'autre.
        flutter = ((1 - pj) * 24 + Math.min(Math.abs(this.slideVel), 6) * 9) * u;
        rz = t.rz + clamp(-this.slideVel * 0.015, -0.05, 0.05) * Math.cos(paper.phase);
        opacity = clamp(pj * 2.5, 0, 1);
        dim = (1 - near) * 0.25 * pj;
        layer = this.stage;
        if (isAnchor) {
          // La feuille cliquée ne disparaît pas : elle devient la section du centre. Elle vole,
          // flotte, se balance de moins en moins et se pose à plat, la peinture s'étalant derrière.
          const f = this.from ?? this.restPose();
          const e = morph < 0.5 ? 4 * morph ** 3 : 1 - Math.pow(-2 * morph + 2, 3) / 2;
          const arc = Math.sin(Math.PI * morph);
          const settle = Math.sin(morph * Math.PI * 3) * (1 - morph) ** 2;
          const mix = (a: number, b: number) => a + (b - a) * e;
          x = mix(f.x, t.x);
          y = mix(f.y, t.y) - arc * 14 * u;
          z = mix(f.z, t.z) + lift * 150 + arc * 110;
          w = mix(f.w, t.w);
          rx = mix(f.rx, t.rx) + arc * 0.2 + settle * 0.08;
          ry = mix(f.ry, t.ry);
          rz = mix(f.rz, t.rz) + settle * 0.05 - arc * 0.03;
          curl = mix(f.curl, t.curl) + lift * 0.16 + arc * 0.3 + settle * 0.12;
          angle = mix(f.angle, t.angle);
          flutter = (arc * 14 + Math.min(Math.abs(this.slideVel), 6) * 4) * u;
          opacity = 1;
          dim = (1 - near) * 0.25 * e;
        }
      } else if (paper.kind === "main") {
        const isCurrent = paper.project === this.current;
        if (ad > 1.6 || c > 0 || (ab > 0 && !isCurrent)) {
          mesh.visible = false;
          continue;
        }
        // Elle arrive d'en bas en arc, roulée en diagonale, et se pose à plat au centre.
        const landed = smooth(clamp(1 - ad, 0, 1));
        const hover = isCurrent ? this.lift : 0;
        y = -d * fall;
        x = paper.side * d * this.W * 0.2 * (1 - landed * 0.5);
        z = -ad * 650 + hover * 30;
        w = picW * (0.78 + 0.22 * landed);
        // Posée, elle se tourne à peine vers le pointeur.
        rx = -d * 0.85 + my * 0.12 * landed;
        ry = -paper.side * d * 0.45 + mx * 0.16 * landed;
        rz = paper.side * d * 0.32;
        // En vol : roulée en diagonale. Posée : elle respire à peine. Survolée : un coin se soulève.
        const breathe = Math.sin(this.t * 0.9 + paper.phase) * 0.03;
        curl = Math.min(ad * 1.3, 0.9) * paper.side + breathe * landed + hover * 0.16;
        angle = 0.7 * paper.side + d * 0.5 - hover * 0.25;
        flutter = Math.min(ad * 1.6, 1) * 20 * u;
        if (isCurrent && ab > 0) {
          // La feuille quitte le centre, rejoint les colonnes 1–3 et se retourne : au verso, Fayssal.
          const f = abFly;
          const turn = abTurn;
          const arc = Math.sin(Math.PI * f);
          const pw = PORTRAIT_W * u;
          const px = -this.W / 2 + MARGIN * u + pw / 2;
          const py = this.H / 2 - PORTRAIT_TOP * u - (pw * PORTRAIT_RATIO) / 2;
          const bob = Math.sin(this.t * 0.7) * 5 * u * f;
          x = x + (px - x) * f;
          y = y + (py - y) * f + arc * 30 * u + bob;
          z = z + arc * 240 + abLift * 90;
          w = w + (pw - w) * f;
          rx = rx * (1 - f) + arc * 0.12 + my * 0.1 * f + abWobble * 0.09;
          ry = ry * (1 - f) + Math.PI * turn + mx * 0.18 * f;
          rz = rz * (1 - f) - arc * 0.06 + abWobble * 0.05;
          curl = curl * (1 - f) + arc * 0.35 + 0.04 * f + abLift * 0.2 + abWobble * 0.12;
          angle = angle * (1 - f) + 0.9 * f;
          flutter += arc * 18 * u;
          ratio = PIC_RATIO + (PORTRAIT_RATIO - PIC_RATIO) * f;
        }
      } else {
        // Les sections du site : posées autour de la feuille, elles flottent sur place.
        // En tombant, elles suivent leur projet avec un peu de parallaxe et tournent davantage.
        const shown = this.shownImage(paper);
        const isCurrent = paper.project === this.current;
        const sourceOfOpen = this.fromSection && isCurrent && shown === this.anchor;
        if (ad > 1.6 || ((c > 0 || ab > 0) && (sourceOfOpen || !isCurrent))) {
          mesh.visible = false;
          continue;
        }
        const air = Math.min(ad, 1);
        const hover = isCurrent && this.hoverSection === shown && c === 0 ? 1 : 0;
        paper.hover = (paper.hover ?? 0) + (hover - (paper.hover ?? 0)) * (1 - Math.exp(-dt * 8));
        const ho = paper.hover;
        // Devant, elle glisse à l'opposé du pointeur ; derrière, à peine : la profondeur se lit.
        const depthK = paper.front ? -46 : -14;
        x = paper.x * u + Math.cos(this.t * 0.4 + paper.phase) * 4 * u + mx * depthK * u;
        y = paper.y * u + Math.sin(this.t * 0.55 + paper.phase) * 7 * u + my * -depthK * 0.6 * u - d * fall * (paper.front ? 1.06 : 0.95);
        z = paper.z + ho * 60;
        w = picW * paper.size * (1 + ho * 0.06);
        rx = paper.spin[0] * (1 - ho) + d * 0.7 + Math.sin(this.t * 0.5 + paper.phase) * 0.04;
        ry = paper.spin[1] * (1 - ho) + d * 0.5;
        rz = paper.spin[2] * (1 - ho * 0.5) + d * 0.35;
        curl = (0.16 + 0.07 * Math.sin(this.t * 0.7 + paper.phase)) * (1 - ho * 0.6) + air * 0.4 * paper.side;
        angle = paper.phase + this.t * 0.05;
        flutter = (5 + air * 16) * u;
        // Au repos, seules les sections du projet posé se montrent ; les voisines n'apparaissent qu'en chute.
        opacity = smooth(clamp((0.8 - ad) / 0.3, 0, 1));
        // À l'ouverture, les sections du projet s'écartent et s'effacent sous la peinture.
        if (c > 0 || ab > 0) {
          const out = Math.max(band(0, 0.4, c), ab > 0 ? abSections : 0);
          x *= 1 + out * 0.7;
          y *= 1 + out * 0.7;
          z += out * 500;
          opacity = 1 - out;
        }
      }
      const h = w * ratio * (paper.kind === "main" ? stretch : 1);
      const back = paper.kind === "main" && paper.project === this.current && ab > 0 && this.portrait?.ready;
      pu.uHasBack.value = back ? 1 : 0;
      if (back && this.portrait) {
        pu.tBack.value = this.portrait.texture;
        pu.uBackImage.value = [this.portrait.w, this.portrait.h];
      }
      const pic = this.picOf(
        paper.project,
        paper.kind === "main" ? -1 : paper.kind === "section" ? this.shownImage(paper) : paper.image % count,
      );
      paper.pose = { x, y, z, w, rx, ry, rz, curl, angle };
      // Zones cliquables, à l'écran (la rotation est faible : un rectangle suffit).
      const sc = this.camera.position.z / (this.camera.position.z - z);
      const hit = {
        image: paper.kind === "section" ? this.shownImage(paper) : paper.image,
        x0: this.W / 2 + (x - w / 2) * sc,
        x1: this.W / 2 + (x + w / 2) * sc,
        y0: this.H / 2 - (y + h / 2) * sc,
        y1: this.H / 2 - (y - h / 2) * sc,
        order: z,
      };
      if (paper.kind === "section" && paper.project === this.current && opacity > 0.5) sectionHits.push(hit);
      if (paper.kind === "slide" && opacity > 0.5) slideHits.push(hit);
      mesh.visible = true;
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.scale.set(w, h, 1);
      if (pic) {
        pu.tMap.value = pic.texture;
        pu.uImage.value = [pic.w, pic.h];
      }
      pu.uReady.value = pic?.ready ? 1 : 0;
      pu.uSize.value = [w, h];
      pu.uCurl.value = curl;
      pu.uAngle.value = angle;
      pu.uFlutter.value = flutter;
      pu.uTime.value = this.t;
      pu.uOpacity.value = opacity;
      pu.uDim.value = dim;
      pu.uGround.value = layer === this.stage ? BLACK : CLEAN;
      order.push({ paper, z, layer });
    }

    this.sectionHits = sectionHits;
    this.slideHits = slideHits;
    order.sort((a, b) => a.z - b.z);
    order.forEach(({ paper, layer }, i) => {
      paper.mesh.setParent(layer);
      paper.mesh.renderOrder = i;
    });

    // La peinture part de la feuille posée au centre.
    const cur = this.picOf(this.current, this.paintImage);
    const pp = this.paintProgram.uniforms;
    pp.uRes.value = [this.W, this.H];
    const src = this.from ?? this.restPose();
    const ss = this.camera.position.z / (this.camera.position.z - src.z);
    pp.uRect.value = [this.W / 2 + src.x * ss, this.H / 2 - src.y * ss, (src.w * ss) / 2, (src.w * PIC_RATIO * ss) / 2];
    pp.uInk.value = ink;
    pp.uTint.value = tu.uRed.value;
    pp.uTime.value = this.t;
    if (cur) {
      pp.tMap.value = cur.texture;
      pp.uImage.value = [cur.w, cur.h];
    }

    // Le paysage avance doucement ; glisser dans le slider le fait défiler plus vite.
    // Une dérive lente et régulière ; le geste l'accélère à peine.
    this.fly += dt * (0.06 + Math.min(Math.abs(this.slideVel), 4) * 0.03);
    const mu = this.mountainProgram.uniforms;
    mu.uRise.value = smooth(rise);
    mu.uAlpha.value = rise;
    // La caméra dérive à peine, comme portée à la main sur un plan fixe ; le ruban la tourne un peu.
    const drift = this.fly;
    this.landCamera.position.set(Math.sin(drift * 0.9) * 160, 760 + Math.sin(drift * 0.6) * 20, 900);
    this.landCamera.lookAt([Math.sin(drift * 0.9) * 120, 60, -2400]);
    this.land.rotation.y = this.slidePos * -0.02 + this.yaw;

    this.renderer.render({ scene: this.gridMesh });
    this.renderer.render({ scene: this.back, camera: this.camera, clear: false });
    this.renderer.render({ scene: this.textMesh, clear: false });
    this.renderer.render({ scene: this.front, camera: this.camera, clear: false });
    if (ink > 0) this.renderer.render({ scene: this.paintMesh, clear: false });
    // Le paysage. Survoler une section fait monter la lune et tourne doucement le regard vers elle.
    const hovered = this.opened && this.hoverSlide >= 0;
    this.light += ((hovered ? 1.35 : 1) - this.light) * (1 - Math.exp(-dt * 3));
    const hr = hovered ? wrap(this.hoverSlide - this.slidePos, this.ribbonLoop(count)) : 0;
    this.yaw += (clamp(hr, -1.5, 1.5) * 0.05 - this.yaw) * (1 - Math.exp(-dt * 2));
    if (rise > 0) {
      const su = this.skyProgram.uniforms;
      su.uAlpha.value = rise;
      su.uLight.value = this.light;
      this.renderer.render({ scene: this.skyMesh, clear: false });
      mu.uLight.value = this.light;
      mu.uSeed.value = this.current * 17.3;
      mu.uAlpha.value = rise;
      this.renderer.render({ scene: this.land, camera: this.landCamera, clear: false });
    }
    if (c > 0) this.renderer.render({ scene: this.stage, camera: this.camera, clear: false });
    this.ev.onFrame(this.pos, c);
  };

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("resize", this.onResize);
    for (const strip of this.strips) this.gl.deleteTexture(strip.texture.texture);
    for (const pic of this.pics.values()) this.gl.deleteTexture(pic.texture.texture);
  }
}
