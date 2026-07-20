# Third-party notices

## FFmpeg

Suwol Tools supports bundling a platform-specific FFmpeg executable through `scripts/prepare-ffmpeg.mjs`. The project does not commit a binary. A distributor must supply an FFmpeg build whose license and enabled codecs are compatible with the distribution terms.

The default application code is prepared for an LGPL-compatible FFmpeg build. If a GPL-enabled build or a build containing separately licensed codecs is supplied, the distributor must provide the corresponding source offer, license text, notices, and any required relinking information. Set `SUWOL_FFMPEG_WIN_X64`, `SUWOL_FFMPEG_MAC_ARM64`, `SUWOL_FFMPEG_MAC_X64`, and `SUWOL_FFMPEG_LINUX_X64` only to binaries that have been reviewed for the target distribution.

Development may fall back to `ffmpeg-static` or a system `ffmpeg`. That fallback is not a substitute for reviewing the binary included in a release.

Release inputs are never committed to this repository. `prepare:ffmpeg` requires an independently obtained SHA-256 digest for every supplied platform executable and writes a provenance/hash manifest next to the packaged resource. Record the upstream download URL, version, license and checksum with the release artifact.

## Other libraries

See `package-lock.json` for the exact dependency graph and licenses. Electron packaging keeps the generated application icon and runtime dependencies under their respective upstream licenses.

PDF page rendering uses `pdfjs-dist`; headless PDF canvas compatibility uses `@napi-rs/canvas`; ICO/ICNS generation uses `png2icons`. Their notices and license terms must be included with the packaged application according to the selected versions.
