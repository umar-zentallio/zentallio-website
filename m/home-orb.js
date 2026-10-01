/* Zentallio mobile home -- hero orb (same three.js orb as desktop index.html) */
(function(){
 var cv=document.getElementById('mArt');if(!cv||typeof THREE==='undefined')return;
 var box=cv.parentNode,reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
 var renderer;try{renderer=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true});if(!renderer.getContext())return;}catch(e){return;}
 renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
 var scene=new THREE.Scene();
 var camera=new THREE.PerspectiveCamera(45,1,0.1,100);camera.position.set(0,0,5.9);
 var grp=new THREE.Group();scene.add(grp);
 var uni={uTime:{value:0},uAmp:{value:0.20}};
 var mat=new THREE.ShaderMaterial({uniforms:uni,vertexShader:'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}uniform float uTime;uniform float uAmp;varying float vN;varying vec3 vNm;varying vec3 vVw;void main(){float n=snoise(position*0.85+uTime*0.16);float n2=snoise(position*2.0-uTime*0.11)*0.5;float disp=(n+n2)*uAmp;vN=n;vec3 pp=position+normal*disp;vNm=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(pp,1.0);vVw=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:'varying float vN;varying vec3 vNm;varying vec3 vVw;void main(){float fres=pow(1.0-max(dot(normalize(vNm),normalize(vVw)),0.0),2.3);vec3 teal=vec3(0.082,0.949,0.949);vec3 violet=vec3(0.608,0.482,1.0);vec3 mag=vec3(1.0,0.176,0.584);float t=0.5+0.5*vN;vec3 base=mix(violet,teal,smoothstep(0.0,0.72,t));vec3 col=base*(0.09+fres*1.08)+mag*fres*0.24;gl_FragColor=vec4(col,0.93);}',transparent:true});
 var orb=new THREE.Mesh(new THREE.IcosahedronGeometry(1.4,16),mat);grp.add(orb);
 var amat=new THREE.ShaderMaterial({vertexShader:'varying vec3 vNm;varying vec3 vVw;void main(){vNm=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vVw=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:'varying vec3 vNm;varying vec3 vVw;void main(){float f=pow(1.0-max(dot(normalize(vNm),normalize(vVw)),0.0),3.0);gl_FragColor=vec4(mix(vec3(0.082,0.949,0.949),vec3(0.55,0.45,1.0),0.55),f*0.14);}',transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false});
 var shell=new THREE.Mesh(new THREE.SphereGeometry(1.58,48,48),amat);grp.add(shell);
 var pc=360,pgeo=new THREE.BufferGeometry(),pa=new Float32Array(pc*3),pcol=new Float32Array(pc*3);
 for(var i=0;i<pc;i++){var u=Math.random(),v=Math.random();var th=u*6.2832,ph=Math.acos(2.0*v-1.0);var rr=1.45+Math.random()*0.66;pa[i*3]=rr*Math.sin(ph)*Math.cos(th);pa[i*3+1]=rr*Math.sin(ph)*Math.sin(th);pa[i*3+2]=rr*Math.cos(ph);var cz=Math.random(),cc=cz<0.46?[0.08,0.95,0.95]:(cz<0.84?[0.55,0.45,1.0]:[1.0,0.18,0.58]);pcol[i*3]=cc[0];pcol[i*3+1]=cc[1];pcol[i*3+2]=cc[2];}
 pgeo.setAttribute('position',new THREE.BufferAttribute(pa,3));pgeo.setAttribute('color',new THREE.BufferAttribute(pcol,3));
 var halo=new THREE.Points(pgeo,new THREE.PointsMaterial({size:0.03,vertexColors:true,transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,depthWrite:false}));grp.add(halo);
 var wire=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.82,1)),new THREE.LineBasicMaterial({color:new THREE.Color(0.10,0.86,0.92),transparent:true,opacity:0.2,blending:THREE.AdditiveBlending,depthWrite:false}));grp.add(wire);
 function resize(){var r=box.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=(r.width/r.height)||1;camera.updateProjectionMatrix();}
 resize();addEventListener('resize',resize);
 var f=0,vis=true;
 if('IntersectionObserver' in window)new IntersectionObserver(function(e){vis=e[0].isIntersecting;}).observe(box);
 function draw(){
  f++;
  uni.uTime.value=f*0.0125;
  uni.uAmp.value=0.095+Math.sin(f*0.02)*0.038+Math.sin(f*0.07)*0.013;
  orb.rotation.y+=0.0036;orb.rotation.x+=0.0008;
  shell.rotation.y-=0.0018;halo.rotation.y+=0.0016;halo.rotation.x+=0.0007;
  wire.rotation.y-=0.0019;wire.rotation.x+=0.0009;
  grp.scale.setScalar(1+Math.sin(f*0.024)*0.035);
  renderer.render(scene,camera);
 }
 function loop(){if(vis)draw();requestAnimationFrame(loop);}
 if(reduce)draw();else loop();
})();
