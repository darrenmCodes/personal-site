import { Color, MeshPhysicalMaterial, MeshStandardMaterial, type Texture, type WebGLProgramParametersWithUniforms } from "three";

// Ports of the procedural shaders in ~/Documents/Blender/hardback-book.blend.
// Blender's textures don't survive glTF export, so wear and page lines are
// worked out here from the same inputs: the per-vertex `wear` weight baked
// into the model, and the position in millimetres (vBookPos). Every book
// is turned so x runs across the spine, y up and -z towards the fore-edge.

const DECLARE = /* glsl */ `
varying float vWear;
varying vec3 vBookPos;
`;

const NOISE = /* glsl */ `
float bkHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float bkNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(bkHash(i), bkHash(i + vec3(1, 0, 0)), f.x),
        mix(bkHash(i + vec3(0, 1, 0)), bkHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(bkHash(i + vec3(0, 0, 1)), bkHash(i + vec3(1, 0, 1)), f.x),
        mix(bkHash(i + vec3(0, 1, 1)), bkHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float bkFbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * bkNoise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
`;

// Cloth worn through to the grey board at the corners and spine ends, with
// a grimy ring around each worn patch. Thresholds match the Blender file.
const CLOTH = /* glsl */ `
float bkSlub = bkNoise(vBookPos * vec3(0.8, 0.15, 0.8));
diffuseColor.rgb *= 0.97 + 0.06 * bkSlub;
float bkW = vWear + bkFbm(vBookPos * 0.9) * 0.6 - 0.3;
float bkWorn = smoothstep(0.42, 0.62, bkW);
float bkGrime = smoothstep(0.15, 0.45, bkW) * 0.45;
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.5, 0.45), bkGrime);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(0.52, 0.47, 0.39), 0.7), bkWorn);
`;

// Page lines run across the thickness (x). Leaves are 0.13 mm apart, far
// below a pixel on the shelf, so each layer fades out once fwidth says it
// would only shimmer.
const PAPER = /* glsl */ `
float bkX = vBookPos.x;
float bkFw = fwidth(bkX);
float bkLeaves = 0.5 + 0.5 * sin(bkX * 6.2831853 / 0.13);
float bkLines = smoothstep(0.56, 0.68, bkFbm(vec3(vBookPos.z * 0.025, vBookPos.y * 0.025, bkX * 1.8)));
float bkSig = smoothstep(0.9, 1.0, fract(bkX / 2.09)) * 0.6;
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.93, 0.92, 0.9), bkLeaves * (1.0 - smoothstep(0.03, 0.09, bkFw)));
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.58, 0.52), bkLines * (1.0 - smoothstep(0.3, 0.8, bkFw)));
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.52, 0.48), bkSig * (1.0 - smoothstep(1.0, 2.0, bkFw)));
float bkDust = smoothstep(0.1, 0.6, bkFbm(vBookPos * 0.3) * vWear) * 0.6;
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.55, 0.43), bkDust);
`;

function inject(shader: WebGLProgramParametersWithUniforms, colour: string, roughness: string) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\nattribute float bookWear;\n${DECLARE}`)
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWear = bookWear;\nvBookPos = position;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${DECLARE}\n${NOISE}`)
    .replace("#include <color_fragment>", `#include <color_fragment>\n${colour}`)
    .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${roughness}`);
}

/** Book cloth. `map` carries the spine colour and title, or the cover image. */
export function clothMaterial(map: Texture | null): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: 0xffffff,
    map,
    roughness: 0.82,
    sheen: 0.35,
    sheenRoughness: 0.4,
    sheenColor: new Color(1, 1, 1),
    specularIntensity: 0.35,
  });
  m.onBeforeCompile = (shader) => inject(shader, CLOTH, "roughnessFactor = mix(roughnessFactor, 0.95, bkWorn);");
  m.customProgramCacheKey = () => "bookshelf-cloth";
  return m;
}

export function paperMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: new Color(0.8, 0.73, 0.58), roughness: 0.88 });
  m.onBeforeCompile = (shader) => inject(shader, PAPER, "");
  m.customProgramCacheKey = () => "bookshelf-paper";
  return m;
}

/** Red-and-cream silk headbands, averaged: the stripes are under a pixel at shelf size. */
export function headbandMaterial(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: new Color(0.6, 0.39, 0.3), roughness: 0.5, sheen: 0.6 });
}
