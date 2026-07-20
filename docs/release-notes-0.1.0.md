# Suwol Tools 0.1.0

Initial desktop release with local file workflows, platform-specific packaging, and macOS/Linux update metadata.

The macOS ARM64 package is built on the existing Mac Studio GitHub Actions runner and uses the configured Developer ID signing and notarization profile. Windows auto-update metadata is intentionally not published; Windows uses the installer/portable distribution flow.

Verify downloaded assets with `checksums.txt` and the detached GPG signature.
