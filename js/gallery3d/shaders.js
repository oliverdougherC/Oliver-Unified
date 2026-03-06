export const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vViewPosition;
varying vec3 vWorldNormal;

void main() {
  vUv = uv;
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vViewPosition = viewPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewPosition;
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_hoverState;
uniform vec2 u_res;
uniform vec2 u_planeRes;
uniform float u_depthPhase;
uniform float u_fresnelStrength;
uniform float u_refractionStrength;
uniform float u_chromaticStrength;
uniform float u_glossStrength;
uniform float u_grainAmount;
uniform float u_qualityLevel;
uniform float u_temperature;
uniform float u_tint;
uniform float u_exposure;
uniform float u_opacity;
uniform float u_cornerRadius;
uniform float u_edgeSoftness;
uniform float u_thickness;
uniform float u_materialMix;

varying vec2 vUv;
varying vec3 vViewPosition;
varying vec3 vWorldNormal;

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 1.0) * x);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );

  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289(i);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) +
    i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
    0.5 - vec3(
      dot(x0, x0),
      dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)
    ),
    0.0
  );

  m *= m;
  m *= m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

vec2 coverUv(vec2 uv, vec2 textureSize, vec2 planeSize) {
  float textureRatio = textureSize.x / textureSize.y;
  float planeRatio = planeSize.x / planeSize.y;
  vec2 scaled = uv;

  if (planeRatio < textureRatio) {
    float sx = planeRatio / textureRatio;
    scaled.x = uv.x * sx + (1.0 - sx) * 0.5;
  } else {
    float sy = textureRatio / planeRatio;
    scaled.y = uv.y * sy + (1.0 - sy) * 0.5;
  }

  return scaled;
}

vec3 applyColorGrade(vec3 color) {
  float exposure = clamp(u_exposure, 0.98, 1.02);
  color *= exposure;
  return clamp(color, 0.0, 1.0);
}

vec2 aspectSpace(vec2 uv) {
  vec2 centered = uv - 0.5;
  float planeAspect = max(u_planeRes.x / max(u_planeRes.y, 1.0), 0.001);
  if (planeAspect >= 1.0) {
    centered.x *= planeAspect;
  } else {
    centered.y *= (1.0 / planeAspect);
  }
  return centered;
}

vec2 aspectHalfSize() {
  float planeAspect = max(u_planeRes.x / max(u_planeRes.y, 1.0), 0.001);
  vec2 halfSize = vec2(0.5);
  if (planeAspect >= 1.0) {
    halfSize.x *= planeAspect;
  } else {
    halfSize.y *= (1.0 / planeAspect);
  }
  return halfSize;
}

float roundedRectSdfAspect(vec2 uv, float radius) {
  vec2 p = aspectSpace(uv);
  vec2 halfSize = aspectHalfSize();
  vec2 q = abs(p) - (halfSize - vec2(radius));
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec2 uv = coverUv(vUv, u_res, u_planeRes);

  float radius = clamp(u_cornerRadius, 0.005, 0.18);
  float edgeSoft = max(u_edgeSoftness, 0.0016);
  float sdf = roundedRectSdfAspect(vUv, radius);

  float paneMask = 1.0 - smoothstep(-edgeSoft, edgeSoft, sdf);
  if (paneMask <= 0.0008) {
    discard;
  }

  float rimBand = smoothstep(-edgeSoft * 1.3, -edgeSoft * 0.2, sdf) *
    (1.0 - smoothstep(0.0, edgeSoft * 1.1, sdf));

  vec2 toMouse = uv - u_mouse;
  float mouseDist = length(toMouse);
  float hoverFocus = exp(-15.0 * mouseDist * mouseDist) * u_hoverState;

  float surfaceNoise = snoise(uv * 4.2 + vec2(u_time * 0.01, -u_time * 0.009));
  float microNoise = snoise(uv * 14.0 + vec2(-u_time * 0.018, u_time * 0.016));
  float imperfection = (surfaceNoise * 0.00008 + microNoise * 0.00004) * mix(0.32, 0.74, u_qualityLevel);

  float px = 1.2 / max(min(u_planeRes.x, u_planeRes.y), 1.0);
  float sx = (snoise((uv + vec2(px, 0.0)) * 4.2 + vec2(u_time * 0.01, -u_time * 0.009)) * 0.00008) - (surfaceNoise * 0.00008);
  float sy = (snoise((uv + vec2(0.0, px)) * 4.2 + vec2(u_time * 0.01, -u_time * 0.009)) * 0.00008) - (surfaceNoise * 0.00008);

  vec3 n = normalize(vec3(-(sx + imperfection) * 4.1, -(sy + imperfection) * 4.1, 1.0));
  vec3 viewDir = normalize(-vViewPosition);
  vec3 worldN = normalize(mix(vWorldNormal, n, 0.24));

  vec3 lightDir = normalize(vec3(-0.24, 0.34, 0.91));
  vec3 lightDir2 = normalize(vec3(0.28, -0.16, 0.95));

  float fresnel = pow(1.0 - max(dot(worldN, viewDir), 0.0), 2.8);
  float specular = pow(max(dot(reflect(-lightDir, worldN), viewDir), 0.0), mix(42.0, 96.0, u_glossStrength));
  float specular2 = pow(max(dot(reflect(-lightDir2, worldN), viewDir), 0.0), mix(56.0, 116.0, u_glossStrength)) * 0.55;

  float refractMix = u_refractionStrength * mix(0.14, 0.28, hoverFocus) * mix(0.48, 0.8, u_depthPhase);
  vec2 refractOffset = n.xy * refractMix;
  float edgeFactor = 1.0 - smoothstep(-edgeSoft * 2.0, edgeSoft * 1.6, sdf);
  vec2 edgeDir = normalize(aspectSpace(vUv) + vec2(0.0001));
  vec2 edgeParallax = edgeDir * edgeFactor * u_thickness * 0.00018;
  vec2 sampleUv = clamp(uv + refractOffset - edgeParallax, vec2(0.001), vec2(0.999));

  float chroma = u_chromaticStrength * mix(0.45, 1.0, hoverFocus);
  vec2 cDir = normalize(n.xy + vec2(0.0001));
  vec2 cOffset = cDir * chroma;

  vec3 baseColor = texture2D(u_image, uv).rgb;
  float r = texture2D(u_image, clamp(sampleUv + cOffset, vec2(0.001), vec2(0.999))).r;
  float g = texture2D(u_image, sampleUv).g;
  float b = texture2D(u_image, clamp(sampleUv - cOffset, vec2(0.001), vec2(0.999))).b;
  vec3 refractedColor = vec3(r, g, b);

  float materialWeight = clamp(0.004 + u_materialMix * 0.72, 0.004, 0.03);
  vec3 photoColor = applyColorGrade(baseColor);
  vec3 glassColor = mix(photoColor, refractedColor, materialWeight * 0.52);
  vec3 color = mix(photoColor, glassColor, materialWeight);

  vec3 rimTint = vec3(1.0);
  color += rimTint * fresnel * u_fresnelStrength * (0.008 + 0.013 * u_materialMix);
  color += vec3(1.0) * specular * (0.00024 + u_glossStrength * 0.00068) * u_materialMix;
  color += vec3(1.0) * specular2 * (0.00018 + u_glossStrength * 0.00046) * u_materialMix;
  color += rimTint * rimBand * 0.0008 * u_materialMix;

  float grain = (snoise(vUv * 168.0 + u_time * 0.05) * 0.5 + 0.5) * u_grainAmount * 0.025;
  color += grain;

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, clamp(u_opacity, 0.0, 1.0) * paneMask);
}
`;
