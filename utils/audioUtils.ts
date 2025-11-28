

import { TimelineClip } from '../types';

/**
 * Decodes a base64 string into an ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts a Blob to a Base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix (e.g. "data:audio/wav;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Creates a WAV file header for the PCM data.
 * Gemini TTS returns raw PCM (16-bit, 24kHz, Mono).
 */
export function createWavBlob(pcmData: ArrayBuffer, sampleRate: number = 24000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  
  const bytes = new Uint8Array(pcmData);
  const dataLength = bytes.length;
  
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeWavHeader(view, dataLength, sampleRate, numChannels, bitsPerSample);

  // Write the PCM data
  new Uint8Array(buffer, 44).set(bytes);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Processes an audio blob (WAV) to apply playback speed using OfflineAudioContext,
 * then returns a new WAV Blob.
 */
export async function processAudioBlob(audioUrl: string, speed: number): Promise<Blob> {
  // 1. Fetch the audio data
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();

  // If speed is 1.0, return original file to avoid re-encoding loss/overhead
  if (speed === 1.0) {
     return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  // 2. Decode the audio
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // 3. Process with OfflineAudioContext
  // Calculate new duration
  const newDuration = audioBuffer.duration / speed;
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(newDuration * audioBuffer.sampleRate),
    audioBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.playbackRate.value = speed;
  source.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();

  // 4. Encode back to WAV
  return audioBufferToWav(renderedBuffer);
}

/**
 * Mixes multiple tracks of audio into a single WAV file.
 * Clips in the same track play sequentially.
 * Clips in different tracks play in parallel (mixed).
 */
export async function mixAudioTracks(timeline: TimelineClip[]): Promise<Blob> {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = 24000; // Standardize sample rate

    // 1. Group clips by track ID to determine sequence
    const tracks: Record<string, TimelineClip[]> = {};
    timeline.forEach(clip => {
        if (!tracks[clip.trackId]) tracks[clip.trackId] = [];
        tracks[clip.trackId].push(clip);
    });

    // 2. Load all audio buffers
    // We map instanceId -> AudioBuffer
    const bufferMap = new Map<string, AudioBuffer>();
    
    for (const clip of timeline) {
        const response = await fetch(clip.audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        bufferMap.set(clip.instanceId, decoded);
    }

    // 3. Calculate start times and total duration
    // In this "sequencer" model:
    // Track 1: [Clip A (dur 5s)] [Gap 2s] [Clip B (dur 3s)] -> Total 10s. Clip B starts at 7s.
    // Track 2: [Clip C (dur 10s)] -> Total 10s. Clip C starts at 0s.
    // Max Duration = 10s.

    let maxDuration = 0;
    const clipPlacements: { buffer: AudioBuffer, startTime: number }[] = [];

    Object.values(tracks).forEach(trackClips => {
        // Sort by visual order (if they aren't already) - Use the array order as the sequence
        // Note: The useTimeline hook should generally keep them sorted by index/order
        let currentTrackTime = 0;
        
        trackClips.forEach(clip => {
            // Apply delay/offset before the clip starts
            currentTrackTime += (clip.startOffset || 0);

            const buffer = bufferMap.get(clip.instanceId);
            if (buffer) {
                clipPlacements.push({
                    buffer: buffer,
                    startTime: currentTrackTime
                });
                currentTrackTime += buffer.duration;
            }
        });

        if (currentTrackTime > maxDuration) {
            maxDuration = currentTrackTime;
        }
    });

    if (maxDuration === 0) {
        // Return a minimal silent blob if empty
        const emptyBuffer = audioCtx.createBuffer(1, sampleRate, sampleRate);
        return audioBufferToWav(emptyBuffer);
    }

    // 4. Create OfflineAudioContext to render the mix
    // We add a small buffer (0.5s) to ensure tails aren't cut off abruptly
    const offlineCtx = new OfflineAudioContext(
        1, // Mono output
        Math.ceil((maxDuration + 0.1) * sampleRate),
        sampleRate
    );

    // 5. Schedule all sources
    clipPlacements.forEach(placement => {
        const source = offlineCtx.createBufferSource();
        source.buffer = placement.buffer;
        source.connect(offlineCtx.destination);
        source.start(placement.startTime);
    });

    // 6. Render
    const renderedBuffer = await offlineCtx.startRendering();

    // 7. Encode to WAV
    return audioBufferToWav(renderedBuffer);
}

/**
 * Encodes an AudioBuffer (Float32) to a WAV Blob (Int16)
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  let result;
  // Interleave channels
  if (numChannels === 2) {
      result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
      result = buffer.getChannelData(0);
  }

  const dataLength = result.length * 2; // 2 bytes per sample
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  writeWavHeader(view, dataLength, sampleRate, numChannels, bitDepth);

  // Write audio data
  floatTo16BitPCM(view, 44, result);

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array) {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);

  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function writeWavHeader(view: DataView, dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number) {
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + dataLength, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  /* bits per sample */
  view.setUint16(34, bitsPerSample, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, dataLength, true);
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
