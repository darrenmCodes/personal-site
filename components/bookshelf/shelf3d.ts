import {
  Box3,
  BufferAttribute,
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type MeshPhysicalMaterial,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { clothMaterial, headbandMaterial, paperMaterial } from "./bookMaterials";

// Draws the shelf's books as real hardbacks in one WebGL canvas laid over
// the CSS shelf. The CSS shelf still does everything: layout, the 500 ms
// turn, scrolling, focus. Each frame this reads where every book box is and
// how far its cover has turned, and poses the matching 3D book to suit.
//
// The CSS opens a book by swinging the spine to -60deg and the cover to
// 30deg about the crease between them. That is a rigid book turning about
// the crease, so each 3D book turns by (cover angle - 90deg) about it.
// Each book box has its own `perspective`, so each book gets its own camera
// at that distance from the box centre, and books are drawn in page order
// with the depth cleared between them, just as the browser flattens them.
//
// The open book can also be dragged round (`turn`), about its own centre
// rather than the crease. That is the one pose the CSS doesn't drive; on
// release it springs back to the CSS pose.

const MODEL_URL = "/models/hardback.glb";

// From the Blender file (~/Documents/Blender/hardback-book.blend), in mm.
// Each shape key's 0 and 1 values: page-block thickness, board height and
// board width. Boards are 2.6 mm thick and the spine's edge sits 2 mm out
// from the page block, which is where the CSS crease goes.
const KEYS = { pages: [3.25, 32.5], height: [229, 329], width: [152, 252] } as const;
const BOARD_MM = 2.6;
const SPINE_EDGE_MM = 2;

// How long the spring back from a drag takes to close most of the gap.
const SPRING_MS = 110;

export interface ShelfBook {
  /** The book's button, spine, cover and spine-title elements. */
  el: HTMLElement;
  spine: HTMLElement;
  cover: HTMLElement;
  title: HTMLElement;
  coverSrc: string | null;
  heightMm: number;
  spinePx: number;
  heightPx: number;
  coverPx: number;
}

interface Options {
  canvas: HTMLCanvasElement;
  viewport: HTMLElement;
  books: ShelfBook[];
  onReady: () => void;
  onLost: () => void;
}

interface Part {
  geometry: BufferGeometry;
  kind: "cloth" | "cover" | "paper" | "headband";
  spine: boolean;
  morph: Record<string, number>;
}

interface Built {
  group: Group;
  /** Turns the book about its own centre while it is dragged. */
  pivot: Group;
  scale: number;
  cloth: MeshPhysicalMaterial;
  cover: MeshPhysicalMaterial;
  title: CanvasTexture;
  hasCover: boolean;
  tone: string;
  ink: string;
}

const textureLoader = new TextureLoader();

async function loadCover(src: string): Promise<Texture | null> {
  try {
    const tex = await textureLoader.loadAsync(src);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  } catch (err) {
    console.warn(`bookshelf: could not load cover ${src} for the 3D shelf`, err);
    return null;
  }
}

async function loadParts(): Promise<Part[]> {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const parts: Part[] = [];
  gltf.scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const mat = obj.material as Material;
    const name = mat.name.toLowerCase();
    const kind = name === "cover" ? "cover" : name === "paper" ? "paper" : name === "headband" ? "headband" : "cloth";
    parts.push({
      geometry: obj.geometry as BufferGeometry,
      kind,
      spine: obj.name === "Spine",
      morph: obj.morphTargetDictionary ?? {},
    });
  });
  return parts;
}

const lerpKey = (key: readonly [number, number], v: number) => (v - key[0]) / (key[1] - key[0]);

/**
 * Applies the shape keys for one book's size, then turns it so the spine
 * faces +z with the crease (front board meets spine) at the origin. Bakes
 * on the CPU because sizes never change after load.
 */
