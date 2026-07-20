import { bytesToCompactHex } from "./encoding";

export type ShaAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export type HmacAlgorithm =
  | "HMAC-SHA1"
  | "HMAC-SHA256"
  | "HMAC-SHA384"
  | "HMAC-SHA512";

export type HashAlgorithmGroup =
  | "common"
  | "sha2"
  | "sha3"
  | "keccak"
  | "blake"
  | "legacy"
  | "checksum";

export type HashAlgorithmId =
  | "md5"
  | "sha1"
  | "sha224"
  | "sha256"
  | "sha384"
  | "sha512"
  | "sha3-224"
  | "sha3-256"
  | "sha3-384"
  | "sha3-512"
  | "keccak-256"
  | "ripemd-160"
  | "blake2b"
  | "blake2s"
  | "blake3"
  | "crc32"
  | "crc32c"
  | "adler32"
  | "xxhash32"
  | "xxhash64";

export type HashOutputFormat = "hex-lower" | "hex-upper" | "base64";

export type HashAlgorithmMeta = {
  id: HashAlgorithmId;
  label: string;
  group: HashAlgorithmGroup;
  outputBits: number;
  insecure?: boolean;
  checksum?: boolean;
};

const encoder = new TextEncoder();
const textDecoder = new TextDecoder();
const MASK_32 = 0xffffffff;
const MASK_64 = 0xffffffffffffffffn;

const hmacHashNames: Record<HmacAlgorithm, ShaAlgorithm> = {
  "HMAC-SHA1": "SHA-1",
  "HMAC-SHA256": "SHA-256",
  "HMAC-SHA384": "SHA-384",
  "HMAC-SHA512": "SHA-512",
};

const webCryptoNames: Partial<Record<HashAlgorithmId, ShaAlgorithm>> = {
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
};

export const hashAlgorithms: HashAlgorithmMeta[] = [
  { id: "md5", label: "MD5", group: "common", outputBits: 128, insecure: true },
  { id: "sha1", label: "SHA-1", group: "common", outputBits: 160, insecure: true },
  { id: "sha256", label: "SHA-256", group: "common", outputBits: 256 },
  { id: "sha512", label: "SHA-512", group: "common", outputBits: 512 },
  { id: "sha224", label: "SHA-224", group: "sha2", outputBits: 224 },
  { id: "sha384", label: "SHA-384", group: "sha2", outputBits: 384 },
  { id: "sha3-224", label: "SHA3-224", group: "sha3", outputBits: 224 },
  { id: "sha3-256", label: "SHA3-256", group: "sha3", outputBits: 256 },
  { id: "sha3-384", label: "SHA3-384", group: "sha3", outputBits: 384 },
  { id: "sha3-512", label: "SHA3-512", group: "sha3", outputBits: 512 },
  { id: "keccak-256", label: "Keccak-256", group: "keccak", outputBits: 256 },
  { id: "blake2b", label: "BLAKE2b", group: "blake", outputBits: 512 },
  { id: "blake2s", label: "BLAKE2s", group: "blake", outputBits: 256 },
  { id: "blake3", label: "BLAKE3", group: "blake", outputBits: 256 },
  { id: "ripemd-160", label: "RIPEMD-160", group: "legacy", outputBits: 160 },
  { id: "crc32", label: "CRC32", group: "checksum", outputBits: 32, checksum: true },
  { id: "crc32c", label: "CRC32C", group: "checksum", outputBits: 32, checksum: true },
  { id: "adler32", label: "Adler-32", group: "checksum", outputBits: 32, checksum: true },
  { id: "xxhash32", label: "xxHash32", group: "checksum", outputBits: 32, checksum: true },
  { id: "xxhash64", label: "xxHash64", group: "checksum", outputBits: 64, checksum: true },
];

export const defaultSelectedHashAlgorithms: HashAlgorithmId[] = [
  "md5",
  "sha1",
  "sha256",
  "sha512",
];

export const hashAlgorithmGroups: HashAlgorithmGroup[] = [
  "common",
  "sha2",
  "sha3",
  "keccak",
  "blake",
  "legacy",
  "checksum",
];

export const shaAlgorithms: ShaAlgorithm[] = [
  "SHA-1",
  "SHA-256",
  "SHA-384",
  "SHA-512",
];

export const hmacAlgorithms: HmacAlgorithm[] = [
  "HMAC-SHA1",
  "HMAC-SHA256",
  "HMAC-SHA384",
  "HMAC-SHA512",
];

function assertWebCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available in this browser context.");
  }
}

function rotateLeft(value: number, shift: number) {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function rotateRight(value: number, shift: number) {
  return ((value >>> shift) | (value << (32 - shift))) >>> 0;
}

function add32(...values: number[]) {
  return values.reduce((sum, value) => (sum + value) >>> 0, 0);
}

function readU32Le(data: Uint8Array, offset: number) {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

function readU32Be(data: Uint8Array, offset: number) {
  return (
    (data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]
  ) >>> 0;
}

function readU64Be(data: Uint8Array, offset: number) {
  let value = 0n;

  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) | BigInt(data[offset + index]);
  }

  return value;
}

function writeU32Le(output: Uint8Array, offset: number, value: number) {
  output[offset] = value & 0xff;
  output[offset + 1] = (value >>> 8) & 0xff;
  output[offset + 2] = (value >>> 16) & 0xff;
  output[offset + 3] = (value >>> 24) & 0xff;
}

