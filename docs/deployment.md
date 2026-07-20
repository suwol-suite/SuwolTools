# 배포 및 Windows QA

## 명령

```bash
npm run prepare:icons
npm run dev:electron
npm run build:web
npm run build:electron
npm run package:win   # NSIS 설치본 + x64 portable
npm run package:mac   # dmg + zip 확장 지점
npm run package:mac:release # 서명 강제 macOS 릴리스 빌드
npm run package:linux # AppImage + tar.gz 확장 지점
npm run release:metadata -- linux
npm run release:validate-metadata -- linux
npm run package:smoke -- linux
```

`package:win`은 `Suwol Tools-<version>-win-x64-setup.exe`와 `Suwol Tools-<version>-win-x64-portable.exe`를 생성하며 Windows용 `latest.yml`은 게시하지 않습니다. macOS는 `Suwol Tools-<version>-mac-arm64.{dmg,zip}`, Linux는 `Suwol Tools-<version>-linux-x64.{AppImage,tar.gz}`를 생성합니다. Windows에서 실행 파일을 제공할 때는 `SUWOL_FFMPEG_WIN_X64`를 사용하거나 패키지 리소스의 `resources/ffmpeg/win-x64/ffmpeg.exe`에 FFmpeg를 넣습니다. macOS/Linux도 각각 `mac-arm64`, `mac-x64`, `linux-x64` 슬롯을 사용합니다.

배포 전에 플랫폼별 바이너리를 주입하려면 다음처럼 실행합니다.

```bash
SUWOL_FFMPEG_WIN_X64=/secure/ffmpeg.exe \
SUWOL_FFMPEG_WIN_X64_SHA256=<verified-sha256> \
SUWOL_FFMPEG_MAC_ARM64=/secure/ffmpeg-arm64 \
SUWOL_FFMPEG_MAC_ARM64_SHA256=<verified-sha256> \
SUWOL_FFMPEG_MAC_X64=/secure/ffmpeg-x64 \
SUWOL_FFMPEG_MAC_X64_SHA256=<verified-sha256> \
SUWOL_FFMPEG_LINUX_X64=/secure/ffmpeg-linux \
SUWOL_FFMPEG_LINUX_X64_SHA256=<verified-sha256> \
npm run package:win
```

`prepare:ffmpeg`는 복사 전 SHA-256을 필수로 검증하고 `build/ffmpeg/manifest.json`에 검증 결과를 기록합니다. `*_SOURCE` 환경 변수로 배포 출처도 기록할 수 있습니다. `build/ffmpeg/{win-x64,mac-arm64,mac-x64,linux-x64}` 슬롯이 비어 있으면 앱 전체가 아니라 해당 미디어 기능만 실행 시 오류를 반환합니다. 바이너리의 라이선스 검토는 `THIRD_PARTY_NOTICES.md`를 따릅니다.

코드 서명은 electron-builder 표준 환경 변수를 사용합니다.

- `CSC_LINK`: 인증서 파일 또는 인증서 URL
- `CSC_KEY_PASSWORD`: 인증서 비밀번호
- `CSC_NAME`: 인증서 subject 이름
- `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`: Windows 전용 override

인증서가 없을 때도 `forceCodeSigning: false`라서 unsigned 빌드는 실패하지 않습니다. 실제 배포 전에는 서명된 CI secret을 사용하고 Defender/SmartScreen 평판을 별도 확인해야 합니다.

## GitHub Actions 정식 배포

워크플로는 `workflow_dispatch`와 `v*` 태그를 지원합니다. 태그 실행은 `v${package.json.version}`이 정확히 일치해야 하며, 수동 실행은 빌드·검증만 하고 GitHub Release를 생성하지 않습니다. 저장소 위치는 `suwol-suite/SuwolTools`로 설정되어 있으므로 실제 저장소가 다르면 `electron-builder.yml`과 workflow의 owner/repo를 함께 변경해야 합니다.

필요한 secret은 `GPG_PRIVATE_KEY_B64`, `GPG_PASSPHRASE`, `MAC_KEYCHAIN_PASSWORD`, `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `CSC_LINK`, `CSC_KEY_PASSWORD`입니다. macOS runner에서는 `Developer ID Application` identity를 확인하고 `notarytool` keychain profile을 사용합니다. `CSC_NAME`도 일반 electron-builder 서명 환경 변수로 지원합니다.

Release 자산에는 Linux `latest-linux.yml`, macOS `latest-mac.yml`, 전체 `checksums.txt`/`.asc`, `suwol-release-public-key.asc`가 포함됩니다. Windows `latest.yml`은 자동 생성되더라도 게시 단계에서 제거합니다. FFmpeg는 `scripts/prepare-ffmpeg.mjs`가 환경 변수로 받은 바이너리의 SHA-256을 검증한 뒤에만 패키지 리소스로 복사합니다.

macOS·Linux 자동 업데이트는 설정의 자동 확인 옵션을 따르며 다운로드 전 사용자 확인을 거칩니다. Windows는 코드 서명과 업데이트 배포 정책이 확정될 때까지 `unsupported` 상태를 표시합니다.

## 확인 항목

현재 개발 호스트는 macOS이므로 Windows 설치·실행·Defender 확인은 수행할 수 없습니다. 패키지 산출물의 PE/NSIS/portable 구조와 아이콘 리소스 생성은 정적 확인하고, Windows QA에서는 다음을 실행합니다.

- 한글·공백이 포함된 설치 경로와 한글 사용자 이름
- 관리자 권한 없는 실행, NSIS 제거 후 사용자 데이터 보존
- NSIS와 portable의 설정 경로 분리
- 파일 연결, 파일/폴더 드롭, 큰 파일, 앱 종료 후 작업 복원
- pause/resume/cancel/retry, 충돌 정책, 결과 열기
- Windows Defender/SmartScreen 오탐 및 서명 상태

Electron 기본 아이콘 대신 `assets/icon.svg`에서 생성한 `build/icons/icon.ico`, `icon.icns`, PNG 세트를 사용합니다.
