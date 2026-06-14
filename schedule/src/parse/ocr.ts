// 写真→テキストのOCR。オープンソースのTesseract.jsを使用（日本語+英語）。
// 本体は動的importで初回のみ読み込み、初期バンドルを軽量に保つ。
// 認識精度を上げるため、グレースケール化・拡大・コントラスト強調の前処理を行う。

export type OcrProgress = (progress: number) => void;

const TARGET_MIN_DIM = 1000; // 小さい画像は拡大して認識率を上げる
const MAX_DIM = 2200; // 大きすぎる画像は抑える（速度）

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした"));
    };
    img.src = url;
  });
}

// グレースケール + 簡易コントラスト強調をかけたPNG Blobを返す
async function preprocess(file: File | Blob): Promise<Blob> {
  const img = await loadImage(file);
  const minDim = Math.min(img.width, img.height);
  let scale = 1;
  if (minDim < TARGET_MIN_DIM) scale = TARGET_MIN_DIM / minDim;
  const maxDim = Math.max(img.width, img.height) * scale;
  if (maxDim > MAX_DIM) scale *= MAX_DIM / maxDim;

  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // 取得不可なら原画像のまま

  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const contrast = 1.25;
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const adj = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
    px[i] = px[i + 1] = px[i + 2] = adj;
  }
  ctx.putImageData(data, 0, 0);

  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/png"),
  );
}

export async function imageToText(
  file: File | Blob,
  onProgress?: OcrProgress,
): Promise<string> {
  const { default: Tesseract } = await import("tesseract.js");
  const prepared = await preprocess(file).catch(() => file);
  const result = await Tesseract.recognize(prepared, "jpn+eng", {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(m.progress);
      }
    },
  });
  return result.data.text.trim();
}
