const L=[0,.68,0],M=6.85,T=4.6,_=.16,F=.28,B=Math.tan(48*Math.PI/180/2),A=0,C=4,D=5.8,S=.42,U=4.2,O=.24,G=.42,k=2.7,w=2.75,b=2.15,z=[{position:[-1.32,.46,-.25],velocity:[0,0,0],radius:.46,color:[.93,.28,.16],material:0,movable:!0},{position:[0,.62,.18],velocity:[0,0,0],radius:.62,color:[.82,.84,.88],material:1,movable:!0},{position:[1.22,.5,-.55],velocity:[0,0,0],radius:.5,color:[.22,.62,.94],material:2,movable:!0},{position:[-.42,.34,1.08],velocity:[0,0,0],radius:.34,color:[.86,.76,.36],material:0,movable:!0},{position:[.92,2.65,1.18],velocity:[0,0,0],radius:.2,color:[1,.82,.46],material:3,movable:!0}],V=`
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
  hit.color = vec3f(0.12, 0.12, 0.11);
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
  hit.color = mix(vec3f(0.07, 0.07, 0.065), vec3f(0.16, 0.155, 0.14), grid);
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
  return vec3f(0.028, 0.029, 0.027);
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
  let ambient = hit.color * vec3f(0.018, 0.02, 0.022);
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
`;function u(a,t){return[a[0]+t[0],a[1]+t[1],a[2]+t[2]]}function m(a,t){return[a[0]-t[0],a[1]-t[1],a[2]-t[2]]}function d(a,t){return[a[0]*t,a[1]*t,a[2]*t]}function g(a,t){return a[0]*t[0]+a[1]*t[1]+a[2]*t[2]}function I(a,t){return[a[1]*t[2]-a[2]*t[1],a[2]*t[0]-a[0]*t[2],a[0]*t[1]-a[1]*t[0]]}function P(a){const t=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/t,a[1]/t,a[2]/t]}function H(a,t){const i=Math.hypot(a[0],a[1],a[2]);return i<=t||i===0?a:d(a,t/i)}function p(a,t,i){return Math.min(i,Math.max(t,a))}function N(){const a=navigator.gpu;return a&&typeof a.requestAdapter=="function"?a:null}function E(a,t,i){return globalThis[a]?.[t]??i}class W{constructor(){this.spheres=z.map(t=>({...t,position:[...t.position],velocity:[...t.velocity],color:[...t.color]})),this.cameraPosition=[0,T,M],this.cameraForward=[0,0,-1],this.cameraRight=[1,0,0],this.cameraUp=[0,1,0],this.cameraAngle=F,this.cameraPaused=!1,this.resizeObserver=null,this.frameId=0,this.frameCount=0,this.lastPhysicsTimestamp=0,this.fpsFrameCount=0,this.fpsLastTimestamp=0,this.fps=0,this.selectedIndex=-1,this.dragState=null,this.status="booting",this.device=null,this.context=null,this.pipeline=null,this.bindGroup=null,this.uniformBuffer=null,this.uniformData=new Float32Array(64),this.mockContext=null,this.canvas=this.requireElement("rtDemoCanvas",HTMLCanvasElement),this.fpsLabel=this.requireElement("rtDemoFps",HTMLElement),this.cameraButton=this.requireElement("rtDemoCameraButton",HTMLButtonElement),this.infoButton=this.requireElement("rtDemoInfoButton",HTMLButtonElement),this.infoMenu=this.requireElement("rtDemoInfoMenu",HTMLElement),this.updateCamera(0)}async init(){if(this.bindInfoMenu(),this.bindCameraButton(),this.bindPointerEvents(),this.resizeObserver=new ResizeObserver(()=>this.resizeCanvas()),this.resizeObserver.observe(this.canvas),window.addEventListener("resize",()=>this.resizeCanvas()),window.addEventListener("pagehide",()=>this.stop()),document.addEventListener("visibilitychange",()=>{document.hidden?this.stop():this.startLoop()}),window.__OD_RT_DEMO_MOCK_WEBGPU__){this.startMockRenderer();return}try{await this.startWebGpuRenderer()}catch(t){console.error("[RT Demo] WebGPU initialization failed:",t),this.drawUnsupported(t instanceof Error?t.message:"WebGPU could not start.")}}requireElement(t,i){const e=document.getElementById(t);if(!(e instanceof i))throw new Error(`Missing required RT Demo element: ${t}`);return e}bindInfoMenu(){const t=()=>{this.infoMenu.hidden=!0,this.infoButton.setAttribute("aria-expanded","false")},i=()=>{const e=this.infoMenu.hidden;this.infoMenu.hidden=!e,this.infoButton.setAttribute("aria-expanded",e?"true":"false")};this.infoButton.addEventListener("click",e=>{e.stopPropagation(),i()}),this.infoMenu.addEventListener("click",e=>e.stopPropagation()),document.addEventListener("click",t),document.addEventListener("keydown",e=>{e.key==="Escape"&&t()})}bindCameraButton(){this.cameraButton.addEventListener("click",t=>{t.stopPropagation(),this.cameraPaused=!this.cameraPaused,this.cameraButton.setAttribute("aria-pressed",this.cameraPaused?"true":"false"),this.cameraButton.setAttribute("aria-label",this.cameraPaused?"Resume orbiting camera":"Pause orbiting camera"),this.cameraButton.title=this.cameraPaused?"Resume camera":"Pause camera",this.cameraButton.textContent=this.cameraPaused?">":"||",this.syncTestState()})}updateCamera(t){this.cameraPaused||(this.cameraAngle+=t*_),this.cameraPosition=[Math.sin(this.cameraAngle)*M,T,Math.cos(this.cameraAngle)*M],this.cameraForward=P(m(L,this.cameraPosition)),this.cameraRight=P(I(this.cameraForward,[0,1,0])),this.cameraUp=P(I(this.cameraRight,this.cameraForward))}bindPointerEvents(){this.canvas.addEventListener("pointerdown",i=>{const e=this.rayFromPointer(i.clientX,i.clientY),s=this.pickSphere(e);if(!s||!this.spheres[s.index]?.movable){this.selectedIndex=-1,this.syncTestState();return}const o=this.spheres[s.index],r=u(e.origin,d(e.direction,s.distance));this.selectedIndex=s.index,this.dragState={index:s.index,planeY:o.position[1],offset:m(o.position,r),lastPosition:[...o.position],lastTimestamp:i.timeStamp},o.velocity=[0,0,0],this.canvas.setPointerCapture(i.pointerId),this.canvas.classList.add("is-dragging"),this.syncTestState(),i.preventDefault()}),this.canvas.addEventListener("pointermove",i=>{if(!this.dragState)return;const e=this.rayFromPointer(i.clientX,i.clientY),s=e.direction[1];if(Math.abs(s)<1e-4)return;const o=(this.dragState.planeY-e.origin[1])/s;if(o<=0)return;const r=u(e.origin,d(e.direction,o)),n=u(r,this.dragState.offset),l=this.spheres[this.dragState.index],c=[p(n[0],-2.7,2.7),l.material===3?p(n[1],1.35,3.05):Math.max(l.radius,n[1]),p(n[2],-1.95,2.15)],h=Math.max(.001,(i.timeStamp-this.dragState.lastTimestamp)/1e3);l.velocity=l.material===3?[0,0,0]:H(d(m(c,this.dragState.lastPosition),G/h),k),l.position=c,this.dragState.lastPosition=[...c],this.dragState.lastTimestamp=i.timeStamp,this.syncTestState(),i.preventDefault()});const t=i=>{this.dragState&&this.canvas.releasePointerCapture(i.pointerId),this.dragState=null,this.canvas.classList.remove("is-dragging")};this.canvas.addEventListener("pointerup",t),this.canvas.addEventListener("pointercancel",t)}async startWebGpuRenderer(){const t=N();if(!t)throw new Error("WebGPU is unavailable in this browser or context.");const i=await t.requestAdapter({powerPreference:"high-performance"});if(!i)throw new Error("No WebGPU adapter was found.");this.device=await i.requestDevice();const e=this.canvas.getContext("webgpu");if(!e)throw new Error("Unable to create a WebGPU canvas context.");this.context=e;const s=t.getPreferredCanvasFormat?.()??"bgra8unorm";e.configure({device:this.device,format:s,alphaMode:"opaque",usage:E("GPUTextureUsage","RENDER_ATTACHMENT",16)});const o=this.device.createShaderModule({code:V});this.pipeline=this.device.createRenderPipeline({layout:"auto",vertex:{module:o,entryPoint:"vsMain"},fragment:{module:o,entryPoint:"fsMain",targets:[{format:s}]},primitive:{topology:"triangle-list"}}),this.uniformBuffer=this.device.createBuffer({size:this.uniformData.byteLength,usage:E("GPUBufferUsage","UNIFORM",64)|E("GPUBufferUsage","COPY_DST",8)}),this.bindGroup=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]}),this.device.lost?.then(r=>{r.reason!=="destroyed"&&this.drawUnsupported(r.message||"The WebGPU device was lost.")}),this.status="webgpu",this.resizeCanvas(),this.syncTestState(),this.startLoop()}startMockRenderer(){const t=this.canvas.getContext("2d",{alpha:!1});if(!t){this.drawUnsupported("Unable to create a canvas renderer.");return}this.mockContext=t,this.status="mock",this.resizeCanvas(),this.syncTestState(),this.startLoop()}resizeCanvas(){const t=this.canvas.getBoundingClientRect(),i=Math.min(window.devicePixelRatio||1,2),e=Math.max(1,Math.floor(t.width*i)),s=Math.max(1,Math.floor(t.height*i));(this.canvas.width!==e||this.canvas.height!==s)&&(this.canvas.width=e,this.canvas.height=s)}startLoop(){if(this.frameId||document.hidden)return;this.fpsLastTimestamp=performance.now(),this.lastPhysicsTimestamp=this.fpsLastTimestamp;const t=i=>{this.frameId=window.requestAnimationFrame(t),this.resizeCanvas();const e=Math.min(.033,Math.max(0,(i-this.lastPhysicsTimestamp)/1e3));this.lastPhysicsTimestamp=i,this.updateCamera(e),this.stepPhysics(e),this.updateFps(i),this.status==="mock"?this.renderMock():this.status==="webgpu"&&this.renderWebGpu(i),this.frameCount+=1,this.syncTestState()};this.frameId=window.requestAnimationFrame(t)}stop(){this.frameId&&(window.cancelAnimationFrame(this.frameId),this.frameId=0)}stepPhysics(t){if(t<=0)return;const i=this.dragState?.index??-1;for(let e=0;e<C;e+=1){if(e===i){this.keepSphereInBounds(this.spheres[e]);continue}const s=this.spheres[e];s.velocity[1]-=D*t,s.velocity=d(s.velocity,Math.max(0,1-O*t)),s.position=u(s.position,d(s.velocity,t)),this.resolveFloorAndBounds(s,t)}for(let e=0;e<3;e+=1)this.resolveSphereCollisions(i)}resolveFloorAndBounds(t,i=1/60){const e=A+t.radius;if(t.position[1]<e){t.position[1]=e,t.velocity[1]<0&&(t.velocity[1]=-t.velocity[1]*S);const l=Math.max(0,1-U*i);t.velocity[0]*=l,t.velocity[2]*=l,Math.abs(t.velocity[1])<.045&&(t.velocity[1]=0)}const s=-w+t.radius,o=w-t.radius;(t.position[0]<s||t.position[0]>o)&&(t.position[0]=p(t.position[0],s,o),t.velocity[0]*=-S);const r=-b+t.radius,n=b-t.radius;(t.position[2]<r||t.position[2]>n)&&(t.position[2]=p(t.position[2],r,n),t.velocity[2]*=-S)}keepSphereInBounds(t){t.position[0]=p(t.position[0],-w+t.radius,w-t.radius),t.position[2]=p(t.position[2],-b+t.radius,b-t.radius),t.position[1]=Math.max(A+t.radius,t.position[1])}resolveSphereCollisions(t){for(let i=0;i<C;i+=1)for(let e=i+1;e<C;e+=1){const s=this.spheres[i],o=this.spheres[e],r=m(o.position,s.position),n=Math.hypot(r[0],r[1],r[2])||1e-4,l=s.radius+o.radius;if(n>=l)continue;const c=d(r,1/n),h=l-n,v=i===t,f=e===t;v&&!f?o.position=u(o.position,d(c,h)):f&&!v?s.position=u(s.position,d(c,-h)):(s.position=u(s.position,d(c,-h*.5)),o.position=u(o.position,d(c,h*.5)));const y=m(o.velocity,s.velocity),x=g(y,c);if(x<0){const R=-1.42*x/2;v||(s.velocity=m(s.velocity,d(c,R))),f||(o.velocity=u(o.velocity,d(c,R)))}this.resolveFloorAndBounds(s),this.resolveFloorAndBounds(o)}}updateFps(t){this.fpsFrameCount+=1;const i=t-this.fpsLastTimestamp;if(i<300)return;const e=this.fpsFrameCount*1e3/i;this.fps=this.fps===0?e:this.fps*.72+e*.28,this.fpsFrameCount=0,this.fpsLastTimestamp=t,this.fpsLabel.textContent=`FPS ${Math.round(this.fps).toString().padStart(2,"0")}`}renderWebGpu(t){if(!this.device||!this.context||!this.pipeline||!this.bindGroup||!this.uniformBuffer)return;this.writeUniforms(t*.001),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformData);const i=this.device.createCommandEncoder(),e=i.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:"clear",clearValue:{r:.055,g:.055,b:.05,a:1},storeOp:"store"}]});e.setPipeline(this.pipeline),e.setBindGroup(0,this.bindGroup),e.draw(3),e.end(),this.device.queue.submit([i.finish()])}writeUniforms(t){this.uniformData.fill(0),this.writeVec4(0,this.canvas.width,this.canvas.height,t,this.selectedIndex),this.writeVec4(1,this.cameraPosition[0],this.cameraPosition[1],this.cameraPosition[2],0),this.writeVec4(2,this.cameraRight[0],this.cameraRight[1],this.cameraRight[2],this.getViewportFovScale()),this.writeVec4(3,this.cameraUp[0],this.cameraUp[1],this.cameraUp[2],0),this.writeVec4(4,this.cameraForward[0],this.cameraForward[1],this.cameraForward[2],5),this.spheres.forEach((i,e)=>{const s=5+e*2;this.writeVec4(s,i.position[0],i.position[1],i.position[2],i.radius),this.writeVec4(s+1,i.color[0],i.color[1],i.color[2],i.material)})}writeVec4(t,i,e,s,o){const r=t*4;this.uniformData[r]=i,this.uniformData[r+1]=e,this.uniformData[r+2]=s,this.uniformData[r+3]=o}renderMock(){if(!this.mockContext)return;const t=this.mockContext,{width:i,height:e}=this.canvas;t.clearRect(0,0,i,e);const s=t.createLinearGradient(0,0,0,e);s.addColorStop(0,"#090d13"),s.addColorStop(.58,"#151719"),s.addColorStop(1,"#080807"),t.fillStyle=s,t.fillRect(0,0,i,e);const o=e*.72;t.fillStyle="#242321",t.fillRect(0,o,i,e-o),t.strokeStyle="rgba(255, 255, 255, 0.055)",t.lineWidth=1;for(let n=-i;n<i*2;n+=i/14)t.beginPath(),t.moveTo(n,e),t.lineTo(i*.5+(n-i*.5)*.2,o),t.stroke();this.spheres.map((n,l)=>({sphere:n,index:l,projected:this.project(n.position)})).filter(n=>n.projected.visible).sort((n,l)=>l.projected.depth-n.projected.depth).forEach(({sphere:n,index:l,projected:c})=>{const h=Math.max(8,n.radius*c.scale),v=p(1.2-n.position[1]*.2,.35,1.2);t.fillStyle="rgba(0, 0, 0, 0.32)",t.beginPath(),t.ellipse(c.x+h*.34,o+8,h*1.15*v,h*.26*v,0,0,Math.PI*2),t.fill();const f=t.createRadialGradient(c.x-h*.35,c.y-h*.45,h*.1,c.x,c.y,h),y=n.color.map(x=>Math.round(x*255));f.addColorStop(0,n.material===3?"#fff6cc":"rgba(255, 255, 255, 0.95)"),f.addColorStop(.18,`rgb(${y[0]}, ${y[1]}, ${y[2]})`),f.addColorStop(1,n.material===1?"#1d2024":"#121416"),t.fillStyle=f,t.beginPath(),t.arc(c.x,c.y,h,0,Math.PI*2),t.fill(),(n.material===1||n.material===2)&&(t.strokeStyle=n.material===1?"rgba(255, 255, 255, 0.72)":"rgba(190, 220, 255, 0.42)",t.lineWidth=Math.max(1,h*.04),t.beginPath(),t.arc(c.x-h*.14,c.y-h*.08,h*.62,-.55,.95),t.stroke()),l===this.selectedIndex&&(t.strokeStyle="rgba(170, 220, 255, 0.95)",t.lineWidth=3,t.beginPath(),t.arc(c.x,c.y,h+4,0,Math.PI*2),t.stroke())})}drawUnsupported(t){this.status="unsupported",this.stop(),this.resizeCanvas();const i=this.canvas.getContext("2d",{alpha:!1});if(!i){this.status="error";return}const{width:e,height:s}=this.canvas;i.fillStyle="#050607",i.fillRect(0,0,e,s),i.fillStyle="rgba(255, 255, 255, 0.82)",i.font=`${Math.max(16,Math.round(e/72))}px Inter, sans-serif`,i.textAlign="center",i.textBaseline="middle",i.fillText("WebGPU unavailable",e/2,s/2-16),i.fillStyle="rgba(255, 255, 255, 0.48)",i.font=`${Math.max(12,Math.round(e/110))}px Inter, sans-serif`,i.fillText(t,e/2,s/2+18),this.fpsLabel.textContent="FPS --",this.syncTestState()}rayFromPointer(t,i){const e=this.canvas.getBoundingClientRect(),s=(t-e.left)/Math.max(1,e.width)*2-1,o=(i-e.top)/Math.max(1,e.height)*2-1,r=e.width/Math.max(1,e.height),n=this.getViewportFovScale(),l=P(u(u(this.cameraForward,d(this.cameraRight,s*r*n)),d(this.cameraUp,-o*n)));return{origin:this.cameraPosition,direction:l}}pickSphere(t){let i=null;return this.spheres.forEach((e,s)=>{const o=m(t.origin,e.position),r=g(o,t.direction),n=g(o,o)-e.radius*e.radius,l=r*r-n;if(l<0)return;const c=Math.sqrt(l);let h=-r-c;h<.01&&(h=-r+c),!(h<.01)&&(!i||h<i.distance)&&(i={index:s,distance:h})}),i}project(t){const i=m(t,this.cameraPosition),e=g(i,this.cameraRight),s=g(i,this.cameraUp),o=g(i,this.cameraForward);if(o<=.1)return{visible:!1,x:0,y:0,scale:0,depth:o};const r=this.canvas.height/(2*this.getViewportFovScale()*o);return{visible:!0,x:this.canvas.width/2+e*r,y:this.canvas.height/2-s*r,scale:r,depth:o}}syncTestState(){window.__RT_DEMO_STATE__={status:this.status,selectedIndex:this.selectedIndex,cameraPaused:this.cameraPaused,frameCount:this.frameCount,fps:this.fps,spheres:this.spheres.map(t=>({x:t.position[0],y:t.position[1],z:t.position[2],radius:t.radius,material:t.material}))}}getViewportFovScale(){const t=this.canvas.getBoundingClientRect(),i=t.width/Math.max(1,t.height);return B*(i<.82?.82/Math.max(.32,i):1)}}document.addEventListener("DOMContentLoaded",()=>{new W().init().catch(t=>{console.error("[RT Demo] Fatal initialization error:",t)})});
