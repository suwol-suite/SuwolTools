# Suwol Tools 0.1.1

Patch release for the signed macOS ARM64 distribution workflow. The Mac Studio release job verifies the signed application before notarization, then validates the stapled and notarized DMG before attaching macOS assets and regenerating release checksums.

Verify downloaded assets with `checksums.txt` and the detached GPG signature.