function writeU32Be(output: Uint8Array, offset: number, value: number) {
  output[offset] = (value >>> 24) & 0xff;
  output[offset + 1] = (value >>> 16) & 0xff;
  output[offset + 2] = (value >>> 8) & 0xff;
  output[offset + 3] = value & 0xff;
}

function writeU64Le(output: Uint8Array, offset: number, value: bigint) {
  let nextValue = value & MASK_64;

  for (let index = 0; index < 8; index += 1) {
    output[offset + index] = Number(nextValue & 0xffn);
    nextValue >>= 8n;
  }
}

function writeU64Be(output: Uint8Array, offset: number, value: bigint) {
  let nextValue = value & MASK_64;

  for (let index = 7; index >= 0; index -= 1) {
    output[offset + index] = Number(nextValue & 0xffn);
    nextValue >>= 8n;
  }
}

function writeU64BeLength(output: Uint8Array, offset: number, bitLength: bigint) {
  let value = bitLength;

  for (let index = 7; index >= 0; index -= 1) {
    output[offset + index] = Number(value & 0xffn);
    value >>= 8n;
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

export function formatHashOutput(bytes: Uint8Array, format: HashOutputFormat) {
  const hex = bytesToCompactHex(bytes);

  if (format === "hex-upper") {
    return hex.toUpperCase();
  }

  if (format === "base64") {
    return bytesToBase64(bytes);
  }

  return hex;
}

export function compareHashValues(
  actual: string,
  expected: string,
  options: { ignoreCase: boolean; trimWhitespace: boolean },
) {
  const normalize = (value: string) => {
    const trimmedValue = options.trimWhitespace ? value.trim() : value;

    return options.ignoreCase ? trimmedValue.toLowerCase() : trimmedValue;
  };

  return normalize(actual) === normalize(expected);
}

async function digestWithWebCrypto(data: Uint8Array, algorithm: ShaAlgorithm) {
  assertWebCrypto();

  const digest = await crypto.subtle.digest(
    algorithm,
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  return new Uint8Array(digest);
}

export function isWebCryptoDigestAvailable() {
  const isBrowser = typeof window !== "undefined";
  const secureContext = !isBrowser || window.isSecureContext;

  return secureContext && Boolean(globalThis.crypto?.subtle);
}

function fallbackShaDigest(data: Uint8Array, algorithm: ShaAlgorithm) {
  switch (algorithm) {
    case "SHA-1":
      return sha1(data);
    case "SHA-256":
      return sha256(data);
    case "SHA-384":
      return sha384(data);
    case "SHA-512":
      return sha512(data);
    default:
      throw new Error("Unsupported hash algorithm.");
  }
}

async function digestSha(data: Uint8Array, algorithm: ShaAlgorithm) {
  if (isWebCryptoDigestAvailable()) {
    try {
      return await digestWithWebCrypto(data, algorithm);
    } catch {
      return fallbackShaDigest(data, algorithm);
    }
  }

  return fallbackShaDigest(data, algorithm);
}

function padMdLittleEndian(data: Uint8Array) {
  const bitLength = BigInt(data.length) * 8n;
  const paddingLength = (56 - ((data.length + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(data.length + 1 + paddingLength + 8);

  padded.set(data);
  padded[data.length] = 0x80;

  let nextLength = bitLength;
  for (let index = 0; index < 8; index += 1) {
    padded[padded.length - 8 + index] = Number(nextLength & 0xffn);
    nextLength >>= 8n;
  }

  return padded;
}

function md5(data: Uint8Array) {
  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const table = Array.from({ length: 64 }, (_, index) =>
    Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0,
  );
  const padded = padMdLittleEndian(data);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) =>
      readU32Le(padded, offset + index * 4),
    );
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let f = 0;
      let g = 0;

      if (index < 16) {
        f = (b & c) | (~b & d);
        g = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        g = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        g = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * index) % 16;
      }

      const nextD = c;
      const nextC = b;
      const nextB = add32(
        b,
        rotateLeft(add32(a, f >>> 0, table[index], words[g]), shifts[index]),
      );
      a = d;
      b = nextB;
      c = nextC;
      d = nextD;
    }

    a0 = add32(a0, a);
    b0 = add32(b0, b);
    c0 = add32(c0, c);
    d0 = add32(d0, d);
  }

  const output = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((word, index) => writeU32Le(output, index * 4, word));

  return output;
}

function sha1(data: Uint8Array) {
  const bitLength = BigInt(data.length) * 8n;
  const paddingLength = (56 - ((data.length + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(data.length + 1 + paddingLength + 8);

  padded.set(data);
  padded[data.length] = 0x80;
  writeU64BeLength(padded, padded.length - 8, bitLength);

  const hash = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const words = new Uint32Array(80);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = readU32Be(padded, offset + index * 4);
    }

    for (let index = 16; index < 80; index += 1) {
      words[index] = rotateLeft(
        words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16],
        1,
      );
    }

    let [a, b, c, d, e] = hash;

    for (let index = 0; index < 80; index += 1) {
      let f = 0;
      let k = 0;

      if (index < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = add32(rotateLeft(a, 5), f >>> 0, e, k, words[index]);
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }

    hash[0] = add32(hash[0], a);
    hash[1] = add32(hash[1], b);
    hash[2] = add32(hash[2], c);
    hash[3] = add32(hash[3], d);
    hash[4] = add32(hash[4], e);
  }

  const output = new Uint8Array(20);
  hash.forEach((word, index) => writeU32Be(output, index * 4, word));

  return output;
}

const sha256K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256Core(data: Uint8Array, initialHash: number[], outputBytes: number) {
  const bitLength = BigInt(data.length) * 8n;
  const paddingLength = (56 - ((data.length + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(data.length + 1 + paddingLength + 8);

  padded.set(data);
  padded[data.length] = 0x80;
  writeU64BeLength(padded, padded.length - 8, bitLength);

  const hash = initialHash.slice();
  const words = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = readU32Be(padded, offset + index * 4);
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const s1 =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10);
      words[index] = add32(words[index - 16], s0, words[index - 7], s1);
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = add32(h, s1, ch, sha256K[index], words[index]);
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = add32(s0, maj);

      h = g;
      g = f;
      f = e;
      e = add32(d, temp1);
      d = c;
      c = b;
      b = a;
      a = add32(temp1, temp2);
    }

    hash[0] = add32(hash[0], a);
    hash[1] = add32(hash[1], b);
    hash[2] = add32(hash[2], c);
    hash[3] = add32(hash[3], d);
    hash[4] = add32(hash[4], e);
    hash[5] = add32(hash[5], f);
    hash[6] = add32(hash[6], g);
    hash[7] = add32(hash[7], h);
  }

  const output = new Uint8Array(32);
  hash.forEach((word, index) => writeU32Be(output, index * 4, word));

  return output.slice(0, outputBytes);
}

function sha256(data: Uint8Array) {
  return sha256Core(
    data,
    [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
      0x1f83d9ab, 0x5be0cd19,
    ],
    32,
  );
}

function sha224(data: Uint8Array) {
  return sha256Core(
    data,
    [
      0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511,
      0x64f98fa7, 0xbefa4fa4,
    ],
    28,
  );
}

const sha512K = [
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn,
  0xe9b5dba58189dbbcn, 0x3956c25bf348b538n, 0x59f111f1b605d019n,
  0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n, 0xd807aa98a3030242n,
  0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n,
  0xc19bf174cf692694n, 0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n,
  0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n, 0x2de92c6f592b0275n,
  0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn,
  0xbf597fc7beef0ee4n, 0xc6e00bf33da88fc2n, 0xd5a79147930aa725n,
  0x06ca6351e003826fn, 0x142929670a0e6e70n, 0x27b70a8546d22ffcn,
  0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n,
  0x92722c851482353bn, 0xa2bfe8a14cf10364n, 0xa81a664bbc423001n,
  0xc24b8b70d0f89791n, 0xc76c51a30654be30n, 0xd192e819d6ef5218n,
  0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n,
  0x34b0bcb5e19b48a8n, 0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn,
  0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n, 0x748f82ee5defb2fcn,
  0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n,
  0xc67178f2e372532bn, 0xca273eceea26619cn, 0xd186b8c721c0c207n,
  0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n, 0x06f067aa72176fban,
  0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn,
  0x431d67c49c100d4cn, 0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an,
  0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
];

function sha512Core(data: Uint8Array, initialHash: bigint[], outputBytes: number) {
  const bitLength = BigInt(data.length) * 8n;
  const paddingLength = (112 - ((data.length + 1) % 128) + 128) % 128;
  const padded = new Uint8Array(data.length + 1 + paddingLength + 16);

  padded.set(data);
  padded[data.length] = 0x80;
  writeU64Be(padded, padded.length - 16, 0n);
  writeU64Be(padded, padded.length - 8, bitLength);

  const hash = initialHash.slice();
  const words = Array.from({ length: 80 }, () => 0n);

  for (let offset = 0; offset < padded.length; offset += 128) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = readU64Be(padded, offset + index * 8);
    }

    for (let index = 16; index < 80; index += 1) {
      const s0 =
        rotateRight64(words[index - 15], 1) ^
        rotateRight64(words[index - 15], 8) ^
        (words[index - 15] >> 7n);
      const s1 =
        rotateRight64(words[index - 2], 19) ^
        rotateRight64(words[index - 2], 61) ^
        (words[index - 2] >> 6n);
      words[index] = add64(words[index - 16], s0, words[index - 7], s1);
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let index = 0; index < 80; index += 1) {
      const s1 = rotateRight64(e, 14) ^ rotateRight64(e, 18) ^ rotateRight64(e, 41);
      const ch = (e & f) ^ (~e & g);
      const temp1 = add64(h, s1, ch, sha512K[index], words[index]);
      const s0 = rotateRight64(a, 28) ^ rotateRight64(a, 34) ^ rotateRight64(a, 39);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = add64(s0, maj);

      h = g;
      g = f;
      f = e;
      e = add64(d, temp1);
      d = c;
      c = b;
      b = a;
      a = add64(temp1, temp2);
    }

    hash[0] = add64(hash[0], a);
    hash[1] = add64(hash[1], b);
    hash[2] = add64(hash[2], c);
    hash[3] = add64(hash[3], d);
    hash[4] = add64(hash[4], e);
    hash[5] = add64(hash[5], f);
    hash[6] = add64(hash[6], g);
    hash[7] = add64(hash[7], h);
  }

  const output = new Uint8Array(64);
  hash.forEach((word, index) => writeU64Be(output, index * 8, word));

  return output.slice(0, outputBytes);
}

