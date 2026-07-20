# Suwol Tools 데스크톱 전환 구조

## 책임 분리

```text
apps/web                 기존 웹 흐름과 호환되는 memory File adapter + 공통 UI
apps/desktop/src/main    dialog, handles, settings, IPC validation, job queue, Worker lifecycle
apps/desktop/src/preload 허용된 typed IPC API만 contextBridge로 노출
apps/desktop/src/renderer 검색/카테고리/즐겨찾기/최근/작업센터/파일 UI
packages/shared          InputSource, OutputTarget, Job, JobResult, settings, registry metadata
packages/core            executeJob, naming/collision orchestration, migrated processors
```

Renderer는 Node API를 import하지 않습니다. 파일 경로 대신 Main이 발급한 `handleId`를 사용하고, Main이 실제 파일을 normalize/realpath/stat 한 뒤 Worker에 전달합니다. Worker 출력도 target root 아래인지 검사하고 `.part` 파일을 원자적으로 rename합니다.

## 작업 복원

`{userData}/jobs.json`에 Job과 완료 결과를 저장합니다. 앱 시작 시 `queued`/`running`은 안전한 `queued` 상태로 복원되어 자동 재개되고, 사용자는 작업 센터에서 일시정지·취소·재시도할 수 있습니다. 실행 중 Worker는 종료 시 terminate되며 원본 파일을 수정하지 않습니다.

## 단계별 전환

1. `toolsRegistry.ts`의 ID/alias/category를 shared registry에 유지
2. 한 도구의 UI 입력을 `InputSource`로 바꾸고 processor에서 옵션을 받음
3. browser codec 또는 Node codec을 주입하고 같은 core test를 두 adapter에서 실행
4. batch/folder/collision/restore/cancel 회귀를 추가
5. `migrated: true`로 표시하고 다음 도구로 이동

현재 69개 도구가 `migrated: true`입니다. 복합 편집 7개는 lazy feature UI를 통해 기존 Processor/Worker/IPC에 연결됩니다. PDF와 GIF는 Core/PDF-lib·sharp Worker에서 처리하고, 오디오·영상은 FFmpeg child process를 통해 처리합니다. Web Audio는 미리듣기 전용 웹 경계에 남기고 실제 파일 변환은 Renderer 밖에서 실행합니다. 외부 네트워크는 별도 Main IPC 제한 계층으로 두어 일반 Worker와 분리했습니다.
