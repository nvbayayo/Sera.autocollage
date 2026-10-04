import { useMemo, useRef, useState } from 'react';
import { Download, GripVertical, ImagePlus, RotateCcw, Trash2, Upload, WandSparkles } from 'lucide-react';
import { detectScreenshot, loadImage, makeSkins } from './image';
import { downloadBlob, exportCollage } from './export';
import type { ExportFormat, Skin } from './types';

const PRESETS = [2048, 3840, 7680, 10240, 16000];

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [skins, setSkins] = useState<Skin[]>([]);
  const [fileName, setFileName] = useState('mlbb-collage');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [width, setWidth] = useState(3840);
  const [columns, setColumns] = useState(5);
  const [gap, setGap] = useState(16);
  const [padding, setPadding] = useState(16);
  const [background, setBackground] = useState('#000000');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(0.95);

  const rows = Math.ceil(skins.length / Math.max(1, columns));
  const preview = useMemo(() => skins.length ? skins.slice(0, 12) : [], [skins]);

  async function processFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const file = files[0];
      if (!file.type.startsWith('image/')) throw new Error('Please select an image file.');
      const image = await loadImage(file);
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'mlbb-collage');
      const detection = await detectScreenshot(image, setProgress);
      setSkins(makeSkins(image, detection, file.name));
    } catch (err) {
      setSkins([]);
      setError(err instanceof Error ? err.message : 'Could not process the image.');
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    setSkins((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, order) => ({ ...item, order }));
    });
  }

  function remove(index: number) {
    setSkins((current) => current.filter((_, i) => i !== index).map((item, order) => ({ ...item, order })));
  }

  async function exportImage() {
    setBusy(true);
    setError('');
    try {
      const blob = await exportCollage(skins, { width, columns, gap, padding, background, format, quality });
      downloadBlob(blob, `${fileName}-${width}px.${format === 'jpeg' ? 'jpg' : format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSkins([]);
    setError('');
    setProgress(0);
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <div className="eyebrow">MLBB TOOL</div>
          <h1>Auto Collage Maker</h1>
          <p>Detect screenshot cards, arrange them, and export at high resolution.</p>
        </div>
        <button className="ghost" onClick={reset} disabled={busy}><RotateCcw size={17} /> Reset</button>
      </header>

      <section className="upload" onClick={() => inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept="image/*" onChange={(e) => processFiles(e.target.files)} hidden />
        <div className="uploadIcon"><Upload size={28} /></div>
        <h2>{busy ? `Processing ${Math.round(progress)}%` : 'Upload MLBB screenshot'}</h2>
        <p>Automatic detection • original image retained for export</p>
        <button className="primary" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }} disabled={busy}>
          <ImagePlus size={18} /> Choose image
        </button>
        {busy && <div className="progress"><span style={{ width: `${progress}%` }} /></div>}
      </section>

      {error && <div className="error">{error}</div>}

      <section className="workspace">
        <div className="panel settings">
          <div className="panelTitle"><WandSparkles size={18} /> Export</div>
          <label>Resolution</label>
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))}>
            {PRESETS.map((value) => <option key={value} value={value}>{value.toLocaleString()} px</option>)}
          </select>

          <label>Columns</label>
          <input type="number" min={1} max={20} value={columns} onChange={(e) => setColumns(Math.max(1, Number(e.target.value) || 1))} />

          <label>Gap: {gap}px</label>
          <input type="range" min={0} max={100} value={gap} onChange={(e) => setGap(Number(e.target.value))} />

          <label>Padding: {padding}px</label>
          <input type="range" min={0} max={100} value={padding} onChange={(e) => setPadding(Number(e.target.value))} />

          <label>Background</label>
          <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} />

          <label>Format</label>
          <div className="formatRow">
            {(['png', 'jpeg', 'webp'] as ExportFormat[]).map((item) => (
              <button key={item} className={format === item ? 'selected' : ''} onClick={() => setFormat(item)}>{item.toUpperCase()}</button>
            ))}
          </div>

          {format !== 'png' && <>
            <label>Quality: {Math.round(quality * 100)}%</label>
            <input type="range" min={50} max={100} value={quality * 100} onChange={(e) => setQuality(Number(e.target.value) / 100)} />
          </>}

          <div className="stats"><span>Items</span><b>{skins.length}</b></div>
          <div className="stats"><span>Rows</span><b>{rows}</b></div>
          <button className="download" disabled={!skins.length || busy} onClick={exportImage}><Download size={18} /> Export {format.toUpperCase()}</button>
        </div>

        <div className="panel previewPanel">
          <div className="panelTitle"><GripVertical size={18} /> Detected items <span>{skins.length}</span></div>
          {!skins.length ? (
            <div className="empty"><ImagePlus size={34} /><strong>No items yet</strong><span>Upload a screenshot to start.</span></div>
          ) : (
            <div className="grid">
              {preview.map((skin, index) => (
                <article className="card" key={skin.id}>
                  <img src={skin.image.src} style={{ objectPosition: `${skin.sx}px ${skin.sy}px` }} alt={`Detected item ${index + 1}`} />
                  <div className="cardFooter">
                    <span>#{index + 1}</span>
                    <div>
                      <button onClick={() => move(index, -1)} disabled={index === 0}>←</button>
                      <button onClick={() => move(index, 1)} disabled={index === skins.length - 1}>→</button>
                      <button onClick={() => remove(index)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {skins.length > preview.length && <div className="more">Showing first {preview.length} of {skins.length} items. All items are included in export.</div>}
        </div>
      </section>

      <footer>Runs locally in your browser • PNG / JPEG / WebP • Up to 16K where your browser supports the canvas size</footer>
    </main>
  );
}

export default App;
              
