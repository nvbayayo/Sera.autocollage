import { useMemo, useRef, useState } from "react";
import { Download, Upload, ArrowLeftRight, Trash2, GripVertical, RotateCcw, Image as ImageIcon, Sparkles } from "lucide-react";
import { detectScreenshot, loadImage, makeSkins } from "./image";
import { downloadBlob, exportCollage } from "./export";
import { Skin } from "./types";

const PRESETS=[2048,3840,7680,10240,16000];

export default function App(){
  const input=useRef<HTMLInputElement>(null);
  const [skins,setSkins]=useState<Skin[]>([]);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);
  const [message,setMessage]=useState("Upload one or more MLBB screenshots. Target detection: ~1–2 minutes for 400–500 skins, depending on device.");
  const [columns,setColumns]=useState(5);
  const [gap,setGap]=useState(12);
  const [padding,setPadding]=useState(24);
  const [width,setWidth]=useState(3840);
  const [format,setFormat]=useState<"png"|"jpeg">("png");
  const [quality,setQuality]=useState(.95);
  const [selected,setSelected]=useState<string|null>(null);
  const [swapId,setSwapId]=useState<string|null>(null);
  const [dragId,setDragId]=useState<string|null>(null);

  const rows=Math.ceil(skins.length/Math.max(1,columns));

  async function upload(files:FileList|null){
    if(!files?.length)return;
    setBusy(true);setProgress(0);setMessage("Analyzing screenshots locally…");
    try{
      let all:Skin[]=[]; let i=0;
      for(const file of Array.from(files)){
        if(!file.type.startsWith("image/"))continue;
        const img=await loadImage(file);
        const result=await detectScreenshot(img,file.name,`${file.name}-${i}`);
        all=[...all,...makeSkins(result,all.length)];
        i++;
        setProgress(Math.round(i/Math.max(1,files.length)*100));
      }
      setSkins(all.map((s,i)=>({...s,order:i})));
      setColumns(Math.max(1,Math.min(12,all.length ? Math.min(6, Math.ceil(Math.sqrt(all.length))) : 5)));
      setMessage(`Detected ${all.length} image regions. You can rearrange or swap them manually.`);
    }catch(e){
      setMessage("Detection failed for one of the images. Try a different screenshot.");
    }finally{setBusy(false);}
  }

  function reorder(from:string,to:string){
    setSkins(prev=>{
      const a=[...prev], fi=a.findIndex(x=>x.id===from), ti=a.findIndex(x=>x.id===to);
      if(fi<0||ti<0)return prev;
      const [item]=a.splice(fi,1);a.splice(ti,0,item);
      return a.map((s,i)=>({...s,order:i}));
    });
  }
  function swap(a:string,b:string){
    setSkins(prev=>{
      const x=[...prev],i=x.findIndex(s=>s.id===a),j=x.findIndex(s=>s.id===b);
      if(i<0||j<0)return prev; [x[i],x[j]]=[x[j],x[i]];
      return x.map((s,k)=>({...s,order:k}));
    });
    setSwapId(null);
  }
  function remove(id:string){setSkins(p=>p.filter(s=>s.id!==id).map((s,i)=>({...s,order:i})));}

  async function exportNow(){
    if(!skins.length)return;
    setBusy(true);setMessage("Rendering full-resolution export…");
    try{
      const blob=await exportCollage(skins,{width,columns,gap,padding,background:"#000000",format,quality});
      downloadBlob(blob,`mlbb-collage-${width}px.${format}`);
      setMessage(`Export complete: ${width.toLocaleString()} px wide, ${format.toUpperCase()}.`);
    }catch(e:any){setMessage(e?.message||"Export failed. Try a smaller resolution.");}
    finally{setBusy(false);}
  }

  const preview=useMemo(()=>skins.slice(0,80),[skins]);

  return <div className="app">
    <header>
      <div className="brand"><div className="logo">ML</div><div><h1>Sera.autocollage</h1><span>RAW • LOSSLESS • LOCAL</span></div></div>
      <button className="primary" onClick={()=>input.current?.click()}><Upload size={18}/> Upload screenshots</button>
      <input ref={input} hidden type="file" accept="image/*" multiple onChange={e=>upload(e.target.files)}/>
    </header>

    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">AUTOMATIC COLLECTION BUILDER</p>
          <h2>Turn your MLBB screenshots into a clean collage.</h2>
          <p className="sub">Automatic detection in about 1–2 minutes for 400–500 skins, depending on your device. Manual control whenever you need it. No filters, no server upload, no artificial sharpening.</p>
        </div>
        <div className="stats">
          <div><b>{skins.length}</b><span>Detected</span></div>
          <div><b>{rows}</b><span>Rows</span></div>
          <div><b>{columns}</b><span>Columns</span></div>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel">
          <h3>Controls</h3>
          <label>Export width</label>
          <div className="presets">{PRESETS.map(p=><button className={width===p?"active":""} key={p} onClick={()=>setWidth(p)}>{p>=1000?(p/1000)+"K":p}</button>)}</div>
          <label>Columns <b>{columns}</b></label>
          <input type="range" min="1" max="12" value={columns} onChange={e=>setColumns(+e.target.value)}/>
          <label>Gap <b>{gap}px</b></label>
          <input type="range" min="0" max="60" value={gap} onChange={e=>setGap(+e.target.value)}/>
          <label>Padding <b>{padding}px</b></label>
          <input type="range" min="0" max="100" value={padding} onChange={e=>setPadding(+e.target.value)}/>
          <label>Format</label>
          <div className="format"><button className={format==="png"?"active":""} onClick={()=>setFormat("png")}>PNG lossless</button><button className={format==="jpeg"?"active":""} onClick={()=>setFormat("jpeg")}>JPEG</button></div>
          {format==="jpeg"&&<><label>JPEG quality <b>{Math.round(quality*100)}%</b></label><input type="range" min=".7" max="1" step=".01" value={quality} onChange={e=>setQuality(+e.target.value)}/></>}
          <button className="export" disabled={!skins.length||busy} onClick={exportNow}><Download size={18}/>{busy?"Processing…":"Export collage"}</button>
          <button className="ghost" onClick={()=>{setSkins([]);setSelected(null);setSwapId(null);setMessage("Ready for a new upload.")}}><RotateCcw size={16}/> Clear project</button>
        </aside>

        <section className="canvasArea">
          <div className="toolbar">
            <span>{message}</span>
            {busy&&<span className="progress">{progress}%</span>}
          </div>
          {!skins.length ? <div className="drop" onClick={()=>input.current?.click()}>
              <ImageIcon size={48}/>
              <h3>Upload screenshots to Sera.autocollage</h3>
              <p>Multiple screenshots supported • automatic detection • manual editing</p>
              <button className="primary">Choose images</button>
          </div> :
          <div className="grid" style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gap}}>
            {preview.map((s,i)=><div key={s.id}
              className={"card "+(selected===s.id?"selected ":"")+(swapId===s.id?"swapTarget":"")}
              draggable
              onDragStart={()=>setDragId(s.id)}
              onDragOver={e=>e.preventDefault()}
              onDrop={()=>dragId&&dragId!==s.id&&reorder(dragId,s.id)}
              onClick={()=>{if(swapId&&swapId!==s.id)swap(swapId,s.id);else setSelected(s.id)}}
            >
              <img src={s.image.src} style={{objectPosition:`${s.sx/s.image.naturalWidth*100}% ${s.sy/s.image.naturalHeight*100}%`}} />
              <div className="cardOverlay"><GripVertical size={15}/><span>#{i+1}</span><div className="cardActions">
                <button title="Swap" onClick={e=>{e.stopPropagation();setSwapId(swapId===s.id?null:s.id)}}><ArrowLeftRight size={14}/></button>
                <button title="Delete" onClick={e=>{e.stopPropagation();remove(s.id)}}><Trash2 size={14}/></button>
              </div></div>
            </div>)}
          </div>}
        </section>
      </section>
      <footer>
        <Sparkles size={15}/> Raw export means no filters or sharpening. PNG is lossless, but apps such as social media/messaging services may recompress images after upload.
      </footer>
    </main>
  </div>
        }
