import { Skin } from "./types";

export type ExportOptions = {
  width:number;
  columns:number;
  gap:number;
  padding:number;
  background:string;
  format:"png"|"jpeg";
  quality:number;
};

export async function exportCollage(skins:Skin[], o:ExportOptions):Promise<Blob>{
  if(!skins.length) throw new Error("No skins to export.");
  const ratio = skins.reduce((a,s)=>a+s.sw/s.sh,0)/skins.length || 1;
  const cols=Math.max(1,o.columns);
  const rows=Math.ceil(skins.length/cols);
  const cellW=Math.max(1,Math.floor((o.width-o.padding*2-o.gap*(cols-1))/cols));
  const avgH=Math.max(1,Math.round(cellW/ratio));
  const height=o.padding*2+rows*avgH+Math.max(0,rows-1)*o.gap;
  const canvas=document.createElement("canvas");
  canvas.width=o.width; canvas.height=height;
  const ctx=canvas.getContext("2d")!;
  ctx.fillStyle=o.background; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  for(let i=0;i<skins.length;i++){
    const s=skins[i], col=i%cols, row=Math.floor(i/cols);
    const x=o.padding+col*(cellW+o.gap);
    const y=o.padding+row*(avgH+o.gap);
    const scale=Math.min(cellW/s.sw,avgH/s.sh);
    const dw=Math.max(1,Math.round(s.sw*scale)), dh=Math.max(1,Math.round(s.sh*scale));
    const dx=x+Math.floor((cellW-dw)/2), dy=y+Math.floor((avgH-dh)/2);
    ctx.drawImage(s.image,s.sx,s.sy,s.sw,s.sh,dx,dy,dw,dh);
  }
  return await new Promise<Blob>((resolve,reject)=>{
    canvas.toBlob(b=>b?resolve(b):reject(new Error("Export failed")),o.format==="png"?"image/png":"image/jpeg",o.quality);
  });
}

export function downloadBlob(blob:Blob,name:string){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
