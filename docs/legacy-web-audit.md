# 기존 Suwol Web Tools 조사 기록

조사 기준일: 2026-07-18

## 결과

원본은 `/Users/m4pro/Suwol/SuwolWebTools`에 있으며 실제 소스를 다시 조사했습니다. 기존 프로젝트의 `npm run build`도 실행했고 Next.js 15.5.19 정적 export가 96개 페이지를 생성하며 성공했습니다. `SuwolTools`는 기존 웹 앱을 덮어쓰지 않는 별도 Electron/웹 호환 프로젝트입니다.

## 원본 구조와 기술 스택

- Next.js 15.5.19, React 19.1, TypeScript 5.8, `output: "export"`
- 서버/백엔드/DB/API route/server action 없음. 브라우저에서 모든 처리를 수행하는 정적 앱
- `src/lib`: 순수 변환·생성·미디어 처리 모듈
- `src/features/tools`: 도구별 React UI와 입력 상태 관리
- `src/components/tools`: `ImageDropzone`, `ToolPageLayout`, `CopyButton`, 공통 텍스트 입력 UI
- `src/lib/toolsRegistry.ts`: 카테고리 8개, canonical tool 69개, alias URL 13개, 인기/숨김/관련 도구 메타데이터
- `src/features/tools/ToolRoute.tsx`: tool ID를 React 컴포넌트에 연결하는 대형 switch 라우터
- `src/app/tools/[toolId]/page.tsx`: 정적 경로 생성 및 alias canonicalization
- `scripts/copy-ffmpeg-core.mjs`: FFmpeg WASM 파일을 `public/ffmpeg`에 복사하고 worker URL을 패치

## 전체 도구 목록

원본 레지스트리에서 canonical ID와 category를 추출한 결과입니다. 별도 표기가 없는 도구는 주로 textarea/form 입력 → 화면 결과 → copy/download 출력입니다.

| category | tools |
|---|---|
| encoding-decoding | `base64`, `url-encode`, `html-escape`, `hex-converter`, `binary-converter` |
| hash-security | `jwt-decoder`, `hash-generator`, `hmac-generator`, `password-generator`, `file-hash-generator` |
| json-data | `json-escape`, `json-formatter`, `json-schema-generator`, `csv-markdown-table-converter`, `yaml-json-converter`, `csv-json-converter`, `xml-formatter`, `jsonpath-tester` |
| text | `unicode-escape`, `text-diff`, `markdown-tools`, `community-post-helper`, `markdown-html-converter`, `markdown-table-generator`, `html-entity-reference`, `text-case-converter`, `text-sort-deduplicate`, `lorem-ipsum-generator` |
| generator | `uuid-generator`, `name-generator`, `cron-generator` |
| media | `pdf-tools`, `gif-frame-editor`, `audio-toolkit`, `retro-sfx-generator`, `video-to-gif-webp` |
| graphics | `qr-code-generator`, `barcode-generator`, `app-icon-generator`, `android-asset-generator`, `ios-asset-generator`, `image-resizer`, `image-editor`, `screenshot-stitch-redact`, `color-converter`, `image-compressor`, `webp-converter`, `css-generator`, `base64-image-converter` |
| dev-utils | `timestamp-converter`, `date-time-tools`, `json-to-typescript`, `regex-tester`, `url-parser`, `user-agent-parser`, `sql-formatter`, `seo-meta-generator`, `open-graph-preview`, `easing-preview`, `number-base-converter`, `unit-converter`, `http-status-codes`, `robots-txt-generator`, `sitemap-generator`, `utm-url-builder`, `mime-type-reference`, `network-tools`, `code-minifier`, `code-beautifier` |

추가 alias는 `css-gradient-generator → css-generator`, `box-shadow-generator → css-generator`, `sitemap-xml-generator → sitemap-generator`, `url-parameter-parser → url-parser`, timestamp/date-time 관련 7개, markdown 관련 3개입니다. `video-to-gif-webp`는 feature flag에 따라 public build에서 비활성화됩니다.

## 입력·출력 형식 분류

