import JSZip from "jszip";
import type { ProcessedOutput, ResolvedInput, ToolProcessor } from "./types";

const encoder = new TextEncoder();
function stem(name: string): string { return name.replace(/\.[^/.]+$/, ""); }
function stringOption(options: Record<string, unknown>, key: string, fallback: string): string { return typeof options[key] === "string" ? options[key] as string : fallback; }
function numberOption(options: Record<string, unknown>, key: string, fallback: number): number { return typeof options[key] === "number" && Number.isFinite(options[key]) ? options[key] as number : fallback; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function output(input: ResolvedInput, data: Uint8Array, name: string, mimeType: string): ProcessedOutput { return { name, data, mimeType }; }
async function zipFiles(files: Array<{ name: string; data: Uint8Array }>): Promise<Uint8Array> { const zip = new JSZip(); for (const file of files) zip.file(file.name, file.data); return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }); }

function writeWav(samples: Float32Array, sampleRate: number, channels = 1, bitDepth = 16): Uint8Array {
  const bytesPerSample = bitDepth <= 8 ? 1 : bitDepth <= 16 ? 2 : 4; const blockAlign = channels * bytesPerSample; const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize); const view = new DataView(buffer);
  const ascii = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); ascii(8, "WAVE"); ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, bitDepth <= 8 ? 8 : bitDepth <= 16 ? 16 : 32, true); ascii(36, "data"); view.setUint32(40, dataSize, true);
  for (let index = 0; index < samples.length; index += 1) { const value = clamp(samples[index] ?? 0, -1, 1); const offset = 44 + index * bytesPerSample; if (bytesPerSample === 1) view.setUint8(offset, Math.round((value + 1) * 127.5)); else if (bytesPerSample === 2) view.setInt16(offset, value < 0 ? Math.round(value * 32768) : Math.round(value * 32767), true); else view.setInt32(offset, value < 0 ? Math.round(value * 2_147_483_648) : Math.round(value * 2_147_483_647), true); }
  return new Uint8Array(buffer);
}

