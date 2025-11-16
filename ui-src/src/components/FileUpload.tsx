import type { TargetedEvent } from "preact";
import { useCallback, useRef, useState } from "preact/compat";
import { HOSTNAME } from '../global.ts'

type UploadProps = {
    endpoint: string,
    accept?: string;
    message?: string,
    maxSizeBytes?: number;
    onComplete?: (response: any, fileName: string) => void;
    onError?: (err: any, fileName?: string) => void;
    buildFormData: (file: File) => FormData,
};

type UploadFileState = {
    preview: string;
    progress: number;
    busy: boolean;
};

export default function FileUpload({
    endpoint,
    accept = "audio/*",
    message = "upload audio file here",
    maxSizeBytes = 20 * 1024 * 1024,
    onComplete,
    buildFormData,
    onError,
}: UploadProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [filesState, setFilesState] = useState<Record<string, UploadFileState>>({});

    const upload = useCallback(
        (file: File) => {
            if (file.size > maxSizeBytes) {
                onError?.(new Error(`File too large. Max ${maxSizeBytes} bytes.`), file.name);
                return;
            }

            const preview = URL.createObjectURL(file);
            setFilesState(prev => ({
                ...prev,
                [file.name]: { preview, progress: 0, busy: true },
            }));

            const form = buildFormData(file);

            const xhr = new XMLHttpRequest();
            xhr.withCredentials = true;
            xhr.open("POST", `${HOSTNAME}${endpoint}`, true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const prog = Math.round((e.loaded / e.total) * 100);
                    setFilesState(prev => ({
                        ...prev,
                        [file.name]: { ...prev[file.name], progress: prog },
                    }));
                }
            };

            xhr.onload = () => {
                setFilesState(prev => ({
                    ...prev,
                    [file.name]: { ...prev[file.name], busy: false, progress: 100 },
                }));
                if (xhr.status >= 200 && xhr.status < 300) {
                    let json = null;
                    try { json = JSON.parse(xhr.responseText); } catch { json = xhr.responseText; }
                    onComplete?.(json, file.name);
                } else {
                    onError?.(new Error(`upload failed: ${xhr.status} ${xhr.statusText}`), file.name);
                }

                setFilesState(prev => {
                    const copy = { ...prev };
                    delete copy[file.name];
                    return copy;
                });
            };

            xhr.onerror = () => {
                setFilesState(prev => ({
                    ...prev,
                    [file.name]: { ...prev[file.name], busy: false },
                }));
                onError?.(new Error("network error during upload"), file.name);
                setFilesState(prev => {
                    const copy = { ...prev };
                    delete copy[file.name];
                    return copy;
                });
            };

            xhr.send(form);
        },
        [maxSizeBytes, onComplete, onError]
    );

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (accept.startsWith("audio/")) {
                if (!file.type.startsWith("audio/")) {
                    onError?.(new Error("only audio files are allowed"), file.name);
                    return;
                }
            }
            upload(file);
        });
    };

    const onInputChange = (e: TargetedEvent<HTMLInputElement, Event>) => {
        if (!e.currentTarget) return;
        handleFiles(e.currentTarget.files);
        if (inputRef.current) inputRef.current.value = "";
    };

    const onDrop = (e: DragEvent) => {
        if (!e.dataTransfer) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    const onDragOver = (e: DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const onDragLeave = (e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    };

    return (
        <>
            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => inputRef.current?.click()}
                style={{
                    border: "2px dashed #ccc",
                    padding: 10,
                    fontSize: "clamp(0.5rem, 1rem, 1.5rem)",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    cursor: "pointer",
                    background: dragOver ? "#fafafa" : "transparent",
                }}
                aria-disabled={Object.values(filesState).some(f => f.busy)}
                role="button"
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    multiple
                    onChange={onInputChange}
                    style={{ display: "none" }}
                />
                <div>
                    {Object.values(filesState).some(f => f.busy) ? "uploading..." : message}
                </div>
            </div>

            <div style={{ bottom: 0, height: "35%", width: "100%", marginTop: 10, position: "fixed", overflowY: "scroll" }}>
                {Object.entries(filesState).map(([fileName, state]) => (
                    <div key={fileName} style={{ marginBottom: 12 }}>
                        <div>{fileName}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <progress value={state.progress} max={100} style={{ flex: 1 }} />
                            <span>{state.progress}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