function sha384(data: Uint8Array) {
  return sha512Core(
    data,
    [
      0xcbbb9d5dc1059ed8n, 0x629a292a367cd507n, 0x9159015a3070dd17n,
      0x152fecd8f70e5939n, 0x67332667ffc00b31n, 0x8eb44a8768581511n,
      0xdb0c2e0d64f98fa7n, 0x47b5481dbefa4fa4n,
    ],
    48,
  );
}

function sha512(data: Uint8Array) {
  return sha512Core(
    data,
    [
      0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn,
      0xa54ff53a5f1d36f1n, 0x510e527fade682d1n, 0x9b05688c2b3e6c1fn,
      0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
    ],
    64,
  );
}

const keccakRoundConstants = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

const keccakRotationOffsets = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];

function rotateLeft64(value: bigint, shift: number) {
  const normalizedShift = BigInt(shift % 64);

  if (normalizedShift === 0n) {
    return value & MASK_64;
  }

  return ((value << normalizedShift) | (value >> (64n - normalizedShift))) & MASK_64;
}

function keccakF(state: bigint[]) {
  for (let round = 0; round < 24; round += 1) {
    const c = Array.from({ length: 5 }, (_, x) =>
      state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20],
    );
    const d = Array.from({ length: 5 }, (_, x) => c[(x + 4) % 5] ^ rotateLeft64(c[(x + 1) % 5], 1));

    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        state[x + 5 * y] = (state[x + 5 * y] ^ d[x]) & MASK_64;
      }
    }

    const b = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const index = x + 5 * y;
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotateLeft64(
          state[index],
          keccakRotationOffsets[index],
        );
      }
    }

    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        state[x + 5 * y] =
          (b[x + 5 * y] ^ ((~b[((x + 1) % 5) + 5 * y]) & b[((x + 2) % 5) + 5 * y])) &
          MASK_64;
      }
    }

    state[0] = (state[0] ^ keccakRoundConstants[round]) & MASK_64;
  }
}

