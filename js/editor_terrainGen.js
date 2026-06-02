// ==================== js/editor_terrainGen.js — 地形与村落生成系统 v2.0 ====================
// 依赖: mapData, hmResW/D, hmStepW/D, worldHalfW/D, worldWidth/Depth, scene, pushSnapshot
// 提供: generateAll, generateTerrainOnly, generateRoadsAndVillages, flattenTerrain,
//        isPointInWater, drawRoadLine, smpHeight, world2sm, w2i, samplePathSmoothDense

// ============================== 基础工具 ==============================

// --- 噪声 ---
function hash(x,y){let h=x*374761393+y*668265263+1274126177;h=((h>>13)^h)*0x5bd1e995;return(h^(h>>15))&0xffff;}
function noise2D(x,z,s){const n=Math.sin(x*12.9898+z*78.233+s)*43758.5453;return n-Math.floor(n);}
function smoothNoise(x,z,s){const ix=Math.floor(x),iz=Math.floor(z);const fx=x-ix,fz=z-iz;const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);const a=noise2D(ix,iz,s)+(noise2D(ix+1,iz,s)-noise2D(ix,iz,s))*sx;const b=noise2D(ix,iz+1,s)+(noise2D(ix+1,iz+1,s)-noise2D(ix,iz+1,s))*sx;return a+(b-a)*sz;}

// --- 坐标 ---
function w2i(wx,wz){const u=(wx+worldHalfW)/worldWidth,v=(wz+worldHalfD)/worldDepth;if(u<0||u>1||v<0||v>1)return-1;const sx=Math.round(u*(hmResW-1)),sy=Math.round(v*(hmResD-1));return sy*hmResW+sx;}
function smpHeight(wx,wz){const i=w2i(wx,wz);return i>=0?mapData.heightmap[i]:0;}
function world2sm(wx,wz){const sx=Math.round((wx+worldHalfW)/worldWidth*(hmResW-1));const sy=Math.round((wz+worldHalfD)/worldDepth*(hmResD-1));return{sx:Math.max(0,Math.min(hmResW-1,sx)),sy:Math.max(0,Math.min(hmResD-1,sy))};}
function sm2world(sx,sy){return{x:(sx/(hmResW-1)-0.5)*worldWidth,z:(sy/(hmResD-1)-0.5)*worldDepth};}

// --- CatmullRom ---
function catmullRomInterpolate(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;return{x:0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),z:0.5*((2*p1.z)+(-p0.z+p2.z)*t+(2*p0.z-5*p1.z+4*p2.z-p3.z)*t2+(-p0.z+3*p1.z-3*p2.z+p3.z)*t3)};}
function samplePathSmooth(points){if(points.length<2)return points;const samples=[points[0]];for(let i=0;i<points.length-1;i++){const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];const segLen=Math.hypot(p2.x-p1.x,p2.z-p1.z);const steps=Math.max(1,Math.round(segLen/2));for(let j=1;j<steps;j++)samples.push(catmullRomInterpolate(p0,p1,p2,p3,j/steps));samples.push(p2);}return samples;}
function samplePathSmoothDense(points,spacing){if(points.length<2)return points;const sp=spacing||1.0;const samples=[points[0]];for(let i=0;i<points.length-1;i++){const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];const segLen=Math.hypot(p2.x-p1.x,p2.z-p1.z);const steps=Math.max(1,Math.round(segLen/sp));for(let j=1;j<steps;j++)samples.push(catmullRomInterpolate(p0,p1,p2,p3,j/steps));samples.push(p2);}return samples;}

// --- 贝塞尔预平滑 ---
function subdivideSharpCorners(pts,maxAngle=45){if(pts.length<3)return[...pts];const result=[pts[0]];for(let i=1;i<pts.length-1;i++){const dxIn=pts[i].x-pts[i-1].x,dzIn=pts[i].z-pts[i-1].z;const dxOut=pts[i+1].x-pts[i].x,dzOut=pts[i+1].z-pts[i].z;const lenIn=Math.hypot(dxIn,dzIn)||1,lenOut=Math.hypot(dxOut,dzOut)||1;const dot=(dxIn*dxOut+dzIn*dzOut)/(lenIn*lenOut);const angle=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;if(angle>maxAngle){const n=Math.ceil(angle/20);for(let j=1;j<=n;j++){const t=j/(n+1);result.push({x:(1-t)*(1-t)*pts[i-1].x+2*(1-t)*t*pts[i].x+t*t*pts[i+1].x,z:(1-t)*(1-t)*pts[i-1].z+2*(1-t)*t*pts[i].z+t*t*pts[i+1].z});}}result.push(pts[i]);}result.push(pts[pts.length-1]);return result;}

function pointToSegmentDist(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az;const lenSq=dx*dx+dz*dz;if(lenSq<1e-9)return Math.hypot(px-ax,pz-az);let t=((px-ax)*dx+(pz-az)*dz)/lenSq;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(ax+t*dx),pz-(az+t*dz));}

// --- FBM ---
function fbm(x,z,seed,octaves,scale){let val=0,amp=1,freq=1,maxAmp=0;for(let o=0;o<octaves;o++){val+=smoothNoise(x/scale*freq,z/scale*freq,seed+o*137)*amp;maxAmp+=amp;amp*=0.5;freq*=2.0;}return val/maxAmp;}

// FBM 降采样生成（大地图性能优化：>400m 时降为半分辨率，bilinear 插值）
function _generateFbmGrid(resW,resD,worldW,worldD,seed,octaves,ptch,halfW,halfD){
    const data=new Float32Array(resW*resD);
    for(let y=0;y<resD;y++){for(let x=0;x<resW;x++){
        const wx=(x/(resW-1)-0.5)*worldW,wz=(y/(resD-1)-0.5)*worldD;
        data[y*resW+x]=fbm(wx,wz,seed,octaves,ptch);
    }}
    return data;
}
function _bilinearUpsample(lowRes,lw,ld,highW,highD){
    const result=new Float32Array(highW*highD);
    const scaleX=(lw-1)/(highW-1),scaleZ=(ld-1)/(highD-1);
    for(let y=0;y<highD;y++){for(let x=0;x<highW;x++){
        const fx=x*scaleX,fz=y*scaleZ;
        const ix=Math.floor(fx),iz=Math.floor(fz);
        const tx=fx-ix,tz=fz-iz;
        const cx=Math.min(ix+1,lw-1),cz=Math.min(iz+1,ld-1);
        const a=lw;result[y*highW+x]=(1-tx)*(1-tz)*lowRes[iz*a+ix]+tx*(1-tz)*lowRes[iz*a+cx]+(1-tx)*tz*lowRes[cz*a+ix]+tx*tz*lowRes[cz*a+cx];
    }}
    return result;
}

// --- splatMap 绘制 ---
function drawCircleSplat(wx,wz,radius,texType){const rPxX=radius/hmStepW,rPxZ=radius/hmStepD;const{sx:sxC,sy:syC}=world2sm(wx,wz);const rWi=Math.ceil(rPxX),rZi=Math.ceil(rPxZ);for(let dy=-rZi;dy<=rZi;dy++){for(let dx=-rWi;dx<=rWi;dx++){const wDist=Math.sqrt(dx*dx*hmStepW*hmStepW+dy*dy*hmStepD*hmStepD);if(wDist>radius)continue;const sx2=sxC+dx,sy2=syC+dy;if(sx2<0||sx2>=hmResW||sy2<0||sy2>=hmResD)continue;if(!mapData.editedVerticesPaint.has(sx2+','+sy2))mapData.splatMap[sy2*hmResW+sx2]=texType;}}}

function drawRoadLine(x1,z1,x2,z2,width,texType){const tt=texType!=null?texType:4;const hw=width/2;const avgStep=Math.sqrt(hmStepW*hmStepD);const rPxApprox=hw/avgStep;const{sx:sx1,sy:sy1}=world2sm(x1,z1);const{sx:sx2,sy:sy2}=world2sm(x2,z2);const dx=sx2-sx1,dy=sy2-sy1;const len=Math.hypot(dx,dy);if(len<1)return;const ux=dx/len,uy=dy/len;const hw2=hw*hw;const minSx=Math.max(0,Math.floor(Math.min(sx1,sx2)-rPxApprox-1)),maxSx=Math.min(hmResW-1,Math.ceil(Math.max(sx1,sx2)+rPxApprox+1));const minSy=Math.max(0,Math.floor(Math.min(sy1,sy2)-rPxApprox-1)),maxSy=Math.min(hmResD-1,Math.ceil(Math.max(sy1,sy2)+rPxApprox+1));for(let sy=minSy;sy<=maxSy;sy++){for(let sx=minSx;sx<=maxSx;sx++){if(mapData.editedVerticesPaint.has(sx+','+sy))continue;const vx=sx-sx1,vy=sy-sy1;let proj=vx*ux+vy*uy;proj=Math.max(0,Math.min(len,proj));const cx=sx1+ux*proj,cy=sy1+uy*proj;const wdx=(sx-cx)*hmStepW,wdz=(sy-cy)*hmStepD;if(wdx*wdx+wdz*wdz<hw2){const dist=Math.sqrt(wdx*wdx+wdz*wdz)/hw;if(dist<1.0)mapData.splatMap[sy*hmResW+sx]=tt;}}}}

// --- 路径辅助 ---
function computePathLength(points){let len=0;for(let i=1;i<points.length;i++)len+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);return len;}
function getPointAtDistance(points,dist){if(points.length<2)return points[0]||{x:0,z:0};if(dist<=0)return{x:points[0].x,z:points[0].z};let remaining=dist;for(let i=1;i<points.length;i++){const segLen=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);if(remaining<=segLen){const t=segLen>0?remaining/segLen:0;return{x:points[i-1].x+(points[i].x-points[i-1].x)*t,z:points[i-1].z+(points[i].z-points[i-1].z)*t};}remaining-=segLen;}return{x:points[points.length-1].x,z:points[points.length-1].z};}
function _truncatePath(pts,maxDist){if(maxDist<=0)return pts.slice(0,1);const result=[pts[0]];let acc=0;for(let i=1;i<pts.length;i++){const seg=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);if(acc+seg>=maxDist){const t=(maxDist-acc)/seg;result.push({x:pts[i-1].x+(pts[i].x-pts[i-1].x)*t,z:pts[i-1].z+(pts[i].z-pts[i-1].z)*t});return result;}acc+=seg;result.push(pts[i]);}return result;}

