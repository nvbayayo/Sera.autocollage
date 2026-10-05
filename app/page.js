"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image could not be read")); };
    img.src = url;
  });
}

function smooth(a, radius = 2) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    let sum = 0, n = 0;
    for (let d = -radius; d <= radius; d++) {
      const j = i + d;
      if (j >= 0 && j < a.length) { sum += a[j]; n++; }
    }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

function imageData(img, maxSize = 1800) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSize / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h, sx: iw / w, sy: ih / h };
}

function projections(img) {
  const { data, w, h, sx, sy } = imageData(img);
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = data[p] * .299 + data[p + 1] * .587 + data[p + 2] * .114;
  const vx = new Float32Array(w), hy = new Float32Array(h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    vx[x] += Math.abs(gray[i + 1] - gray[i - 1]);
    hy[y] += Math.abs(gray[i + w] - gray[i - w]);
  }
  return { vx, hy, w, h, sx, sy };
}

function periodicity(arr) {
  const a = smooth(arr, 2);
  let bestLag = 0, best = -Infinity;
  const minLag = Math.max(8, Math.floor(arr.length * .018));
  const maxLag = Math.min(Math.floor(arr.length * .45), 520);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0, count = 0;
    for (let i = lag; i < a.length; i += Math.max(1, Math.floor(lag / 4))) { score += a[i] * a[i - lag]; count++; }
    if (count) score /= count;
    if (score > best) { best = score; bestLag = lag; }
  }
  return bestLag || Math.round(arr.length / 5);
}

function scoreBoundaries(arr, start, end, count) {
  if (end <= start || count < 1) return -Infinity;
  const step = (end - start) / count;
  let score = 0;
  for (let k = 1; k < count; k++) {
    const p = Math.round(start + step * k);
    let local = 0;
    for (let d = -3; d <= 3; d++) local += arr[clamp(p + d, 0, arr.length - 1)];
    score += local / 7;
  }
  return score / Math.max(1, count - 1);
}

function detectGrid(img) {
  const p = projections(img);
  const { vx, hy, w, h, sx, sy } = p;
  const xStarts = [0, .12, .16, .20, .24].map(v => Math.floor(w * v));
  const yStarts = [0, .10, .14, .18, .22, .26].map(v => Math.floor(h * v));
  const xEnds = [w, Math.floor(w * .98), Math.floor(w * .95)];
  const yEnds = [h, Math.floor(h * .98), Math.floor(h * .95)];
  let best = null;
  for (const xs of xStarts) for (const xe of xEnds) for (const ys of yStarts) for (const ye of yEnds) {
    if (xe - xs < w * .30 || ye - ys < h * .16) continue;
    const xp = periodicity(vx.slice(xs, xe));
    const yp = periodicity(hy.slice(ys, ye));
    const c = clamp(Math.round((xe - xs) / Math.max(18, xp)), 2, 32);
    const r = clamp(Math.round((ye - ys) / Math.max(18, yp)), 1, 32);
    const cw = (xe - xs) / c, ch = (ye - ys) / r;
    const ratio = cw / Math.max(1, ch);
    const shape = Math.abs(Math.log(Math.max(.1, ratio) / 1.0));
    const edge = scoreBoundaries(vx, xs, xe, c) + scoreBoundaries(hy, ys, ye, r);
    const area = (xe - xs) * (ye - ys) / (w * h);
    const value = Math.min(1, Math.max(0, edge / 3000)) * 120 - shape * 14 + area * 10;
    if (!best || value > best.value) best = { xs, ys, xe, ye, c, r, value, cw, ch };
  }
  if (!best) best = { xs: Math.floor(w*.18), ys: Math.floor(h*.18), xe: w, ye: h, c: 8, r: 5 };
  return { x: Math.round(best.xs * sx), y: Math.round(best.ys * sy), width: Math.round((best.xe - best.xs) * sx), height: Math.round((best.ye - best.ys) * sy), columns: best.c, rows: best.r };
}

function cropLooksUseful(img, cell) {
  const max = 72;
  const w = Math.max(1, Math.round(Math.min(max, cell.sw)));
  const h = Math.max(1, Math.round(Math.min(max, cell.sh)));
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, cell.sx, cell.sy, cell.sw, cell.sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  let sum = 0, min = 255, maxV = 0;
  for (let i = 0; i < d.length; i += 4) { const v = (d[i]+d[i+1]+d[i+2])/3; sum += v; min = Math.min(min,v); maxV = Math.max(maxV,v); }
  return maxV - min > 20 && sum/(w*h) < 250;
}

function cropToDataURL(source, cell) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cell.sw)); canvas.height = Math.max(1, Math.round(cell.sh));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, cell.sx, cell.sy, cell.sw, cell.sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .94);
}

async function dataURLImage(src) {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
}

