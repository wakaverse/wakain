/**
 * Browser-side video compression to 480p using Mediabunny (WebCodecs).
 * Falls back to returning the original file if WebCodecs is unsupported.
 */
import {
  Conversion,
  Input,
  Output,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,
  ALL_FORMATS,
} from 'mediabunny';

const TARGET_HEIGHT = 480;
const TARGET_BITRATE = 1_500_000; // 1.5 Mbps — good quality for 480p

export type CompressProgress = {
  phase: 'compressing' | 'done' | 'skipped';
  progress: number; // 0-1
};

/**
 * Check if browser supports WebCodecs (needed for Mediabunny transcoding).
 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof globalThis.VideoEncoder === 'function' &&
    typeof globalThis.VideoDecoder === 'function'
  );
}

/**
 * Compress a video file to 480p MP4.
 * Returns compressed File if successful, or original File if:
 *  - WebCodecs not supported
 *  - Video is already ≤480p
 *  - Any error occurs (graceful fallback)
 */
export async function compressTo480p(
  file: File,
  onProgress?: (p: CompressProgress) => void,
): Promise<File> {
  // Fallback: no WebCodecs support
  if (!isWebCodecsSupported()) {
    console.warn('[videoCompress] WebCodecs not supported, skipping compression');
    onProgress?.({ phase: 'skipped', progress: 1 });
    return file;
  }

  try {
    onProgress?.({ phase: 'compressing', progress: 0 });

    const source = new BlobSource(file);
    const input = new Input({ formats: ALL_FORMATS, source });

    // Check video dimensions
    const tracks = await input.getTracks();
    const videoTrack = tracks.find((t) => t.type === 'video');
    if (!videoTrack || !('displayHeight' in videoTrack)) {
      console.warn('[videoCompress] No video track found, skipping');
      onProgress?.({ phase: 'skipped', progress: 1 });
      return file;
    }

    const vt = videoTrack as unknown as { displayHeight: number; displayWidth: number };
    if (vt.displayHeight <= TARGET_HEIGHT) {
      console.log(`[videoCompress] Already ${vt.displayHeight}p, skipping`);
      onProgress?.({ phase: 'skipped', progress: 1 });
      return file;
    }

    console.log(`[videoCompress] ${vt.displayWidth}x${vt.displayHeight} → 480p`);

    // Set up output
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });

    // Create conversion
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        height: TARGET_HEIGHT,
        codec: 'avc', // H.264 for maximum compatibility
        bitrate: TARGET_BITRATE,
      },
      audio: {
        codec: 'aac',
        bitrate: 128_000,
      },
    });

    conversion.onProgress = (p) => {
      onProgress?.({ phase: 'compressing', progress: p });
    };

    await conversion.execute();

    const buffer = target.buffer;
    if (!buffer) {
      console.warn('[videoCompress] No output buffer, falling back to original');
      onProgress?.({ phase: 'skipped', progress: 1 });
      return file;
    }

    // Build new File
    const ext = file.name.replace(/\.[^.]+$/, '');
    const compressed = new File(
      [buffer],
      `${ext}_480p.mp4`,
      { type: 'video/mp4' },
    );

    const ratio = ((1 - compressed.size / file.size) * 100).toFixed(0);
    console.log(
      `[videoCompress] ${(file.size / 1e6).toFixed(1)}MB → ${(compressed.size / 1e6).toFixed(1)}MB (${ratio}% smaller)`,
    );

    onProgress?.({ phase: 'done', progress: 1 });
    return compressed;
  } catch (err) {
    console.error('[videoCompress] Compression failed, using original:', err);
    onProgress?.({ phase: 'skipped', progress: 1 });
    return file;
  }
}
