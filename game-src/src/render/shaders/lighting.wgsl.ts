export const LIGHTING_GBUFFER_WGSL = /* wgsl */ `
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@location(0) position: vec2f, @location(1) uv: vec2f) -> VsOut {
  var out: VsOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = uv;
  return out;
}

@fragment
fn fs_main(input: VsOut) -> @location(0) vec4f {
  // Placeholder gbuffer stage. The live pipeline currently uses Pixi draw targets.
  return vec4f(input.uv, 0.0, 1.0);
}
`;

export const LIGHTING_RESOLVE_WGSL = /* wgsl */ `
@group(0) @binding(0) var gAlbedo: texture_2d<f32>;
@group(0) @binding(1) var gSampler: sampler;

@fragment
fn fs_resolve(@location(0) uv: vec2f) -> @location(0) vec4f {
  let color = textureSample(gAlbedo, gSampler, uv);
  return color;
}
`;
