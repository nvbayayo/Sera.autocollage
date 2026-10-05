 "use client";

import { useRef, useState } from "react";

export default function Home() {
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [columns, setColumns] = useState(5);
  const [gap, setGap] = useState(10);
  const [background, setBackground] = useState("#111318");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Upload screenshots to begin.");
  const [dragIndex, setDragIndex] = useState(null);

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith("image/")).slice(0, 30);
    if (!files.length) return;

    const next = files.map((file, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name
    }));

    setItems(prev => [...prev, ...next].slice(0, 30));
    setStatus(`${Math.min(items.length + next.length, 30)} screenshots ready.`);
  }

  function remove(id) {
    setItems(prev => prev.filter(x => x.id !== id));
  }

  function move(from, to) {
    if (from === to || from == null || to == null) return;
    setItems(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }

  async function makeCanvas() {
    const cell = 1080;
    const g = Number(gap);
    const cols = Number(columns);
    const rows = Math.ceil(items.length / cols);
    const width = cols * cell + (cols + 1) * g;
    const height = rows * cell + (rows + 1) * g;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < items.length; i++) {
      const img = await loadImage(items[i].url);
      const x = g + (i % cols) * (cell + g);
      const y = g + Math.floor(i / cols) * (cell + g);
      drawCover(ctx, img, x, y, cell, cell);
    }

    return canvas;
  }

  async function download(type) {
    if (!items.length) return setStatus("Upload screenshots first.");
    setBusy(true);
    setStatus("Rendering high-resolution collage…");

    try {
      const canvas = await makeCanvas();
      const mime = type === "jpg" ? "image/jpeg" : "image/png";
      const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, 0.95));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mlbb-skin-collage.${type}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Done — ${canvas.width}px wide.`);
    } catch (e) {
      console.error(e);
      setStatus("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!items.length) return setStatus("Upload screenshots first.");
    setBusy(true);
    setStatus("Preparing share image…");

    try {
      const canvas = await makeCanvas();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      const file = new File([blob], "mlbb-skin-collage.png", { type: "image/png" });

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: "My MLBB Skin Collage",
          text: "My Mobile Legends skin collection",
          files: [file]
        });
        setStatus("Share sheet opened.");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mlbb-skin-collage.png";
        a.click();
        URL.revokeObjectURL(url);
        setStatus("Your browser does not support file sharing, so the image was downloaded.");
      }
    } catch (e) {
      if (e.name !== "AbortError") setStatus("Sharing failed. Try downloading instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <div className="logo">MLBB <span>Skin Collage</span></div>
        <div className="free">FREE</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">MOBILE LEGENDS: BANG BANG</p>
          <h1>Your skins.<br /><span>One beautiful collage.</span></h1>
          <p className="lead">Upload your screenshots, arrange them, customize the grid and export a sharp 1080px+ collage.</p>
        </div>

        <div
          className="dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        >
          <div className="upload-icon">＋</div>
          <strong>Upload screenshots</strong>
          <span>Tap here or drag & drop · up to 30 images</span>
          <input ref={inputRef} hidden type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e => addFiles(e.target.files)} />
        </div>
      </section>

      <section className="workspace">
        <aside className="controls">
          <h2>Customize</h2>

          <label>
            Columns <b>{columns}</b>
            <input type="range" min="1" max="8" value={columns} onChange={e => setColumns(e.target.value)} />
          </label>

          <label>
            Spacing <b>{gap}px</b>
            <input type="range" min="0" max="60" value={gap} onChange={e => setGap(e.target.value)} />
          </label>

          <label>
            Background
            <input className="color" type="color" value={background} onChange={e => setBackground(e.target.value)} />
          </label>

          <button className="primary" disabled={busy || !items.length} onClick={() => download("png")}>Download PNG</button>
          <button disabled={busy || !items.length} onClick={() => download("jpg")}>Download JPG</button>
          <button disabled={busy || !items.length} onClick={share}>Share</button>

          <p className="status">{status}</p>
          <p className="privacy">Images are processed in your browser in this starter. They are not uploaded to a server.</p>
        </aside>

        <section className="preview">
          <div className="preview-head">
            <h2>Preview</h2>
            <span>{items.length} skin{items.length === 1 ? "" : "s"}</span>
          </div>

          {!items.length ? (
            <div className="empty">Upload screenshots to see your collage.</div>
          ) : (
            <div className="grid" style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: `${gap}px`,
              padding: `${gap}px`,
              background
            }}>
              {items.map((item, index) => (
                <div
                  className={`tile ${dragIndex === index ? "dragging" : ""}`}
                  key={item.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragEnd={() => setDragIndex(null)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); move(dragIndex, index); setDragIndex(null); }}
                >
                  <img src={item.url} alt="" />
                  <button className="remove" title="Remove" onClick={() => remove(item.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <footer>Free MLBB Skin Collage Maker · Built for desktop and mobile</footer>
    </main>
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
          }