function keccak(data: Uint8Array, outputBits: number, suffix: number) {
  const rateBytes = (1600 - outputBits * 2) / 8;
  const outputBytes = outputBits / 8;
  const state = new Array<bigint>(25).fill(0n);
  let offset = 0;

  while (offset + rateBytes <= data.length) {
    for (let index = 0; index < rateBytes / 8; index += 1) {
      let lane = 0n;
      for (let byteIndex = 0; byteIndex < 8; byteIndex += 1) {
        lane |= BigInt(data[offset + index * 8 + byteIndex]) << BigInt(byteIndex * 8);
      }
      state[index] ^= lane;
    }
    keccakF(state);
    offset += rateBytes;
  }

  const block = new Uint8Array(rateBytes);
  block.set(data.subarray(offset));
  block[data.length - offset] = suffix;
  block[rateBytes - 1] ^= 0x80;

  for (let index = 0; index < rateBytes / 8; index += 1) {
    let lane = 0n;
    for (let byteIndex = 0; byteIndex < 8; byteIndex += 1) {
      lane |= BigInt(block[index * 8 + byteIndex]) << BigInt(byteIndex * 8);
    }
    state[index] ^= lane;
  }
  keccakF(state);

  const output = new Uint8Array(outputBytes);
  let outputOffset = 0;

  while (outputOffset < output.length) {
    for (let index = 0; index < rateBytes / 8 && outputOffset < output.length; index += 1) {
      let lane = state[index];
      for (let byteIndex = 0; byteIndex < 8 && outputOffset < output.length; byteIndex += 1) {
        output[outputOffset] = Number(lane & 0xffn);
        lane >>= 8n;
        outputOffset += 1;
      }
    }

    if (outputOffset < output.length) {
      keccakF(state);
    }
  }

  return output;
}

const ripemdR1 = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
  3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
  1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
  4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
];
const ripemdR2 = [
  5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
  6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
  15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
  8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
  12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
];
const ripemdS1 = [
  11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
  7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
  11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
  11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
  9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
];
const ripemdS2 = [
  8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
  9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
  9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
  15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
  8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
];

function ripemdF(index: number, x: number, y: number, z: number) {
  if (index < 16) return x ^ y ^ z;
  if (index < 32) return (x & y) | (~x & z);
  if (index < 48) return (x | ~y) ^ z;
  if (index < 64) return (x & z) | (y & ~z);
  return x ^ (y | ~z);
}

function ripemdK1(index: number) {
  if (index < 16) return 0x00000000;
  if (index < 32) return 0x5a827999;
  if (index < 48) return 0x6ed9eba1;
  if (index < 64) return 0x8f1bbcdc;
  return 0xa953fd4e;
}

function ripemdK2(index: number) {
  if (index < 16) return 0x50a28be6;
  if (index < 32) return 0x5c4dd124;
  if (index < 48) return 0x6d703ef3;
  if (index < 64) return 0x7a6d76e9;
  return 0x00000000;
}

