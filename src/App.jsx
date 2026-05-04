import React, { useEffect, useRef, useState } from 'react';
import { Activity, Image as ImageIcon, Info, Sliders, UploadCloud } from 'lucide-react';

const zigZag = [
  [0, 0], [1, 0], [0, 1], [0, 2], [1, 1], [2, 0], [3, 0], [2, 1],
  [1, 2], [0, 3], [0, 4], [1, 3], [2, 2], [3, 1], [4, 0], [5, 0],
  [4, 1], [3, 2], [2, 3], [1, 4], [0, 5], [0, 6], [1, 5], [2, 4],
  [3, 3], [4, 2], [5, 1], [6, 0], [7, 0], [6, 1], [5, 2], [4, 3],
  [3, 4], [2, 5], [1, 6], [0, 7], [1, 7], [2, 6], [3, 5], [4, 4],
  [5, 3], [6, 2], [7, 1], [7, 2], [6, 3], [5, 4], [4, 5], [3, 6],
  [2, 7], [3, 7], [4, 6], [5, 5], [6, 4], [7, 3], [7, 4], [6, 5],
  [5, 6], [4, 7], [5, 7], [6, 6], [7, 5], [7, 6], [6, 7], [7, 7],
];

const { cosMap, CMap } = (() => {
  const cosines = new Float32Array(64);
  for (let x = 0; x < 8; x += 1) {
    for (let u = 0; u < 8; u += 1) {
      cosines[x * 8 + u] = Math.cos(((2 * x + 1) * u * Math.PI) / 16);
    }
  }

  const coefficients = new Float32Array(8);
  for (let i = 0; i < 8; i += 1) {
    coefficients[i] = i === 0 ? 1 / Math.SQRT2 : 1;
  }

  return { cosMap: cosines, CMap: coefficients };
})();

const performDCT = (pixels, width, height) => {
  const numBlocksX = width / 8;
  const numBlocksY = height / 8;
  const dctR = new Float32Array(width * height);
  const dctG = new Float32Array(width * height);
  const dctB = new Float32Array(width * height);

  for (let by = 0; by < numBlocksY; by += 1) {
    for (let bx = 0; bx < numBlocksX; bx += 1) {
      const blockStartX = bx * 8;
      const blockStartY = by * 8;
      const blockR = new Float32Array(64);
      const blockG = new Float32Array(64);
      const blockB = new Float32Array(64);

      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const pxIndex = ((blockStartY + y) * width + (blockStartX + x)) * 4;
          blockR[y * 8 + x] = pixels[pxIndex] - 128;
          blockG[y * 8 + x] = pixels[pxIndex + 1] - 128;
          blockB[y * 8 + x] = pixels[pxIndex + 2] - 128;
        }
      }

      for (let v = 0; v < 8; v += 1) {
        for (let u = 0; u < 8; u += 1) {
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;

          for (let y = 0; y < 8; y += 1) {
            for (let x = 0; x < 8; x += 1) {
              const cosVal = cosMap[x * 8 + u] * cosMap[y * 8 + v];
              sumR += blockR[y * 8 + x] * cosVal;
              sumG += blockG[y * 8 + x] * cosVal;
              sumB += blockB[y * 8 + x] * cosVal;
            }
          }

          const factor = 0.25 * CMap[u] * CMap[v];
          const outIdx = (blockStartY + v) * width + (blockStartX + u);
          dctR[outIdx] = factor * sumR;
          dctG[outIdx] = factor * sumG;
          dctB[outIdx] = factor * sumB;
        }
      }
    }
  }

  return { dctR, dctG, dctB };
};

const performIDCT = (dctData, width, height, numCoeffs) => {
  const { dctR, dctG, dctB } = dctData;
  const numBlocksX = width / 8;
  const numBlocksY = height / 8;
  const outPixels = new Uint8ClampedArray(width * height * 4);
  const activeCoeffs = zigZag.slice(0, numCoeffs);

  for (let by = 0; by < numBlocksY; by += 1) {
    for (let bx = 0; bx < numBlocksX; bx += 1) {
      const blockStartX = bx * 8;
      const blockStartY = by * 8;

      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;

          for (let i = 0; i < numCoeffs; i += 1) {
            const [u, v] = activeCoeffs[i];
            const factor = CMap[u] * CMap[v] * cosMap[x * 8 + u] * cosMap[y * 8 + v];
            const inIdx = (blockStartY + v) * width + (blockStartX + u);
            sumR += dctR[inIdx] * factor;
            sumG += dctG[inIdx] * factor;
            sumB += dctB[inIdx] * factor;
          }

          const pxIndex = ((blockStartY + y) * width + (blockStartX + x)) * 4;
          outPixels[pxIndex] = sumR * 0.25 + 128;
          outPixels[pxIndex + 1] = sumG * 0.25 + 128;
          outPixels[pxIndex + 2] = sumB * 0.25 + 128;
          outPixels[pxIndex + 3] = 255;
        }
      }
    }
  }

  return new ImageData(outPixels, width, height);
};

const computeDCTAsync = (pixels, width, height) => (
  new Promise((resolve) => setTimeout(() => resolve(performDCT(pixels, width, height)), 50))
);

const computeIDCTAsync = (dctData, width, height, numCoeffs) => (
  new Promise((resolve) => setTimeout(() => resolve(performIDCT(dctData, width, height, numCoeffs)), 10))
);

