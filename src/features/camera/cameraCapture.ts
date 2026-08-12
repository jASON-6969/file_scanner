const MAX_CAPTURE_WIDTH = 4096;
const MAX_CAPTURE_HEIGHT = 3072;

interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
  focusMode?: string[];
  torch?: boolean;
}

interface ExtendedTrackConstraintSet extends MediaTrackConstraintSet {
  focusMode?: string;
  torch?: boolean;
}

interface ImageCaptureInstance {
  takePhoto: () => Promise<Blob>;
}

type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureInstance;

export const documentCameraConstraints: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: MAX_CAPTURE_WIDTH },
    height: { ideal: MAX_CAPTURE_HEIGHT },
  },
};

export async function configureDocumentCamera(track: MediaStreamTrack): Promise<ExtendedTrackCapabilities> {
  track.contentHint = 'detail';
  const capabilities = (track.getCapabilities?.() ?? {}) as ExtendedTrackCapabilities;
  const advanced: ExtendedTrackConstraintSet[] = [];

  if (capabilities.focusMode?.includes('continuous')) {
    advanced.push({ focusMode: 'continuous' });
  }

  const width = capabilities.width?.max
    ? { ideal: Math.min(capabilities.width.max, MAX_CAPTURE_WIDTH) }
    : undefined;
  const height = capabilities.height?.max
    ? { ideal: Math.min(capabilities.height.max, MAX_CAPTURE_HEIGHT) }
    : undefined;

  if (width || height || advanced.length) {
    try {
      await track.applyConstraints({ width, height, advanced });
    } catch {
      // The initial stream remains usable when optional camera tuning is rejected.
    }
  }

  return capabilities;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
}

export async function captureDocumentPhoto(video: HTMLVideoElement, track: MediaStreamTrack): Promise<Blob | null> {
  const imageCapture = (globalThis as typeof globalThis & { ImageCapture?: ImageCaptureConstructor }).ImageCapture;

  if (imageCapture) {
    try {
      const blob = await new imageCapture(track).takePhoto();
      if (blob.size > 0) return blob;
    } catch {
      // Safari and some Android browsers expose partial ImageCapture support.
    }
  }

  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvasToJpeg(canvas);
}

export async function setCameraTorch(track: MediaStreamTrack, enabled: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: enabled } as ExtendedTrackConstraintSet] });
}