function ripemd160(data: Uint8Array) {
  const padded = padMdLittleEndian(data);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) =>
      readU32Le(padded, offset + index * 4),
    );
    let al = h0;
    let bl = h1;
    let cl = h2;
    let dl = h3;
    let el = h4;
    let ar = h0;
    let br = h1;
    let cr = h2;
    let dr = h3;
    let er = h4;

    for (let index = 0; index < 80; index += 1) {
      const tl = add32(
        rotateLeft(add32(al, ripemdF(index, bl, cl, dl), words[ripemdR1[index]], ripemdK1(index)), ripemdS1[index]),
        el,
      );
      al = el;
      el = dl;
      dl = rotateLeft(cl, 10);
      cl = bl;
      bl = tl;

      const tr = add32(
        rotateLeft(add32(ar, ripemdF(79 - index, br, cr, dr), words[ripemdR2[index]], ripemdK2(index)), ripemdS2[index]),
        er,
      );
      ar = er;
      er = dr;
      dr = rotateLeft(cr, 10);
      cr = br;
      br = tr;
    }

    const t = add32(h1, cl, dr);
    h1 = add32(h2, dl, er);
    h2 = add32(h3, el, ar);
    h3 = add32(h4, al, br);
    h4 = add32(h0, bl, cr);
    h0 = t;
  }

  const output = new Uint8Array(20);
  [h0, h1, h2, h3, h4].forEach((word, index) => writeU32Le(output, index * 4, word));

  return output;
}

function createCrcTable(polynomial: number) {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? polynomial ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

const crc32Table = createCrcTable(0xedb88320);
const crc32cTable = createCrcTable(0x82f63b78);

function crc32WithTable(data: Uint8Array, table: Uint32Array) {
  let crc = 0xffffffff;

  data.forEach((byte) => {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });

  const output = new Uint8Array(4);
  writeU32Be(output, 0, (crc ^ 0xffffffff) >>> 0);

  return output;
}

function adler32(data: Uint8Array) {
  const mod = 65521;
  let a = 1;
  let b = 0;

  data.forEach((byte) => {
    a = (a + byte) % mod;
    b = (b + a) % mod;
  });

  const output = new Uint8Array(4);
  writeU32Be(output, 0, ((b << 16) | a) >>> 0);

  return output;
}

function multiply32(a: number, b: number) {
  return Math.imul(a, b) >>> 0;
}

function xxhash32(data: Uint8Array, seed = 0) {
  const prime1 = 0x9e3779b1;
  const prime2 = 0x85ebca77;
  const prime3 = 0xc2b2ae3d;
  const prime4 = 0x27d4eb2f;
  const prime5 = 0x165667b1;
  let offset = 0;
  let hash = 0;

  if (data.length >= 16) {
    let v1 = add32(seed, prime1, prime2);
    let v2 = add32(seed, prime2);
    let v3 = seed >>> 0;
    let v4 = add32(seed, -prime1);
    const limit = data.length - 16;

    while (offset <= limit) {
      v1 = multiply32(rotateLeft(add32(v1, multiply32(readU32Le(data, offset), prime2)), 13), prime1);
      offset += 4;
      v2 = multiply32(rotateLeft(add32(v2, multiply32(readU32Le(data, offset), prime2)), 13), prime1);
      offset += 4;
      v3 = multiply32(rotateLeft(add32(v3, multiply32(readU32Le(data, offset), prime2)), 13), prime1);
      offset += 4;
      v4 = multiply32(rotateLeft(add32(v4, multiply32(readU32Le(data, offset), prime2)), 13), prime1);
      offset += 4;
    }

    hash = add32(rotateLeft(v1, 1), rotateLeft(v2, 7), rotateLeft(v3, 12), rotateLeft(v4, 18));
  } else {
    hash = add32(seed, prime5);
  }

  hash = add32(hash, data.length);

  while (offset + 4 <= data.length) {
    hash = multiply32(rotateLeft(add32(hash, multiply32(readU32Le(data, offset), prime3)), 17), prime4);
    offset += 4;
  }

  while (offset < data.length) {
    hash = multiply32(rotateLeft(add32(hash, multiply32(data[offset], prime5)), 11), prime1);
    offset += 1;
  }

  hash ^= hash >>> 15;
  hash = multiply32(hash, prime2);
  hash ^= hash >>> 13;
  hash = multiply32(hash, prime3);
  hash ^= hash >>> 16;

  const output = new Uint8Array(4);
  writeU32Be(output, 0, hash >>> 0);

  return output;
}

function readU64Le(data: Uint8Array, offset: number) {
  let value = 0n;

  for (let index = 0; index < 8; index += 1) {
    value |= BigInt(data[offset + index]) << BigInt(index * 8);
  }

  return value;
}

function add64(...values: bigint[]) {
  return values.reduce((sum, value) => (sum + value) & MASK_64, 0n);
}

function multiply64(a: bigint, b: bigint) {
  return (a * b) & MASK_64;
}

function rotateLeft64Word(value: bigint, shift: number) {
  return rotateLeft64(value, shift);
}

function xxhash64(data: Uint8Array, seed = 0n) {
  const prime1 = 0x9e3779b185ebca87n;
  const prime2 = 0xc2b2ae3d27d4eb4fn;
  const prime3 = 0x165667b19e3779f9n;
  const prime4 = 0x85ebca77c2b2ae63n;
  const prime5 = 0x27d4eb2f165667c5n;
  let offset = 0;
  let hash = 0n;

  const round = (acc: bigint, input: bigint) =>
    multiply64(rotateLeft64Word(add64(acc, multiply64(input, prime2)), 31), prime1);

  const mergeRound = (acc: bigint, value: bigint) =>
    add64(multiply64(add64(acc ^ round(0n, value), 0n), prime1), prime4);

  if (data.length >= 32) {
    let v1 = add64(seed, prime1, prime2);
    let v2 = add64(seed, prime2);
    let v3 = seed & MASK_64;
    let v4 = add64(seed, -prime1);
    const limit = data.length - 32;

    while (offset <= limit) {
      v1 = round(v1, readU64Le(data, offset));
      offset += 8;
      v2 = round(v2, readU64Le(data, offset));
      offset += 8;
      v3 = round(v3, readU64Le(data, offset));
      offset += 8;
      v4 = round(v4, readU64Le(data, offset));
      offset += 8;
    }

    hash = add64(
      rotateLeft64Word(v1, 1),
      rotateLeft64Word(v2, 7),
      rotateLeft64Word(v3, 12),
      rotateLeft64Word(v4, 18),
    );
    hash = mergeRound(hash, v1);
    hash = mergeRound(hash, v2);
    hash = mergeRound(hash, v3);
    hash = mergeRound(hash, v4);
  } else {
    hash = add64(seed, prime5);
  }

  hash = add64(hash, BigInt(data.length));

  while (offset + 8 <= data.length) {
    const k1 = round(0n, readU64Le(data, offset));
    hash = add64(multiply64(rotateLeft64Word(hash ^ k1, 27), prime1), prime4);
    offset += 8;
  }

  if (offset + 4 <= data.length) {
    hash ^= multiply64(BigInt(readU32Le(data, offset)), prime1);
    hash = add64(multiply64(rotateLeft64Word(hash, 23), prime2), prime3);
    offset += 4;
  }

  while (offset < data.length) {
    hash ^= multiply64(BigInt(data[offset]), prime5);
    hash = multiply64(rotateLeft64Word(hash, 11), prime1);
    offset += 1;
  }

  hash ^= hash >> 33n;
  hash = multiply64(hash, prime2);
  hash ^= hash >> 29n;
  hash = multiply64(hash, prime3);
  hash ^= hash >> 32n;

  const output = new Uint8Array(8);
  writeU64Le(output, 0, hash);

  return output.reverse();
}

const blake2sIv = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const blakeSigma = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
];

