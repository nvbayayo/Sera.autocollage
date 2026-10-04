import { DetectionResult, Skin } from "./types";

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function sample(img: HTMLImageElement, w = 900): { data: Uint8ClampedArray, width: number, height: number } {
  const scale = Math.min(1, w / img.naturalWidth);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

function edgeScore(data: Uint8ClampedArray, w: number, h: number, vertical: boolean, pos: number): number {
  const band = 2;
  let sum = 0, count = 0;
  if (vertical) {
    for (let y = 0; y < h; y += 4) {
      for (let d = -band; d <= band; d++) {
        const x1 = Math.max(0, Math.min(w - 1, pos + d));
        const x2 = Math.max(0, Math.min(w - 1, pos + d + 1));
        const a = (y*w+x1)*4, b=(y*w+x2)*4;
        sum += Math.abs(data[a]-data[b])+Math.abs(data[a+1]-data[b+1])+Math.abs(data[a+2]-data[b+2]);
        count++;
      }
    }
  } else {
    for (let x = 0; x < w; x += 4) {
      for (let d = -band; d <= band; d++) {
        const y1 = Math.max(0, Math.min(h - 1, pos + d));
        const y2 = Math.max(0, Math.min(h - 1, pos + d + 1));
        const a = (y1*w+x)*4, b=(y2*w+x)*4;
        sum += Math.abs(data[a]-data[b])+Math.abs(data[a+1]-data[b+1])+Math.abs(data[a+2]-data[b+2]);
        count++;
      }
    }
  }
  return sum / Math.max(1, count);
}

function findCuts(scores: number[], minGap: number): number[] {
  const max = Math.max(...scores, 1);
  const threshold = max * 0.42;
  const candidates: number[] = [];
  for (let i=1;i<scores.length-1;i++) {
    if (scores[i] >= threshold && scores[i] >= scores[i-1] && scores[i] >= scores[i+1]) candidates.push(i);
  }
  const cuts:number[]=[];
  for (const c of candidates) {
    if (!cuts.length || c-cuts[cuts.length-1] >= minGap) cuts.push(c);
    else if (scores[c] > scores[cuts[cuts.length-1]]) cuts[cuts.length-1]=c;
  }
  return cuts;
}

function gridGuess(img: HTMLImageElement): { cols:number, rows:number } {
  const ratio = img.naturalWidth / Math.max(1,img.naturalHeight);
  const candidates = [2,3,4,5,6,7,8];
  let best = candidates[0], score=Infinity;
  for (const c of candidates) {
    const r = Math.max(1, Math.round(c/ratio));
    const ar = (img.naturalWidth/c)/(img.naturalHeight/r);
    const s = Math.abs(Math.log(ar)) + Math.abs(c-r)*0.03;
    if (s<score){score=s;best=c;}
  }
  return {cols:best, rows:Math.max(1,Math.round(best/ratio))};
}

export async function detectScreenshot(img: HTMLImageElement, sourceName: string, sourceId: string): Promise<DetectionResult> {
  const s=sample(img);
  const vx:number[]=[]; const hy:number[]=[];
  for(let x=1;x<s.width-1;x+=2) vx.push(edgeScore(s.data,s.width,s.height,true,x));
  for(let y=1;y<s.height-1;y+=2) hy.push(edgeScore(s.data,s.width,s.height,false,y));
  const minX=Math.max(8,Math.floor(s.width/80));
  const minY=Math.max(8,Math.floor(s.height/80));
  const xc=findCuts(vx,minX).map(v=>v*2);
  const yc=findCuts(hy,minY).map(v=>v*2);

  let cols=xc.length+1, rows=yc.length+1;
  const sane = cols>=2 && cols<=20 && rows>=1 && rows<=30 && cols*rows<=500;
  if(!sane) ({cols,rows}=gridGuess(img));

  const xs = sane ? [0,...xc,s.width] : Array.from({length:cols+1},(_,i)=>Math.round(i*s.width/cols));
  const ys = sane ? [0,...yc,s.height] : Array.from({length:rows+1},(_,i)=>Math.round(i*s.height/rows));

  // Avoid tiny edge cells.
  const items:Omit<Skin,"id"|"order">[]=[];
  let n=0;
  for(let r=0;r<ys.length-1;r++){
    for(let c=0;c<xs.length-1;c++){
      const x0=xs[c], x1=xs[c+1], y0=ys[r], y1=ys[r+1];
      if(x1-x0<12 || y1-y0<12) continue;
      items.push({
        sourceId, sourceName, image:img,
        sx:Math.round(x0/s.width*img.naturalWidth),
        sy:Math.round(y0/s.height*img.naturalHeight),
        sw:Math.round((x1-x0)/s.width*img.naturalWidth),
        sh:Math.round((y1-y0)/s.height*img.naturalHeight)
      });
      n++;
    }
  }
  return {items, columns:cols, rows, confidence:sane ? .86 : .62};
}

export function makeSkins(result:DetectionResult, offset:number):Skin[]{
  return result.items.map((x,i)=>({...x,id:`skin-${Date.now()}-${offset+i}`,order:offset+i}));
}

export function cropToDataURL(s:Skin, maxW=1200):string{
  const scale=Math.min(1,maxW/s.sw);
  const c=document.createElement("canvas");
  c.width=Math.max(1,Math.round(s.sw*scale)); c.height=Math.max(1,Math.round(s.sh*scale));
  c.getContext("2d")!.drawImage(s.image,s.sx,s.sy,s.sw,s.sh,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",.88);
}
