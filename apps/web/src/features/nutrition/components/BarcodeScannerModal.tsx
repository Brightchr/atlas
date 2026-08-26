import { useEffect, useRef, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

/** Minimal typing for the native BarcodeDetector — available in Chromium on
 * Android (including the Capacitor webview), our primary scanning surface.
 * TS doesn't ship these types yet. */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  } catch {
    return null;
  }
}

/** Camera barcode scanner with a manual-entry fallback. Detection uses the
 * platform BarcodeDetector where it exists (Android Chrome / the app's
 * webview); elsewhere — most desktop browsers — the typed fallback shows
 * instead of a camera that could never decode. */
export function BarcodeScannerModal({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const detector = useRef<BarcodeDetectorLike | null>(getBarcodeDetector());
  const canScan = detector.current !== null;

  useEffect(() => {
    if (!canScan) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;

    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (done) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        void video.play();
        // Poll rather than rAF: 4 checks/second finds a steady barcode fast
        // without pinning a phone CPU.
        timer = setInterval(() => {
          void (async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            const codes = await detector.current!.detect(videoRef.current).catch(() => []);
            const value = codes[0]?.rawValue?.replace(/\D/g, '');
            if (value && value.length >= 8 && !done) {
              done = true;
              onDetected(value);
            }
          })();
        }, 250);
      })
      .catch(() => setCameraError('Camera unavailable — type the barcode instead.'));

    return () => {
      done = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [canScan, onDetected]);

  const submitManual = () => {
    const code = manual.replace(/\D/g, '');
    if (code.length >= 8) onDetected(code);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-label="Scan a barcode"
    >
      <div className="w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Scan a barcode</p>
          <button
            type="button"
            aria-label="Close scanner"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {canScan && !cameraError && (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
            {/* Aim guide */}
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-lg border-2 border-white/70" />
          </div>
        )}
        {canScan && !cameraError && (
          <p className="text-center text-xs text-muted">
            Point the camera at the barcode — it logs the moment it's read.
          </p>
        )}
        {(!canScan || cameraError) && (
          <p className="text-sm text-muted">
            {cameraError ?? 'Camera scanning needs the mobile app or an Android browser.'}
          </p>
        )}

        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitManual();
            }}
            inputMode="numeric"
            placeholder="Or type the number under the barcode"
            aria-label="Barcode number"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <button
            type="button"
            disabled={manual.replace(/\D/g, '').length < 8}
            onClick={submitManual}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold transition-colors hover:bg-elev disabled:opacity-50"
          >
            <Keyboard size={14} aria-hidden />
            Look up
          </button>
        </div>
      </div>
    </div>
  );
}
