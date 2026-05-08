// 地貌纹理生成模块 v1.0 — Canvas程序化生成，零外部依赖
(function(g){'use strict';const T=256;let C={};
function N(x,y,s){let h=Math.floor(s+x*374761393+y*668265263);h=((h^(h>>13))*1274126177)&0x7fffffff;return(h%10000)/10000;}
function F(x,y,o,l,gv){let v=0,a=1,f=1,m=0;for(let i=0;i<o;i++){v+=a*N(Math.floor(x*f),Math.floor(y*f),1);m+=a;a*=gv;f*=l;}return v/m;}
function fillNoise(c,r1,g1,b1,r2,g2,b2,s,o){const d=c.getContext('2d').createImageData(T,T),p=d.data;
for(let y=0;y<T;y++)for(let x=0;x<T;x++){const i=(y*T+x)*4,n=F(x*s,y*s,o,2,0.5);
p[i]=r1+n*(r2-r1)|0;p[i+1]=g1+n*(g2-g1)|0;p[i+2]=b1+n*(b2-b1)|0;p[i+3]=255;}
c.getContext('2d').putImageData(d,0,0);}

g.TerrainTextures={
grass(){if(C.g)return C.g;const c=document.createElement('canvas');c.width=c.height=T;fillNoise(c,40,105,40,35,60,30,0.03,4);const x=c.getContext('2d');
for(let i=0;i<6000;i++){const px=Math.random()*T,py=Math.random()*T,a=Math.random()*6.28,l=1.5+Math.random()*5,s=90+Math.random()*50;
x.strokeStyle=`rgba(${s},${s+40},${20+Math.random()*25},0.35)`;x.lineWidth=0.3+Math.random()*0.4;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke();}
return C.g=c;},

mud(){if(C.m)return C.m;const c=document.createElement('canvas');c.width=c.height=T;fillNoise(c,75,50,25,40,30,20,0.04,4);const x=c.getContext('2d');
for(let i=0;i<400;i++){const px=Math.random()*T,py=Math.random()*T,r=3+Math.random()*8,s=40+Math.random()*30;
x.fillStyle=`rgba(${s+20},${s},${s*0.4},0.3)`;x.beginPath();x.arc(px,py,r,0,6.28);x.fill();}
return C.m=c;},

sand(){if(C.s)return C.s;const c=document.createElement('canvas');c.width=c.height=T;fillNoise(c,185,155,100,40,35,30,0.05,3);const x=c.getContext('2d');
for(let y=0;y<T;y+=2)for(let px=0;px<T;px+=2)if(Math.random()<0.3){const s=200+Math.random()*40;x.fillStyle=`rgba(${s},${s-20},${s-90},0.3)`;x.fillRect(px,y,2,2);}
return C.s=c;},

concrete(){if(C.c)return C.c;const c=document.createElement('canvas');c.width=c.height=T;fillNoise(c,165,165,165,40,40,40,0.06,3);const x=c.getContext('2d');
for(let i=0;i<200;i++){const px=Math.random()*T,py=Math.random()*T,a=Math.random()*3.14,l=2+Math.random()*10;
x.strokeStyle='rgba(130,130,130,0.3)';x.lineWidth=0.3;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke();}
return C.c=c;},

asphalt(){if(C.a)return C.a;const c=document.createElement('canvas');c.width=c.height=T;fillNoise(c,55,55,55,30,30,30,0.07,3);const x=c.getContext('2d');
for(let i=0;i<3000;i++){const px=Math.random()*T,py=Math.random()*T,r=0.5+Math.random(),v=70+Math.random()*40;
x.fillStyle=`rgba(${v},${v},${v},0.4)`;x.beginPath();x.arc(px,py,r,0,6.28);x.fill();}
for(let y=0;y<T;y+=12+Math.random()*8){x.strokeStyle='rgba(45,45,45,0.25)';x.lineWidth=0.5+Math.random();x.beginPath();x.moveTo(0,y+Math.random()*3);x.lineTo(T,y+Math.random()*3);x.stroke();}
return C.a=c;},

brick(){if(C.b)return C.b;const c=document.createElement('canvas');c.width=c.height=T;fillNoise(c,145,75,45,35,25,15,0.04,3);const x=c.getContext('2d');
const bw=28,bh=12,gp=2;x.strokeStyle='rgba(80,40,20,0.55)';x.lineWidth=1;
for(let r=0;r<T/bh;r++){const y=r*bh,off=r%2?bw/2:0;
for(let col=-1;col<T/bw+1;col++){const bx=col*bw+off;x.strokeRect(bx+gp/2,y+gp/2,bw-gp,bh-gp);}}
for(let i=0;i<800;i++){const px=Math.random()*T,py=Math.random()*T,sz=1+Math.random()*2;x.fillStyle=`rgba(160,80,50,0.2)`;x.fillRect(px,py,sz,sz);}
return C.b=c;},

// 清除缓存
clearCache(){C={};},

// 获取所有纹理类型
getTypes(){return['grass','mud','sand','concrete','asphalt','brick'];},

// 按索引获取纹理
getByIndex(idx){const m=['grass','mud','sand','concrete','asphalt','brick'];return this[m[idx]]?this[m[idx]]():null;}
};
})(window);
