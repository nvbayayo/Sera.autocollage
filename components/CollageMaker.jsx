 "use client";

import React, { useCallback, useMemo, useRef, useState } from "react";

const PRESETS = [
  { name: "2K", w: 2560, h: 1440 },
  { name: "4K", w: 3840, h: 2160 },
  { name: "8K", w: 7680, h: 4320 },
  { name: "10K", w: 10240, h: 5760 },
  { name: "16K", w: 15360, h: 8640 },
];

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => resolve({
      url,
      w: img.naturalWidth,
      h: img.naturalHeight,
    });

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };

    img.src = url;
  });
}

async function detectCards(file) {
  const src = await readImage(file);
  const img = new Image();
  img.src = src.url;
  await img.decode();

  const max = 1800;
  const scale = Math.min(1, max / img.naturalWidth, max / img.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const col = new Float32Array(canvas.width);
  const row = new Float32Array(canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;

      if (lum > 28) {
        col[x]++;
        row[y]++;
      }
    }
  }

  const colHit = col.map((v) => v / canvas.height > 0.035);
  const rowHit = row.map((v) => v / canvas.width > 0.035);

  function segments(values) {
    const out = [];
    let start = -1;

    for (let i = 0; i < values.length; i++) {
      if (values[i] && start < 0) start = i;

      if ((!values[i] || i === values.length - 1) && start >= 0) {
        const end = values[i] ? i : i - 1;

        if (end - start > 4) {
          out.push(start, end);
        }

        start = -1;
      }
    }

    return out;
  }

  const xs = segments(colHit);
  const ys = segments(rowHit);
  const xBounds = [];
  const yBounds = [];

  for (let i = 0; i < xs.length; i += 2) xBounds.push(xs[i], xs[i + 1]);
  for (let i = 0; i < ys.length; i += 2) yBounds.push(ys[i], ys[i + 1]);

  const candidates = [];

  for (let yi = 0; yi < yBounds.length; yi += 2) {
    for (let xi = 0; xi < xBounds.length; xi += 2) {
      const x = xBounds[xi];
      const y = yBounds[yi];
      const w = xBounds[xi + 1] - x + 1;
      const h = yBounds[yi + 1] - y + 1;
      const ratio = w / h;

      if (
        w > canvas.width * 0.08 &&
        h > canvas.height * 0.08 &&
        ratio > 0.25 &&
        ratio < 4
      ) {
        candidates.push({ x, y, w, h });
      }
    }
  }

  if (candidates.length < 2 || candidates.length > 200) {
    return [{
      id: crypto.randomUUID(),
      url: src.url,
      name: file.name,
      w: src.w,
      h: src.h,
    }];
  }

  return candidates.map((box, index) => {
    const card = document.createElement("canvas");

    card.width = Math.round(box.w / scale);
    card.height = Math.round(box.h / scale);

    const cardCtx = card.getContext("2d");

    cardCtx.drawImage(
      img,
      box.x / scale,
      box.y / scale,
      box.w / scale,
      box.h / scale,
      0,
      0,
      card.width,
      card.height
    );

    return {
      id: crypto.randomUUID(),
      url: card.toDataURL("image/png"),
      name: `${file.name} • ${index + 1}`,
      w: card.width,
      h: card.height,
    };
  });
}