function generateSfx(options: Record<string, unknown>): Uint8Array {
  const sampleRate = [22050, 44100, 48000].includes(numberOption(options, "sampleRate", 44100)) ? numberOption(options, "sampleRate", 44100) : 44100;
  const duration = clamp(numberOption(options, "duration", 0.16), 0.01, 10); const length = Math.max(1, Math.floor(sampleRate * duration)); const start = clamp(numberOption(options, "startFrequency", 880), 20, 20000); const end = clamp(numberOption(options, "endFrequency", 520), 20, 20000); const volume = clamp(numberOption(options, "volume", 0.55), 0, 1); const waveform = stringOption(options, "waveform", "square"); const channels = stringOption(options, "channels", "mono") === "stereo" ? 2 : 1; const pan = clamp(numberOption(options, "pan", 0), -1, 1); const seedText = stringOption(options, "seed", "retro"); let seed = Math.abs([...seedText].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 7)) || 1; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const mono = new Float32Array(length); let phase = 0; let crushed = 0;
  const attack = Math.max(0.001, numberOption(options, "attack", 0.004)); const decay = Math.max(0.001, numberOption(options, "decay", 0.045)); const sustain = clamp(numberOption(options, "sustain", 0.25), 0, 1); const release = Math.max(0.001, numberOption(options, "release", 0.055)); const noiseAmount = clamp(numberOption(options, "noiseAmount", 0), 0, 1); const pitchSlide = numberOption(options, "pitchSlide", 0); const sampleRateCrush = Math.max(1, Math.round(numberOption(options, "sampleRateCrush", 1))); const vibratoDepth = clamp(numberOption(options, "vibratoDepth", 0), 0, 1); const vibratoSpeed = Math.max(0, numberOption(options, "vibratoSpeed", 12)); const tremoloDepth = clamp(numberOption(options, "tremoloDepth", numberOption(options, "tremolo", 0)), 0, 1); const tremoloSpeed = Math.max(0, numberOption(options, "tremoloSpeed", 18));
  for (let frame = 0; frame < length; frame += 1) { const time = frame / sampleRate; const progress = frame / Math.max(1, length - 1); const slideProgress = clamp(progress + pitchSlide * progress * (1 - progress), 0, 1); let frequency = start + (end - start) * slideProgress; frequency *= 1 + Math.sin(time * Math.PI * 2 * vibratoSpeed) * vibratoDepth; if (sampleRateCrush > 1 && frame % sampleRateCrush !== 0) { mono[frame] = crushed; continue; } phase += frequency / sampleRate; const cycle = phase % 1; let wave = waveform === "sine" ? Math.sin(cycle * Math.PI * 2) : waveform === "triangle" ? 1 - 4 * Math.abs(Math.round(cycle) - cycle) : waveform === "sawtooth" ? cycle * 2 - 1 : waveform === "noise" ? random() * 2 - 1 : cycle < 0.5 ? 1 : -1; if (waveform === "mixed") wave = wave * 0.7 + Math.sin(cycle * Math.PI * 4) * 0.3; wave = wave * (1 - noiseAmount) + (random() * 2 - 1) * noiseAmount; const envelope = time < attack ? time / attack : time < attack + decay ? 1 - (1 - sustain) * ((time - attack) / decay) : time >= duration - release ? sustain * Math.max(0, (duration - time) / release) : sustain; const tremolo = tremoloDepth ? 1 - tremoloDepth / 2 + Math.sin(time * Math.PI * 2 * tremoloSpeed) * tremoloDepth / 2 : 1; crushed = clamp(wave * volume * envelope * tremolo, -1, 1); mono[frame] = crushed; }
  const distortion = clamp(numberOption(options, "distortion", 0), 0, 1); const lowPass = numberOption(options, "lowPass", 20000); const highPass = numberOption(options, "highPass", 20); let previous = 0; if (lowPass < sampleRate / 2 - 100) { const alpha = (1 / sampleRate) / (1 / (Math.PI * 2 * Math.max(20, lowPass)) + 1 / sampleRate); for (let index = 0; index < mono.length; index += 1) { previous += alpha * (mono[index]! - previous); mono[index] = previous; } } if (highPass > 20) { const alpha = (1 / (Math.PI * 2 * highPass)) / (1 / (Math.PI * 2 * highPass) + 1 / sampleRate); let lastInput = mono[0] ?? 0; let lastOutput = mono[0] ?? 0; for (let index = 0; index < mono.length; index += 1) { const next = alpha * (lastOutput + mono[index]! - lastInput); mono[index] = next; lastOutput = next; lastInput = mono[index]!; } } if (distortion > 0) for (let index = 0; index < mono.length; index += 1) mono[index] = Math.tanh(mono[index]! * (1 + distortion * 12));
  const fadeIn = Math.max(0, numberOption(options, "fadeIn", 0.002)); const fadeOut = Math.max(0, numberOption(options, "fadeOut", 0.018)); for (let index = 0; index < mono.length; index += 1) { let value = mono[index]!; if (fadeIn > 0 && index / sampleRate < fadeIn) value *= (index / sampleRate) / fadeIn; if (fadeOut > 0 && index / sampleRate > duration - fadeOut) value *= Math.max(0, (duration - index / sampleRate) / fadeOut); mono[index] = value; } if (options.reverse === true) mono.reverse();
  const samples = new Float32Array(length * channels); if (channels === 1) samples.set(mono); else { const stereoWidth = clamp(numberOption(options, "stereoWidth", 0), 0, 1); const angle = (pan + 1) * Math.PI / 4; const leftGain = Math.cos(angle); const rightGain = Math.sin(angle); for (let index = 0; index < length; index += 1) { const value = mono[index]!; samples[index * 2] = value * (1 - stereoWidth * 0.25) * leftGain; samples[index * 2 + 1] = value * (1 - stereoWidth * 0.25) * rightGain; } }
  const bitDepth = Math.round(numberOption(options, "bitDepth", 16)); if (bitDepth < 16) { const levels = 2 ** Math.max(1, Math.min(16, bitDepth)); for (let index = 0; index < samples.length; index += 1) samples[index] = Math.round(samples[index]! * (levels / 2)) / (levels / 2); }
  return writeWav(samples, sampleRate, channels, bitDepth <= 8 ? 8 : bitDepth <= 16 ? 16 : 32);
}

