import type { LookParams } from "./looks";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders";

export interface FilmFrame {
  time: number;
  frame: number;
  motion: boolean;
  sprocket: number;
  look: LookParams;
}

export interface FilmRenderer {
  resize(cssWidth: number, cssHeight: number): void;
  draw(frame: FilmFrame): void;
  dispose(): void;
}

// Grain reads better slightly soft, and this keeps fill cost flat on 3x phones.
// Device pixel ratio is ignored on purpose.
const RENDER_SCALE = 0.6;
const MAX_PIXELS = 1_400_000;

const UNIFORMS = [
  "uRes",
  "uScale",
  "uTime",
  "uFrame",
  "uMotion",
  "uGrain",
  "uFlicker",
  "uVignette",
  "uVignetteTint",
  "uLeak",
  "uLeakA",
  "uLeakB",
  "uDust",
  "uWash",
  "uWashAlpha",
  "uSprocket",
] as const;
type UniformName = (typeof UNIFORMS)[number];

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("film: could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`film: shader compile failed: ${log ?? "no log"}`);
  }
  return shader;
}

/** Returns null when WebGL isn't available; the caller falls back to CSS grain. */
export function createFilmRenderer(canvas: HTMLCanvasElement): FilmRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  let program: WebGLProgram;
  let vs: WebGLShader;
  let fs: WebGLShader;
  try {
    vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const p = gl.createProgram();
    if (!p) throw new Error("film: could not create program");
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`film: program link failed: ${gl.getProgramInfoLog(p) ?? "no log"}`);
    }
    program = p;
  } catch (err) {
    console.error(err);
    return null;
  }

  gl.useProgram(program);

  // One oversized triangle covers the screen with no seam down the diagonal.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPosition = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const loc = {} as Record<UniformName, WebGLUniformLocation | null>;
  for (const name of UNIFORMS) loc[name] = gl.getUniformLocation(program, name);

  let scale = RENDER_SCALE;

  return {
    resize(cssWidth, cssHeight) {
      const pixels = cssWidth * cssHeight * RENDER_SCALE * RENDER_SCALE;
      scale = pixels > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / (cssWidth * cssHeight)) : RENDER_SCALE;
      canvas.width = Math.max(1, Math.round(cssWidth * scale));
      canvas.height = Math.max(1, Math.round(cssHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw({ time, frame, motion, sprocket, look }) {
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform1f(loc.uScale, scale);
      gl.uniform1f(loc.uTime, time);
      gl.uniform1f(loc.uFrame, frame);
      gl.uniform1f(loc.uMotion, motion ? 1 : 0);
      gl.uniform1f(loc.uGrain, look.grain);
      gl.uniform1f(loc.uFlicker, look.flicker);
      gl.uniform1f(loc.uVignette, look.vignette);
      gl.uniform3fv(loc.uVignetteTint, look.vignetteTint);
      gl.uniform1f(loc.uLeak, look.leak);
      gl.uniform3fv(loc.uLeakA, look.leakA);
      gl.uniform3fv(loc.uLeakB, look.leakB);
      gl.uniform1f(loc.uDust, look.dust);
      gl.uniform3fv(loc.uWash, look.wash);
      gl.uniform1f(loc.uWashAlpha, look.washAlpha);
      gl.uniform1f(loc.uSprocket, sprocket);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
