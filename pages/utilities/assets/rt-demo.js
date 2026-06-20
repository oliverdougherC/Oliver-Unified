const d=[0,2.35,6.2],S=[0,.92,0],R=Math.tan(48*Math.PI/180/2),E=[{position:[-1.32,.46,-.25],radius:.46,color:[.93,.28,.16],material:0,movable:!0},{position:[0,.62,.18],radius:.62,color:[.82,.84,.88],material:1,movable:!0},{position:[1.22,.5,-.55],radius:.5,color:[.22,.62,.94],material:2,movable:!0},{position:[-.42,.34,1.08],radius:.34,color:[.86,.76,.36],material:0,movable:!0},{position:[.92,2.65,1.18],radius:.2,color:[1,.82,.46],material:3,movable:!0}],P=`
struct Uniforms {
  data: array<vec4f, 16>,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
};

struct Ray {
  origin: vec3f,
  direction: vec3f,
};

struct Hit {
  distance: f32,
  index: i32,
  position: vec3f,
  normal: vec3f,
  color: vec3f,
  material: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(3.0, 1.0),
    vec2f(-1.0, 1.0)
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  return output;
}

fn sphereA(index: i32) -> vec4f {
  return uniforms.data[5 + (index * 2)];
}

fn sphereB(index: i32) -> vec4f {
  return uniforms.data[6 + (index * 2)];
}

fn intersectSphere(ray: Ray, index: i32) -> Hit {
  let dataA = sphereA(index);
  let center = dataA.xyz;
  let radius = dataA.w;
  let oc = ray.origin - center;
  let halfB = dot(oc, ray.direction);
  let c = dot(oc, oc) - radius * radius;
  let discriminant = halfB * halfB - c;
  var hit: Hit;
  hit.distance = 1.0e20;
  hit.index = -1;
  hit.position = vec3f(0.0);
  hit.normal = vec3f(0.0, 1.0, 0.0);
  hit.color = vec3f(0.0);
  hit.material = 0.0;
  if (discriminant < 0.0) {
    return hit;
  }
  let root = sqrt(discriminant);
  var t = -halfB - root;
  if (t < 0.01) {
    t = -halfB + root;
  }
  if (t < 0.01) {
    return hit;
  }
  let material = sphereB(index);
  hit.distance = t;
  hit.index = index;
  hit.position = ray.origin + ray.direction * t;
  hit.normal = normalize(hit.position - center);
  hit.color = material.xyz;
  hit.material = material.w;
  return hit;
}

fn intersectFloor(ray: Ray) -> Hit {
  var hit: Hit;
  hit.distance = 1.0e20;
  hit.index = -2;
  hit.position = vec3f(0.0);
  hit.normal = vec3f(0.0, 1.0, 0.0);
  hit.color = vec3f(0.58, 0.56, 0.52);
  hit.material = 0.0;
  let denom = ray.direction.y;
  if (abs(denom) < 0.0001) {
    return hit;
  }
  let t = -ray.origin.y / denom;
  if (t < 0.01) {
    return hit;
  }
  let position = ray.origin + ray.direction * t;
  if (abs(position.x) > 4.0 || abs(position.z) > 3.2) {
    return hit;
  }
  let grid = step(0.035, abs(fract(position.x * 1.55) - 0.5)) * step(0.035, abs(fract(position.z * 1.55) - 0.5));
  hit.distance = t;
  hit.position = position;
  hit.color = mix(vec3f(0.42, 0.41, 0.39), vec3f(0.64, 0.62, 0.58), grid);
  return hit;
}

fn traceClosest(ray: Ray, ignoreIndex: i32) -> Hit {
  var closest = intersectFloor(ray);
  let objectCount = i32(uniforms.data[4].w);
  for (var index = 0; index < 5; index = index + 1) {
    if (index >= objectCount || index == ignoreIndex) {
      continue;
    }
    let hit = intersectSphere(ray, index);
    if (hit.distance < closest.distance) {
      closest = hit;
    }
  }
  return closest;
}

fn sky(direction: vec3f) -> vec3f {
  let t = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
  let horizon = vec3f(0.34, 0.38, 0.42);
  let zenith = vec3f(0.025, 0.035, 0.055);
  return mix(horizon, zenith, t);
}

fn directLight(hit: Hit) -> vec3f {
  let lightData = sphereA(4);
  let lightPosition = lightData.xyz;
  let toLight = lightPosition - hit.position;
  let lightDistance = length(toLight);
  let lightDirection = toLight / lightDistance;
  let ndotl = max(dot(hit.normal, lightDirection), 0.0);
  var visibility = 1.0;
  let shadowRay = Ray(hit.position + hit.normal * 0.025, lightDirection);
  let shadowHit = traceClosest(shadowRay, 4);
  if (shadowHit.distance < lightDistance - 0.08) {
    visibility = 0.16;
  }
  let attenuation = 5.2 / max(1.0, lightDistance * lightDistance);
  let warmLight = vec3f(1.0, 0.84, 0.58);
  let diffuse = hit.color * warmLight * ndotl * attenuation * visibility;
  let ambient = hit.color * vec3f(0.035, 0.045, 0.055);
  return diffuse + ambient;
}

fn shadeRay(primary: Ray) -> vec3f {
  var ray = primary;
  var throughput = vec3f(1.0);
  var color = vec3f(0.0);
  let selectedIndex = i32(uniforms.data[0].w);

  for (var bounce = 0; bounce < 3; bounce = bounce + 1) {
    let hit = traceClosest(ray, -99);
    if (hit.index == -1) {
      color += throughput * sky(ray.direction);
      break;
    }
    if (hit.material > 2.5) {
      color += throughput * hit.color * 3.8;
      break;
    }

    var lit = directLight(hit);
    if (hit.index == selectedIndex) {
      let edge = pow(1.0 - max(dot(-ray.direction, hit.normal), 0.0), 2.5);
      lit += vec3f(0.7, 0.9, 1.0) * edge * 0.65;
    }

    if (hit.material < 0.5) {
      color += throughput * lit;
      break;
    }

    let reflectivity = select(0.55, 0.92, hit.material < 1.5);
    color += throughput * lit * (1.0 - reflectivity);
    throughput *= mix(vec3f(reflectivity), hit.color * reflectivity, select(0.72, 0.05, hit.material < 1.5));
    ray.origin = hit.position + hit.normal * 0.03;
    ray.direction = normalize(reflect(ray.direction, hit.normal));
  }

  return pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(0.4545));
}

@fragment
fn fsMain(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let resolution = uniforms.data[0].xy;
  let aspect = resolution.x / max(1.0, resolution.y);
  let cameraPosition = uniforms.data[1].xyz;
  let cameraRight = uniforms.data[2].xyz;
  let fovScale = uniforms.data[2].w;
  let cameraUp = uniforms.data[3].xyz;
  let cameraForward = uniforms.data[4].xyz;
  let pixel = (fragCoord.xy / resolution) * 2.0 - vec2f(1.0);
  let uv = vec2f(pixel.x * aspect, -pixel.y) * fovScale;
  let ray = Ray(cameraPosition, normalize(cameraForward + cameraRight * uv.x + cameraUp * uv.y));
  let shaded = shadeRay(ray);
  let vignette = smoothstep(1.42, 0.12, length(pixel));
  return vec4f(shaded * (0.72 + vignette * 0.28), 1.0);
}
`;function u(r,t){return[r[0]+t[0],r[1]+t[1],r[2]+t[2]]}function p(r,t){return[r[0]-t[0],r[1]-t[1],r[2]-t[2]]}function v(r,t){return[r[0]*t,r[1]*t,r[2]*t]}function f(r,t){return r[0]*t[0]+r[1]*t[1]+r[2]*t[2]}function M(r,t){return[r[1]*t[2]-r[2]*t[1],r[2]*t[0]-r[0]*t[2],r[0]*t[1]-r[1]*t[0]]}function g(r){const t=Math.hypot(r[0],r[1],r[2])||1;return[r[0]/t,r[1]/t,r[2]/t]}function x(r,t,e){return Math.min(e,Math.max(t,r))}function T(){const r=navigator.gpu;return r&&typeof r.requestAdapter=="function"?r:null}function w(r,t,e){return globalThis[r]?.[t]??e}class L{constructor(){this.spheres=E.map(t=>({...t,position:[...t.position],color:[...t.color]})),this.cameraForward=g(p(S,d)),this.cameraRight=g(M(this.cameraForward,[0,1,0])),this.cameraUp=g(M(this.cameraRight,this.cameraForward)),this.resizeObserver=null,this.frameId=0,this.frameCount=0,this.fpsFrameCount=0,this.fpsLastTimestamp=0,this.fps=0,this.selectedIndex=-1,this.dragState=null,this.status="booting",this.device=null,this.context=null,this.pipeline=null,this.bindGroup=null,this.uniformBuffer=null,this.uniformData=new Float32Array(64),this.mockContext=null,this.canvas=this.requireElement("rtDemoCanvas",HTMLCanvasElement),this.fpsLabel=this.requireElement("rtDemoFps",HTMLElement),this.infoButton=this.requireElement("rtDemoInfoButton",HTMLButtonElement),this.infoMenu=this.requireElement("rtDemoInfoMenu",HTMLElement)}async init(){if(this.bindInfoMenu(),this.bindPointerEvents(),this.resizeObserver=new ResizeObserver(()=>this.resizeCanvas()),this.resizeObserver.observe(this.canvas),window.addEventListener("resize",()=>this.resizeCanvas()),window.addEventListener("pagehide",()=>this.stop()),document.addEventListener("visibilitychange",()=>{document.hidden?this.stop():this.startLoop()}),window.__OD_RT_DEMO_MOCK_WEBGPU__){this.startMockRenderer();return}try{await this.startWebGpuRenderer()}catch(t){console.error("[RT Demo] WebGPU initialization failed:",t),this.drawUnsupported(t instanceof Error?t.message:"WebGPU could not start.")}}requireElement(t,e){const i=document.getElementById(t);if(!(i instanceof e))throw new Error(`Missing required RT Demo element: ${t}`);return i}bindInfoMenu(){const t=()=>{this.infoMenu.hidden=!0,this.infoButton.setAttribute("aria-expanded","false")},e=()=>{const i=this.infoMenu.hidden;this.infoMenu.hidden=!i,this.infoButton.setAttribute("aria-expanded",i?"true":"false")};this.infoButton.addEventListener("click",i=>{i.stopPropagation(),e()}),this.infoMenu.addEventListener("click",i=>i.stopPropagation()),document.addEventListener("click",t),document.addEventListener("keydown",i=>{i.key==="Escape"&&t()})}bindPointerEvents(){this.canvas.addEventListener("pointerdown",e=>{const i=this.rayFromPointer(e.clientX,e.clientY),a=this.pickSphere(i);if(!a||!this.spheres[a.index]?.movable){this.selectedIndex=-1,this.syncTestState();return}const s=this.spheres[a.index],o=u(i.origin,v(i.direction,a.distance));this.selectedIndex=a.index,this.dragState={index:a.index,planeY:s.position[1],offset:p(s.position,o)},this.canvas.setPointerCapture(e.pointerId),this.canvas.classList.add("is-dragging"),this.syncTestState(),e.preventDefault()}),this.canvas.addEventListener("pointermove",e=>{if(!this.dragState)return;const i=this.rayFromPointer(e.clientX,e.clientY),a=i.direction[1];if(Math.abs(a)<1e-4)return;const s=(this.dragState.planeY-i.origin[1])/a;if(s<=0)return;const o=u(i.origin,v(i.direction,s)),n=u(o,this.dragState.offset),l=this.spheres[this.dragState.index];l.position=[x(n[0],-2.7,2.7),l.material===3?x(n[1],1.35,3.05):Math.max(l.radius,n[1]),x(n[2],-1.95,2.15)],this.syncTestState(),e.preventDefault()});const t=e=>{this.dragState&&this.canvas.releasePointerCapture(e.pointerId),this.dragState=null,this.canvas.classList.remove("is-dragging")};this.canvas.addEventListener("pointerup",t),this.canvas.addEventListener("pointercancel",t)}async startWebGpuRenderer(){const t=T();if(!t)throw new Error("WebGPU is unavailable in this browser or context.");const e=await t.requestAdapter({powerPreference:"high-performance"});if(!e)throw new Error("No WebGPU adapter was found.");this.device=await e.requestDevice();const i=this.canvas.getContext("webgpu");if(!i)throw new Error("Unable to create a WebGPU canvas context.");this.context=i;const a=t.getPreferredCanvasFormat?.()??"bgra8unorm";i.configure({device:this.device,format:a,alphaMode:"opaque",usage:w("GPUTextureUsage","RENDER_ATTACHMENT",16)});const s=this.device.createShaderModule({code:P});this.pipeline=this.device.createRenderPipeline({layout:"auto",vertex:{module:s,entryPoint:"vsMain"},fragment:{module:s,entryPoint:"fsMain",targets:[{format:a}]},primitive:{topology:"triangle-list"}}),this.uniformBuffer=this.device.createBuffer({size:this.uniformData.byteLength,usage:w("GPUBufferUsage","UNIFORM",64)|w("GPUBufferUsage","COPY_DST",8)}),this.bindGroup=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]}),this.device.lost?.then(o=>{o.reason!=="destroyed"&&this.drawUnsupported(o.message||"The WebGPU device was lost.")}),this.status="webgpu",this.resizeCanvas(),this.syncTestState(),this.startLoop()}startMockRenderer(){const t=this.canvas.getContext("2d",{alpha:!1});if(!t){this.drawUnsupported("Unable to create a canvas renderer.");return}this.mockContext=t,this.status="mock",this.resizeCanvas(),this.syncTestState(),this.startLoop()}resizeCanvas(){const t=this.canvas.getBoundingClientRect(),e=Math.min(window.devicePixelRatio||1,2),i=Math.max(1,Math.floor(t.width*e)),a=Math.max(1,Math.floor(t.height*e));(this.canvas.width!==i||this.canvas.height!==a)&&(this.canvas.width=i,this.canvas.height=a)}startLoop(){if(this.frameId||document.hidden)return;this.fpsLastTimestamp=performance.now();const t=e=>{this.frameId=window.requestAnimationFrame(t),this.resizeCanvas(),this.updateFps(e),this.status==="mock"?this.renderMock():this.status==="webgpu"&&this.renderWebGpu(e),this.frameCount+=1,this.syncTestState()};this.frameId=window.requestAnimationFrame(t)}stop(){this.frameId&&(window.cancelAnimationFrame(this.frameId),this.frameId=0)}updateFps(t){this.fpsFrameCount+=1;const e=t-this.fpsLastTimestamp;if(e<300)return;const i=this.fpsFrameCount*1e3/e;this.fps=this.fps===0?i:this.fps*.72+i*.28,this.fpsFrameCount=0,this.fpsLastTimestamp=t,this.fpsLabel.textContent=`FPS ${Math.round(this.fps).toString().padStart(2,"0")}`}renderWebGpu(t){if(!this.device||!this.context||!this.pipeline||!this.bindGroup||!this.uniformBuffer)return;this.writeUniforms(t*.001),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformData);const e=this.device.createCommandEncoder(),i=e.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:"clear",clearValue:{r:.015,g:.017,b:.02,a:1},storeOp:"store"}]});i.setPipeline(this.pipeline),i.setBindGroup(0,this.bindGroup),i.draw(3),i.end(),this.device.queue.submit([e.finish()])}writeUniforms(t){this.uniformData.fill(0),this.writeVec4(0,this.canvas.width,this.canvas.height,t,this.selectedIndex),this.writeVec4(1,d[0],d[1],d[2],0),this.writeVec4(2,this.cameraRight[0],this.cameraRight[1],this.cameraRight[2],this.getViewportFovScale()),this.writeVec4(3,this.cameraUp[0],this.cameraUp[1],this.cameraUp[2],0),this.writeVec4(4,this.cameraForward[0],this.cameraForward[1],this.cameraForward[2],5),this.spheres.forEach((e,i)=>{const a=5+i*2;this.writeVec4(a,e.position[0],e.position[1],e.position[2],e.radius),this.writeVec4(a+1,e.color[0],e.color[1],e.color[2],e.material)})}writeVec4(t,e,i,a,s){const o=t*4;this.uniformData[o]=e,this.uniformData[o+1]=i,this.uniformData[o+2]=a,this.uniformData[o+3]=s}renderMock(){if(!this.mockContext)return;const t=this.mockContext,{width:e,height:i}=this.canvas;t.clearRect(0,0,e,i);const a=t.createLinearGradient(0,0,0,i);a.addColorStop(0,"#090d13"),a.addColorStop(.58,"#151719"),a.addColorStop(1,"#080807"),t.fillStyle=a,t.fillRect(0,0,e,i);const s=i*.72;t.fillStyle="#242321",t.fillRect(0,s,e,i-s),t.strokeStyle="rgba(255, 255, 255, 0.055)",t.lineWidth=1;for(let n=-e;n<e*2;n+=e/14)t.beginPath(),t.moveTo(n,i),t.lineTo(e*.5+(n-e*.5)*.2,s),t.stroke();this.spheres.map((n,l)=>({sphere:n,index:l,projected:this.project(n.position)})).filter(n=>n.projected.visible).sort((n,l)=>l.projected.depth-n.projected.depth).forEach(({sphere:n,index:l,projected:h})=>{const c=Math.max(8,n.radius*h.scale),b=x(1.2-n.position[1]*.2,.35,1.2);t.fillStyle="rgba(0, 0, 0, 0.32)",t.beginPath(),t.ellipse(h.x+c*.34,s+8,c*1.15*b,c*.26*b,0,0,Math.PI*2),t.fill();const m=t.createRadialGradient(h.x-c*.35,h.y-c*.45,c*.1,h.x,h.y,c),y=n.color.map(C=>Math.round(C*255));m.addColorStop(0,n.material===3?"#fff6cc":"rgba(255, 255, 255, 0.95)"),m.addColorStop(.18,`rgb(${y[0]}, ${y[1]}, ${y[2]})`),m.addColorStop(1,n.material===1?"#1d2024":"#121416"),t.fillStyle=m,t.beginPath(),t.arc(h.x,h.y,c,0,Math.PI*2),t.fill(),(n.material===1||n.material===2)&&(t.strokeStyle=n.material===1?"rgba(255, 255, 255, 0.72)":"rgba(190, 220, 255, 0.42)",t.lineWidth=Math.max(1,c*.04),t.beginPath(),t.arc(h.x-c*.14,h.y-c*.08,c*.62,-.55,.95),t.stroke()),l===this.selectedIndex&&(t.strokeStyle="rgba(170, 220, 255, 0.95)",t.lineWidth=3,t.beginPath(),t.arc(h.x,h.y,c+4,0,Math.PI*2),t.stroke())})}drawUnsupported(t){this.status="unsupported",this.stop(),this.resizeCanvas();const e=this.canvas.getContext("2d",{alpha:!1});if(!e){this.status="error";return}const{width:i,height:a}=this.canvas;e.fillStyle="#050607",e.fillRect(0,0,i,a),e.fillStyle="rgba(255, 255, 255, 0.82)",e.font=`${Math.max(16,Math.round(i/72))}px Inter, sans-serif`,e.textAlign="center",e.textBaseline="middle",e.fillText("WebGPU unavailable",i/2,a/2-16),e.fillStyle="rgba(255, 255, 255, 0.48)",e.font=`${Math.max(12,Math.round(i/110))}px Inter, sans-serif`,e.fillText(t,i/2,a/2+18),this.fpsLabel.textContent="FPS --",this.syncTestState()}rayFromPointer(t,e){const i=this.canvas.getBoundingClientRect(),a=(t-i.left)/Math.max(1,i.width)*2-1,s=(e-i.top)/Math.max(1,i.height)*2-1,o=i.width/Math.max(1,i.height),n=this.getViewportFovScale(),l=g(u(u(this.cameraForward,v(this.cameraRight,a*o*n)),v(this.cameraUp,-s*n)));return{origin:d,direction:l}}pickSphere(t){let e=null;return this.spheres.forEach((i,a)=>{const s=p(t.origin,i.position),o=f(s,t.direction),n=f(s,s)-i.radius*i.radius,l=o*o-n;if(l<0)return;const h=Math.sqrt(l);let c=-o-h;c<.01&&(c=-o+h),!(c<.01)&&(!e||c<e.distance)&&(e={index:a,distance:c})}),e}project(t){const e=p(t,d),i=f(e,this.cameraRight),a=f(e,this.cameraUp),s=f(e,this.cameraForward);if(s<=.1)return{visible:!1,x:0,y:0,scale:0,depth:s};const o=this.canvas.height/(2*this.getViewportFovScale()*s);return{visible:!0,x:this.canvas.width/2+i*o,y:this.canvas.height/2-a*o,scale:o,depth:s}}syncTestState(){window.__RT_DEMO_STATE__={status:this.status,selectedIndex:this.selectedIndex,frameCount:this.frameCount,fps:this.fps,spheres:this.spheres.map(t=>({x:t.position[0],y:t.position[1],z:t.position[2],radius:t.radius,material:t.material}))}}getViewportFovScale(){const t=this.canvas.getBoundingClientRect(),e=t.width/Math.max(1,t.height);return R*(e<.82?.82/Math.max(.32,e):1)}}document.addEventListener("DOMContentLoaded",()=>{new L().init().catch(t=>{console.error("[RT Demo] Fatal initialization error:",t)})});