// --- 水体检测 ---
function isPtInPond(x,z,pondCenters){for(const pc of pondCenters)if(Math.hypot(x-pc.x,z-pc.z)<pc.r+3)return true;for(const w of mapData.waters){if(w.type!=='river'||!w.points||w.points.length<2)continue;for(let i=1;i<w.points.length;i++){const a=w.points[i-1],b=w.points[i];const dx=b.x-a.x,dz=b.z-a.z;const len2=dx*dx+dz*dz;if(len2===0)continue;let t=((x-a.x)*dx+(z-a.z)*dz)/len2;t=Math.max(0,Math.min(1,t));if(Math.hypot(x-(a.x+t*dx),z-(a.z+t*dz))<7)return true;}}return false;}

function isPointInWater(x,z,margin=3){for(const w of mapData.waters){if(w.type==='pond'){if(Math.hypot(x-w.center.x,z-w.center.z)<(w.radius||8)+margin)return true;}else if(w.type==='river'&&w.points&&w.points.length>=2){const hw=(w.width||40)*0.5+margin;for(let i=1;i<w.points.length;i++){const a=w.points[i-1],b=w.points[i];const dx=b.x-a.x,dz=b.z-a.z;const len2=dx*dx+dz*dz;if(len2===0)continue;let t=((x-a.x)*dx+(z-a.z)*dz)/len2;t=Math.max(0,Math.min(1,t));if(Math.hypot(x-(a.x+t*dx),z-(a.z+t*dz))<hw)return true;}}}return false;}

// --- 粗糙度 ---
function _roughness(wx,wz,radius){const rPx=Math.ceil(radius/hmStepW),rPz=Math.ceil(radius/hmStepD);const{sx:sc,sy:sz}=world2sm(wx,wz);let sum=0,count=0;for(let dy=-rPz;dy<=rPz;dy++){for(let dx=-rPx;dx<=rPx;dx++){const sx2=sc+dx,sy2=sz+dy;if(sx2<0||sx2>=hmResW||sy2<0||sy2>=hmResD)continue;sum+=mapData.heightmap[sy2*hmResW+sx2];count++;}}if(count<4)return 0;const avg=sum/count;let variance=0;for(let dy=-rPz;dy<=rPz;dy++){for(let dx=-rPx;dx<=rPx;dx++){const sx2=sc+dx,sy2=sz+dy;if(sx2<0||sx2>=hmResW||sy2<0||sy2>=hmResD)continue;const diff=mapData.heightmap[sy2*hmResW+sx2]-avg;variance+=diff*diff;}}return Math.sqrt(variance/(count-1));}

// ============================== A* 搜索 ==============================

class MinHeap {
    constructor() { this.data = []; }
    push(key, value) {
        this.data.push({ key, value });
        let i = this.data.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.data[p].value <= this.data[i].value) break;
            const tmp = this.data[p];
            this.data[p] = this.data[i];
            this.data[i] = tmp;
            i = p;
        }
    }
    pop() {
        if (this.data.length === 0) return null;
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            let i = 0;
            const n = this.data.length;
            while (true) {
                let smallest = i;
                const l = i * 2 + 1, r = i * 2 + 2;
                if (l < n && this.data[l].value < this.data[smallest].value) smallest = l;
                if (r < n && this.data[r].value < this.data[smallest].value) smallest = r;
                if (smallest === i) break;
                const tmp2 = this.data[i];
                this.data[i] = this.data[smallest];
                this.data[smallest] = tmp2;
                i = smallest;
            }
        }
        return top;
    }
    isEmpty() { return this.data.length === 0; }
}

function _hashNoise(x,y,seed){let h=seed^(x*374761393+y*668265263);h=(h^(h>>>13))*1274126177;h=h^(h>>>16);return(h&0x7FFFFFFF)/0x7FFFFFFF*2-1;}

// 动态粗化因子：A* 网格保持 ≤ 200×200
function _getCoarseFactor(){return Math.max(2,Math.ceil(Math.max(hmResW,hmResD)/200));}

function _buildCoarseGrid(){const C=_getCoarseFactor();const cw=Math.max(3,Math.ceil(hmResW/C)),cd=Math.max(3,Math.ceil(hmResD/C));const sw=hmStepW*C,sd=hmStepD*C;const cells=new Array(cw*cd);for(let cy=0;cy<cd;cy++){for(let cx=0;cx<cw;cx++){const wx=(cx+0.5)*sw-worldHalfW,wz=(cy+0.5)*sd-worldHalfD;cells[cy*cw+cx]={h:smpHeight(wx,wz),rough:_roughness(wx,wz,sw*0.7),inWater:isPointInWater(wx,wz,0),worldX:wx,worldZ:wz};}}return{cw,cd,sw,sd,cells};}

function _aStarSearch(sx,sz,gx,gz,grid,noiseSeed){const{cw,cd,sw,sd,cells}=grid;const w2c=(wx,wz)=>{const cx=Math.max(0,Math.min(cw-1,Math.floor((wx+worldHalfW)/sw)));const cy=Math.max(0,Math.min(cd-1,Math.floor((wz+worldHalfD)/sd)));return cy*cw+cx;};const start=w2c(sx,sz),goal=w2c(gx,gz);if(start===goal)return[{x:sx,z:sz},{x:gx,z:gz}];const total=cw*cd;const gScore=new Float32Array(total);gScore.fill(1e9);const cameFrom=new Int32Array(total);cameFrom.fill(-1);const closed=new Uint8Array(total);const heuristic=(idx)=>{const cx=idx%cw,cy=(idx/cw)|0;return Math.hypot(cells[goal].worldX-cells[idx].worldX,cells[goal].worldZ-cells[idx].worldZ);};gScore[start]=0;const heap=new MinHeap();heap.push(start,heuristic(start));const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];while(!heap.isEmpty()){const cur=heap.pop();const idx=cur.key;if(closed[idx])continue;closed[idx]=1;if(idx===goal)break;const cx=idx%cw,cy=(idx/cw)|0;const ca=cells[idx];for(const[dx,dy,dMul]of NB){const nx=cx+dx,ny=cy+dy;if(nx<0||nx>=cw||ny<0||ny>=cd)continue;const ni=ny*cw+nx;if(closed[ni])continue;const cb=cells[ni];let tCost=0;if(cb.rough>0.6)tCost+=(cb.rough-0.6)*50;else tCost+=cb.rough*2;const absH=Math.abs(cb.h);if(absH>4)tCost+=(absH-4)*30;const edgeDist=sw*dMul;const slope=Math.abs(cb.h-ca.h)/edgeDist;if(slope>=0.35)tCost+=99999;else if(slope>0.2)tCost+=Math.pow((slope-0.15)*10,3);else if(slope>0.08)tCost+=(slope-0.08)*20;if(cb.inWater)tCost+=5000;const bDist=Math.min(worldHalfW-Math.abs(cb.worldX),worldHalfD-Math.abs(cb.worldZ));if(bDist<5)tCost+=(5-bDist)*6;const noise=_hashNoise(nx,ny,noiseSeed)*0.2;const moveCost=edgeDist*(1.0+tCost+noise);const tg=gScore[idx]+moveCost;if(tg<gScore[ni]){gScore[ni]=tg;cameFrom[ni]=idx;heap.push(ni,tg+heuristic(ni)*0.7);}}}if(gScore[goal]>=1e8)return null;const path=[];let cur=goal;while(cur!==-1){path.push({x:cells[cur].worldX,z:cells[cur].worldZ});cur=cameFrom[cur];}path.reverse();path[0]={x:sx,z:sz};path[path.length-1]={x:gx,z:gz};return _stringPull(path);}

function _stringPull(pts){if(pts.length<=3)return pts;const isValid=(x,z)=>{if(Math.abs(x)>worldHalfW-3||Math.abs(z)>worldHalfD-3)return false;if(isPointInWater(x,z,1))return false;if(Math.abs(smpHeight(x,z))>6)return false;if(_roughness(x,z,5)>0.8)return false;return true;};const result=[pts[0]];let anchor=0;while(anchor<pts.length-1){let farthest=anchor+1;for(let j=pts.length-1;j>anchor;j--){const dx=pts[j].x-pts[anchor].x,dz=pts[j].z-pts[anchor].z;const dist=Math.hypot(dx,dz);const steps=Math.ceil(dist/1.5);let clear=true;for(let s=1;s<steps;s++){const t=s/steps;if(!isValid(pts[anchor].x+dx*t,pts[anchor].z+dz*t)){clear=false;break;}}if(clear){farthest=j;break;}}result.push(pts[farthest]);anchor=farthest;}return result;}

function _generateMainRoadGreedy(cfg){const pts=[];const routeType=Math.floor(Math.random()*5);let sX,sZ,eX,eZ;const margin=5;const rw=worldHalfW-margin,rd=worldHalfD-margin;if(routeType===0){sX=-rw;sZ=-rd;eX=rw;eZ=rd;}else if(routeType===1){sX=(Math.random()-0.5)*worldWidth;sZ=-rd;eX=(Math.random()-0.5)*worldWidth;eZ=rd;}else if(routeType===2){sX=-rw;sZ=(Math.random()-0.5)*worldDepth;eX=rw;eZ=(Math.random()-0.5)*worldDepth;}else{const ae=[()=>({x:(Math.random()-0.5)*worldWidth,z:-rd}),()=>({x:(Math.random()-0.5)*worldWidth,z:rd}),()=>({x:-rw,z:(Math.random()-0.5)*worldDepth}),()=>({x:rw,z:(Math.random()-0.5)*worldDepth})];const e1=Math.floor(Math.random()*4);let e2=Math.floor(Math.random()*3);if(e2>=e1)e2++;const p1=ae[e1](),p2=ae[e2]();sX=p1.x;sZ=p1.z;eX=p2.x;eZ=p2.z;}pts.push({x:sX,z:sZ});const numMid=2+(cfg.village||3);const dx=eX-sX,dz=eZ-sZ;const totalLen=Math.hypot(dx,dz)||1;const ux=dx/totalLen,uz=dz/totalLen;for(let i=1;i<=numMid;i++){const t=i/(numMid+1);const baseX=sX+dx*t,baseZ=sZ+dz*t;const perpX=-uz,perpZ=ux;const prevH=smpHeight(pts[pts.length-1].x,pts[pts.length-1].z);let bestPt={x:baseX,z:baseZ},bestDiff=Infinity;const searchRange=Math.min(worldWidth,worldDepth)*0.25;for(let c=0;c<12;c++){const off=(c/11-0.5)*2*searchRange;const cx=baseX+perpX*off,cz=baseZ+perpZ*off;if(Math.abs(cx)>worldHalfW-8||Math.abs(cz)>worldHalfD-8)continue;const h=smpHeight(cx,cz);if(Math.abs(h)>4||_roughness(cx,cz,8)>0.8)continue;const diff=Math.abs(h-prevH);if(diff<bestDiff){bestDiff=diff;bestPt={x:cx,z:cz};}}if(bestDiff===Infinity){for(let c=0;c<12;c++){const off=(c/11-0.5)*2*searchRange;const cx=baseX+perpX*off,cz=baseZ+perpZ*off;if(Math.abs(cx)>worldHalfW-8||Math.abs(cz)>worldHalfD-8)continue;const diff=Math.abs(smpHeight(cx,cz)-prevH);if(diff<bestDiff){bestDiff=diff;bestPt={x:cx,z:cz};}}}if(bestDiff===Infinity)bestPt={x:baseX,z:baseZ};pts.push(bestPt);}pts.push({x:eX,z:eZ});return pts;}