function bake(part: Part, weights: Record<string, number>, halfThick: number): BufferGeometry {
  const src = part.geometry;
  const g = src.clone();
  const pos = src.getAttribute("position");
  const morphs = src.morphAttributes.position ?? [];
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    for (const [name, index] of Object.entries(part.morph)) {
      const w = weights[name] ?? 0;
      x += w * morphs[index].getX(i);
      y += w * morphs[index].getY(i);
      z += w * morphs[index].getZ(i);
    }
    out[i * 3] = z * 1000 - halfThick;
    out[i * 3 + 1] = y * 1000;
    out[i * 3 + 2] = -x * 1000 - SPINE_EDGE_MM;
  }
  g.morphAttributes = {};
  g.setAttribute("position", new BufferAttribute(out, 3));
  // clone() kept the model's own bounds (in metres, before the shape keys and
  // the turn above). three.js culls against the bounding sphere, so a stale
  // one parked at the crease hid any book whose crease had scrolled off the
  // shelf, even with most of its cover still showing. Drop them so they're
  // recomputed from the baked positions.
  g.boundingBox = null;
  g.boundingSphere = null;
  g.setAttribute("bookWear", g.getAttribute("_wear"));
  g.deleteAttribute("_wear");
  g.deleteAttribute("normal");
  g.computeVertexNormals();
  return g;
}

function setUvs(g: BufferGeometry, part: Part, thickMm: number, heightMm: number) {
  const pos = g.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  if (part.kind === "cover") {
    g.computeBoundingBox();
    const box = g.boundingBox;
    if (!box) throw new Error("bookshelf: cover has no bounding box");
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (box.max.z - pos.getZ(i)) / (box.max.z - box.min.z);
      uv[i * 2 + 1] = (pos.getY(i) - box.min.y) / (box.max.y - box.min.y);
    }
  } else if (part.spine) {
    // Planar, straight on, as the flat CSS spine shows its title.
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + thickMm) / thickMm;
      uv[i * 2 + 1] = pos.getY(i) / heightMm + 0.5;
    }
  }
  // Everything else samples the title canvas's bottom-left corner, which is
  // always plain spine colour (the title stops 12 px short of the foot).
  g.setAttribute("uv", new BufferAttribute(uv, 2));
}

function applyTextTransform(text: string, transform: string) {
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "uppercase") return text.toUpperCase();
  return text;
}

/** Paints the spine colour and title exactly as the CSS spine lays them out. */
function paintSpine(canvas: HTMLCanvasElement, book: ShelfBook, tone: string, ink: string) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2) * 2;
  const w = book.spinePx;
  const h = book.heightPx;
  canvas.width = Math.ceil(w * ratio);
  canvas.height = Math.ceil(h * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("bookshelf: no 2D context for the spine title");
  // Fill in device pixels: w * ratio rounds up, and an unpainted last row
  // is exactly where the boards and grooves sample their colour.
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(ratio, ratio);

  const cs = getComputedStyle(book.title);
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";
  const maxLen = parseFloat(cs.maxHeight) || h - 24;
  let text = applyTextTransform(book.title.textContent ?? "", cs.textTransform);
  if (ctx.measureText(text).width > maxLen) {
    while (text.length > 1 && ctx.measureText(`${text}…`).width > maxLen) text = text.slice(0, -1);
    text = `${text.trimEnd()}…`;
  }
  // vertical-rl: reads top to bottom, glyph tops facing right.
  ctx.translate(w / 2, parseFloat(cs.marginTop) || 12);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(text, 0, 0);
}