function blake2s(data: Uint8Array, outputLength = 32) {
  const h = blake2sIv.slice();
  h[0] ^= 0x01010000 ^ outputLength;

  const compress = (block: Uint8Array, offset: number, length: number, isLast: boolean) => {
    const m = Array.from({ length: 16 }, (_, index) => readU32Le(block, index * 4));
    const v = [...h, ...blake2sIv];
    v[12] ^= offset >>> 0;
    v[13] ^= Math.floor(offset / 2 ** 32) >>> 0;
    if (isLast) v[14] ^= MASK_32;

    const g = (a: number, b: number, c: number, d: number, x: number, y: number) => {
      v[a] = add32(v[a], v[b], x);
      v[d] = rotateRight(v[d] ^ v[a], 16);
      v[c] = add32(v[c], v[d]);
      v[b] = rotateRight(v[b] ^ v[c], 12);
      v[a] = add32(v[a], v[b], y);
      v[d] = rotateRight(v[d] ^ v[a], 8);
      v[c] = add32(v[c], v[d]);
      v[b] = rotateRight(v[b] ^ v[c], 7);
    };

    for (let round = 0; round < 10; round += 1) {
      const s = blakeSigma[round];
      g(0, 4, 8, 12, m[s[0]], m[s[1]]);
      g(1, 5, 9, 13, m[s[2]], m[s[3]]);
      g(2, 6, 10, 14, m[s[4]], m[s[5]]);
      g(3, 7, 11, 15, m[s[6]], m[s[7]]);
      g(0, 5, 10, 15, m[s[8]], m[s[9]]);
      g(1, 6, 11, 12, m[s[10]], m[s[11]]);
      g(2, 7, 8, 13, m[s[12]], m[s[13]]);
      g(3, 4, 9, 14, m[s[14]], m[s[15]]);
    }

    for (let index = 0; index < 8; index += 1) {
      h[index] = (h[index] ^ v[index] ^ v[index + 8]) >>> 0;
    }
  };

  let offset = 0;
  while (offset + 64 < data.length) {
    compress(data.subarray(offset, offset + 64), offset + 64, 64, false);
    offset += 64;
  }

  const lastBlock = new Uint8Array(64);
  lastBlock.set(data.subarray(offset));
  compress(lastBlock, data.length, data.length - offset, true);

  const output = new Uint8Array(32);
  h.forEach((word, index) => writeU32Le(output, index * 4, word));

  return output.slice(0, outputLength);
}

const blake2bIv = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
];

function rotateRight64(value: bigint, shift: number) {
  const normalizedShift = BigInt(shift % 64);

  return ((value >> normalizedShift) | (value << (64n - normalizedShift))) & MASK_64;
}

