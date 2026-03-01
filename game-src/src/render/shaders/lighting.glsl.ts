export const LIGHTING_VERTEX_GLSL = /* glsl */ `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;

void main(void) {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const LIGHTING_FRAGMENT_GLSL = /* glsl */ `
precision mediump float;
varying vec2 vUV;

void main(void) {
  gl_FragColor = vec4(vUV.xy, 0.0, 1.0);
}
`;
