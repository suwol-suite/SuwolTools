# Legacy compatibility snapshot

This directory contains the browser-independent `src/lib` modules required by
the shared processors. The source is synchronized from the reference
`SuwolWebTools` project so this repository can build in a clean GitHub Actions
checkout without requiring a sibling working copy. The original web project is
not modified; its build remains the compatibility reference.

Browser UI, download helpers, and DOM-only modules are intentionally excluded.
