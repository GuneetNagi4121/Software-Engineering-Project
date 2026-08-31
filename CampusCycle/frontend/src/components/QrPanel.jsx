import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Keyboard, QrCode } from 'lucide-react';
import { Field, Input } from './ui/Field';
import Button from './ui/Button';
import { cn } from '../utils/format';

/**
 * QR entry for a rental. Manual entry always works; camera scanning is offered
 * as an enhancement when the browser supports the BarcodeDetector API.
 */
export default function QrPanel({ value, onChange, disabled }) {
  const supportsCamera =
    typeof window !== 'undefined' &&
    'BarcodeDetector' in window &&
    !!navigator.mediaDevices?.getUserMedia;

  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => stopCamera, []); // clean up on unmount

  async function startCamera() {
    setCamError('');
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            onChange(codes[0].rawValue.trim());
            stopCamera();
            return;
          }
        } catch {
          /* transient det: ignore and keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCamError('Camera unavailable. Please enter the code manually.');
      stopCamera();
    }
  }

  return (
    <div className="space-y-3">
      {scanning ? (
        <div className="relative overflow-hidden rounded-xl bg-slate-900">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="h-52 w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-32 w-32 rounded-lg border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(15,23,42,0.35)]" />
          </div>
          <button
            type="button"
            onClick={stopCamera}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700"
          >
            <CameraOff size={14} /> Stop
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-slate-400">
          <QrCode size={20} />
          <span className="text-sm">Scan a cycle QR code or type it below.</span>
        </div>
      )}

      <Field label="Cycle QR code" htmlFor="qr" hint="Printed on the bicycle, e.g. QR-CYCLE-001">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">
            <Keyboard size={16} />
          </span>
          <Input
            id="qr"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="QR-CYCLE-001"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            className={cn('font-mono uppercase tracking-wide')}
          />
        </div>
      </Field>

      {supportsCamera && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={scanning ? stopCamera : startCamera}
          disabled={disabled}
        >
          <Camera size={16} />
          {scanning ? 'Stop camera' : 'Scan with camera'}
        </Button>
      )}
      {camError && <p className="text-xs text-amber-600">{camError}</p>}
    </div>
  );
}
