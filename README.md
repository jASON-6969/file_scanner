# Clearfile

Clearfile is a mobile-first, on-device document scanner and PDF cleanup app. Images, imported PDF pages, edit recipes, and named projects remain in the browser's IndexedDB; the app has no backend or analytics.

## Included

- Continuous rear-camera capture with a system file-picker fallback
- JPEG, PNG, WebP, HEIC/HEIF, and PDF imports
- Automatic document-edge detection and manual four-corner correction
- Touch-friendly page ordering, selection, duplication, rotation, and deletion
- Original, Auto Clean, Color Document, Grayscale, and Black & White filters
- Per-page or batch brightness, contrast, sharpness, and filter intensity
- Named local projects with autosave, undo, and redo
- A4, Letter, and original-ratio PDF output at 150, 200, or 300 DPI

DOCX/PPTX conversion, OCR, annotations, signatures, cloud sync, and accounts are intentionally outside the first release.

## Validate and build

```powershell
npm install
npm run typecheck
npm test
npm run build
```

Deploy the generated `dist` directory to any static HTTPS host. HTTPS is required for camera access on phones. No development server is required for the production build.

## Privacy and browser storage

Documents are not stored in cookies and are never uploaded by this application. IndexedDB is used because cookies cannot hold document files. Clearing site data or using some private-browsing modes can remove local projects, so users should download completed PDFs before clearing browser data.

Imported PDF pages are rasterized for filtering. Searchable text, links, forms, and existing OCR layers are not preserved in the first release. Password-protected PDFs are rejected without changing the current project.
