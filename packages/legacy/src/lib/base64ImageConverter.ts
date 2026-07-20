export type Base64ImageInfo = {
  dataUrl: string;
  base64: string;
  mimeType: string;
};

const dataUrlPattern = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i;

export function parseBase64ImageInput(input: string, fallbackMimeType: string): Base64ImageInfo {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("empty");
  }

  const dataUrlMatch = trimmed.match(dataUrlPattern);
  const mimeType = dataUrlMatch?.[1] ?? fallbackMimeType;
  const base64 = (dataUrlMatch?.[2] ?? trimmed).replace(/\s/g, "");

  if (!/^image\//i.test(mimeType)) {
    throw new Error("invalid-mime");
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new Error("invalid-base64");
  }

  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    base64,
    mimeType,
  };
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