function _generateMainRoad(cfg,rng){const routeType=Math.floor(rng()*5);let sX,sZ,eX,eZ;const margin=5;const rw=worldHalfW-margin,rd=worldHalfD-margin;if(routeType===0){sX=-rw;sZ=-rd;eX=rw;eZ=rd;}else if(routeType===1){sX=(rng()-0.5)*worldWidth;sZ=-rd;eX=(rng()-0.5)*worldWidth;eZ=rd;}else if(routeType===2){sX=-rw;sZ=(rng()-0.5)*worldDepth;eX=rw;eZ=(rng()-0.5)*worldDepth;}else{const ae=[()=>({x:(rng()-0.5)*worldWidth,z:-rd}),()=>({x:(rng()-0.5)*worldWidth,z:rd}),()=>({x:-rw,z:(rng()-0.5)*worldDepth}),()=>({x:rw,z:(rng()-0.5)*worldDepth})];const e1=Math.floor(rng()*4);let e2=Math.floor(rng()*3);if(e2>=e1)e2++;const p1=ae[e1](),p2=ae[e2]();sX=p1.x;sZ=p1.z;eX=p2.x;eZ=p2.z;}const grid=_buildCoarseGrid();const noiseSeed=Math.floor(rng()*2147483647);const w2c=(wx,wz)=>{const cx=Math.max(0,Math.min(grid.cw-1,Math.floor((wx+worldHalfW)/grid.sw)));const cy=Math.max(0,Math.min(grid.cd-1,Math.floor((wz+worldHalfD)/grid.sd)));return cy*grid.cw+cx;};const si=w2c(sX,sZ),gi=w2c(eX,eZ);const siW=grid.cells[si].inWater,giW=grid.cells[gi].inWater;if(siW)grid.cells[si].inWater=false;if(giW)grid.cells[gi].inWater=false;const path=_aStarSearch(sX,sZ,eX,eZ,grid,noiseSeed);if(siW)grid.cells[si].inWater=true;if(giW)grid.cells[gi].inWater=true;if(path)return path;console.warn('A* 寻路失败，回退贪心算法');return _generateMainRoadGreedy(cfg);}

// ============================== 确定性随机 ==============================

