import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureDocumentPhoto, documentCameraConstraints } from './cameraCapture';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('document camera capture', () => {
  it('requests a high-resolution rear camera stream', () => {
    expect(documentCameraConstraints).toEqual({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 4096 },
        height: { ideal: 3072 },
      },
    });
  });

  it('uses the full-resolution ImageCapture photo when supported', async () => {
    const photo = new Blob(['full-resolution'], { type: 'image/jpeg' });
    const takePhoto = vi.fn().mockResolvedValue(photo);
    vi.stubGlobal('ImageCapture', class {
      takePhoto = takePhoto;
    });

    const result = await captureDocumentPhoto(document.createElement('video'), {} as MediaStreamTrack);

    expect(takePhoto).toHaveBeenCalledOnce();
    expect(result).toBe(photo);
  });

  it('falls back to the video frame when ImageCapture is unavailable', async () => {
    vi.stubGlobal('ImageCapture', undefined);
    const fallback = new Blob(['video-frame'], { type: 'image/jpeg' });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(fallback));

    const video = document.createElement('video');
    Object.defineProperties(video, {
      videoWidth: { value: 1920 },
      videoHeight: { value: 1080 },
    });

    const result = await captureDocumentPhoto(video, {} as MediaStreamTrack);

    expect(drawImage).toHaveBeenCalledOnce();
    expect(result).toBe(fallback);
  });
});
