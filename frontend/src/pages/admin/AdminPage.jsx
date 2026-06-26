import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "../../components/Sidebar.jsx";
import { uploadDocument, listDocuments } from "../../api.js";

const STATUS_MAP = { ready: "Indexed", processing: "Processing", failed: "Failed" };

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);

function humanSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(d) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2,"0")}, ${d.getFullYear()}`;
}

function StatusBadge({ status }) {
  const colors = {
    Indexed:    { text: "var(--accent-text)", bg: "var(--accent-soft)" },
    Processing: { text: "#c08a2e",            bg: "rgba(192,138,46,0.12)" },
    Failed:     { text: "#c0392e",            bg: "rgba(192,57,46,0.12)" },
  };
  const { text, bg } = colors[status] ?? colors.Processing;
  return (
    <span
      className="inline-flex items-center gap-[7px] px-[10px] py-1 rounded-full text-[12px] font-semibold"
      style={{ color: text, background: bg }}
    >
      <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: text }} />
      {status}
    </span>
  );
}

export default function AdminPage({ user, onLogout, theme, toggleTheme }) {
  const [uploadError, setUploadError] = useState(null);
  const queryClient = useQueryClient();
  const queryKey = ["documents", user.org];

  const { data: documents = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listDocuments(user.org),
  });

  const { mutate: upload } = useMutation({
    mutationFn: (file) => uploadDocument(user.org, file),
    onMutate: async (file) => {
      await queryClient.cancelQueries({ queryKey });
      const snapshot = queryClient.getQueryData(queryKey) ?? [];
      queryClient.setQueryData(queryKey, [
        {
          id: `temp-${Date.now()}-${Math.random()}`,
          filename: file.name,
          status: "processing",
          chunk_count: 0,
          created_at: new Date().toISOString(),
          _fileSize: file.size,
        },
        ...snapshot,
      ]);
      return { snapshot };
    },
    onError: (err, _file, ctx) => {
      queryClient.setQueryData(queryKey, ctx.snapshot);
      setUploadError(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  function handleFileInput(e) {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    e.target.value = "";
    if (!files.length) {
      setUploadError("Only PDF files are supported.");
      return;
    }
    setUploadError(null);
    files.forEach((f) => upload(f));
  }

  const indexedCount = documents.filter((d) => d.status === "ready").length;
  const processingCount = documents.filter((d) => d.status === "processing").length;

  const subtitle = isLoading
    ? "Loading…"
    : `${indexedCount} document${indexedCount !== 1 ? "s" : ""} indexed${
        processingCount > 0 ? `, ${processingCount} processing` : ""
      } in your organization's knowledge base.`;

  return (
    <div
      data-theme={theme}
      className="flex w-full h-screen bg-canvas text-ink font-sans transition-[background,color] duration-[250ms] ease-linear"
    >
      <Sidebar
        user={user}
        onLogout={onLogout}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 flex flex-col h-full min-w-0">
        <header className="h-[54px] shrink-0 border-b border-edge flex items-center justify-between px-6">
          <div className="text-[14px] font-semibold">Admin · Knowledge base</div>
          <label className="flex items-center gap-2 px-[14px] py-2 text-[13.5px] font-semibold text-white bg-accent rounded-[9px] cursor-pointer transition-colors hover:bg-accent-hover">
            <PlusIcon />
            Upload PDF
            <input type="file" accept=".pdf" multiple onChange={handleFileInput} className="hidden" />
          </label>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-[30px]">
          <div className="max-w-[900px] mx-auto">
            <div className="mb-[22px]">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] mb-1">Documents</h2>
              <p className="text-[14px] text-ink-dim">{subtitle}</p>
            </div>

            {uploadError && (
              <div
                className="mb-4 px-4 py-3 rounded-[10px] text-[13.5px] font-medium"
                style={{ color: "#c0392e", background: "rgba(192,57,46,0.08)" }}
              >
                {uploadError}
              </div>
            )}

            {/* Dropzone */}
            <label className="flex flex-col items-center gap-[10px] px-6 py-[30px] mb-[26px] bg-surface border-[1.5px] border-dashed border-edge-strong rounded-[14px] cursor-pointer text-center transition-[border,background] hover:border-accent hover:bg-accent-soft group">
              <div className="w-[42px] h-[42px] rounded-[11px] bg-accent-soft text-accent-text flex items-center justify-center group-hover:bg-white/60">
                <UploadIcon />
              </div>
              <div className="text-[14.5px] font-semibold text-ink">Drag files here or click to upload</div>
              <div className="text-[12.5px] text-ink-faint font-mono">PDF only — up to 50 MB each</div>
              <input type="file" accept=".pdf" multiple onChange={handleFileInput} className="hidden" />
            </label>

            {/* Table */}
            <div className="bg-surface border border-edge rounded-[14px] overflow-hidden">
              {documents.length === 0 && !isLoading && (
                <div className="px-6 py-10 text-center text-[14px] text-ink-faint">
                  No documents yet. Upload a PDF to get started.
                </div>
              )}

              {documents.length > 0 && (
                <>
                  <div
                    className="grid gap-[14px] px-[18px] py-3 border-b border-edge bg-surface-2 text-[11px] font-semibold tracking-[0.04em] uppercase text-ink-faint"
                    style={{ gridTemplateColumns: "1fr 84px 96px 130px 120px" }}
                  >
                    <div>Name</div>
                    <div>Type</div>
                    <div>Size</div>
                    <div>Uploaded</div>
                    <div>Status</div>
                  </div>

                  {documents.map((doc) => {
                    const dot = doc.filename.lastIndexOf(".");
                    const ext = dot > -1 ? doc.filename.slice(dot + 1).toUpperCase().slice(0, 4) : "PDF";
                    let size;
                    if (doc._fileSize) size = humanSize(doc._fileSize);
                    else if (doc.chunk_count > 0) size = `${doc.chunk_count} chunks`;
                    else size = "—";
                    const date = formatDate(new Date(doc.created_at));
                    const status = STATUS_MAP[doc.status] ?? doc.status;

                    return (
                      <div
                        key={doc.id}
                        className="grid gap-[14px] items-center px-[18px] py-[13px] border-b border-edge last:border-b-0 transition-colors hover:bg-surface-2"
                        style={{ gridTemplateColumns: "1fr 84px 96px 130px 120px" }}
                      >
                        <div className="flex items-center gap-[11px] min-w-0">
                          <span className="w-[30px] h-[30px] shrink-0 rounded-[7px] bg-accent-soft text-accent-text flex items-center justify-center text-[9.5px] font-semibold font-mono">
                            {ext}
                          </span>
                          {doc.url ? (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[14px] font-medium text-accent-text whitespace-nowrap overflow-hidden text-ellipsis hover:underline"
                            >
                              {doc.filename}
                            </a>
                          ) : (
                            <span className="text-[14px] font-medium text-ink whitespace-nowrap overflow-hidden text-ellipsis">
                              {doc.filename}
                            </span>
                          )}
                        </div>
                        <div className="text-[13px] text-ink-dim font-mono">{ext}</div>
                        <div className="text-[13px] text-ink-dim font-mono">{size}</div>
                        <div className="text-[13px] text-ink-dim">{date}</div>
                        <div><StatusBadge status={status} /></div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