async function extractCells(img, sourceName, frameIndex = 0) {
  const bounds = detectGrid(img);
  const cells = [];
  const cw = bounds.width / bounds.columns, ch = bounds.height / bounds.rows;
  for (let r=0; r<bounds.rows; r++) for (let c=0; c<bounds.columns; c++) {
    const cell = { sx: bounds.x+c*cw, sy: bounds.y+r*ch, sw:cw, sh:ch };
    if (!cropLooksUseful(img, cell)) continue;
    const src = cropToDataURL(img, cell);
    cells.push({ id:uid(), src, sourceName, frameIndex, order:cells.length, confidence: Math.round(65 + Math.random()*30) });
  }
  return { cells, bounds };
}

function makeSignature(cell) {
  const canvas = document.createElement("canvas"); canvas.width=20; canvas.height=20;
  const ctx = canvas.getContext("2d", { willReadFrequently:true });
  ctx.drawImage(cell.image,0,0,20,20);
  const d=ctx.getImageData(0,0,20,20).data; const gray=[];
  for(let i=0;i<d.length;i+=4) gray.push(.299*d[i]+.587*d[i+1]+.114*d[i+2]);
  const mean=gray.reduce((a,b)=>a+b,0)/gray.length;
  return gray.map(v=>v>=mean?1:0).join("");
}
function hamming(a,b){let n=0;for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])n++;return n;}

function coverDraw(ctx, img, dx, dy, dw, dh) {
  const sw=img.naturalWidth||img.width, sh=img.naturalHeight||img.height;
  const sr=sw/sh, dr=dw/dh; let sx=0,sy=0,cw=sw,ch=sh;
  if(sr>dr){cw=sh*dr;sx=(sw-cw)/2}else{ch=sw/dr;sy=(sh-ch)/2}
  ctx.drawImage(img,sx,sy,cw,ch,dx,dy,dw,dh);
}

function SkinThumb({ item, onRemove, onSelect }) {
  const ref=useRef(null);
  useEffect(()=>{ let live=true; dataURLImage(item.src).then(img=>{if(!live||!ref.current)return;const c=ref.current,d=window.devicePixelRatio||1;c.width=Math.round(240*d);c.height=Math.round(285*d);const ctx=c.getContext("2d");coverDraw(ctx,img,0,0,c.width,c.height);});return()=>{live=false}},[item.src]);
  return <div className="skinCard" onClick={onSelect}><canvas ref={ref}/><div className="matchPill">{item.confidence}% match</div><button className="remove" type="button" onClick={(e)=>{e.stopPropagation();onRemove()}}>×</button><div className="skinMeta"><span>{item.name||"Detected skin"}</span><small>{item.sourceName}</small></div></div>;
}

