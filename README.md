# Suwol Tools

웹 파일 도구를 로컬 파일 중심의 Electron 도구 모음으로 확장하기 위한 기반 프로젝트입니다. 공통 처리 로직은 `packages/core`, 타입·스키마·레지스트리는 `packages/shared`에 두고, 웹과 Electron은 플랫폼별 파일 어댑터만 제공합니다.

원본 웹 소스 `/Users/m4pro/Suwol/SuwolWebTools`를 실제 구현 기준으로 조사했고, 순수 변환 로직은 `@legacy` alias로 공유합니다. 전환 매트릭스와 미전환 사유는 [`docs/tool-migration-matrix.md`](docs/tool-migration-matrix.md), 브라우저 API 조사는 [`docs/legacy-web-audit.md`](docs/legacy-web-audit.md)에 기록했습니다.

## 명령

```bash
npm install
npm run dev:web        # 웹 호환 UI
npm run dev:electron   # Electron 개발 실행
npm run typecheck
npm test
npm run build
npm run package:win   # NSIS 설치본 + portable
```

기존 원본 웹 앱은 별도 저장소인 [`/Users/m4pro/Suwol/SuwolWebTools`](../SuwolWebTools)에서 계속 실행합니다.

```bash
cd ../SuwolWebTools
npm run dev
npm run build
```

Windows 패키징은 현재 Mac에서도 x64 PE/NSIS/portable 산출물을 만들도록 설정되어 있습니다. 실제 설치·실행 확인은 Windows QA 환경에서 수행해야 합니다. macOS/Linux target도 같은 `electron-builder` 설정에 포함되어 있습니다.

69개 도구가 공통 `ToolDefinition`/`ToolProcessor`와 Electron Worker에 연결되어 있습니다. 복합 Canvas/PDF/미디어 화면은 lazy-loaded React feature로 분리되고, 무거운 파일 처리는 Main Process의 Worker/FFmpeg 계층에서 수행됩니다. `network-tools`는 Main Process 제한 네트워크 API만 사용하며 Renderer 직접 요청은 금지됩니다. 플랫폼별 FFmpeg가 패키지 리소스에 없을 때는 해당 미디어 기능만 비활성화됩니다.

앱 아이콘 원본은 `assets/icon.png`이며 `npm run icons:generate`로 Windows `.ico`, macOS `.icns`, Linux PNG 세트와 `build/icons/manifest.json`을 생성합니다. `npm run icons:check`는 원본 해시, RGBA/투명 여백, PNG 크기, ICO 내부 프레임, ICNS 표준 크기를 검증합니다. 기존 CI 호환을 위해 `npm run prepare:icons`도 같은 생성기를 호출합니다. GitHub Actions 정식 배포는 `.github/workflows/release.yml`이 담당하며 `v<package.version>` 태그에서 Windows/Linux core Release를 먼저 게시하고, self-hosted macOS ARM64 산출물이 ready marker를 남긴 경우에만 같은 Release에 추가합니다. macOS·AppImage Linux만 `electron-updater`를 사용하고 Windows updater는 서명 준비 전까지 초기화하지 않습니다.