function createRng(seed){let s=seed|0;return function(){s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

// ============================== 掩码网格 ==============================

const MG_BUILDABLE=1<<0, MG_FORBIDDEN=1<<1, MG_WATER=1<<2, MG_ROAD=1<<3;
const MG_PLAZA=1<<4, MG_BUILDING=1<<5, MG_BUFFER=1<<6;

let maskGrid=null; // Uint8Array[hmResW*hmResD]

function _mgIdx(wx,wz){const sx=Math.round((wx+worldHalfW)/worldWidth*(hmResW-1));const sy=Math.round((wz+worldHalfD)/worldDepth*(hmResD-1));if(sx<0||sx>=hmResW||sy<0||sy>=hmResD)return-1;return sy*hmResW+sx;}

function _mgSetRect(wx,wz,radius,flag){const rpx=Math.ceil(radius/hmStepW),rpz=Math.ceil(radius/hmStepD);const{sx:sc,sy:sz}=world2sm(wx,wz);for(let dy=-rpz;dy<=rpz;dy++){for(let dx=-rpx;dx<=rpx;dx++){const sx2=sc+dx,sy2=sz+dy;if(sx2<0||sx2>=hmResW||sy2<0||sy2>=hmResD)continue;const wd=Math.sqrt(dx*dx*hmStepW*hmStepW+dy*dy*hmStepD*hmStepD);if(wd<=radius)maskGrid[sy2*hmResW+sx2]|=flag;}}}

function _mgSetLine(x1,z1,x2,z2,hw,flag){const{sx:sx1,sy:sy1}=world2sm(x1,z1);const{sx:sx2,sy:sy2}=world2sm(x2,z2);const dx2=sx2-sx1,dy2=sy2-sy1;const segLen=Math.hypot(dx2,dy2);if(segLen<1)return;const ux=dx2/segLen,uy=dy2/segLen;const rPx=Math.ceil(hw/Math.min(hmStepW,hmStepD));const hw2=hw*hw;const minSx=Math.max(0,Math.floor(Math.min(sx1,sx2)-rPx-1)),maxSx=Math.min(hmResW-1,Math.ceil(Math.max(sx1,sx2)+rPx+1));const minSy=Math.max(0,Math.floor(Math.min(sy1,sy2)-rPx-1)),maxSy=Math.min(hmResD-1,Math.ceil(Math.max(sy1,sy2)+rPx+1));for(let sy=minSy;sy<=maxSy;sy++){for(let sx=minSx;sx<=maxSx;sx++){const vx=sx-sx1,vy=sy-sy1;let proj=vx*ux+vy*uy;proj=Math.max(0,Math.min(segLen,proj));const cx=sx1+ux*proj,cy=sy1+uy*proj;const wdx=(sx-cx)*hmStepW,wdz=(sy-cy)*hmStepD;if(wdx*wdx+wdz*wdz<hw2)maskGrid[sy*hmResW+sx]|=flag;}}}

// ============================== 数据结构 ==============================

class BuildableRegion{constructor(id){this.id=id;this.cells=[];this.area=0;this.centroidWx=0;this.centroidWz=0;this.flatnessScore=0;this.boundingRadius=0;}score(){return this.area*(1-this.flatnessScore);}}

class VillagePlan{constructor(){this.plazaX=0;this.plazaZ=0;this.plazaRadius=0;this.branchRoadPts=[];this.buildingSlots=[];this.capacity=0;this.regionId=-1;}}

class GenerationReport{constructor(){this.phases=[];this.regionsFound=0;this.viableRegions=0;this.villagesPlaced=0;this.buildingsPlaced=0;this.treesPlaced=0;this.roadsBuilt={main:0,branch:0};this.bridgesBuilt=0;this.buildablePct=0;this.failures=[];this.quality={flatness:0,distribution:0,road:0};this.durationMs=0;this.seed=0;}}

// ============================== 配置读取 ==============================

function _readCfg(rngSeed){return{seed:rngSeed||0,maxH:parseFloat(document.getElementById('rg-maxh').value),ptch:parseFloat(document.getElementById('rg-ptch').value),hills:parseInt(document.getElementById('rg-hills').value),octaves:parseInt(document.getElementById('rg-octaves').value),moist:parseInt(document.getElementById('rg-moist').value)/100,sandLvl:parseFloat(document.getElementById('rg-sandlvl')?.value||55)/100,mudLvl:parseFloat(document.getElementById('rg-mudlvl')?.value||60)/100,ponds:parseInt(document.getElementById('rg-ponds').value),pondMaxR:parseFloat(document.getElementById('rg-pondr').value),pondMaxD:parseFloat(document.getElementById('rg-pondd').value),keepPeaks:parseFloat(document.getElementById('rg-keep').value)/100,flatRadius:parseFloat(document.getElementById('rg-flatrad').value)/100,vDensity:document.getElementById('rg-vdensity').value,roadW:parseFloat(document.getElementById('rg-roadw').value),plazaR:parseFloat(document.getElementById('rg-plazar').value),roadBuf:parseFloat(document.getElementById('rg-roadbuf').value),waterBuf:parseFloat(document.getElementById('rg-waterbuf').value),minBld:parseInt(document.getElementById('rg-minbld').value),safeR:parseFloat(document.getElementById('rg-safe').value),treeDensity:parseInt(document.getElementById('rg-treed').value)/100,treeSpacing:parseFloat(document.getElementById('rg-treesp').value),greenB:parseFloat(document.getElementById('rg-greenb').value),};}

// 密度→绝对数转换（sqrt非线性缩放：面积×4→数量×2，避免超大/超小地图极端值）
const _DENSITY_REF_AREA=100000; // 参考面积（~400m 地图可建面积）
function _resolveVillageCount(buildableArea,vDensity){
    const perVillage=vDensity==='dense'?12000:vDensity==='sparse'?50000:25000;
    const scale=Math.sqrt(buildableArea/_DENSITY_REF_AREA);
    return Math.max(1,Math.floor(buildableArea/(perVillage*scale)));
}
function _resolveTreeCount(buildableArea,treeDensity,treeSpacing){
    const avgTreeArea=treeSpacing*treeSpacing*4;
    const raw=Math.floor(buildableArea*treeDensity/avgTreeArea);
    const scale=Math.sqrt(buildableArea/_DENSITY_REF_AREA);
    return Math.max(10,Math.floor(raw/scale));
}
function _resolvePondCount(baseCount,buildableArea){
    const scale=Math.sqrt(buildableArea/_DENSITY_REF_AREA);
    return Math.max(0,Math.floor(baseCount*scale));
}

// ============================== 异步辅助 ==============================

function _yieldToUI(){return new Promise(r=>setTimeout(r,0));}

// ============================== 管线 A：仅生成地形 ==============================

async function generateTerrainOnly(cfgOverride,onStatus){
    const seedVal=parseInt(document.getElementById('rg-seed').value)||Math.floor(Math.random()*2147483647);
    const cfg=_readCfg(seedVal);if(cfgOverride)Object.assign(cfg,cfgOverride);
    const rng=createRng(cfg.seed);
    const report=new GenerationReport();report.seed=cfg.seed;
    const t0=performance.now();
    const emit=(phase,total,label,progress,stats)=>{if(onStatus)onStatus({phase,totalPhases:total,label,progress,stats});};
    const totalPhases=4;

    // --- A1: 清空 + FBM ---
    emit(1,totalPhases,'生成基础地形...',0,{});
    mapData.heightmap.fill(0);mapData.splatMap.fill(0);
    Object.values(entityMarkers).forEach(m=>{scene.remove(m);if(m.disposeRecursive)m.disposeRecursive();else if(m.traverse)m.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});});
    Object.keys(entityMarkers).forEach(k=>delete entityMarkers[k]);
    Object.values(patrolLines).forEach(l=>{scene.remove(l);l.geometry.dispose();l.material.dispose();});
    Object.keys(patrolLines).forEach(k=>delete patrolLines[k]);
    Object.values(bridgeMeshes).forEach(m=>{scene.remove(m);m.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});});
    Object.keys(bridgeMeshes).forEach(k=>delete bridgeMeshes[k]);
    mapData.entities=[];mapData.groups=[];selectedEntityIds.clear();entityIdCounter=1;
    mapData.waters=[];mapData.bridges=[];mapData.editedVerticesPaint=new Set();

    const seedE=cfg.seed,seedM=cfg.seed+2718;
    const totalCells=hmResW*hmResD;

    // FBM — 大地图降采样优化：>400m 半分辨率（保持地形特征）
    const mapSpan=Math.max(worldWidth,worldDepth);
    const fbmRatio=mapSpan>400?0.5:1;
    let elevRaw,moistRaw;
    if(fbmRatio<1){
        const fbmW=Math.max(3,Math.ceil(hmResW*fbmRatio)),fbmD=Math.max(3,Math.ceil(hmResD*fbmRatio));
        // 高程低分辨率
        const fbmElev=_generateFbmGrid(fbmW,fbmD,worldWidth,worldDepth,seedE,cfg.octaves,cfg.ptch,worldHalfW,worldHalfD);
        await _yieldToUI();
        elevRaw=_bilinearUpsample(fbmElev,fbmW,fbmD,hmResW,hmResD);
        // 湿度用全分辨率避免过度均匀
        moistRaw=new Float32Array(totalCells);
        for(let i=0;i<totalCells;i++){
            const sy=Math.floor(i/hmResW),sx=i%hmResW;
            const wx=(sx/(hmResW-1)-0.5)*worldWidth,wz=(sy/(hmResD-1)-0.5)*worldDepth;
            moistRaw[i]=fbm(wx+50,wz+50,seedM,cfg.octaves,cfg.ptch*1.3);
        }
    }else{
        const chunkSize=50000;
        elevRaw=new Float32Array(totalCells);moistRaw=new Float32Array(totalCells);
        for(let offset=0;offset<totalCells;offset+=chunkSize){
            const end=Math.min(offset+chunkSize,totalCells);
            for(let i=offset;i<end;i++){
                const sy=Math.floor(i/hmResW),sx=i%hmResW;
                const wx=(sx/(hmResW-1)-0.5)*worldWidth,wz=(sy/(hmResD-1)-0.5)*worldDepth;
                elevRaw[i]=fbm(wx,wz,seedE,cfg.octaves,cfg.ptch);
                moistRaw[i]=fbm(wx+50,wz+50,seedM,cfg.octaves,cfg.ptch*1.3);
            }
            if(totalCells>500000)await _yieldToUI();
        }
    }
    for(let i=0;i<totalCells;i++){elevRaw[i]=Math.pow(Math.max(0,elevRaw[i]),1.8);moistRaw[i]=Math.max(0,Math.min(1,moistRaw[i]*1.5-0.5+cfg.moist*0.5));}
    for(let i=0;i<totalCells;i++)mapData.heightmap[i]=(elevRaw[i]-0.45)*cfg.maxH;

    // 山丘
    for(let h=0;h<cfg.hills;h++){
        const cx=(rng()-0.5)*worldWidth*0.7,cz=(rng()-0.5)*worldDepth*0.7;
        const rx=6+rng()*14,rz=6+rng()*14;
        const peak=cfg.maxH*(0.25+rng()*0.55);
        const{rPx:rPxW}=Math.max(rx,rz)/Math.max(worldWidth,worldDepth)*Math.max(hmResW,hmResD);
        const{sx:sxC,sy:syC}=world2sm(cx,cz);const rPx=Math.ceil(rPxW);
        for(let dy=-rPx;dy<=rPx;dy++){for(let dx=-rPx;dx<=rPx;dx++){
            const sx2=sxC+dx,sy2=syC+dy;if(sx2<0||sx2>=hmResW||sy2<0||sy2>=hmResD)continue;
            const wx2=(sx2/(hmResW-1)-0.5)*worldWidth,wz2=(sy2/(hmResD-1)-0.5)*worldDepth;
            const d2=((wx2-cx)/rx)**2+((wz2-cz)/rz)**2;
            if(d2<4)mapData.heightmap[sy2*hmResW+sx2]+=peak*Math.exp(-d2);
        }}
    }
    await _yieldToUI();

    // --- A2: 自动平整 ---
    emit(2,totalPhases,'自动平整地形（保峰压谷）...',0,{});
    _autoFlatten(cfg,rng);
    // 计算可建比例
    let buildableCount=0;
    for(let i=0;i<totalCells;i++){const hAbs=Math.abs(mapData.heightmap[i]);if(hAbs<=3){const sy=Math.floor(i/hmResW),sx=i%hmResW;const wx=(sx/(hmResW-1)-0.5)*worldWidth,wz=(sy/(hmResD-1)-0.5)*worldDepth;if(_roughness(wx,wz,6)<=0.8)buildableCount++;}}
    report.buildablePct=Math.round(buildableCount/totalCells*100);
    await _yieldToUI();

    // --- A3: 生态区 + 池塘 ---
    emit(3,totalPhases,'生成生态区和池塘...',0,{});
    for(let i=0;i<totalCells;i++){const e=elevRaw[i],m=moistRaw[i];if(m>cfg.mudLvl&&e<cfg.sandLvl)mapData.splatMap[i]=1;else if(m<0.35&&e>cfg.sandLvl)mapData.splatMap[i]=2;else mapData.splatMap[i]=0;}

    const pondCenters=[];
    const pondTarget=_resolvePondCount(cfg.ponds,buildableCount);
    for(let i=0;i<pondTarget;i++){
        let px,pz,valid=false;
        for(let a=0;a<25;a++){px=(rng()-0.5)*worldWidth*0.65;pz=(rng()-0.5)*worldDepth*0.65;if(Math.abs(px)<25&&Math.abs(pz)<25)continue;let tooClose=false;for(const pc of pondCenters){if(Math.hypot(px-pc.x,pz-pc.z)<cfg.pondMaxR*2.5){tooClose=true;break;}}if(!tooClose){valid=true;break;}}
        if(!valid)continue;
        const r=4+rng()*(cfg.pondMaxR-4),depth=0.5+rng()*(cfg.pondMaxD-0.5);
        const waterLevel=smpHeight(px,pz);
        pondCenters.push({x:px,z:pz,r,depth});
        const rPxX=r/hmStepW,rPxZ=r/hmStepD;const{sx:cx,sy:cy}=world2sm(px,pz);
        const rWin=Math.ceil(rPxX),rZin=Math.ceil(rPxZ);
        for(let dy=-rZin;dy<=rZin;dy++){for(let dx=-rWin;dx<=rWin;dx++){
            const wd=Math.sqrt(dx*dx*hmStepW*hmStepW+dy*dy*hmStepD*hmStepD);if(wd>r)continue;
            const sx2=cx+dx,sy2=cy+dy;if(sx2<0||sx2>=hmResW||sy2<0||sy2>=hmResD)continue;
            const t2=1-wd/r;const falloff=t2*t2*(3-2*t2);
            const idx=sy2*hmResW+sx2;mapData.heightmap[idx]=waterLevel-depth*falloff;
            if(falloff>0.08)mapData.splatMap[idx]=1;
            mapData.editedVerticesPaint.add(sx2+','+sy2);
        }}
        mapData.waters.push({id:'wr'+i,type:'pond',center:{x:px,z:pz},radius:r,waterLevel});
    }

    // --- A4: 刷新 ---
    emit(4,totalPhases,'刷新显示...',0.8,{});
    createGround();renderHeightmapCanvas();refreshWaterList();clearUndoStack();pushSnapshot();

    report.durationMs=performance.now()-t0;
    const cnt=[0,0,0,0,0,0];for(let i=0;i<totalCells;i++)cnt[mapData.splatMap[i]]++;
    emit(4,totalPhases,'地形就绪',1,{buildablePct:report.buildablePct});

    overlayInfo.textContent='🌍 地形已生成 — 草地'+(cnt[0]/totalCells*100).toFixed(0)+'% 泥地'+(cnt[1]/totalCells*100).toFixed(0)+'% 沙地'+(cnt[2]/totalCells*100).toFixed(0)+'% 可建'+report.buildablePct+'% 池塘'+pondCenters.length;
    console.log('🌍 管线A完成: 可建比例='+report.buildablePct+'% seed='+cfg.seed);
    return report;
}

// ============================== 自动平整（保峰压谷）==============================

