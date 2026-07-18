/**
 * Method A: realtime preview recording (design spec §11.2). Thin wrapper
 * over `canvas.captureStream()` + `MediaRecorder` — inherently variable
 * frame rate, tied to whatever the display loop actually renders, so it's
 * documented as preview-only, never a source of reproducible frames.
 */
export interface RealtimeRecording {
  stop(): Promise<Blob>;
}

export function startRealtimeRecording(canvas: HTMLCanvasElement, mimeType = 'video/webm'): RealtimeRecording {
  const stream = canvas.captureStream();
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined);
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  return {
    stop(): Promise<Blob> {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          for (const track of stream.getTracks()) track.stop();
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
        };
        recorder.stop();
      });
    },
  };
}