export default function CollageMaker() {
  const [items, setItems] = useState([]);
  const [columns, setColumns] = useState(4);
  const [gap, setGap] = useState(10);
  const [padding, setPadding] = useState(20);
  const [preset, setPreset] = useState(PRESETS[1]);
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(0.95);
  const [detect, setDetect] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const inputRef = useRef(null);

  const addFiles = useCallback(async (files) => {
    const arr = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (!arr.length) return;

    setBusy(true);

    try {
      const output = [];

      for (const file of arr) {
        if (detect && arr.length <= 4) {
          output.push(...(await detectCards(file)));
        } else {
          const image = await readImage(file);
          output.push({
            id: crypto.randomUUID(),
            ...image,
            name: file.name,
          });
        }
      }

      setItems((current) => [...current, ...output]);
    } finally {
      setBusy(false);
    }
  }, [detect]);

  const onDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    addFiles(event.dataTransfer.files);
  };

  const remove = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const swap = (a, b) => {
    setItems((current) => {
      const next = [...current];
      const indexA = next.findIndex((item) => item.id === a);
      const indexB = next.findIndex((item) => item.id === b);

      if (indexA < 0 || indexB < 0) return current;

      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });
  };

  const tileW = useMemo(
    () =>
      Math.max(
        80,
        Math.floor(
          (preset.w - padding * 2 - gap * (columns - 1)) / columns
        )
      ),
    [preset, columns, gap, padding]
  );

  const tileH = Math.round(tileW * 0.62);

  async function exportCollage() {
    if (!items.length) return;

    setBusy(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = preset.w;
      canvas.height = preset.h;

      const ctx = canvas.getContext("2d", { alpha: false });

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cols = Math.max(1, columns);
      const rows = Math.ceil(items.length / cols);

      const cellW =
        (preset.w - padding * 2 - gap * (cols - 1)) / cols;

      const cellH =
        (preset.h - padding * 2 - gap * (rows - 1)) / rows;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const img = new Image();

        img.src = item.url;
        await img.decode();

        const col = i % cols;
        const row = Math.floor(i / cols);

        const x = padding + col * (cellW + gap);
        const y = padding + row * (cellH + gap);

        const scale = Math.min(
          cellW / img.naturalWidth,
          cellH / img.naturalHeight
        );

        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;

        ctx.drawImage(
          img,
          x + (cellW - w) / 2,
          y + (cellH - h) / 2,
          w,
          h
        );
      }

      const mime = format === "png" ? "image/png" : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (!blob) return;

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");

          link.href = url;
          link.download =
            `collage-${preset.name.toLowerCase()}.${format}`;

          link.click();

          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        mime,
        quality
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          Sera <span>AutoCollage</span>
        </div>
        <small>100% local browser processing</small>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="section">
            <div
              className={`drop ${dragOver ? "drag" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <strong>{busy ? "Processing…" : "Drop images here"}</strong>
              <div className="muted">
                or choose multiple images
              </div>

              <button
                className="btn primary"
                style={{ marginTop: 12 }}
                onClick={() => inputRef.current?.click()}
              >
                Upload images
              </button>

              <input
                ref={inputRef}
                hidden
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                }}
              />
            </div>

            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <input
                type="checkbox"
                checked={detect}
                onChange={(event) => setDetect(event.target.checked)}
              />
              Automatic card/grid detection
            </label>
          </div>

          <div className="section">
            <h3>Layout</h3>

            <div className="controls">
              <label>
                Columns
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={columns}
                  onChange={(event) =>
                    setColumns(
                      Math.max(1, Number(event.target.value) || 1)
                    )
                  }
                />
              </label>

              <label>
                Gap (px)
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={gap}
                  onChange={(event) =>
                    setGap(
                      Math.max(0, Number(event.target.value) || 0)
                    )
                  }
                />
              </label>

              <label>
                Padding (px)
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={padding}
                  onChange={(event) =>
                    setPadding(
                      Math.max(0, Number(event.target.value) || 0)
                    )
                  }
                />
              </label>
            </div>
          </div>

          <div className="section">
            <h3>Export size</h3>

            <div className="presetgrid">
              {PRESETS.map((item) => (
                <button
                  key={item.name}
                  className={`btn preset ${
                    preset.name === item.name ? "active" : ""
                  }`}
                  onClick={() => setPreset(item)}
                >
                  {item.name}
                  <br />
                  <span className="muted">
                    {item.w}×{item.h}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <h3>Format</h3>

            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            >
              <option value="png">PNG — lossless</option>
              <option value="jpeg">JPEG</option>
            </select>

            {format === "jpeg" && (
              <label style={{ marginTop: 10 }}>
                Quality: {Math.round(quality * 100)}%
                <input
                  type="range"
                  min=".5"
                  max="1"
                  step=".01"
                  value={quality}
                  onChange={(event) =>
                    setQuality(Number(event.target.value))
                  }
                />
              </label>
            )}
          </div>

          <div className="section">
            <div className="row">
              <button
                className="btn"
                onClick={() => setItems([])}
              >
                Clear all
              </button>

              <button
                className="btn primary"
                disabled={!items.length || busy}
                onClick={exportCollage}
              >
                Export {preset.name}
              </button>
            </div>

            <p className="footer-note">
              Images never leave this browser. Export uses an
              in-memory canvas. Very large presets can require
              substantial device RAM.
            </p>
          </div>
        </aside>

        <main className="workspace">
          <div className="topbar">
            <div className="stats">
              {items.length} cards • {preset.w}×{preset.h} export
            </div>

            <div className="muted">
              Drag cards to swap • Remove with ×
            </div>
          </div>

          <div className="canvas-wrap">
            {!items.length ? (
              <div className="empty">
                <h2>Start your collage</h2>
                <p>
                  Upload MLBB screenshots or card images.
                  Detected cards can be reordered manually.
                </p>
              </div>
            ) : (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${columns}, ${tileW}px)`,
                  gap,
                }}
              >
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={
                      `card ` +
                      (dragId === item.id ? "dragging " : "") +
                      (overId === item.id ? "over" : "")
                    }
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    onDragEnter={() => setOverId(item.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragEnd={() => {
                      if (
                        dragId &&
                        overId &&
                        dragId !== overId
                      ) {
                        swap(dragId, overId);
                      }

                      setDragId(null);
                      setOverId(null);
                    }}
                    style={{
                      width: tileW,
                      height: tileH,
                    }}
                  >
                    <img src={item.url} alt={item.name} />
                    <span className="num">{index + 1}</span>

                    <button
                      className="remove"
                      onClick={() => remove(item.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
    }
                 
