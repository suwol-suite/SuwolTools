Place the platform FFmpeg executable in this directory before packaging:

Windows: ffmpeg.exe
macOS/Linux: ffmpeg

The application never executes a user-provided command line. It invokes this
known executable with an allowlisted argument builder from the media worker.
SUWOL_FFMPEG_PATH may be used for development or CI instead.