export async function mountShelf3D({ canvas, viewport, books, onReady, onLost }: Options) {
  // failIfMajorPerformanceCaveat: with no GPU (acceleration off, or the GPU
  // blocklisted) WebGL falls back to software and the turn stutters. Refusing
  // the context there keeps the CSS shelf, which stays smooth.
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, failIfMajorPerformanceCaveat: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.45;
  room.dispose();
  // Soft key from the upper left, so the crease catches the light the CSS
  // shine used to paint on.
  const key = new DirectionalLight(0xfff4e6, 2.4);
  key.position.set(-0.6, 0.8, 1);
  scene.add(key, new HemisphereLight(0xffffff, 0x8a7f72, 0.5));

  let parts: Part[];
  let covers: (Texture | null)[];
  try {
    [parts, covers] = await Promise.all([
      loadParts(),
      Promise.all(books.map((b) => (b.coverSrc ? loadCover(b.coverSrc) : Promise.resolve(null)))),
      document.fonts.ready,
    ]);
  } catch (err) {
    scene.environment?.dispose();
    pmrem.dispose();
    renderer.dispose();
    throw err;
  }

  const paper = paperMaterial();
  const headband = headbandMaterial();
  const built: Built[] = books.map((book, i) => {
    // Height sets the scale; the spine and cover are fitted to the same
    // px sizes the CSS shelf uses, so nothing about the layout moves.
    const scale = book.heightPx / book.heightMm;
    const thickMm = book.spinePx / scale;
    const halfThick = thickMm / 2;
    const weights = {
      pages: lerpKey(KEYS.pages, thickMm - 2 * BOARD_MM),
      height: lerpKey(KEYS.height, book.heightMm),
      width: lerpKey(KEYS.width, book.coverPx / scale),
    };
    const tone = getComputedStyle(book.spine).backgroundColor;
    const ink = getComputedStyle(book.title).color;
    const titleCanvas = document.createElement("canvas");
    paintSpine(titleCanvas, book, tone, ink);
    const title = new CanvasTexture(titleCanvas);
    title.colorSpace = SRGBColorSpace;
    title.anisotropy = 4;
    const cloth = clothMaterial(title);
    const coverTex = covers[i];
    const cover = clothMaterial(coverTex);
    if (!coverTex) cover.color.setStyle(tone);

    // group (placed and turned from the CSS) > pivot (at the book's centre,
    // turned by a drag) > inner (moves the book back so the pivot is its
    // centre) > meshes.
    const group = new Group();
    const pivot = new Group();
    const inner = new Group();
    const bounds = new Box3();
    for (const part of parts) {
      const g = bake(part, weights, halfThick);
      setUvs(g, part, thickMm, book.heightMm);
      g.computeBoundingBox();
      if (g.boundingBox) bounds.union(g.boundingBox);
      const mat = part.kind === "cover" ? cover : part.kind === "paper" ? paper : part.kind === "headband" ? headband : cloth;
      inner.add(new Mesh(g, mat));
    }
    const centre = bounds.getCenter(new Vector3());
    centre.y = 0;
    pivot.position.copy(centre);
    inner.position.copy(centre).negate();
    pivot.add(inner);
    group.add(pivot);
    group.scale.setScalar(scale);
    group.visible = false;
    scene.add(group);
    return { group, pivot, scale, cloth, cover, title, hasCover: Boolean(coverTex), tone, ink };
  });

  const camera = new PerspectiveCamera();
  // Upload every texture and compile every shader now. Otherwise a book
  // that starts off screen pays for its uploads the first frame it scrolls
  // into view, which can drop a frame mid-animation.
  for (const b of built) {
    renderer.initTexture(b.title);
    if (b.cover.map) renderer.initTexture(b.cover.map);
    b.group.visible = true;
  }
  renderer.compile(scene, camera);
  for (const b of built) b.group.visible = false;

  let width = 0;
  let height = 0;
  let last = "";
  let dirty = true;
  let raf = 0;
  let readyFired = false;
  let lost = false;
  // Drag turn, in radians, on one book at a time.
  let turnIndex = -1;
  let turnYaw = 0;
  let dragging = false;
  let prevTime = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function frame(time: number) {
    raf = requestAnimationFrame(frame);
    const dt = prevTime ? Math.min(time - prevTime, 100) : 16;
    prevTime = time;
    if (!dragging && turnYaw !== 0) {
      turnYaw = reducedMotion.matches ? 0 : turnYaw * Math.exp(-dt / SPRING_MS);
      if (Math.abs(turnYaw) < 1e-4) turnYaw = 0;
    }
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      renderer.setSize(w, h);
      dirty = true;
    }
    const vp = viewport.getBoundingClientRect();
    const poses = books.map((book, i) => {
      // Rects, not offsetLeft: offsets are rounded to whole pixels and would
      // make books jitter while a neighbour's width animates.
      const r = book.el.getBoundingClientRect();
      const m = new DOMMatrixReadOnly(getComputedStyle(book.cover).transform);
      const tone = getComputedStyle(book.spine).backgroundColor;
      const ink = getComputedStyle(book.title).color;
      const b = built[i];
      if (tone !== b.tone || ink !== b.ink) {
        // The spine colours arrive once the covers have been averaged.
        b.tone = tone;
        b.ink = ink;
        paintSpine(b.title.image as HTMLCanvasElement, book, tone, ink);
        b.title.needsUpdate = true;
        if (!b.hasCover) b.cover.color.setStyle(tone);
        dirty = true;
      }
      return {
        left: r.left - vp.left,
        top: r.top - vp.top,
        w: r.width,
        h: r.height,
        angle: Math.atan2(-m.m13, m.m11),
        perspective: parseFloat(getComputedStyle(book.el).perspective) || 1000,
      };
    });
    const state = JSON.stringify(poses) + turnIndex + turnYaw;
    if (!dirty && state === last) return;
    last = state;
    dirty = false;

    renderer.clear();
    poses.forEach((p, i) => {
      const book = books[i];
      // A turning cover can reach a cover's width past its own box.
      if (p.left > width || p.left + p.w + book.coverPx < 0) return;
      const b = built[i];
      const d = p.perspective;
      const ox = p.left + p.w / 2;
      const oy = p.top + p.h / 2;
      const near = 1;
      const k = near / d;
      camera.position.set(ox, -oy, d);
      camera.updateMatrixWorld();
      camera.projectionMatrix.makePerspective(-ox * k, (width - ox) * k, oy * k, (oy - height) * k, near, d * 4);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

      b.group.position.set(p.left + book.spinePx, -oy, 0);
      b.group.rotation.y = p.angle - Math.PI / 2;
      b.pivot.rotation.y = i === turnIndex ? turnYaw : 0;
      for (const other of built) other.group.visible = other === b;
      renderer.clearDepth();
      renderer.render(scene, camera);
    });
    if (!readyFired) {
      readyFired = true;
      onReady();
    }
  }

  const io = new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(raf);
    if (entry.isIntersecting && !lost) {
      dirty = true;
      prevTime = 0;
      raf = requestAnimationFrame(frame);
    }
  });
  io.observe(viewport);

  const handleLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
    console.warn("bookshelf: WebGL context lost, falling back to the CSS shelf");
    onLost();
  };
  canvas.addEventListener("webglcontextlost", handleLost);

  return {
    /** Turns book `index` by `yaw` radians while dragged; null lets it spring back. */
    turn(index: number, yaw: number | null) {
      if (index !== turnIndex) {
        turnIndex = index;
        turnYaw = 0;
      }
      dragging = yaw !== null;
      if (yaw !== null) turnYaw = yaw;
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      canvas.removeEventListener("webglcontextlost", handleLost);
      for (const b of built) {
        b.group.traverse((obj) => {
          if (obj instanceof Mesh) (obj.geometry as BufferGeometry).dispose();
        });
        b.title.dispose();
        b.cloth.dispose();
        b.cover.map?.dispose();
        b.cover.dispose();
      }
      paper.dispose();
      headband.dispose();
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

export type Shelf3D = Awaited<ReturnType<typeof mountShelf3D>>;