export const audioProcessor: ToolProcessor = async (input, options, context) => {
  const operation = stringOption(options, "operation", "export");
  if (operation === "sfx") return [output(input, generateSfx(options), `${stem(input.name)}_sfx.wav`, "audio/wav")];
  if (!context.mediaCodec || !input.sourcePath) throw new Error("FFmpeg 프로세스가 필요합니다. 입력 파일 경로를 확인하세요.");
  if (operation === "analysis") return [output(input, new TextEncoder().encode(JSON.stringify({ file: input.name, bytes: input.size ?? 0, extension: input.name.split(".").pop()?.toLowerCase() ?? "" }, null, 2)), `${stem(input.name)}_analysis.json`, "application/json;charset=utf-8")];
  await context.waitIfPaused?.();
  const outputFormatValue = stringOption(options, "outputFormat", "wav"); const outputFormat = ["wav", "mp3", "flac", "ogg", "m4a"].includes(outputFormatValue) ? outputFormatValue : "wav";
  const convertOptions: Record<string, unknown> = { outputFormat };
  if (operation === "trim") { convertOptions.start = Math.max(0, numberOption(options, "start", 0)); convertOptions.duration = Math.max(0.01, numberOption(options, "duration", 1)); }
  if (operation === "delete") { convertOptions.deleteStart = Math.max(0, numberOption(options, "start", 0)); convertOptions.deleteEnd = Math.max(numberOption(options, "start", 0), numberOption(options, "start", 0) + numberOption(options, "duration", 1)); }
  if (operation === "volume") convertOptions.volumeDb = numberOption(options, "volumeDb", 0);
  if (operation === "fade") { convertOptions.fadeDirection = stringOption(options, "fadeDirection", "in"); convertOptions.fadeSeconds = Math.max(0.01, numberOption(options, "fadeSeconds", 1)); }
  if (operation === "speed") convertOptions.speed = clamp(numberOption(options, "speed", 1), 0.25, 4);
  if (operation === "channel") convertOptions.channels = stringOption(options, "channelMode", "stereo");
  if (operation === "silence") { convertOptions.silenceThresholdDb = numberOption(options, "silenceThresholdDb", -45); convertOptions.silenceDuration = numberOption(options, "silenceMinDuration", 0.2); }
  if (operation === "loop") convertOptions.loopCount = Math.max(1, Math.min(20, Math.round(numberOption(options, "loopCount", 2))));
  if (operation === "normalize" || options.normalize === true) convertOptions.normalize = true;
  if (operation === "reverse" || options.reverse === true) convertOptions.reverse = true;
  if (numberOption(options, "sampleRate", 0) > 0) convertOptions.sampleRate = numberOption(options, "sampleRate", 44100);
  if (numberOption(options, "bitrate", 0) > 0) convertOptions.bitrate = numberOption(options, "bitrate", 192);
  const converted = await context.mediaCodec.convertFile(input.sourcePath, convertOptions);
  return [{ filePath: converted.filePath, size: converted.size, name: `${stem(input.name)}_${operation}.${converted.extension}`, mimeType: converted.mimeType }];
};