function _autoFlatten(cfg,rng){
    const keepRatio=1-cfg.keepPeaks; // 85%保留→keepRatio=0.15
    const falloffDist=Math.max(worldWidth,worldDepth)*cfg.flatRadius;
    const step=Math.max(3,Math.floor(Math.min(hmResW,hmResD)/60));
    const peaks=[];

    // 找局部峰值
    for(let sy=step;sy<hmResD-step;sy+=step){for(let sx=step;sx<hmResW-step;sx+=step){
        const cv=mapData.heightmap[sy*hmResW+sx];let isMax=true;
        for(let dy=-step;dy<=step&&isMax;dy+=step)for(let dx=-step;dx<=step&&isMax;dx+=step)
            if(mapData.heightmap[(sy+dy)*hmResW+(sx+dx)]>cv)isMax=false;
        if(isMax&&cv>1.5)peaks.push({sx,sy,h:cv});
    }}
    peaks.sort((a,b)=>b.h-a.h);
    const kept=peaks.slice(0,cfg.hills||4);

    // 衰减
    const sq=(x)=>x*x;
    for(let sy=0;sy<hmResD;sy++){for(let sx=0;sx<hmResW;sx++){
        const idx=sy*hmResW+sx;const origH=mapData.heightmap[idx];let minDist=Infinity;
        for(const p of kept){const d=Math.hypot((sx-p.sx)*hmStepW,(sy-p.sy)*hmStepD);if(d<minDist)minDist=d;}
        const t=Math.max(0,Math.min(1,minDist/falloffDist));
        const s=t*t*(3-2*t);
        mapData.heightmap[idx]=origH*(1.0-s*(1-keepRatio));
    }}
    console.log('🏔️ 自动平整: '+peaks.length+'峰→保留'+kept.length+'个, 谷削至'+(keepRatio*100).toFixed(0)+'%');
}

// ============================== 管线 B：生成道路与村落 ==============================

async function generateRoadsAndVillages(cfgOverride,onStatus){
    const seedVal=parseInt(document.getElementById('rg-seed').value)||Math.floor(Math.random()*2147483647);
    const cfg=_readCfg(seedVal);if(cfgOverride)Object.assign(cfg,cfgOverride);
    const rng=createRng(cfg.seed);
    const report=new GenerationReport();report.seed=cfg.seed;
    const t0=performance.now();
    const emit=(phase,total,label,progress,stats)=>{if(onStatus)onStatus({phase,totalPhases:total,label,progress,stats,details:report.failures.slice(-5)});};
    const totalPhases=6;
    const totalCells=hmResW*hmResD;

    // --- B1: 初始化 + 构建掩码 ---
    emit(1,totalPhases,'初始化掩码网格...',0,{regions:0,villages:0,buildings:0,trees:0});
    // 清除非地形数据
    Object.values(entityMarkers).forEach(m=>{scene.remove(m);if(m.disposeRecursive)m.disposeRecursive();else if(m.traverse)m.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});});
    Object.keys(entityMarkers).forEach(k=>delete entityMarkers[k]);
    Object.values(patrolLines).forEach(l=>{scene.remove(l);l.geometry.dispose();l.material.dispose();});
    Object.keys(patrolLines).forEach(k=>delete patrolLines[k]);
    for(const oldB of mapData.bridges){if(oldB._carvedCells)for(const cc of oldB._carvedCells){mapData.heightmap[cc.idx]=cc.origH;if(cc.origSplat!==undefined)mapData.splatMap[cc.idx]=cc.origSplat;}}
    Object.values(bridgeMeshes).forEach(m=>{scene.remove(m);m.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});});
    Object.keys(bridgeMeshes).forEach(k=>delete bridgeMeshes[k]);
    mapData.entities=[];mapData.groups=[];selectedEntityIds.clear();entityIdCounter=1;mapData.bridges=[];
    for(let i=0;i<totalCells;i++){const v=mapData.splatMap[i];if(v>=3||v<0||v>5)mapData.splatMap[i]=0;}
    createGround();renderHeightmapCanvas();

    // 构建掩码
    maskGrid=new Uint8Array(totalCells);let buildableCount=0;
    for(let sy=0;sy<hmResD;sy++){for(let sx=0;sx<hmResW;sx++){
        const idx=sy*hmResW+sx;const wx=(sx/(hmResW-1)-0.5)*worldWidth,wz=(sy/(hmResD-1)-0.5)*worldDepth;
        const hAbs=Math.abs(mapData.heightmap[idx]);
        // 水体检测
        if(isPointInWater(wx,wz,cfg.waterBuf)){maskGrid[idx]=MG_WATER|MG_FORBIDDEN;continue;}
        // 边界缓冲
        if(Math.abs(wx)>worldHalfW-5||Math.abs(wz)>worldHalfD-5){maskGrid[idx]=MG_FORBIDDEN;continue;}
        // 粗糙度 + 海拔
        const rough=_roughness(wx,wz,6);
        if(rough>0.8||hAbs>3){maskGrid[idx]=MG_FORBIDDEN;continue;}
        maskGrid[idx]=MG_BUILDABLE;buildableCount++;
    }}
    report.buildablePct=Math.round(buildableCount/totalCells*100);

    // --- B2: 主干道 ---
    emit(2,totalPhases,'规划主干道路...',0,{regions:0,villages:0,buildings:0,trees:0});
    const mainRoadPts=_generateMainRoad(cfg,rng);
    const mainSmooth=samplePathSmoothDense(mainRoadPts,1.0);
    const mainLen=computePathLength(mainSmooth);
    const mainWidth=cfg.roadW*1.5;
    report.roadsBuilt.main=Math.round(mainLen);

    // 主干道写入 splatMap + maskGrid
    for(let i=1;i<mainSmooth.length;i++)drawRoadLine(mainSmooth[i-1].x,mainSmooth[i-1].z,mainSmooth[i].x,mainSmooth[i].z,mainWidth,4);
    for(let i=1;i<mainSmooth.length;i++){_mgSetLine(mainSmooth[i-1].x,mainSmooth[i-1].z,mainSmooth[i].x,mainSmooth[i].z,mainWidth/2,MG_ROAD|MG_FORBIDDEN);_mgSetLine(mainSmooth[i-1].x,mainSmooth[i-1].z,mainSmooth[i].x,mainSmooth[i].z,mainWidth/2+cfg.roadBuf,MG_BUFFER|MG_FORBIDDEN);}
    await _yieldToUI();

    // --- B3: Flood Fill 区域分割 ---
    emit(3,totalPhases,'分割平坦区域...',0,{regions:0,villages:0,buildings:0,trees:0});
    const regions=_findBuildableRegions();
    report.regionsFound=regions.length;
    report.viableRegions=regions.filter(r=>r.boundingRadius>=25).length;

    // --- B4: 村落选址 + 容量预验证（v0.51 多轮大区域选址）---
    emit(4,totalPhases,'村落选址与容量验证...',0.3,{regions:report.regionsFound,villages:0,buildings:0,trees:0});
    const buildableArea=buildableCount*hmStepW*hmStepD;
    const targetVillages=_resolveVillageCount(buildableArea,cfg.vDensity);
    const villagePlans=[];
    const allRoadPoints=[...mainSmooth];
    // 村落最小间距：按地图尺寸自适应（大图80m，小图按10%边长）
    const MIN_VILLAGE_SPACING=Math.min(80,Math.max(worldWidth,worldDepth)*0.1);
    const MAX_ROUNDS=3;
    // 多轮选址：每轮每个区域尝试放一个村，直到达目标或无可用位置
    for(let round=0;round<MAX_ROUNDS&&villagePlans.length<targetVillages;round++){
        let placedThisRound=0;
        for(const region of regions){
            if(villagePlans.length>=targetVillages)break;
            if(region.boundingRadius<25)continue;
            const existingPlazas=villagePlans.map(p=>({x:p.plazaX,z:p.plazaZ}));
            let bestPlan=null;
            for(let attempt=0;attempt<6&&!bestPlan;attempt++){
                const plan=_tryPlanVillage(region,mainSmooth,cfg,rng,round,existingPlazas);
                if(!plan)continue;
                if(plan.capacity<cfg.minBld){report.failures.push({phase:'容量验证',reason:'容量不足',detail:'区域'+region.id+' 最多'+plan.capacity+'栋(需要≥'+cfg.minBld+')'});continue;}
                let tooClose=false;
                for(const existing of villagePlans){
                    if(Math.hypot(plan.plazaX-existing.plazaX,plan.plazaZ-existing.plazaZ)<MIN_VILLAGE_SPACING){tooClose=true;break;}
                }
                if(!tooClose){bestPlan=plan;break;}
            }
            if(bestPlan){villagePlans.push(bestPlan);report.villagesPlaced++;placedThisRound++;allRoadPoints.push(...bestPlan.branchRoadPts);}
        }
        if(placedThisRound===0)break;
        await _yieldToUI();
    }
    if(villagePlans.length===0&&regions.length>0){
        // 兜底：在最大区域的质心强制建村
        const r=regions[0];const plan=new VillagePlan();
        plan.plazaX=r.centroidWx;plan.plazaZ=r.centroidWz;plan.plazaRadius=cfg.plazaR;
        plan.regionId=r.id;plan.capacity=cfg.minBld;
        const directPts=[{x:plan.plazaX,z:plan.plazaZ},mainSmooth[Math.floor(mainSmooth.length/2)]];
        plan.branchRoadPts=directPts;
        const slots=_simulateBuildingSlots(plan.plazaX,plan.plazaZ,plan.plazaRadius,mainSmooth,cfg,rng);
        plan.buildingSlots=slots;plan.capacity=slots.length;
        if(plan.capacity>=cfg.minBld){villagePlans.push(plan);report.villagesPlaced++;report.failures.push({phase:'选址',reason:'兜底模式',detail:'所有正常选址失败，在最大区域强制建村'});}
    }

    // --- B5: 落地村落 ---
    emit(5,totalPhases,'生成村落与建筑...',0.4,{regions:report.regionsFound,villages:report.villagesPlaced,buildings:0,trees:0});
    const branchWidth=Math.max(3,cfg.roadW*0.8);
    let totalBldgs=0;

    for(const plan of villagePlans){
        // 广场整平 + 纹理
        _flattenCircle(plan.plazaX,plan.plazaZ,plan.plazaRadius);
        drawCircleSplat(plan.plazaX,plan.plazaZ,plan.plazaRadius,3);
        _mgSetRect(plan.plazaX,plan.plazaZ,plan.plazaRadius,MG_PLAZA|MG_FORBIDDEN);

        // 支路落地：截断到主路边缘（避免混凝土覆盖柏油）
        if(plan.branchRoadPts.length>=2){
            let branchPts=[...plan.branchRoadPts];
            // 从末端反向查找，截断到距主路中心 >mainHalfW+2 的位置
            const mainHalfW=mainWidth/2;
            let truncIdx=branchPts.length;
            for(let i=branchPts.length-1;i>=0;i--){
                let minD=Infinity;
                for(const mp of mainSmooth){
                    const d=Math.hypot(branchPts[i].x-mp.x,branchPts[i].z-mp.z);
                    if(d<minD)minD=d;
                }
                if(minD>mainHalfW+1){truncIdx=i+1;break;}
            }
            branchPts=branchPts.slice(0,truncIdx);
            // 确保最后一点连到主路边距处
            if(branchPts.length>=1){
                const last=branchPts[branchPts.length-1];
                // 找主路上最近点，延伸last到主路边缘
                let bestMp=null,bestD=Infinity;
                for(const mp of mainSmooth){
                    const d=Math.hypot(last.x-mp.x,last.z-mp.z);
                    if(d<bestD){bestD=d;bestMp=mp;}
                }
                if(bestMp&&bestD>mainHalfW+1){
                    const dx=bestMp.x-last.x,dz=bestMp.z-last.z;
                    const dist=Math.hypot(dx,dz)||1;
                    const ux=dx/dist,uz=dz/dist;
                    branchPts.push({x:last.x+ux*(dist-mainHalfW-1),z:last.z+uz*(dist-mainHalfW-1)});
                }
            }
            if(branchPts.length>=2){
                const branchSmooth=samplePathSmoothDense(branchPts,1.0);
                for(let i=1;i<branchSmooth.length;i++)drawRoadLine(branchSmooth[i-1].x,branchSmooth[i-1].z,branchSmooth[i].x,branchSmooth[i].z,branchWidth,3);
                for(let i=1;i<branchSmooth.length;i++){_mgSetLine(branchSmooth[i-1].x,branchSmooth[i-1].z,branchSmooth[i].x,branchSmooth[i].z,branchWidth/2,MG_ROAD|MG_FORBIDDEN);_mgSetLine(branchSmooth[i-1].x,branchSmooth[i-1].z,branchSmooth[i].x,branchSmooth[i].z,branchWidth/2+cfg.roadBuf,MG_BUFFER|MG_FORBIDDEN);}
                allRoadPoints.push(...branchSmooth);
                report.roadsBuilt.branch+=Math.round(computePathLength(branchSmooth));
                // 更新plan的支路点（截断后的，供 roadSystem 存储用）
                plan.branchRoadPts=branchPts;
            }
        }

        // 建筑放置
        const bldgTypes=['bungalow','villa','apartment'];
        const planBuildings=[]; // 收集本村建筑坐标用于生成连接路
        for(const slot of plan.buildingSlots){
            const h=smpHeight(slot.x,slot.z);
            const bt=bldgTypes[Math.floor(rng()*bldgTypes.length)];
            addEntity('building',slot.x,h,slot.z,bt,slot.angle);
            totalBldgs++;
            planBuildings.push({x:slot.x,z:slot.z});
            const idx=_mgIdx(slot.x,slot.z);if(idx>=0)maskGrid[idx]|=MG_BUILDING|MG_FORBIDDEN;
        }

        // 生成连接路：直接用模拟阶段的簇数据
        const connectors=[];
        const clusterData=plan.buildingSlots._clusters||[];
        for(const cl of clusterData){
            if(cl.buildings.length<2)continue;
            let gcx=cl.cx,gcz=cl.cz;
            // 如果簇中心无效，用建筑均值
            if(!gcx&&!gcz){
                for(const b of cl.buildings){gcx+=b.x;gcz+=b.z;}
                gcx/=cl.buildings.length;gcz/=cl.buildings.length;
            }
            const ang=Math.atan2(gcz-plan.plazaZ,gcx-plan.plazaX);
            const edgeX=plan.plazaX+Math.cos(ang)*(plan.plazaRadius+2);
            const edgeZ=plan.plazaZ+Math.sin(ang)*(plan.plazaRadius+2);
            drawRoadLine(edgeX,edgeZ,gcx,gcz,2,3);
            connectors.push({x1:edgeX,z1:edgeZ,x2:gcx,z2:gcz,width:2});
        }
        plan._connectors=connectors;
    }
    report.buildingsPlaced=totalBldgs;

    // --- B6: 障碍物 ---
    emit(6,totalPhases,'放置树木...',0.7,{regions:report.regionsFound,villages:report.villagesPlaced,buildings:totalBldgs,trees:0});
    const treeTarget=_resolveTreeCount(buildableCount*hmStepW*hmStepD,cfg.treeDensity,cfg.treeSpacing);
    const trees=_placeObstacles(treeTarget,cfg,rng);
    report.treesPlaced=trees.length;

    // --- B7: 最终化 ---
    emit(6,totalPhases,'检测桥梁/出生点/保存...',0.9,{regions:report.regionsFound,villages:report.villagesPlaced,buildings:totalBldgs,trees:trees.length});
    clearEntitiesOnRoadSplat();
    const allRoadSmooths=[mainSmooth];for(const plan of villagePlans){if(plan.branchRoadPts.length>=2)allRoadSmooths.push(samplePathSmoothDense(plan.branchRoadPts,1.0));}
    for(const rs of allRoadSmooths)detectAndBuildBridges(rs);
    report.bridgesBuilt=mapData.bridges.length;

    // 出生点
    let spawnX=0,spawnZ=0;
    if(isPointInWater(spawnX,spawnZ,cfg.safeR)){let found=false;for(let r2=10;r2<worldHalfW&&!found;r2+=10){for(let a=0;a<Math.PI*2&&!found;a+=0.3){const sx=Math.cos(a)*r2,sz=Math.sin(a)*r2;if(Math.abs(sx)>worldHalfW-10||Math.abs(sz)>worldHalfD-10)continue;if(!isPointInWater(sx,sz,cfg.safeR)){spawnX=sx;spawnZ=sz;found=true;}}}}
    addEntity('spawn',spawnX,smpHeight(spawnX,spawnZ),spawnZ,null);

    // roadSystem
    const roadSegments=[];_storeRoadSegments(roadSegments,mainSmooth,mainWidth,'main',10);for(const plan of villagePlans){if(plan.branchRoadPts.length>=2){const bs=samplePathSmoothDense(plan.branchRoadPts,1.0);_storeRoadSegments(roadSegments,bs,branchWidth,'village',8);}}
    const villages=villagePlans.map(plan=>({plazaX:plan.plazaX,plazaZ:plan.plazaZ,plazaRadius:plan.plazaRadius,buildings:plan.buildingSlots.map(s=>({x:s.x,z:s.z,angle:s.angle})),connectors:plan._connectors||[]}));
    // 连接路写入 roadSegments
    for(const v of villages){for(const conn of v.connectors){roadSegments.push({x1:conn.x1,z1:conn.z1,x2:conn.x2,z2:conn.z2,width:conn.width||2,type:'village'});}}
    const mainRoad={points:_downsamplePts(mainSmooth,5),width:mainWidth,type:'asphalt',roughness:_measureRoughness(mainSmooth,mainWidth/2)};
    const branchRoads=villagePlans.filter(p=>p.branchRoadPts.length>=2).map(p=>{const bs=samplePathSmoothDense(p.branchRoadPts,1.0);return{points:_downsamplePts(bs,5),width:branchWidth,type:'concrete',roughness:_measureRoughness(bs,branchWidth/2)};});
    mapData.roadSystem={roadSegments,villages,mainRoad,branchRoads};

    // 质量评分
    report.quality.flatness=Math.min(1,report.buildablePct/70);
    report.quality.distribution=Math.min(1,villagePlans.length/Math.max(1,targetVillages));
    report.quality.road=Math.min(1,mainLen/Math.max(worldWidth,worldDepth));
    report._avgQ=((report.quality.flatness+report.quality.distribution+report.quality.road)/3).toFixed(2);

    createGround();renderHeightmapCanvas();refreshEntityList();refreshWaterList();clearUndoStack();pushSnapshot();
    report.durationMs=performance.now()-t0;

    overlayInfo.textContent='🏘️ 村落已生成 — 主干道'+report.roadsBuilt.main+'m +'+report.villagesPlaced+'村 | '+report.buildingsPlaced+'建筑 '+report.treesPlaced+'树木 | 桥梁'+report.bridgesBuilt+' | ⭐'+report._avgQ;
    console.log('🏘️ 管线B完成: '+report.villagesPlaced+'村 '+report.buildingsPlaced+'建筑 可建'+report.buildablePct+'% 评分'+report._avgQ+' seed='+cfg.seed);
    maskGrid=null; // 释放掩码
    return report;
}

