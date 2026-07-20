# Electron 도구 전환 매트릭스

기준: 2026-07-18. 도구 ID와 옵션은 `/Users/m4pro/Suwol/SuwolWebTools/src/lib/toolsRegistry.ts`, 실제 입력·출력과 기본값은 각 `src/features/tools/*Tool.tsx` 및 `src/lib/*`를 비교해 기록했습니다.

## 상태 요약

- canonical 도구: 69개
- Electron 전환 완료: 69개 (`migrated: true`)
- 웹 fallback/부분 구현 유지: 0개
- 공통 로직: 원본 `SuwolWebTools/src/lib`를 `@legacy` alias로 참조하며, Electron Worker와 웹 adapter가 같은 processor를 호출

## 분류별 전환 완료

| 분류 | 전환 완료 도구 |
|---|---|
| 이미지·SVG/그래픽 로컬 | `image-resizer`, `webp-converter`, `image-compressor`, `base64-image-converter`, `app-icon-generator`, `android-asset-generator`, `ios-asset-generator`, `qr-code-generator`, `barcode-generator`, `css-generator`, `color-converter` |
| 텍스트·데이터 변환 | `base64`, `url-encode`, `html-escape`, `json-escape`, `unicode-escape`, `hex-converter`, `binary-converter`, `json-formatter`, `csv-json-converter`, `yaml-json-converter`, `json-schema-generator`, `json-to-typescript`, `jsonpath-tester`, `text-case-converter`, `text-sort-deduplicate`, `regex-tester`, `text-diff`, `url-parser`, `utm-url-builder`, `html-entity-reference`, `sql-formatter`, `code-minifier`, `xml-formatter`, `code-beautifier` |
| 계산기·생성기·참조 | `number-base-converter`, `password-generator`, `lorem-ipsum-generator`, `cron-generator`, `uuid-generator`, `name-generator`, `unit-converter`, `easing-preview`, `timestamp-converter`, `http-status-codes`, `mime-type-reference`, `seo-meta-generator` |
| 보안·해시 | `file-hash-generator`, `jwt-decoder`, `hash-generator`, `hmac-generator` |
| 미디어 생성 | `retro-sfx-generator` |

완료 도구는 단일 입력뿐 아니라 공통 `InputSource`를 통한 다중 파일·폴더 배치도 사용할 수 있고, 처리 결과는 공통 `OutputTarget`의 접두사·접미사·번호·충돌 정책을 적용합니다. 생성기처럼 파일 입력이 원본 UI에 없던 도구도 동일 작업 큐를 사용하기 위해 빈 클립보드 텍스트 source를 내부적으로 만들며 결과는 사용자가 지정한 출력 위치에 저장합니다.

## 복합 편집·제한 네트워크 도구

| ID | 분류 | Electron 상태 | 사유 및 현재 동작 |
|---|---|---|---|
| `app-icon-generator` | 이미지·파일 | full | 전체 preset PNG, manifest/HTML, `.ico/.icns`, ZIP을 생성하고 native QA를 통과했습니다. |
| `android-asset-generator` | 이미지·파일 | full | density/adaptive/notification/splash/Play Store 결과와 manifest/README ZIP을 생성하고 native QA를 통과했습니다. |
| `ios-asset-generator` | 이미지·파일 | full | AppIcon/Launch/Brand/AppStore/Splash 및 idiom/scale/size `Contents.json` ZIP을 생성하고 native QA를 통과했습니다. |
| `image-editor` | 이미지 편집 | full | lazy React 레이어 편집기, 50단계 history, proxy preview와 원본 해상도 Worker 합성/프로젝트 JSON 저장을 제공합니다. |
| `screenshot-stitch-redact` | 이미지 편집 | full | 재정렬·방향·수동/자동 overlap·crop/redact·history·축소 preview와 Worker stitch를 제공합니다. |
| `pdf-tools` | 문서 | full | PDF.js Worker 썸네일, 선택/순서/삭제/회전/병합/분할/이미지 변환/metadata/압축을 pdf-lib Worker와 연결합니다. PDF 암호화는 의도적으로 노출하지 않습니다. |
| `gif-frame-editor` | 미디어 | full | bounded-window thumbnail UI, 프레임 삭제/복제/순서/지연/loop/playback과 GIF·PNG ZIP Worker 출력을 제공합니다. |
| `audio-toolkit` | 미디어 | full | Web Audio waveform/미리듣기와 FFmpeg child-process trim/normalize/fade/volume/channel/resample/format/batch를 분리합니다. |
| `retro-sfx-generator` | 미디어 생성 | full | 원본 preset과 결정적 seed/전체 파라미터/JSON/variant ZIP을 Worker에서 생성합니다. 실시간 waveform preview만 제한됩니다. |
| `video-to-gif-webp` | 미디어 | full | lazy video preview, range/FPS/size/crop/rotate/quality/loop 추정 UI와 FFmpeg progress/cancel/temp cleanup/batch를 제공합니다. |
| `network-tools` | 브라우저/외부 API | full | Main 제한 IPC만 사용해 URL/DNS/header/redirect/TLS/port와 로컬 분석을 실행하고 JSON/text/clipboard 저장·취소를 제공합니다. |

## 레지스트리 필드

각 canonical 레지스트리 항목에는 `migrated`, `electronSupport`, `webSupported`, `electronOnly`, `capabilities`, `worker`, `externalApi`, `unsupportedReason`, `defaultOptions`가 있습니다. Electron 화면은 이 상태를 기술 용어로 노출하지 않고, 완료 도구는 공통 작업 화면을, 미지원 도구는 원본 웹 도구 열기와 제한 사유를 보여줍니다.

## 배포 전 확인

1. 릴리스에서 공급할 각 FFmpeg 플랫폼 바이너리의 SHA-256·출처·LGPL 조건을 검토한다.
2. `scripts/windows-qa.ps1`로 Windows 설치/portable/Defender/한글 경로 검사를 실행한다.
