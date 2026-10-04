import type { Skin } from "./types";

export interface DetectionResult {
  boxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export function loadImage(
  file: File
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const url =
        URL.createObjectURL(file);

      const image =
        new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);

        reject(
          new Error(
            `Could not load ${file.name}`
          )
        );
      };

      image.src = url;
    }
  );
}

/*
 * Basic computer-vision style detector.
 *
 * MLBB screenshot grids normally contain repeated
 * rectangular image/card regions. This scans the
 * screenshot for high-information rectangular
 * areas and groups nearby candidates.
 *
 * The detector intentionally runs entirely in the
 * browser so user screenshots do not need to be
 * uploaded to a server.
 */
export async function detectScreenshot(
  image: HTMLImageElement,
  onProgress?: (
    progress: number
  ) => void
): Promise<DetectionResult> {
  const maxDimension = 1800;

  const scale =
    Math.min(
      1,
      maxDimension /
        Math.max(
          image.naturalWidth,
          image.naturalHeight
        )
    );

  const width =
    Math.max(
      1,
      Math.round(
        image.naturalWidth * scale
      )
    );

  const height =
    Math.max(
      1,
      Math.round(
        image.naturalHeight * scale
      )
    );

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext("2d", {
      willReadFrequently: true,
    });

  if (!context) {
    throw new Error(
      "Canvas is not supported."
    );
  }

  context.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  const data =
    context.getImageData(
      0,
      0,
      width,
      height
    ).data;

  /*
   * Determine an approximate background color.
   */
  const sampleStep =
    Math.max(
      4,
      Math.floor(
        Math.min(width, height) /
          100
      )
    );

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let samples = 0;

  for (
    let y = 0;
    y < height;
    y += sampleStep
  ) {
    for (
      let x = 0;
      x < width;
      x += sampleStep
    ) {
      const index =
        (y * width + x) * 4;

      totalR += data[index];
      totalG += data[index + 1];
      totalB += data[index + 2];

      samples++;
    }

    if (
      onProgress &&
      y % Math.max(1, Math.floor(height / 20)) === 0
    ) {
      onProgress(
        Math.round(
          (y / height) * 35
        )
      );

      await new Promise(
        (resolve) =>
          requestAnimationFrame(
            () => resolve(null)
          )
      );
    }
  }

  const average = {
    r: totalR / Math.max(1, samples),
    g: totalG / Math.max(1, samples),
    b: totalB / Math.max(1, samples),
  };

  /*
   * Estimate likely grid cell dimensions.
   *
   * MLBB collection screenshots commonly have
   * several cards horizontally.
   */
  const possibleColumns = [
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
  ];

  let bestColumns = 5;
  let bestScore = Infinity;

  for (
    const candidate of possibleColumns
  ) {
    const cellWidth =
      width / candidate;

    const score =
      Math.abs(
        cellWidth /
          Math.max(1, height) -
          0.16
      );

    if (score < bestScore) {
      bestScore = score;
      bestColumns =
        candidate;
    }
  }

  onProgress?.(45);

  const approximateCellWidth =
    width / bestColumns;

  const approximateCellHeight =
    approximateCellWidth * 1.25;

  const boxes: DetectionResult["boxes"] =
    [];

  /*
   * Scan likely grid positions.
   */
  const rows =
    Math.ceil(
      height /
        Math.max(
          1,
          approximateCellHeight
        )
    );

  for (
    let row = 0;
    row < rows;
    row++
  ) {
    for (
      let column = 0;
      column < bestColumns;
      column++
    ) {
      const x =
        Math.round(
          column *
            approximateCellWidth
        );

      const y =
        Math.round(
          row *
            approximateCellHeight
        );

      const w =
        Math.round(
          approximateCellWidth
        );

      const h =
        Math.round(
          approximateCellHeight
        );

      if (
        x + w > width ||
        y + h > height
      ) {
        continue;
      }

      /*
       * Measure color variation inside
       * the candidate cell.
       */
      let variance = 0;
      let count = 0;

      const stepX =
        Math.max(
          2,
          Math.floor(w / 12)
        );

      const stepY =
        Math.max(
          2,
          Math.floor(h / 12)
        );

      for (
        let py = y;
        py < y + h;
        py += stepY
      ) {
        for (
          let px = x;
          px < x + w;
          px += stepX
        ) {
          const index =
            (py * width + px) * 4;

          const r =
            data[index];

          const g =
            data[index + 1];

          const b =
            data[index + 2];

          const distance =
            Math.abs(
              r - average.r
            ) +
            Math.abs(
              g - average.g
            ) +
            Math.abs(
              b - average.b
            );

          variance += distance;
          count++;
        }
      }

      const score =
        variance /
        Math.max(1, count);

      /*
       * Reject cells that look almost exactly
       * like the overall background.
       */
      if (score > 25) {
        boxes.push({
          x,
          y,
          width: w,
          height: h,
        });
      }

      const progress =
        45 +
        Math.round(
          (
            (row * bestColumns +
              column) /
            Math.max(
              1,
              rows * bestColumns
            )
          ) *
            50
        );

      onProgress?.(
        Math.min(95, progress)
      );

      /*
       * Yield periodically so mobile devices
       * remain responsive.
       */
      if (
        (row * bestColumns +
          column) %
          8 ===
        0
      ) {
        await new Promise(
          (resolve) =>
            requestAnimationFrame(
              () => resolve(null)
            )
        );
      }
    }
  }

  onProgress?.(100);

  /*
   * If the heuristic was too aggressive,
   * provide a sensible fallback grid.
   */
  if (boxes.length === 0) {
    const fallbackColumns =
      5;

    const fallbackWidth =
      width / fallbackColumns;

    const fallbackHeight =
      fallbackWidth * 1.25;

    const fallbackRows =
      Math.ceil(
        height /
          fallbackHeight
      );

    for (
      let row = 0;
      row < fallbackRows;
      row++
    ) {
      for (
        let column = 0;
        column < fallbackColumns;
        column++
      ) {
        const x =
          Math.round(
            column *
              fallbackWidth
          );

        const y =
          Math.round(
            row *
              fallbackHeight
          );

        if (
          x + fallbackWidth <=
            width &&
          y + fallbackHeight <=
            height
        ) {
          boxes.push({
            x,
            y,
            width:
              Math.round(
                fallbackWidth
              ),
            height:
              Math.round(
                fallbackHeight
              ),
          });
        }
      }
    }
  }

  /*
   * Convert detector coordinates back to
   * original screenshot resolution.
   */
  return {
    boxes: boxes.map(
      (box) => ({
        x:
          Math.round(
            box.x / scale
          ),
        y:
          Math.round(
            box.y / scale
          ),
        width:
          Math.round(
            box.width / scale
          ),
        height:
          Math.round(
            box.height / scale
          ),
      })
    ),
  };
}

export function makeSkins(
  image: HTMLImageElement,
  detection: DetectionResult
): Skin[] {
  return detection.boxes.map(
    (box, index) => {
      const cropCanvas =
        document.createElement(
          "canvas"
        );

      cropCanvas.width =
        Math.max(
          1,
          box.width
        );

      cropCanvas.height =
        Math.max(
          1,
          box.height
        );

      const context =
        cropCanvas.getContext(
          "2d"
        );

      if (context) {
        context.drawImage(
          image,
          box.x,
          box.y,
          box.width,
          box.height,
          0,
          0,
          box.width,
          box.height
        );
      }

      const cropped =
        new Image();

      cropped.src =
        cropCanvas.toDataURL(
          "image/png"
        );

      return {
        id: `skin-${Date.now()}-${index}-${Math.random()
          .toString(36)
          .slice(2)}`,

        image: cropped,

        sx: 0,
        sy: 0,

        order: index,
      };
    }
  );
      }