// ============================== 一键全部 ==============================

async function generateAll(cfgOverride,onStatus){
    const cfg=_readCfg(parseInt(document.getElementById('rg-seed').value));
    if(cfgOverride)Object.assign(cfg,cfgOverride);
    const rng=createRng(cfg.seed);

    // 管线A
    const reportA=await generateTerrainOnly({...cfg,seed:cfg.seed},onStatus);
    await _yieldToUI();

    // 管线B（继承rng状态）
    const reportB=await generateRoadsAndVillages({...cfg,seed:cfg.seed},onStatus);

    // 合并报告
    reportB.buildablePct=reportA.buildablePct;
    reportB.seed=cfg.seed;
    return reportB;
}

// ============================== 区域分割 ==============================

function _findBuildableRegions(){
    const visited=new Uint8Array(hmResW*hmResD);const regions=[];let rid=0;
    for(let sy=0;sy<hmResD;sy++){for(let sx=0;sx<hmResW;sx++){
        const idx=sy*hmResW+sx;if(visited[idx])continue;if(!(maskGrid[idx]&MG_BUILDABLE))continue;
        const region=new BuildableRegion(rid++);const queue=[idx];visited[idx]=1;
        while(queue.length>0){
            const cur=queue.shift();region.cells.push(cur);region.area++;
            const csx=cur%hmResW,csy=Math.floor(cur/hmResW);region.centroidWx+=(csx/(hmResW-1)-0.5)*worldWidth;region.centroidWz+=(csy/(hmResD-1)-0.5)*worldDepth;
            const nbs=[cur-1,cur+1,cur-hmResW,cur+hmResW];
            for(const ni of nbs){if(ni>=0&&ni<hmResW*hmResD&&!visited[ni]&&(maskGrid[ni]&MG_BUILDABLE)){visited[ni]=1;queue.push(ni);}}
        }
        region.centroidWx/=region.area;region.centroidWz/=region.area;
        let maxR=0;for(const ci of region.cells){const sx2=ci%hmResW,sy2=Math.floor(ci/hmResW);const wx2=(sx2/(hmResW-1)-0.5)*worldWidth,wz2=(sy2/(hmResD-1)-0.5)*worldDepth;const d=Math.hypot(wx2-region.centroidWx,wz2-region.centroidWz);if(d>maxR)maxR=d;}
        region.boundingRadius=maxR;
        let rSum=0,rCnt=0;for(const ci of region.cells){const sx2=ci%hmResW,sy2=Math.floor(ci/hmResW);const wx2=(sx2/(hmResW-1)-0.5)*worldWidth,wz2=(sy2/(hmResD-1)-0.5)*worldDepth;rSum+=_roughness(wx2,wz2,4);rCnt++;}
        region.flatnessScore=rSum/rCnt;
        regions.push(region);
    }}
    regions.sort((a,b)=>b.score()-a.score());
    return regions;
}

