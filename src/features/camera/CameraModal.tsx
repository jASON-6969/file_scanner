import { Camera, Check, ImagePlus, RotateCcw, X, Zap, ZapOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileImportButton } from '../../components/FileImportButton';
import { IconButton } from '../../components/IconButton';
import { captureDocumentPhoto, configureDocumentCamera, documentCameraConstraints, setCameraTorch } from './cameraCapture';

interface CameraModalProps {
  onClose: () => void;
  onComplete: (blobs: Blob[]) => Promise<void> | void;
  onFallbackFiles: (files: File[]) => void;
}

interface Shot {
  blob: Blob;
  url: string;
}

export function CameraModal({ onClose, onComplete, onFallbackFiles }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shotsRef = useRef<Shot[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.getUserMedia(documentCameraConstraints)
      .then(async (stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        const capabilities = await configureDocumentCamera(track);
        setTorchAvailable(Boolean(capabilities?.torch));
      })
      .catch(() => setError('Camera access was denied or is unavailable. Use the system camera or choose files instead.'));
    return () => {
      active = false;
      stopCamera();
      shotsRef.current.forEach((shot) => URL.revokeObjectURL(shot.url));
    };
  }, [stopCamera]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!video || !track) return;
    const blob = await captureDocumentPhoto(video, track);
    if (!blob) return;
    setShots((current) => [...current, { blob, url: URL.createObjectURL(blob) }]);
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await setCameraTorch(track, next);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  const removeLast = () => {
    setShots((current) => {
      const last = current[current.length - 1];
      if (last) URL.revokeObjectURL(last.url);
      return current.slice(0, -1);
    });
  };

  return (
    <div className="modal-backdrop camera-backdrop" role="dialog" aria-modal="true" aria-label="Document camera">
      <div className="camera-shell">
        <div className="camera-header">
          <IconButton label="Close camera" onClick={() => { stopCamera(); onClose(); }}><X /></IconButton>
          <span>{shots.length ? `${shots.length} page${shots.length === 1 ? '' : 's'} captured` : 'Align the document'}</span>
          {torchAvailable ? (
            <IconButton label={torchOn ? 'Turn flash off' : 'Turn flash on'} onClick={toggleTorch} active={torchOn}>
              {torchOn ? <Zap /> : <ZapOff />}
            </IconButton>
          ) : <span className="camera-header-spacer" />}
        </div>

        <div className="camera-viewport">
          {error ? (
            <div className="camera-error">
              <Camera size={34} />
              <p>{error}</p>
              <FileImportButton compact onFiles={(files) => { onFallbackFiles(files); onClose(); }} />
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay muted playsInline />
              <div className="camera-guide" aria-hidden="true" />
            </>
          )}
        </div>

        {shots.length > 0 && (
          <div className="camera-shots" aria-label="Captured pages">
            {shots.map((shot, index) => <img key={shot.url} src={shot.url} alt={`Captured page ${index + 1}`} />)}
          </div>
        )}

        <div className="camera-controls">
          <IconButton label="Remove last capture" onClick={removeLast} disabled={!shots.length}><RotateCcw /></IconButton>
          <button className="shutter" onClick={capture} disabled={Boolean(error)} aria-label="Capture page"><span /></button>
          <button
            className="camera-done"
            disabled={!shots.length || finishing}
            onClick={async () => {
              setFinishing(true);
              stopCamera();
              await onComplete(shots.map((shot) => shot.blob));
              onClose();
            }}
          >
            {finishing ? <ImagePlus size={20} /> : <Check size={20} />}
            <span>{finishing ? 'Adding' : 'Done'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
