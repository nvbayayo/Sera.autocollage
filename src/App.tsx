import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  Download,
  Upload,
  ArrowLeftRight,
  Trash2,
  GripVertical,
  RotateCcw,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";

import {
  detectScreenshot,
  loadImage,
  makeSkins,
} from "./image";

import {
  downloadBlob,
  exportCollage,
} from "./export";

import type {
  ExportFormat,
  Skin,
} from "./types";

const PRESETS = [
  2048,
  3840,
  7680,
  10240,
  16000,
];

export default function App() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [skins, setSkins] =
    useState<Skin[]>([]);

  const [busy, setBusy] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [message, setMessage] =
    useState(
      "Upload one or more MLBB screenshots. Target detection: ~1–2 minutes for 400–500 skins, depending on device."
    );

  const [columns, setColumns] =
    useState(5);

  const [gap, setGap] =
    useState(12);

  const [padding, setPadding] =
    useState(24);

  const [width, setWidth] =
    useState(3840);

  const [format, setFormat] =
    useState<ExportFormat>("png");

  const [quality, setQuality] =
    useState(0.95);

  const [selected, setSelected] =
    useState<string | null>(null);

  const [swapId, setSwapId] =
    useState<string | null>(null);

  const [dragId, setDragId] =
    useState<string | null>(null);

  const rows = Math.ceil(
    skins.length /
      Math.max(1, columns)
  );

  const previewSkins = useMemo(
    () => skins.slice(0, 80),
    [skins]
  );

  async function handleFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    if (!files.length) {
      return;
    }

    setBusy(true);
    setProgress(0);
    setMessage(
      `Processing ${files.length} screenshot(s)...`
    );

    try {
      const allSkins: Skin[] = [];

      for (
        let i = 0;
        i < files.length;
        i++
      ) {
        const file = files[i];

        if (!file.type.startsWith("image/")) {
          continue;
        }

        setMessage(
          `Analyzing screenshot ${
            i + 1
          } of ${files.length}: ${file.name}`
        );

        const image =
          await loadImage(file);

        const detection =
          await detectScreenshot(
            image,
            (value) => {
              const base =
                (i / files.length) * 100;

              const part =
                value / files.length;

              setProgress(
                Math.min(
                  100,
                  Math.round(
                    base + part
                  )
                )
              );
            }
          );

        const generated =
          makeSkins(
            image,
            detection
          );

        allSkins.push(
          ...generated
        );

        setProgress(
          Math.round(
            ((i + 1) /
              files.length) *
              100
          )
        );
      }

      const normalized =
        allSkins.map(
          (skin, index) => ({
            ...skin,
            order: index,
          })
        );

      setSkins(normalized);

      if (normalized.length > 0) {
        const recommendedColumns =
          normalized.length >= 100
            ? 8
            : normalized.length >= 50
              ? 6
              : 5;

        setColumns(
          recommendedColumns
        );

        setMessage(
          `Detected ${normalized.length} MLBB items. Automatic collage is ready.`
        );
      } else {
        setMessage(
          "No MLBB items were detected. Try a clearer screenshot."
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error";

      setMessage(
        `Detection failed: ${errorMessage}`
      );
    } finally {
      setBusy(false);
      setProgress(100);

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  function clearAll() {
    setSkins([]);
    setSelected(null);
    setSwapId(null);
    setDragId(null);
    setProgress(0);

    setMessage(
      "Upload one or more MLBB screenshots. Target detection: ~1–2 minutes for 400–500 skins, depending on device."
    );
  }

  function removeSkin(id: string) {
    setSkins((current) =>
      current
        .filter(
          (skin) => skin.id !== id
        )
        .map(
          (skin, index) => ({
            ...skin,
            order: index,
          })
        )
    );

    if (selected === id) {
      setSelected(null);
    }

    if (swapId === id) {
      setSwapId(null);
    }
  }

  function swapSkins(
    firstId: string,
    secondId: string
  ) {
    if (firstId === secondId) {
      return;
    }

    setSkins((current) => {
      const firstIndex =
        current.findIndex(
          (skin) =>
            skin.id === firstId
        );

      const secondIndex =
        current.findIndex(
          (skin) =>
            skin.id === secondId
        );

      if (
        firstIndex === -1 ||
        secondIndex === -1
      ) {
        return current;
      }

      const next = [...current];

      [
        next[firstIndex],
        next[secondIndex],
      ] = [
        next[secondIndex],
        next[firstIndex],
      ];

      return next.map(
        (skin, index) => ({
          ...skin,
          order: index,
        })
      );
    });
  }

  function handleSwapClick(
    id: string
  ) {
    if (!swapId) {
      setSwapId(id);
      return;
    }

    swapSkins(swapId, id);
    setSwapId(null);
  }

  function handleDragStart(
    event: DragEvent<HTMLDivElement>,
    id: string
  ) {
    setDragId(id);

    event.dataTransfer.effectAllowed =
      "move";

    event.dataTransfer.setData(
      "text/plain",
      id
    );
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    event.dataTransfer.dropEffect =
      "move";
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    targetId: string
  ) {
    event.preventDefault();

    const sourceId =
      dragId ||
      event.dataTransfer.getData(
        "text/plain"
      );

    if (
      !sourceId ||
      sourceId === targetId
    ) {
      setDragId(null);
      return;
    }

    setSkins((current) => {
      const sourceIndex =
        current.findIndex(
          (skin) =>
            skin.id === sourceId
        );

      const targetIndex =
        current.findIndex(
          (skin) =>
            skin.id === targetId
        );

      if (
        sourceIndex === -1 ||
        targetIndex === -1
      ) {
        return current;
      }

      const next = [...current];

      const [moved] =
        next.splice(
          sourceIndex,
          1
        );

      next.splice(
        targetIndex,
        0,
        moved
      );

      return next.map(
        (skin, index) => ({
          ...skin,
          order: index,
        })
      );
    });

    setDragId(null);
  }

  async function handleExport() {
    if (!skins.length) {
      setMessage(
        "Add some MLBB screenshots before exporting."
      );
      return;
    }

    setBusy(true);

    setMessage(
      `Rendering ${width}px ${format.toUpperCase()} collage...`
    );

    try {
      const blob =
        await exportCollage(
          skins,
          {
            width,
            columns,
            gap,
            padding,
            background: "#000000",
            format,
            quality,
          }
        );

      const extension =
        format === "jpeg"
          ? "jpg"
          : format;

      downloadBlob(
        blob,
        `sera-mlbb-collage-${width}px.${extension}`
      );

      setMessage(
        `Export complete: ${width}px ${format.toUpperCase()}.`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Export failed.";

      setMessage(
        errorMessage
      );
    } finally {
      setBusy(false);
    }
  }

  function resetSettings() {
    setColumns(5);
    setGap(12);
    setPadding(24);
    setWidth(3840);
    setFormat("png");
    setQuality(0.95);
    setMessage(
      "Export settings reset."
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            S
          </div>

          <div>
            <div className="brand-name">
              Sera.autocollage
            </div>

            <div className="brand-sub">
              MLBB automatic collage maker
            </div>
          </div>
        </div>

        <button
          type="button"
          className="upload-button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={busy}
        >
          <Upload size={18} />
          Upload screenshots
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFiles}
        />
      </header>

      <main>
        <section className="hero">
          <div className="hero-badge">
            <Sparkles size={15} />
            MLBB AUTO COLLAGE
          </div>

          <h1>
            Turn your MLBB screenshots
            <br />
            into a clean collage.
          </h1>

          <p>
            Upload your Mobile Legends
            screenshots. Sera automatically
            detects the cards, arranges them,
            and prepares a high-resolution
            collage.
          </p>

          <button
            type="button"
            className="hero-upload"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={busy}
          >
            <Upload size={20} />
            Choose MLBB screenshots
          </button>

          <div className="hero-note">
            Supports multiple screenshots
            {" • "}
            Automatic detection
            {" • "}
            Manual editing
          </div>
        </section>

        <section className="stats">
          <div className="stat">
            <span>Detected</span>
            <strong>
              {skins.length}
            </strong>
          </div>

          <div className="stat">
            <span>Columns</span>
            <strong>
              {columns}
            </strong>
          </div>

          <div className="stat">
            <span>Rows</span>
            <strong>
              {rows}
            </strong>
          </div>

          <div className="stat">
            <span>Output</span>
            <strong>
              {width.toLocaleString()}px
            </strong>
          </div>
        </section>

        <section className="workspace">
          <div className="workspace-header">
            <div>
              <h2>
                Collage workspace
              </h2>

              <p>
                {message}
              </p>
            </div>

            {busy && (
              <div className="processing">
                <div className="spinner" />
                <span>
                  {progress}%
                </span>
              </div>
            )}
          </div>

          {busy && (
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          )}

          {skins.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ImageIcon
                  size={36}
                />
              </div>

              <h3>
                No screenshots yet
              </h3>

              <p>
                Upload your MLBB screenshots
                to start automatic detection.
              </p>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={busy}
              >
                <Upload size={17} />
                Upload screenshots
              </button>
            </div>
          ) : (
            <div
              className="preview-grid"
              style={{
                gridTemplateColumns:
                  `repeat(${columns}, minmax(0, 1fr))`,
                gap: `${gap}px`,
                padding: `${padding}px`,
              }}
            >
              {previewSkins.map(
                (skin, index) => {
                  const isSelected =
                    selected ===
                    skin.id;

                  const isSwap =
                    swapId ===
                    skin.id;

                  return (
                    <div
                      key={skin.id}
                      className={[
                        "skin-card",
                        isSelected
                          ? "selected"
                          : "",
                        isSwap
                          ? "swap-selected"
                          : "",
                      ].join(" ")}
                      draggable
                      onDragStart={(
                        event
                      ) =>
                        handleDragStart(
                          event,
                          skin.id
                        )
                      }
                      onDragOver={
                        handleDragOver
                      }
                      onDrop={(
                        event
                      ) =>
                        handleDrop(
                          event,
                          skin.id
                        )
                      }
                      onClick={() =>
                        setSelected(
                          isSelected
                            ? null
                            : skin.id
                        )
                      }
                    >
                      <img
                        src={
                          skin.image.src
                        }
                        alt={`MLBB item ${
                          index + 1
                        }`}
                        draggable={false}
                      />

                      <div className="skin-number">
                        {index + 1}
                      </div>

                      <div className="skin-actions">
                        <button
                          type="button"
                          title="Drag to reorder"
                          className="icon-button drag"
                          onClick={(
                            event
                          ) =>
                            event.stopPropagation()
                          }
                        >
                          <GripVertical
                            size={16}
                          />
                        </button>

                        <button
                          type="button"
                          title="Select for swap"
                          className="icon-button"
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();

                            handleSwapClick(
                              skin.id
                            );
                          }}
                        >
                          <ArrowLeftRight
                            size={15}
                          />
                        </button>

                        <button
                          type="button"
                          title="Delete"
                          className="icon-button danger"
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();

                            removeSkin(
                              skin.id
                            );
                          }}
                        >
                          <Trash2
                            size={15}
                          />
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}

          {skins.length > 80 && (
            <div className="preview-limit">
              Showing first 80 items in the
              preview. All{" "}
              {skins.length} items will be
              included in export.
            </div>
          )}
        </section>

        <section className="controls">
          <div className="controls-header">
            <div>
              <h2>
                Export settings
              </h2>

              <p>
                Configure your final collage
                before exporting.
              </p>
            </div>

            <button
              type="button"
              className="reset-button"
              onClick={
                resetSettings
              }
            >
              <RotateCcw
                size={16}
              />
              Reset
            </button>
          </div>

          <div className="control-grid">
            <div className="control">
              <label>
                Output width
              </label>

              <select
                value={width}
                onChange={(event) =>
                  setWidth(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              >
                {PRESETS.map(
                  (preset) => (
                    <option
                      key={preset}
                      value={preset}
                    >
                      {preset.toLocaleString()}
                      px
                      {" "}
                      (
                      {preset ===
                      2048
                        ? "2K"
                        : preset ===
                            3840
                          ? "4K"
                          : preset ===
                              7680
                            ? "8K"
                            : preset ===
                                10240
                              ? "10K"
                              : "16K"}
                      )
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="control">
              <label>
                Columns
              </label>

              <input
                type="number"
                min={1}
                max={20}
                value={columns}
                onChange={(event) =>
                  setColumns(
                    Math.max(
                      1,
                      Math.min(
                        20,
                        Number(
                          event.target
                            .value
                        ) || 1
                      )
                    )
                  )
                }
              />
            </div>

            <div className="control">
              <label>
                Gap
              </label>

              <input
                type="number"
                min={0}
                max={200}
                value={gap}
                onChange={(event) =>
                  setGap(
                    Math.max(
                      0,
                      Number(
                        event.target
                          .value
                      ) || 0
                    )
                  )
                }
              />
            </div>

            <div className="control">
              <label>
                Padding
              </label>

              <input
                type="number"
                min={0}
                max={300}
                value={padding}
                onChange={(event) =>
                  setPadding(
                    Math.max(
                      0,
                      Number(
                        event.target
                          .value
                      ) || 0
                    )
                  )
                }
              />
            </div>

            <div className="control">
              <label>
                File format
              </label>

              <select
                value={format}
                onChange={(event) =>
                  setFormat(
                    event.target
                      .value as ExportFormat
                  )
                }
              >
                <option value="png">
                  PNG — Lossless
                </option>

                <option value="jpeg">
                  JPEG — Smaller
                </option>

                <option value="webp">
                  WebP — Modern
                </option>
              </select>
            </div>

            {format !== "png" && (
              <div className="control">
                <label>
                  Quality{" "}
                  {Math.round(
                    quality * 100
                  )}
                  %
                </label>

                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.01"
                  value={quality}
                  onChange={(
                    event
                  ) =>
                    setQuality(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                />
              </div>
            )}
          </div>

          <div className="export-row">
            <button
              type="button"
              className="export-button"
              onClick={
                handleExport
              }
              disabled={
                busy ||
                skins.length === 0
              }
            >
              <Download
                size={19}
              />
              Export{" "}
              {format.toUpperCase()}
            </button>

            <button
              type="button"
              className="clear-button"
              onClick={clearAll}
              disabled={
                busy ||
                skins.length === 0
              }
            >
              <Trash2 size={17} />
              Clear all
            </button>
          </div>
        </section>

        <section className="info-section">
          <div>
            <strong>
              Automatic detection
            </strong>

            <p>
              Designed for large MLBB
              screenshot collections.
              Processing time depends on
              your device.
            </p>
          </div>

          <div>
            <strong>
              Manual control
            </strong>

            <p>
              Drag cards to reorder them,
              or use the swap button to
              manually change the sequence.
            </p>
          </div>

          <div>
            <strong>
              High-resolution export
            </strong>

            <p>
              Export up to 16K canvas width.
              PNG is recommended when you
              want maximum lossless quality.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <span>
          Sera.autocollage
        </span>

        <span>
          MLBB screenshot collage maker
        </span>
      </footer>
    </div>
  );
}