// ============================== 选址与容量验证 ==============================

function _tryPlanVillage(region,mainSmooth,cfg,rng,searchOffset=0,existingPlazas=[]){
    const plan=new VillagePlan();plan.regionId=region.id;
    const mainLen=computePathLength(mainSmooth);

    // 搜索最佳广场位置：质心附近采样，多轮时递进搜索范围并回避已有村落
    let bestPlaza=null,bestScore=-Infinity;
    const maxSearch=Math.min(region.boundingRadius*0.6,150);
    const minSearch=Math.min(maxSearch*0.25,30);
    const searchR=minSearch+(maxSearch-minSearch)*Math.min(1,(searchOffset+1)/3); // offset从0.33开始
    for(let t=0;t<18;t++){
        const ang=rng()*Math.PI*2;const dist=rng()*searchR;
        const px=region.centroidWx+Math.cos(ang)*dist,pz=region.centroidWz+Math.sin(ang)*dist;
        if(Math.abs(px)>worldHalfW-15||Math.abs(pz)>worldHalfD-15)continue;
        if(isPointInWater(px,pz,cfg.waterBuf))continue;
        const idx=_mgIdx(px,pz);if(idx<0||!(maskGrid[idx]&MG_BUILDABLE))continue;
        // 与主干道保持安全距离（广场半径+道路半宽+缓冲）
        const safeRdDist=cfg.plazaR+cfg.roadW/2+5;
        let nearRoad=false;
        for(let i=0;i<mainSmooth.length;i+=3){if(Math.hypot(px-mainSmooth[i].x,pz-mainSmooth[i].z)<safeRdDist){nearRoad=true;break;}}
        if(nearRoad)continue;
        // 评分：平坦度为主 + 距主路距离 + 回避已有村落
        const flatScore=1-_roughness(px,pz,8);
        if(flatScore<0.35)continue; // 硬门槛：太崎岖直接排除
        let minRdDist=Infinity;for(let i=0;i<mainSmooth.length;i+=5){const d=Math.hypot(px-mainSmooth[i].x,pz-mainSmooth[i].z);if(d<minRdDist)minRdDist=d;}
        const rdScore=Math.min(1,minRdDist/80);
        let avoidPenalty=0;
        for(const ep of existingPlazas){const ed=Math.hypot(px-ep.x,pz-ep.z);if(ed<60)avoidPenalty+=1.0-ed/60;}
        const score=flatScore*0.6+rdScore*0.2-avoidPenalty*0.2;
        if(score>bestScore){bestScore=score;bestPlaza={x:px,z:pz};}
    }
    if(!bestPlaza)return null;

    plan.plazaX=bestPlaza.x;plan.plazaZ=bestPlaza.z;plan.plazaRadius=cfg.plazaR;

    // 生长支路到主干道
    const closestMainPt=_findClosestOnPath(bestPlaza.x,bestPlaza.z,mainSmooth);
    const branchPts=_growBranchRoad(bestPlaza.x,bestPlaza.z,closestMainPt.x,closestMainPt.z,cfg,rng);
    plan.branchRoadPts=branchPts;

    // 模拟建筑放置
    const allRoadsForTest=[...mainSmooth,...branchPts];
    const slots=_simulateBuildingSlots(bestPlaza.x,bestPlaza.z,cfg.plazaR,allRoadsForTest,cfg,rng);
    plan.buildingSlots=slots;plan.capacity=slots.length;

    return plan;
}

// ============================== 支路生长 ==============================

function _growBranchRoad(fromX,fromZ,towardX,towardZ,cfg,rng){
    const pts=[{x:fromX,z:fromZ}];const targetAngle=Math.atan2(towardZ-fromZ,towardX-fromX);const maxSegs=12;const segLen=8;
    let cx=fromX,cz=fromZ;
    for(let i=0;i<maxSegs;i++){
        let bestStep=null,bestDiff=Infinity;
        for(let s=-4;s<=4;s++){
            const ang=targetAngle+s*0.2;
            const tx=cx+Math.cos(ang)*segLen,tz=cz+Math.sin(ang)*segLen;
            if(Math.abs(tx)>worldHalfW-5||Math.abs(tz)>worldHalfD-5)continue;
            if(isPointInWater(tx,tz,cfg.waterBuf))continue;
            const idx=_mgIdx(tx,tz);if(idx>=0&&maskGrid[idx]&MG_FORBIDDEN&&!(maskGrid[idx]&MG_BUILDABLE))continue;
            const diff=_roughness(tx,tz,5);
            if(diff<bestDiff){bestDiff=diff;bestStep={x:tx,z:tz};}
        }
        if(!bestStep||bestDiff>0.7)break;
        cx=bestStep.x;cz=bestStep.z;pts.push({x:cx,z:cz});
        if(Math.hypot(cx-towardX,cz-towardZ)<segLen*1.5)break;
    }
    // 确保终点连接到目标（主路）
    const lastPt=pts[pts.length-1];
    if(Math.hypot(lastPt.x-towardX,lastPt.z-towardZ)>3){
        pts.push({x:towardX,z:towardZ});
    }
    return pts;
}

// ============================== 建筑按角度聚类（用于生成连接路）==============================

function _clusterByAngle(buildings,cx,cz){
    // 按相对于广场的角度排序
    const sorted=buildings.map(b=>({x:b.x,z:b.z,ang:Math.atan2(b.z-cz,b.x-cx)})).sort((a,b)=>a.ang-b.ang);
    if(sorted.length<=3)return [{buildings:sorted}];
    // 拆分：角度间隙 > 30° 处分群
    const groups=[];let cur=[sorted[0]];
    for(let i=1;i<sorted.length;i++){
        const gap=sorted[i].ang-cur[cur.length-1].ang;
        if(gap>Math.PI/6){groups.push({buildings:cur});cur=[];}
        cur.push(sorted[i]);
    }
    if(cur.length>0)groups.push({buildings:cur});
    // 跨 0° 合并首尾群
    if(groups.length>1){
        const firstBegin=groups[0].buildings[0].ang;
        const lastEnd=groups[groups.length-1].buildings[groups[groups.length-1].buildings.length-1].ang;
        if(lastEnd-firstBegin>Math.PI*5/3){
            const merged=groups[groups.length-1].buildings.concat(groups[0].buildings);
            groups.shift();groups.pop();groups.push({buildings:merged});
        }
    }
    return groups;
}

// ============================== 建筑模拟放置 ==============================

function _simulateBuildingSlots(plazaX,plazaZ,plazaR,allRoadPts,cfg,rng){
    const slots=[];
    // 确定"村前方向"：取支路中段方向（如果有支路），否则随机
    let villageForward=0;
    if(allRoadPts.length>10){
        const mid=allRoadPts[Math.floor(allRoadPts.length/4)]; // 取道路约1/4处
        villageForward=Math.atan2(mid.z-plazaZ,mid.x-plazaX);
    }
    // 分为 2-4 个角度簇，限制在村前方向 ±100° 内，簇间留 ≥40° 间隙
    const numClusters=2+Math.floor(rng()*3);
    const clusterCenters=[];
    const arcHalf=100*Math.PI/180;
    const minGap=35*Math.PI/180;
    for(let ci=0;ci<numClusters*2&&clusterCenters.length<numClusters;ci++){
        let bestAng=null,bestGap=0;
        for(let tryA=0;tryA<20;tryA++){
            const ang=villageForward-arcHalf+rng()*arcHalf*2;
            let minDist=Infinity;
            for(const c of clusterCenters){
                let gap=Math.abs(ang-c.ang);
                if(gap>Math.PI)gap=Math.PI*2-gap;
                if(gap<minDist)minDist=gap;
            }
            if(clusterCenters.length===0||minDist>=minGap){bestAng=ang;break;}
            if(minDist>bestGap){bestGap=minDist;bestAng=ang;}
        }
        if(bestAng!==null){
            const cDist=plazaR+20+rng()*35;
            clusterCenters.push({ang:bestAng,dist:cDist});
        }
    }

    // 在每个簇周围撒建筑
    const clusterRadius=Math.max(10,plazaR*1.5);
    const slotsPerCluster=Math.ceil(30/Math.max(1,clusterCenters.length));
    const clusterData=[]; // 记录簇数据供连接路生成
    for(const cc of clusterCenters){
        const ccx=plazaX+Math.cos(cc.ang)*cc.dist;
        const ccz=plazaZ+Math.sin(cc.ang)*cc.dist;
        const clusterSlots=[];
        let placed=0;
        for(let a=0;a<slotsPerCluster*15&&placed<slotsPerCluster;a++){
            const bAng=rng()*Math.PI*2;
            const bDist=rng()*clusterRadius;
            const bx=ccx+Math.cos(bAng)*bDist,bz=ccz+Math.sin(bAng)*bDist;
            if(Math.abs(bx)>worldHalfW-3||Math.abs(bz)>worldHalfD-3)continue;
            const idx=_mgIdx(bx,bz);if(idx>=0&&maskGrid[idx]&MG_FORBIDDEN)continue;
            if(isPointInWater(bx,bz,1))continue;
            if(_roughness(bx,bz,6)>0.7||Math.abs(smpHeight(bx,bz))>3)continue;
            let minRdDist=Infinity;
            for(const rp of allRoadPts){const d=Math.hypot(bx-rp.x,bz-rp.z);if(d<minRdDist)minRdDist=d;}
            if(minRdDist<2||minRdDist>50)continue;
            let tooClose=false;
            for(const s of slots){if(Math.hypot(bx-s.x,bz-s.z)<4)tooClose=true;}
            if(tooClose)continue;
            const yaw=_findClosestRoadAngle(bx,bz,allRoadPts);
            const slot={x:bx,z:bz,angle:yaw};slots.push(slot);clusterSlots.push(slot);placed++;
        }
        if(clusterSlots.length>=2)clusterData.push({cx:ccx,cz:ccz,buildings:clusterSlots});
    }
    slots._clusters=clusterData;
    return slots;
}