export const retroSfxProcessor: ToolProcessor = async (input, options) => {
  const preset = stringOption(options, "preset", "");
  const presetOptions: Record<string, Record<string, unknown>> = {
    click: { waveform: "square", duration: 0.055, startFrequency: 1300, endFrequency: 720, sustain: 0.05, noiseAmount: 0.08 },
    hover: { waveform: "triangle", duration: 0.075, startFrequency: 520, endFrequency: 700, bitDepth: 12 },
    confirm: { waveform: "sine", duration: 0.16, startFrequency: 620, endFrequency: 1040, pitchSlide: 0.22, bitDepth: 12 },
    cancel: { waveform: "triangle", duration: 0.15, startFrequency: 520, endFrequency: 220, pitchSlide: -0.25 },
    error: { waveform: "square", duration: 0.24, startFrequency: 230, endFrequency: 170, tremoloDepth: 0.25, noiseAmount: 0.08 },
    notice: { waveform: "sine", duration: 0.22, startFrequency: 780, endFrequency: 1040, bitDepth: 14 },
    menuMove: { waveform: "square", duration: 0.08, startFrequency: 360, endFrequency: 480, sustain: 0.18 },
    select: { waveform: "mixed", duration: 0.12, startFrequency: 700, endFrequency: 930, noiseAmount: 0.02 },
    popupOpen: { waveform: "triangle", duration: 0.2, startFrequency: 320, endFrequency: 760, pitchSlide: 0.35 },
    popupClose: { waveform: "triangle", duration: 0.18, startFrequency: 760, endFrequency: 260, pitchSlide: -0.35 },
    coin: { waveform: "sine", duration: 0.23, startFrequency: 920, endFrequency: 1720, pitchSlide: 0.42, bitDepth: 10 },
    jump: { waveform: "square", duration: 0.22, startFrequency: 280, endFrequency: 780, pitchSlide: 0.45 },
    hit: { waveform: "mixed", duration: 0.13, startFrequency: 180, endFrequency: 80, noiseAmount: 0.35, pitchSlide: -0.28 },
    attack: { waveform: "sawtooth", duration: 0.18, startFrequency: 420, endFrequency: 960, distortion: 0.24 },
    shield: { waveform: "triangle", duration: 0.22, startFrequency: 420, endFrequency: 300, vibratoDepth: 0.08, bitDepth: 12 },
    item: { waveform: "sine", duration: 0.28, startFrequency: 600, endFrequency: 1320, pitchSlide: 0.35, bitDepth: 12 },
    powerup: { waveform: "triangle", duration: 0.55, startFrequency: 360, endFrequency: 1280, pitchSlide: 0.55, tremoloDepth: 0.16 },
    levelup: { waveform: "sine", duration: 0.72, startFrequency: 440, endFrequency: 1760, pitchSlide: 0.6, bitDepth: 14 },
    bullet: { waveform: "square", duration: 0.08, startFrequency: 1100, endFrequency: 520, noiseAmount: 0.2, distortion: 0.25 },
    laser: { waveform: "sawtooth", duration: 0.34, startFrequency: 1800, endFrequency: 210, pitchSlide: -0.72, distortion: 0.18 },
    explosion: { waveform: "noise", duration: 0.72, startFrequency: 120, endFrequency: 42, noiseAmount: 0.92, distortion: 0.32, lowPass: 2600 },
    smallExplosion: { waveform: "noise", duration: 0.34, startFrequency: 170, endFrequency: 60, noiseAmount: 0.78, distortion: 0.24, lowPass: 3200 },
    doorOpen: { waveform: "sawtooth", duration: 0.36, startFrequency: 160, endFrequency: 480, noiseAmount: 0.12, sampleRateCrush: 5 },
    unlock: { waveform: "triangle", duration: 0.24, startFrequency: 620, endFrequency: 1180, pitchSlide: 0.3 },
    typing: { waveform: "square", duration: 0.045, startFrequency: 920, endFrequency: 740, noiseAmount: 0.14 },
    quest: { waveform: "sine", duration: 0.48, startFrequency: 520, endFrequency: 1420, pitchSlide: 0.42, tremoloDepth: 0.1 },
    eightBitSquare: { waveform: "square", duration: 0.18, startFrequency: 660, endFrequency: 660, bitDepth: 6, sampleRateCrush: 5 },
    eightBitNoise: { waveform: "noise", duration: 0.28, noiseAmount: 1, bitDepth: 5, lowPass: 3600 },
    sixteenBitSoft: { waveform: "triangle", duration: 0.38, bitDepth: 16, sampleRateCrush: 1, attack: 0.018, release: 0.16, stereoWidth: 0.2 },
    arcade: { waveform: "mixed", duration: 0.32, startFrequency: 720, endFrequency: 360, bitDepth: 8, distortion: 0.14 },
    famicom: { waveform: "square", duration: 0.25, bitDepth: 6, sampleRateCrush: 6, startFrequency: 880, endFrequency: 440 },
    gameboy: { waveform: "square", duration: 0.32, bitDepth: 8, sampleRateCrush: 8, lowPass: 4200 },
    dos: { waveform: "square", duration: 0.18, bitDepth: 5, sampleRateCrush: 10, startFrequency: 440, endFrequency: 440 },
    chiptuneNotice: { waveform: "sine", duration: 0.36, bitDepth: 10, startFrequency: 740, endFrequency: 1480, tremoloDepth: 0.12 },
  };
  const base = { ...presetOptions[preset] ?? {}, ...options };
  if (stringOption(base, "outputMode", "wav") === "json" || stringOption(base, "mode", "wav") === "json") return [output(input, encoder.encode(JSON.stringify({ version: 1, tool: "retro-sfx-generator", options: base }, null, 2)), `${stem(input.name)}_retro-sfx.json`, "application/json;charset=utf-8")];
  const variants = Math.max(1, Math.min(32, Math.round(numberOption(base, "variants", 1))));
  if (variants > 1) { const files: Array<{ name: string; data: Uint8Array }> = []; const seed = stringOption(base, "seed", "retro"); for (let index = 0; index < variants; index += 1) files.push({ name: `${stem(input.name)}-${String(index + 1).padStart(2, "0")}.wav`, data: generateSfx({ ...base, seed: `${seed}-${index + 1}` }) }); return [output(input, await zipFiles(files), `${stem(input.name)}_retro-sfx-variants.zip`, "application/zip")]; }
  return [output(input, generateSfx(base), `${stem(input.name)}_retro-sfx.wav`, "audio/wav")];
};

export const videoProcessor: ToolProcessor = async (input, options, context) => {
  if (!context.mediaCodec || !input.sourcePath) throw new Error("FFmpeg 실행 파일이 없습니다. SUWOL_FFMPEG_PATH 또는 패키지 리소스를 설정하세요.");
  await context.waitIfPaused?.();
  const outputFormat = stringOption(options, "outputFormat", "gif") === "webp" ? "webp" : "gif";
  const converted = await context.mediaCodec.convertFile(input.sourcePath, { outputFormat, fps: numberOption(options, "fps", 12), width: numberOption(options, "width", 640), height: numberOption(options, "height", 0), keepAspectRatio: options.keepAspectRatio !== false, start: Math.max(0, numberOption(options, "start", 0)), duration: Math.min(30, Math.max(0.1, numberOption(options, "duration", 10))), preset: stringOption(options, "preset", "default"), quality: numberOption(options, "quality", 80), loop: options.loop !== false, rotate: numberOption(options, "rotate", 0), crop: options.crop });
  return [{ filePath: converted.filePath, size: converted.size, name: `${stem(input.name)}${numberOption(options, "start", 0) > 0 ? "-clip" : ""}.${converted.extension}`, mimeType: converted.mimeType }];
};
