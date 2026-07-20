import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { InputItem, InputSource, OutputTarget, ToolDefinition } from "@suwol/shared";

export type FeatureProps = {
  tool: ToolDefinition;
  input?: InputSource;
  options: Record<string, unknown>;
  output: OutputTarget;
  error: string;
  isElectron: boolean;
  onInput: (next: InputSource | undefined) => void;
  onOptions: (patch: Record<string, unknown>) => void;
  onReplaceOptions: (next: Record<string, unknown>) => void;
  onOutput: (patch: Partial<OutputTarget>) => void;
  onChooseFiles: () => void;
  onChooseFolder: () => void;
  onChooseOutput: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onRun: (optionsOverride?: Record<string, unknown>) => void;
};

export type PreviewData = { url?: string; mimeType?: string; error?: string; loading: boolean };

export function toBlobPart(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

export function useHandlePreview(item?: InputItem, maxBytes = 16 * 1024 * 1024): PreviewData {
  const [state, setState] = useState<PreviewData>({ loading: false });
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    if (!item || !window.suwol) { setState({ loading: false }); return; }
    setState({ loading: true });
    void window.suwol.files.preview({ handleId: item.handleId, maxBytes }).then((result) => {
      if (!active) return;
      url = URL.createObjectURL(new Blob([toBlobPart(result.data)], { type: result.mimeType || item.mimeType || "application/octet-stream" }));
      setState({ url, mimeType: result.mimeType || item.mimeType, loading: false });
    }).catch((caught) => { if (active) setState({ loading: false, error: caught instanceof Error ? caught.message : "미리보기를 불러오지 못했습니다." }); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [item?.handleId, maxBytes]);
  return state;
}

export function useFfmpegAvailability(): { available: boolean; checked: boolean } {
  const [state, setState] = useState({ available: false, checked: false });
  useEffect(() => { let active = true; if (!window.suwol) { setState({ available: false, checked: true }); return; } void window.suwol.media.status().then((value) => { if (active) setState({ available: value.available, checked: true }); }).catch(() => { if (active) setState({ available: false, checked: true }); }); return () => { active = false; }; }, []);
  return state;
}

export function useMultiplePreviews(items: InputItem[], maxBytes = 8 * 1024 * 1024): Record<string, PreviewData> {
  const key = items.map((item) => item.handleId).join(":");
  const [state, setState] = useState<Record<string, PreviewData>>({});
  useEffect(() => {
    let active = true; const urls: string[] = [];
    if (!window.suwol || items.length === 0) { setState({}); return; }
    setState(Object.fromEntries(items.map((item) => [item.handleId, { loading: true }])));
    void Promise.all(items.slice(0, 80).map(async (item) => {
      try { const result = await window.suwol!.files.preview({ handleId: item.handleId, maxBytes }); const url = URL.createObjectURL(new Blob([toBlobPart(result.data)], { type: result.mimeType || item.mimeType || "application/octet-stream" })); urls.push(url); return [item.handleId, { url, mimeType: result.mimeType || item.mimeType, loading: false }] as const; }
      catch (caught) { return [item.handleId, { loading: false, error: caught instanceof Error ? caught.message : "미리보기 실패" }] as const; }
    })).then((entries) => { if (active) setState(Object.fromEntries(entries)); });
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [key, maxBytes]);
  return state;
}

export function formatBytes(value?: number): string {
  if (!value) return "0 B";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items]; const [item] = next.splice(from, 1); if (item !== undefined) next.splice(to, 0, item); return next;
}

export function replaceInputItems(input: InputSource | undefined, items: InputItem[]): InputSource | undefined {
  return input ? { ...input, items } : input;
}

export function useHistory<T>(value: T, onRestore: (value: T) => void, maxEntries = 50) {
  const past = useRef<T[]>([]); const future = useRef<T[]>([]); const [, redraw] = useState(0);
  const commit = (next: T) => { past.current = [...past.current.slice(-(maxEntries - 1)), structuredClone(value)]; future.current = []; onRestore(next); redraw((count) => count + 1); };
  const undo = () => { const previous = past.current.pop(); if (previous === undefined) return; future.current.unshift(structuredClone(value)); onRestore(previous); redraw((count) => count + 1); };
  const redo = () => { const next = future.current.shift(); if (next === undefined) return; past.current.push(structuredClone(value)); onRestore(next); redraw((count) => count + 1); };
  return { commit, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

function OutputControls({ props, disabled, disabledReason }: { props: FeatureProps; disabled?: boolean; disabledReason?: string }) {
  return <div className="feature-output-controls"><label>저장 방식<select value={props.output.kind} onChange={(event) => props.onOutput({ kind: event.target.value as OutputTarget["kind"] })}><option value="sibling">원본 파일 옆</option><option value="directory">출력 폴더</option></select></label><label>충돌 정책<select value={props.output.collision} onChange={(event) => props.onOutput({ collision: event.target.value as OutputTarget["collision"] })}><option value="rename">자동 이름 변경</option><option value="skip">건너뛰기</option><option value="overwrite">덮어쓰기</option></select></label><div className="two-col"><label>접두사<input value={props.output.prefix} onChange={(event) => props.onOutput({ prefix: event.target.value })} /></label><label>접미사<input value={props.output.suffix} onChange={(event) => props.onOutput({ suffix: event.target.value })} /></label></div><button className="secondary-button full-width" onClick={props.onChooseOutput}>출력 폴더 지정</button><button className="run-button" disabled={disabled} onClick={() => props.onRun()}>{disabled ? "FFmpeg 필요" : "작업 시작"}</button>{disabledReason && <p className="error-text">{disabledReason}</p>}{props.error && <p className="error-text">{props.error}</p>}</div>;
}

function InputPanel({ props, selectedId, onSelect }: { props: FeatureProps; selectedId?: string; onSelect?: (item: InputItem) => void }) {
  const items = props.input?.items ?? [];
  return <section className="panel feature-input"><div className="panel-heading"><div><span className="eyebrow">INPUT</span><h2>파일</h2></div><span className="count-badge">{items.length}</span></div><div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={props.onDrop}><strong>파일 또는 폴더를 드롭</strong><span>여러 파일과 클립보드 입력을 지원합니다.</span><div className="button-row"><button className="primary-button" onClick={props.onChooseFiles}>파일 열기</button><button className="secondary-button" onClick={props.onChooseFolder}>폴더 열기</button></div></div><div className="feature-file-list">{items.map((item, index) => <button key={item.handleId} className={item.handleId === selectedId ? "feature-file feature-file--active" : "feature-file"} onClick={() => onSelect?.(item)}><span>{index + 1}</span><div><strong>{item.name}</strong><small>{item.relativePath} · {formatBytes(item.size)}</small></div></button>)}</div></section>;
}

export function FeatureLayout({ props, selectedId, onSelect, center, right, footer, showOutput = true, runDisabled = false, runDisabledReason }: { props: FeatureProps; selectedId?: string; onSelect?: (item: InputItem) => void; center: ReactNode; right: ReactNode; footer?: ReactNode; showOutput?: boolean; runDisabled?: boolean; runDisabledReason?: string }) {
  return <div className="feature-workspace"><InputPanel props={props} selectedId={selectedId} onSelect={onSelect} /><section className="panel feature-canvas"><div className="panel-heading"><div><span className="eyebrow">PREVIEW / EDIT</span><h2>{props.tool.name}</h2></div></div>{center}</section><section className="panel feature-properties"><div className="panel-heading"><div><span className="eyebrow">PROPERTIES</span><h2>옵션</h2></div></div>{right}{showOutput && <OutputControls props={props} disabled={runDisabled} disabledReason={runDisabledReason} />}</section>{footer && <section className="feature-footer">{footer}</section>}</div>;
}

export function Checkerboard({ children }: { children: ReactNode }) { return <div className="checkerboard">{children}</div>; }

export function RangeField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) { return <label>{label}<input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><output>{value}</output></label>; }

export function useObjectOptions<T extends Record<string, unknown>>(options: Record<string, unknown>, key: string, fallback: T): T { return useMemo(() => (options[key] && typeof options[key] === "object" && !Array.isArray(options[key]) ? options[key] as T : fallback), [options, key, fallback]); }