// ============================== 建筑朝向 ==============================

function _findClosestOnPath(wx,wz,pts){let best=pts[0],bestD=Infinity;for(const p of pts){const d=Math.hypot(wx-p.x,wz-p.z);if(d<bestD){bestD=d;best=p;}}return best;}

function _findClosestRoadAngle(wx,wz,allRoadPts){let bestD=Infinity,bestP=null;for(const p of allRoadPts){const d=Math.hypot(wx-p.x,wz-p.z);if(d<bestD){bestD=d;bestP=p;}}if(!bestP)return 0;return Math.atan2(bestP.z-wz,bestP.x-wx);}

// ============================== 广场整平 ==============================

function _flattenCircle(cx,cz,radius){
    const rPxX=radius/hmStepW,rPxZ=radius/hmStepD;const{sx:sc,sy:sz}=world2sm(cx,cz);
    const rWin=Math.ceil(rPxX),rZin=Math.ceil(rPxZ);
    // 取边缘平均高度
    let edgeSum=0,edgeCnt=0;const innerPts=[];
    for(let dy=-rZin;dy<=rZin;dy++){for(let dx=-rWin;dx<=rWin;dx++){
        const sx2=sc+dx,sy2=sz+dy;if(sx2<0||sx2>=hmResW||sy2<0||sy2>=hmResD)continue;
        const wd=Math.sqrt(dx*dx*hmStepW*hmStepW+dy*dy*hmStepD*hmStepD);
        if(wd>radius)continue;
        const t=wd/radius;
        if(t>0.8&&t<=1.0){edgeSum+=mapData.heightmap[sy2*hmResW+sx2];edgeCnt++;}
        else if(t<=0.8)innerPts.push({sx:sx2,sy:sy2});
    }}
    const avgH=edgeCnt>0?edgeSum/edgeCnt:0;
    for(const{ sx:sx2,sy:sy2}of innerPts)mapData.heightmap[sy2*hmResW+sx2]=avgH;
}

// ============================== 障碍物放置 ==============================

function _placeObstacles(targetCount,cfg,rng){
    const trees=[];const gridSpacing=cfg.treeSpacing*2;
    const maxAttempts=targetCount*5;
    for(let a=0;a<maxAttempts&&trees.length<targetCount;a++){
        const tx=(rng()-0.5)*worldWidth*0.85,tz=(rng()-0.5)*worldDepth*0.85;
        if(Math.abs(tx)>worldHalfW-4||Math.abs(tz)>worldHalfD-4)continue;
        if(isPointInWater(tx,tz,3))continue;
        const idx=_mgIdx(tx,tz);if(idx>=0&&maskGrid[idx]&MG_FORBIDDEN)continue;
        if(_roughness(tx,tz,5)>0.8)continue;
        // 绿化带：距道路
        let minRdD=Infinity;for(const rp of mapData.roadSystem?.roadSegments||[]){const d=pointToSegmentDist(tx,tz,rp.x1,rp.z1,rp.x2,rp.z2);if(d<minRdD)minRdD=d;}
        if(minRdD<cfg.greenB)continue;
        // 距建筑
        let tooClose=false;for(const b of trees){if(Math.hypot(tx-b.x,tz-b.z)<cfg.treeSpacing)tooClose=true;}
        if(tooClose)continue;
        trees.push({x:tx,z:tz});
    }
    const treeTypes=['cone','sphere','oak'];
    for(const tp of trees){const tt=treeTypes[Math.floor(rng()*treeTypes.length)];addEntity('tree',tp.x,smpHeight(tp.x,tp.z),tp.z,tt);}
    return trees;
}

// ============================== 道路存储辅助 ==============================

function _storeRoadSegments(segments,smoothPts,width,type,step){for(let i=0;i<smoothPts.length-1;i+=step){const j=Math.min(i+step,smoothPts.length-1);segments.push({x1:smoothPts[i].x,z1:smoothPts[i].z,x2:smoothPts[j].x,z2:smoothPts[j].z,width,type});}}

function _downsamplePts(pts,spacing){const r=[pts[0]];let acc=0;for(let i=1;i<pts.length;i++){acc+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);if(acc>=spacing||i===pts.length-1){r.push(pts[i]);acc=0;}}return r.map(p=>({x:p.x,z:p.z}));}

function _measureRoughness(pts,hw){const ranges=[];const step2=Math.max(1,Math.floor(pts.length/20));for(let i=0;i<pts.length-1;i+=step2){const dx=pts[i+1].x-pts[i].x,dz=pts[i+1].z-pts[i].z;const segLen=Math.hypot(dx,dz)||1;const snx=-dz/segLen,snz=dx/segLen;const x=pts[i].x,z=pts[i].z;const hs=[smpHeight(x,z),smpHeight(x+snx*hw,z+snz*hw),smpHeight(x-snx*hw,z-snz*hw),smpHeight(x+snx*hw*0.5,z+snz*hw*0.5),smpHeight(x-snx*hw*0.5,z-snz*hw*0.5)];ranges.push(Math.max(...hs)-Math.min(...hs));}ranges.sort((a,b)=>a-b);return ranges[Math.floor(ranges.length*0.9)]||0;}

// ============================== 平整地形（手动按钮）==============================

function flattenTerrain(){
    if(!undoManager._inUndoRedo)pushSnapshot();
    const keepPeaks=parseInt(document.getElementById('rg-hills').value)||4;
    const flatRad=parseFloat(document.getElementById('rg-flatrad').value)/100;
    const keepRatio=1-parseFloat(document.getElementById('rg-keep').value)/100;
    const falloffDist=Math.max(worldWidth,worldDepth)*flatRad;
    const step=Math.max(3,Math.floor(Math.min(hmResW,hmResD)/60));
    const peaks=[];
    for(let sy=step;sy<hmResD-step;sy+=step){for(let sx=step;sx<hmResW-step;sx+=step){
        const cv=mapData.heightmap[sy*hmResW+sx];let isMax=true;
        for(let dy=-step;dy<=step&&isMax;dy+=step)for(let dx=-step;dx<=step&&isMax;dx+=step)
            if(mapData.heightmap[(sy+dy)*hmResW+(sx+dx)]>cv)isMax=false;
        if(isMax&&cv>1.5)peaks.push({sx,sy,h:cv});
    }}
    peaks.sort((a,b)=>b.h-a.h);const kept=peaks.slice(0,keepPeaks);
    for(let sy=0;sy<hmResD;sy++){for(let sx=0;sx<hmResW;sx++){
        const idx=sy*hmResW+sx;const origH=mapData.heightmap[idx];let minDist=Infinity;
        for(const p of kept){const d=Math.hypot((sx-p.sx)*hmStepW,(sy-p.sy)*hmStepD);if(d<minDist)minDist=d;}
        const t=Math.max(0,Math.min(1,minDist/falloffDist));const s=t*t*(3-2*t);
        mapData.heightmap[idx]=origH*(1.0-s*(1-keepRatio));
    }}
    createGround();renderHeightmapCanvas();
    overlayInfo.textContent='📐 地形已平整 — '+kept.length+'个高地保留，外围连续衰减至'+(keepRatio*100).toFixed(0)+'%';
    console.log('📐 手动平整: '+peaks.length+'峰→保留'+kept.length);
}

// ============================== 按钮绑定 ==============================

// 状态面板
const genStatusPanel=createGenStatusPanel(document.querySelector('.view3d'));

// 一键全部
document.getElementById('btn-rg-all').addEventListener('click',async()=>{
    disableGenBtns(true);
    genStatusPanel.show(10);
    const rep=await generateAll(null,(st)=>{genStatusPanel.update(st);});
    genStatusPanel.showSummary(rep);
    disableGenBtns(false);
});

// 仅生成地形
document.getElementById('btn-rg-terrain').addEventListener('click',async()=>{
    disableGenBtns(true);
    genStatusPanel.show(4);
    const rep=await generateTerrainOnly(null,(st)=>{genStatusPanel.update(st);});
    genStatusPanel.showSummary(rep);
    disableGenBtns(false);
});

// 生成道路与村落
document.getElementById('btn-rg-roads').addEventListener('click',async()=>{
    // 前置检查
    let hasTerrain=false;for(let i=0;i<hmResW*hmResD;i++){if(mapData.heightmap[i]!==0){hasTerrain=true;break;}}
    if(!hasTerrain){alert('⚠️ 尚未生成地形，请先点击「🌍 仅生成地形」或「🎲 一键全部」');return;}
    disableGenBtns(true);
    genStatusPanel.show(6);
    const rep=await generateRoadsAndVillages(null,(st)=>{genStatusPanel.update(st);});
    genStatusPanel.showSummary(rep);
    disableGenBtns(false);
});

// 手动平整
document.getElementById('btn-flatten-terrain').addEventListener('click',flattenTerrain);

// 随机种子按钮
document.getElementById('btn-rg-random-seed').addEventListener('click',()=>{document.getElementById('rg-seed').value=Math.floor(Math.random()*2147483647);});

// 面板折叠
document.getElementById('btn-random-gen').addEventListener('click',()=>{['rg-terrain-body','rg-village-body'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='block';});const hdr=document.getElementById('rg-terrain-header');if(hdr)hdr.scrollIntoView({behavior:'smooth',block:'start'});});
['rg-terrain-header','rg-village-header'].forEach(hid=>{const hdr=document.getElementById(hid);if(!hdr)return;hdr.addEventListener('click',()=>{const bodyId=hid==='rg-terrain-header'?'rg-terrain-body':'rg-village-body';const body=document.getElementById(bodyId);if(body)body.style.display=body.style.display==='none'?'block':'none';});});

// 滑块值绑定
document.querySelectorAll('.rg-row input[type=range]').forEach(sl=>{const vs=document.getElementById(sl.id+'-v');if(vs){sl.addEventListener('input',()=>{vs.textContent=sl.value;});}});

function disableGenBtns(disabled){
    ['btn-rg-all','btn-rg-terrain','btn-rg-roads','btn-flatten-terrain'].forEach(id=>{const btn=document.getElementById(id);if(btn)btn.disabled=disabled;});
}