function blake2b(data: Uint8Array, outputLength = 64) {
  const h = blake2bIv.slice();
  h[0] ^= 0x01010000n ^ BigInt(outputLength);

  const readBlockWord = (block: Uint8Array, index: number) => readU64Le(block, index * 8);

  const compress = (block: Uint8Array, offset: bigint, isLast: boolean) => {
    const m = Array.from({ length: 16 }, (_, index) => readBlockWord(block, index));
    const v = [...h, ...blake2bIv];
    v[12] ^= offset & MASK_64;
    v[13] ^= (offset >> 64n) & MASK_64;
    if (isLast) v[14] ^= MASK_64;

    const g = (a: number, b: number, c: number, d: number, x: bigint, y: bigint) => {
      v[a] = add64(v[a], v[b], x);
      v[d] = rotateRight64(v[d] ^ v[a], 32);
      v[c] = add64(v[c], v[d]);
      v[b] = rotateRight64(v[b] ^ v[c], 24);
      v[a] = add64(v[a], v[b], y);
      v[d] = rotateRight64(v[d] ^ v[a], 16);
      v[c] = add64(v[c], v[d]);
      v[b] = rotateRight64(v[b] ^ v[c], 63);
    };

    for (let round = 0; round < 12; round += 1) {
      const s = blakeSigma[round % 10];
      g(0, 4, 8, 12, m[s[0]], m[s[1]]);
      g(1, 5, 9, 13, m[s[2]], m[s[3]]);
      g(2, 6, 10, 14, m[s[4]], m[s[5]]);
      g(3, 7, 11, 15, m[s[6]], m[s[7]]);
      g(0, 5, 10, 15, m[s[8]], m[s[9]]);
      g(1, 6, 11, 12, m[s[10]], m[s[11]]);
      g(2, 7, 8, 13, m[s[12]], m[s[13]]);
      g(3, 4, 9, 14, m[s[14]], m[s[15]]);
    }

    for (let index = 0; index < 8; index += 1) {
      h[index] = (h[index] ^ v[index] ^ v[index + 8]) & MASK_64;
    }
  };

  let offset = 0;
  while (offset + 128 < data.length) {
    compress(data.subarray(offset, offset + 128), BigInt(offset + 128), false);
    offset += 128;
  }

  const lastBlock = new Uint8Array(128);
  lastBlock.set(data.subarray(offset));
  compress(lastBlock, BigInt(data.length), true);

  const output = new Uint8Array(64);
  h.forEach((word, index) => writeU64Le(output, index * 8, word));

  return output.slice(0, outputLength);
}

const blake3Iv = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const blake3MsgPermutation = [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8];
const BLAKE3_CHUNK_START = 1;
const BLAKE3_CHUNK_END = 2;
const BLAKE3_PARENT = 4;
const BLAKE3_ROOT = 8;

type Blake3Output = {
  inputCv: number[];
  blockWords: number[];
  counter: bigint;
  blockLength: number;
  flags: number;
};

function blake3Compress(
  cv: number[],
  blockWords: number[],
  counter: bigint,
  blockLength: number,
  flags: number,
) {
  const state = [
    ...cv,
    ...blake3Iv.slice(0, 4),
    Number(counter & 0xffffffffn) >>> 0,
    Number((counter >> 32n) & 0xffffffffn) >>> 0,
    blockLength >>> 0,
    flags >>> 0,
  ];
  let words = blockWords.slice();

  const g = (a: number, b: number, c: number, d: number, x: number, y: number) => {
    state[a] = add32(state[a], state[b], x);
    state[d] = rotateRight(state[d] ^ state[a], 16);
    state[c] = add32(state[c], state[d]);
    state[b] = rotateRight(state[b] ^ state[c], 12);
    state[a] = add32(state[a], state[b], y);
    state[d] = rotateRight(state[d] ^ state[a], 8);
    state[c] = add32(state[c], state[d]);
    state[b] = rotateRight(state[b] ^ state[c], 7);
  };

  for (let round = 0; round < 7; round += 1) {
    g(0, 4, 8, 12, words[0], words[1]);
    g(1, 5, 9, 13, words[2], words[3]);
    g(2, 6, 10, 14, words[4], words[5]);
    g(3, 7, 11, 15, words[6], words[7]);
    g(0, 5, 10, 15, words[8], words[9]);
    g(1, 6, 11, 12, words[10], words[11]);
    g(2, 7, 8, 13, words[12], words[13]);
    g(3, 4, 9, 14, words[14], words[15]);
    words = blake3MsgPermutation.map((index) => words[index]);
  }

  return [
    state[0] ^ state[8],
    state[1] ^ state[9],
    state[2] ^ state[10],
    state[3] ^ state[11],
    state[4] ^ state[12],
    state[5] ^ state[13],
    state[6] ^ state[14],
    state[7] ^ state[15],
    state[8] ^ cv[0],
    state[9] ^ cv[1],
    state[10] ^ cv[2],
    state[11] ^ cv[3],
    state[12] ^ cv[4],
    state[13] ^ cv[5],
    state[14] ^ cv[6],
    state[15] ^ cv[7],
  ].map((word) => word >>> 0);
}

function wordsFromBlock(block: Uint8Array) {
  const padded = new Uint8Array(64);
  padded.set(block);

  return Array.from({ length: 16 }, (_, index) => readU32Le(padded, index * 4));
}

function blake3ChainingValue(output: Blake3Output) {
  return blake3Compress(
    output.inputCv,
    output.blockWords,
    output.counter,
    output.blockLength,
    output.flags,
  ).slice(0, 8);
}