| 흐름 | 원본 도구 | 입력 | 출력 |
|---|---|---|---|
| 텍스트/코드 | base64, URL/HTML/JSON/Unicode/hex/binary, JSON/XML/YAML/SQL/Markdown formatter, regex, diff, case/sort, SEO/URL/UA/robots/sitemap/UTM | textarea, select, number, 일부 `navigator.userAgent` | textarea/preview, copy text, `.txt`/`.json`/`.csv`/`.xml`/`.md`/`.ts`/`.css` download |
| 생성기 | UUID, name, password, QR, barcode, cron, CSS, lorem, app/iOS/Android asset | form options, 일부 이미지 | text, SVG/PNG, ZIP, manifest/snippet download, clipboard |
| 이미지 단일 파일 | image-resizer, image-editor, image-compressor, webp-converter, base64-image-converter, app/icon asset, screenshot redact | `File` image/*, drag-and-drop, 일부 clipboard image | Blob preview, PNG/JPEG/WebP, data URL, ZIP, clipboard PNG |
| 미디어 파일 | gif-frame-editor, audio-toolkit, video-to-gif-webp | GIF/audio/video `File`, drag-and-drop | GIF frame/image/audio/WAV/Opus/GIF/WebP Blob, ZIP 또는 다운로드 |
| PDF | pdf-tools | PDF `File`, 일부 image/text options | merged/split/compressed PDF, page image/preview, Blob download |
| 파일 해시 | hash-generator의 file mode, file-hash-generator | 단일/다중 file, drag-and-drop | hash 결과 화면, TXT/CSV/JSON, clipboard |

원본 레지스트리는 도구별 실행 schema를 별도 JSON으로 제공하지 않습니다. 실제 허용 확장자와 옵션은 각 `src/features/tools/*Tool.tsx` 및 `src/lib/*` 구현에 분산되어 있으므로 Electron 전환 때는 해당 UI의 state와 결과 filename을 processor contract로 옮겨야 합니다.

## 업로드·다운로드·브라우저 API 조사

| 영역 | 원본 구현 | Electron 분리 계획 |
|---|---|---|
| 파일 선택 | 일반 `<input type="file">`, `ImageDropzone`; 대부분 단일 파일. hash/audio/video 일부 다중 처리 | Main `dialog.showOpenDialog`의 `multiSelections`/`openDirectory`, opaque handle로 Renderer에 전달 |
| 드래그 앤 드롭 | 도구별 `DragEvent`, `dataTransfer.files`; 폴더 재귀 처리 공통화 없음 | Preload `adoptDroppedPaths` → Main path normalization → 공통 `InputSource` |
| 이미지 입력 | `URL.createObjectURL`, `Image`, `createImageBitmap`, Canvas 2D | Worker `sharp` codec, 웹은 Canvas codec을 동일 `ImageCodec` 계약에 주입 |
| 텍스트 clipboard | `navigator.clipboard.writeText`, 실패 시 hidden textarea + `document.execCommand("copy")` | Renderer 표준 clipboard 입력/출력, Electron 결과 파일 복사는 Main `clipboard` API |
| 이미지 clipboard | `ClipboardItem` + `navigator.clipboard.write({image/png})` | Preload 허용 API를 추가할 때만 Main clipboard로 연결; 임의 IPC는 금지 |
| 다운로드 | `Blob`, `URL.createObjectURL`, hidden `<a download>` | 공통 executor → Main 파일 writer; 웹 adapter는 기존 Blob download |
| PDF | `pdf-lib`, `pdfjs-dist`, PDF.js worker, Canvas rendering, `file.arrayBuffer()` | PDF processor와 PDF worker를 별도 단계로 이관. Renderer에서 CPU-heavy PDF 처리를 실행하지 않음 |
| Audio | Web Audio/OfflineAudioContext, Canvas waveform, file arrayBuffer, FFmpeg WASM 공지/경로 | Worker/child process에서 ffmpeg와 decode를 격리하고 취소/종료를 연결 |
| Video | FFmpeg WASM, `<video>` preview, drag/drop, Blob output | 별도 worker process로 분리. Windows codec/FFmpeg 배포 검증 후 전환 |

정적 검색으로 확인한 주요 API 의존 파일은 `src/lib/download.ts`, `clipboard.ts`, `imageResize.ts`, `imageResizer.ts`, `imageCompressor.ts`, `pdfTools.ts`, `audioToolkit.ts`, `gifFrameEditor.ts`, `androidAssetGenerator.ts`, `appAssetCanvas.ts`, `retroSfx.ts`, `qrCode.ts`, `src/components/tools/ImageDropzone.tsx` 및 이미지/PDF/audio/video/screenshot 도구 컴포넌트들입니다.

## 새 기반에서 확보한 호환 지점

- 웹과 Electron이 같은 `ToolDefinition` 레지스트리와 `executeJob`을 사용
- 웹은 `WebFileAdapter`, Electron은 Main/Worker의 `NodeFileAdapter` 사용
- 공통 `InputSource`, `OutputTarget`, `Job`, `JobResult` 계약으로 파일 UI와 도구 로직 분리
- 기존 69개 ID와 alias를 새 `packages/shared/src/tool-registry.ts`에 등록
- `migrated: true`인 69개 도구는 공통 processor와 Electron Worker/웹 memory adapter를 연결했으며, 원본 순수 함수는 `@legacy` alias로 중복 구현하지 않음
- 기존 웹 프로젝트는 `/Users/m4pro/Suwol/SuwolWebTools`에서 별도 유지되며 `npm run build` 회귀 검증 성공
- 복합 UI·미디어·네트워크 11개 도구는 공통 파일/Worker/IPC와 lazy React feature UI를 통해 전환 완료했습니다. `network-tools`는 외부 요청 보안 경계를 Main IPC에 구현한 제한 화면으로만 실행합니다.

원본 도구를 추가 전환할 때는 각 feature의 입력 확장자/옵션/결과 filename을 먼저 contract test로 고정한 다음 processor를 등록해야 합니다.