export default function App() {
  const [originalImage, setOriginalImage] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [dctData, setDctData] = useState(null);
  const [numCoeffs, setNumCoeffs] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const canvasProcessedRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = async () => {
        setIsProcessing(true);
        setDctData(null);

        const maxDimension = 512;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        width = Math.max(8, Math.floor(width / 8) * 8);
        height = Math.max(8, Math.floor(height / 8) * 8);
        setDimensions({ width, height });

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);

        setOriginalImage(canvas.toDataURL());
        const data = await computeDCTAsync(imageData.data, width, height);
        setDctData(data);
        setIsProcessing(false);
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!dctData || !dimensions.width) return undefined;

    let isCancelled = false;
    const renderProcessedImage = async () => {
      setIsRendering(true);
      const imageData = await computeIDCTAsync(dctData, dimensions.width, dimensions.height, numCoeffs);

      if (!isCancelled && canvasProcessedRef.current) {
        canvasProcessedRef.current.width = dimensions.width;
        canvasProcessedRef.current.height = dimensions.height;
        canvasProcessedRef.current.getContext('2d').putImageData(imageData, 0, 0);
        setIsRendering(false);
      }
    };

    renderProcessedImage();
    return () => {
      isCancelled = true;
    };
  }, [dctData, dimensions, numCoeffs]);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-3 py-4 text-slate-800 sm:p-8">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm sm:p-8">
          <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-indigo-100 p-2.5 text-indigo-600 sm:p-3">
            <Activity size={32} />
          </div>
          <h1 className="text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">
            عرض تحويل جيب التمام المتقطع
            <span className="mt-2 block text-base font-normal leading-snug text-slate-500 sm:text-xl" dir="ltr">
              Discrete Cosine Transform Demo
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            ارفع صورة لتجربة فكرة ضغط الصور باستخدام DCT. يقسم التطبيق الصورة إلى كتل، يحسب تردداتها،
            ثم يعيد بناءها بعدد مختلف من المعاملات حتى ترى أثر الضغط على الجودة.
          </p>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <UploadCloud className="text-indigo-500" size={24} />
                رفع الصورة
              </h2>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50 p-5 text-center transition-colors hover:bg-indigo-100 sm:p-8"
              >
                <ImageIcon size={48} className="mb-3 text-indigo-400" />
                <span className="font-medium text-indigo-700">اضغط هنا لاختيار صورة</span>
                <span className="mt-1 max-w-64 text-sm leading-6 text-indigo-400">يفضل استخدام صورة بأبعاد مناسبة مثل 512x512</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <div className="flex flex-col justify-center space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Sliders className="text-indigo-500" size={24} />
                التحكم بالمعاملات
              </h2>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-6">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="font-medium text-slate-700">عدد المعاملات:</span>
                  <span className="w-fit rounded-lg bg-indigo-600 px-3 py-1 text-base font-bold text-white sm:text-lg" dir="ltr">
                    {numCoeffs} / 64
                  </span>
                </div>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="font-medium text-slate-700">نسبة الضغط:</span>
                  <span className="w-fit rounded-lg bg-emerald-500 px-3 py-1 text-base font-bold text-white sm:text-lg" dir="ltr">
                    {(((64 - numCoeffs) / 64) * 100).toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="64"
                  value={numCoeffs}
                  onChange={(event) => setNumCoeffs(Number.parseInt(event.target.value, 10))}
                  disabled={!dctData || isProcessing}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                  dir="ltr"
                />
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>جودة أعلى</span>
                  <span>ضغط أعلى</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                <Info size={20} className="mt-0.5 shrink-0" />
                <p>
                  كلما قل عدد المعاملات، تقل البيانات اللازمة لتمثيل الصورة، لكن تنخفض الدقة. هذه هي
                  الفكرة الأساسية التي تستفيد منها خوارزميات ضغط الصور مثل JPEG.
                </p>
              </div>
            </div>
          </div>
        </section>

        {originalImage && (
          <section className="relative grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {isProcessing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg border border-indigo-100 bg-white/85 p-4 text-center shadow-lg backdrop-blur-sm">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                <h3 className="text-lg font-bold text-indigo-950 sm:text-xl">جاري معالجة الصورة...</h3>
                <p className="mt-2 text-sm text-indigo-600 sm:text-base">يتم حساب معاملات التردد للصورة بالكامل</p>
              </div>
            )}

            <figure className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <figcaption className="border-b border-slate-100 bg-slate-50 p-3 font-semibold text-slate-700 sm:p-4">
                الصورة الأصلية
              </figcaption>
              <div className="flex min-h-60 flex-1 items-center justify-center overflow-auto bg-checkered p-3 sm:p-4">
                <img
                  src={originalImage}
                  alt="Original upload"
                  className="h-auto max-w-full rounded border border-slate-300 shadow-sm"
                />
              </div>
            </figure>

            <figure className="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 p-3 font-semibold text-slate-700 sm:gap-4 sm:p-4">
                <span>الصورة المعاد بناؤها</span>
                {isRendering && (
                  <span className="animate-pulse rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
                    جاري التحديث...
                  </span>
                )}
              </figcaption>
              <div className="flex min-h-60 flex-1 items-center justify-center overflow-auto bg-checkered p-3 sm:p-4">
                <canvas
                  ref={canvasProcessedRef}
                  className="h-auto max-w-full rounded border border-slate-300 shadow-sm"
                />
              </div>
            </figure>
          </section>
        )}

        <footer className="mt-8 py-6 text-center text-sm text-slate-500">
          جميع الحقوق محفوظة &copy; {new Date().getFullYear()} - خليل الشيخاوي
        </footer>
      </main>
    </div>
  );
}