function blake3ParentOutput(left: number[], right: number[]): Blake3Output {
  return {
    inputCv: blake3Iv,
    blockWords: [...left, ...right],
    counter: 0n,
    blockLength: 64,
    flags: BLAKE3_PARENT,
  };
}

function blake3ChunkOutput(chunk: Uint8Array, chunkIndex: number): Blake3Output {
  let cv = blake3Iv.slice();
  const blockCount = Math.max(1, Math.ceil(chunk.length / 64));

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
    const block = chunk.subarray(blockIndex * 64, Math.min(chunk.length, (blockIndex + 1) * 64));
    const flags =
      (blockIndex === 0 ? BLAKE3_CHUNK_START : 0) |
      (blockIndex === blockCount - 1 ? BLAKE3_CHUNK_END : 0);
    const output: Blake3Output = {
      inputCv: cv,
      blockWords: wordsFromBlock(block),
      counter: BigInt(chunkIndex),
      blockLength: block.length,
      flags,
    };

    if (blockIndex === blockCount - 1) {
      return output;
    }

    cv = blake3ChainingValue(output);
  }

  throw new Error("Invalid BLAKE3 chunk.");
}

function blake3RootBytes(output: Blake3Output, outputLength = 32) {
  const bytes = new Uint8Array(outputLength);
  let offset = 0;
  let outputBlockCounter = 0n;

  while (offset < outputLength) {
    const words = blake3Compress(
      output.inputCv,
      output.blockWords,
      outputBlockCounter,
      output.blockLength,
      output.flags | BLAKE3_ROOT,
    );
    const block = new Uint8Array(64);
    words.forEach((word, index) => writeU32Le(block, index * 4, word));
    bytes.set(block.subarray(0, Math.min(block.length, outputLength - offset)), offset);
    offset += block.length;
    outputBlockCounter += 1n;
  }

  return bytes;
}

function blake3(data: Uint8Array) {
  const chunkOutputs: Blake3Output[] = [];

  for (let offset = 0; offset < data.length || offset === 0; offset += 1024) {
    chunkOutputs.push(
      blake3ChunkOutput(data.subarray(offset, Math.min(data.length, offset + 1024)), offset / 1024),
    );

    if (data.length === 0) break;
  }

  if (chunkOutputs.length === 1) {
    return blake3RootBytes(chunkOutputs[0]);
  }

  let level = chunkOutputs.map((output) => blake3ChainingValue(output));

  while (level.length > 2) {
    const nextLevel: number[][] = [];
    for (let index = 0; index < level.length; index += 2) {
      if (index + 1 < level.length) {
        nextLevel.push(blake3ChainingValue(blake3ParentOutput(level[index], level[index + 1])));
      } else {
        nextLevel.push(level[index]);
      }
    }
    level = nextLevel;
  }

  return blake3RootBytes(blake3ParentOutput(level[0], level[1]));
}

export async function hashBytes(data: Uint8Array, algorithm: HashAlgorithmId): Promise<Uint8Array> {
  const webCryptoAlgorithm = webCryptoNames[algorithm];

  if (webCryptoAlgorithm) {
    return digestSha(data, webCryptoAlgorithm);
  }

  switch (algorithm) {
    case "md5":
      return md5(data);
    case "sha224":
      return sha224(data);
    case "sha3-224":
      return keccak(data, 224, 0x06);
    case "sha3-256":
      return keccak(data, 256, 0x06);
    case "sha3-384":
      return keccak(data, 384, 0x06);
    case "sha3-512":
      return keccak(data, 512, 0x06);
    case "keccak-256":
      return keccak(data, 256, 0x01);
    case "ripemd-160":
      return ripemd160(data);
    case "blake2b":
      return blake2b(data);
    case "blake2s":
      return blake2s(data);
    case "blake3":
      return blake3(data);
    case "crc32":
      return crc32WithTable(data, crc32Table);
    case "crc32c":
      return crc32WithTable(data, crc32cTable);
    case "adler32":
      return adler32(data);
    case "xxhash32":
      return xxhash32(data);
    case "xxhash64":
      return xxhash64(data);
    default:
      throw new Error("Unsupported hash algorithm.");
  }
}

export async function hashTextBytes(value: string, algorithm: HashAlgorithmId) {
  return hashBytes(encoder.encode(value), algorithm);
}

export async function digestText(value: string, algorithm: ShaAlgorithm): Promise<string> {
  const digest = await digestSha(encoder.encode(value), algorithm);
  return bytesToCompactHex(digest);
}

export async function hmacText(
  value: string,
  secret: string,
  algorithm: HmacAlgorithm,
): Promise<string> {
  assertWebCrypto();
  const secretBytes = encoder.encode(secret);
  const valueBytes = encoder.encode(value);

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes.buffer.slice(
      secretBytes.byteOffset,
      secretBytes.byteOffset + secretBytes.byteLength,
    ) as ArrayBuffer,
    {
      name: "HMAC",
      hash: hmacHashNames[algorithm],
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    valueBytes.buffer.slice(
      valueBytes.byteOffset,
      valueBytes.byteOffset + valueBytes.byteLength,
    ) as ArrayBuffer,
  );

  return bytesToCompactHex(new Uint8Array(signature));
}

export function bytesFromText(value: string) {
  return encoder.encode(value);
}

export function textFromBytes(value: Uint8Array) {
  return textDecoder.decode(value);
}