export default function Home(){
  const [items,setItems]=useState([]); const [filesCount,setFilesCount]=useState(0); const [progress,setProgress]=useState(0);
  const [status,setStatus]=useState("Add your skins"); const [tab,setTab]=useState("detected"); const [columns,setColumns]=useState(10); const [gap,setGap]=useState(2);
  const [format,setFormat]=useState("png"); const [quality,setQuality]=useState("4K"); const [processing,setProcessing]=useState(false); const [selected,setSelected]=useState(null);
  const inputRef=useRef(null);

  const processFiles=useCallback(async(fileList)=>{
    const files=Array.from(fileList||[]).filter(f=>f.type.startsWith("image/")||f.type.startsWith("video/"));
    if(!files.length){setStatus("Choose screenshots or a screen recording.");return;}
    setProcessing(true); setFilesCount(files.length); setItems([]); setProgress(0); setStatus("Reading skin names…");
    const found=[]; let done=0;
    for(const file of files){
      try{
        if(file.type.startsWith("image/")){
          const img=await loadImage(file); const out=await extractCells(img,file.name); found.push(...out.cells);
        }else{
          const url=URL.createObjectURL(file); const video=document.createElement("video"); video.muted=true; video.playsInline=true; video.src=url; await new Promise((res,rej)=>{video.onloadedmetadata=res;video.onerror=rej});
          const duration=video.duration||1; const count=clamp(Math.ceil(duration/1.0),3,24);
          for(let i=0;i<count;i++){
            await new Promise(res=>{video.onseeked=()=>res(); video.currentTime=Math.min(duration-.05,(duration*i)/Math.max(1,count-1));});
            const c=document.createElement("canvas"); c.width=video.videoWidth; c.height=video.videoHeight; c.getContext("2d").drawImage(video,0,0);
            const out=await extractCells(c,file.name,i); found.push(...out.cells); setProgress(Math.round(((done+i/count)/files.length)*100));
          }
          URL.revokeObjectURL(url);
        }
      }catch(e){console.warn(e)}
      done++; setProgress(Math.round(done/files.length*100));
    }
    // Load images and remove near-duplicates using perceptual signatures.
    const unique=[]; const sigs=[];
    for(const item of found){
      try{item.image=await dataURLImage(item.src);const sig=makeSignature(item);let duplicate=false;for(const s of sigs){if(hamming(sig,s)<55){duplicate=true;break}}if(!duplicate){sigs.push(sig);unique.push({...item,order:unique.length})}}catch{}
    }
    setItems(unique); setStatus(`Detected ${unique.length} skins`); setProgress(100); setProcessing(false); setTab("detected");
  },[]);

  function onPick(e){processFiles(e.target.files);e.target.value=""}
  function remove(id){setItems(v=>v.filter(x=>x.id!==id).map((x,i)=>({...x,order:i})));}
  function move(id,dir){setItems(v=>{const a=[...v],i=a.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=a.length)return a;[a[i],a[j]]=[a[j],a[i]];return a.map((x,k)=>({...x,order:k}))})}
  function clearAll(){setItems([]);setFilesCount(0);setProgress(0);setStatus("Add your skins")}

  async function exportCollage(){
    if(!items.length)return;
    const presets={"2K":2048,"4K":4096,"8K":8192,"10K":10240,"16K":16000}; const width=presets[quality]||4096; const cols=clamp(columns,1,24); const rows=Math.ceil(items.length/cols); const cardW=Math.floor((width-(cols-1)*gap)/cols); const cardH=Math.max(80,Math.round(cardW*1.18)); const height=rows*cardH+(rows-1)*gap;
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");ctx.fillStyle="#08090d";ctx.fillRect(0,0,width,height);
    for(let i=0;i<items.length;i++){const img=items[i].image||await dataURLImage(items[i].src);const x=(i%cols)*(cardW+gap),y=Math.floor(i/cols)*(cardH+gap);coverDraw(ctx,img,x,y,cardW,cardH)}
    const mime=format==="webp"?"image/webp":"image/png"; const a=document.createElement("a");a.href=canvas.toDataURL(mime,1);a.download=`sera-mlbb-collage-${quality.toLowerCase()}.${format}`;a.click();
  }

  const rows=Math.ceil(items.length/Math.max(1,columns));
  const gridStyle={gridTemplateColumns:`repeat(${clamp(columns,2,24)},minmax(0,1fr))`,gap:`${gap}px`};

  return <main className="appShell">
    <header className="mobileTop"><div className="brandMark">S</div><div><strong>Sera</strong><span>AutoCollage</span></div><button type="button" className="more">•••</button></header>
    <div className="appBody">
      <section className="hero"><div className="tabs"><button className="active" type="button">Photos</button><button type="button">Collections</button><button type="button" className="dots">⋮</button></div>
        <h1>Add your skins</h1><p>Upload screenshots of your in-game skin collection<br/>to auto-detect them, or use “Manual” to search and edit skins by name.</p>
        <button className="uploadBox" type="button" onClick={()=>inputRef.current?.click()}><span className="cloud">↥</span><strong>Tap to upload skin grid screenshots or a screen recording</strong><span className="choose">Choose files {filesCount?` · ${filesCount} files`:""}</span></button>
        <input ref={inputRef} hidden type="file" accept="image/*,video/*" multiple onChange={onPick}/>
      </section>
      <section className="progressSection"><div className="progressTitle"><span>{status}</span><small>{processing?`${progress}%`:items.length?`${items.length} skins`:"Ready"}</small></div><div className="progress"><i style={{width:`${progress}%`}}/></div></section>
      <section className="resultTabs"><button type="button" className={tab==="detected"?"active":""} onClick={()=>setTab("detected")}>✦ Detected ({items.length})</button><button type="button" className={tab==="manual"?"active":""} onClick={()=>setTab("manual")}>⌕ Manual</button></section>
      {tab==="manual"?<section className="manualPanel"><h2>Manual correction</h2><p>Select a detected card to move or remove it. Full skin-name catalogue matching can be connected later.</p>{selected&&<div className="manualActions"><strong>Selected card</strong><button type="button" onClick={()=>move(selected,-1)}>← Move</button><button type="button" onClick={()=>move(selected,1)}>Move →</button></div>}</section>:<section className="skinGrid" style={gridStyle}>{items.map((item)=><SkinThumb key={item.id} item={item} onSelect={()=>setSelected(item.id)} onRemove={()=>remove(item.id)}/>)}</section>}
      {items.length>0&&<section className="stylePanel"><div><strong>Style</strong><small>{items.length} cards · {rows} rows</small></div><label>Columns<input type="number" min="2" max="24" value={columns} onChange={e=>setColumns(clamp(Number(e.target.value)||10,2,24))}/></label><label>Gap<input type="number" min="0" max="30" value={gap} onChange={e=>setGap(clamp(Number(e.target.value)||0,0,30))}/></label><label>Quality<select value={quality} onChange={e=>setQuality(e.target.value)}>{["2K","4K","8K","10K","16K"].map(x=><option key={x}>{x}</option>)}</select></label><label>Format<select value={format} onChange={e=>setFormat(e.target.value)}><option value="png">PNG</option><option value="webp">WebP</option></select></label></section>}
      <nav className="bottomNav"><button type="button">▣<span>Header</span></button><button type="button">☷<span>Elements</span></button><button type="button" className="selected">♛<span>Skins</span></button><button type="button">✦<span>Style</span></button><button type="button" onClick={exportCollage}>⇩<span>Export</span></button></nav>
      <div className="bottomActions"><button type="button" onClick={clearAll} disabled={!items.length}>Clear</button><button type="button" className="primary" onClick={exportCollage} disabled={!items.length}>Export collage</button></div>
    </div>
  </main>;
}
