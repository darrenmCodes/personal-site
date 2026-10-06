export const VERTEX_SHADER = /* glsl */ `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Output is premultiplied alpha composited over the page with normal blending.
// Every effect is an "over" of a colour at some alpha, so the result is always
// a valid premultiplied pixel. The overlay can't see the page beneath it:
// halation lives in CSS instead (see --halation-text and MediaSlot).
export const FRAGMENT_SHADER = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uScale;      // canvas px per CSS px
uniform float uTime;       // seconds
uniform float uFrame;      // projected frame count, 18 per second
uniform float uMotion;     // 0 when held still
uniform float uGrain;
uniform float uFlicker;
uniform float uVignette;
uniform vec3 uVignetteTint;
uniform float uLeak;
uniform vec3 uLeakA;
uniform vec3 uLeakB;
uniform float uDust;
uniform vec3 uWash;
uniform float uWashAlpha;
uniform float uSprocket;   // 0..1 envelope, driven from JS

const vec3 DARK = vec3(0.16, 0.1, 0.06);
const vec3 LIGHT = vec3(1.0, 0.97, 0.9);

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec4 over(vec4 dst, vec3 col, float a) {
  a = clamp(a, 0.0, 1.0);
  return vec4(col * a + dst.rgb * (1.0 - a), a + dst.a * (1.0 - a));
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / uRes;
  vec2 css = px / uScale;
  float aspect = uRes.x / uRes.y;
  vec4 o = vec4(0.0);

  o = over(o, uWash, uWashAlpha);

  // Vignette: elliptical, only really bites in the corners.
  float d = length(uv - 0.5) * 1.414;
  o = over(o, uVignetteTint, smoothstep(0.5, 1.08, d) * uVignette);

  // Light leaks: two warm blooms wandering in from the edges, coming and going.
  vec2 la = vec2(1.08, 0.55 + 0.32 * sin(uTime * 0.11));
  vec2 lb = vec2(0.15 + 0.25 * sin(uTime * 0.07 + 2.0), 1.12);
  float ea = pow(0.5 + 0.5 * sin(uTime * 0.13), 2.0);
  float eb = pow(0.5 + 0.5 * sin(uTime * 0.09 + 1.3), 2.0);
  vec2 sa = (uv - la) * vec2(aspect, 1.0);
  vec2 sb = (uv - lb) * vec2(aspect, 1.0);
  o = over(o, uLeakA, exp(-dot(sa, sa) * 3.2) * ea * uLeak);
  o = over(o, uLeakB, exp(-dot(sb, sb) * 4.0) * eb * uLeak);

  // Exposure: slow drift plus a whisper of per-frame wobble.
  float drift = sin(uTime * 2.1) * 0.6 + sin(uTime * 5.3 + 1.7) * 0.4;
  float wobble = hash11(uFrame * 0.618 + 3.0) - 0.5;
  float f = (drift * 0.5 + wobble * 0.35) * uFlicker * uMotion;
  o = f > 0.0 ? over(o, LIGHT, f) : over(o, DARK, -f);

  // Grain: two octaves, re-rolled every projected frame.
  vec2 seed = vec2(mod(uFrame, 97.0) * 13.7, mod(uFrame, 89.0) * 7.3);
  float g = (hash12(px + seed) - 0.5) * 0.65 + (hash12(floor(px * 0.5) + seed.yx) - 0.5) * 0.35;
  g *= 2.0 * uGrain;
  o = g > 0.0 ? over(o, LIGHT, g * 0.7) : over(o, DARK, -g);

  // Dust and hairs: new every frame, like real dirt in the gate.
  float dustAmt = uDust * uMotion;
  if (dustAmt > 0.0) {
    float speck = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      if (hash11(uFrame * 1.31 + fi * 17.17) > 0.42) continue;
      vec2 pos = vec2(hash11(uFrame * 2.17 + fi * 3.1), hash11(uFrame * 0.73 + fi * 9.7)) * uRes;
      float r = mix(0.7, 2.6, hash11(fi * 5.3 + uFrame * 1.9)) * uScale * 1.4;
      speck += 1.0 - smoothstep(r * 0.35, r, length(px - pos));
    }
    if (hash11(uFrame * 0.37 + 11.0) < 0.12) {
      vec2 c = vec2(hash11(uFrame + 2.0), hash11(uFrame + 5.0)) * uRes;
      float ang = hash11(uFrame + 8.0) * 6.283;
      vec2 l = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (px - c) / uScale;
      float bend = sin(l.x * 0.06) * 7.0;
      float hair = (1.0 - smoothstep(0.3, 0.9, abs(l.y - bend))) * step(abs(l.x), 38.0);
      speck += hair;
    }
    o = over(o, DARK, clamp(speck, 0.0, 1.0) * 0.42 * dustAmt);

    // A scratch that hangs around for ten frames or so.
    float slot = floor(uFrame / 10.0);
    if (hash11(slot * 7.7) > 0.8) {
      float sx = (hash11(slot * 3.3) + sin(uv.y * 3.0 + uFrame * 0.07) * 0.002) * uRes.x;
      float line = 1.0 - smoothstep(0.0, 1.0 * uScale, abs(px.x - sx));
      o = over(o, LIGHT, line * 0.28 * dustAmt);
    }
  }

  // Sprocket holes and a frame line: they drift into the gate now and then.
  if (uSprocket > 0.0) {
    float stripW = 26.0;
    float pitch = 46.0;
    float inStrip = 1.0 - smoothstep(stripW - 2.0, stripW + 2.0, css.x);
    vec2 hp = vec2(css.x - stripW * 0.5, mod(css.y, pitch) - pitch * 0.5);
    float hole = 1.0 - smoothstep(-0.6, 0.6, sdRoundBox(hp, vec2(6.0, 8.5), 2.2));
    o = over(o, DARK, inStrip * 0.42 * uSprocket);
    o = over(o, LIGHT, hole * inStrip * 0.75 * uSprocket);
    float frameLine = 1.0 - smoothstep(1.0, 3.0, abs(css.y - (uRes.y / uScale - 14.0)));
    o = over(o, DARK, frameLine * 0.32 * uSprocket);
  }

  gl_FragColor = o;
}
`;
