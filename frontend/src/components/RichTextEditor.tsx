/**
 * Lightweight rich-text editor for news post bodies.
 *
 * A contentEditable surface with a formatting toolbar (bold, italic,
 * underline, headings, lists, links, images). The produced HTML is always
 * sanitized server-side before storage — this component is UX, not security.
 */

import { useEffect, useRef, useState } from "react";

import { ApiError } from "../api/client";
import { uploadsApi } from "../api/endpoints";
import { cn } from "./ui";

type ToolbarButtonProps = {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton({ label, title, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      className="rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-brand-600"
      onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
    >
      {children}
    </button>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync external value -> DOM only when it actually differs, so typing
  // (which already updated the parent) never resets the caret.
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  function emit() {
    const el = editorRef.current;
    if (el) onChange(el.innerHTML);
  }

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  function insertLink() {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const selected = sel && !sel.isCollapsed ? sel.toString() : "";
    const url = window.prompt("Link URL:", "https://");
    if (!url) return;
    if (selected) {
      document.execCommand("createLink", false, url);
    } else {
      document.execCommand("insertHTML", false, `<a href="${url}">${url}</a>`);
    }
    emit();
  }

  async function insertImage(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadsApi.upload(file);
      editorRef.current?.focus();
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${url}" alt="${file.name.replace(/\.[^.]+$/, "")}">`,
      );
      emit();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white">
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 p-1"
        role="toolbar"
        aria-label="Text formatting"
      >
        <ToolbarButton label="Bold" title="Bold (Ctrl+B)" onClick={() => exec("bold")}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton label="Italic" title="Italic (Ctrl+I)" onClick={() => exec("italic")}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton label="Underline" title="Underline (Ctrl+U)" onClick={() => exec("underline")}>
          <u>U</u>
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
        <ToolbarButton label="Heading 2" title="Heading 2" onClick={() => exec("formatBlock", "<h2>")}>
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton label="Heading 3" title="Heading 3" onClick={() => exec("formatBlock", "<h3>")}>
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>
        <ToolbarButton label="Paragraph" title="Normal text" onClick={() => exec("formatBlock", "<p>")}>
          <span className="text-xs font-medium">¶</span>
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
        <ToolbarButton label="Bullet list" title="Bullet list" onClick={() => exec("insertUnorderedList")}>
          <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" title="Numbered list" onClick={() => exec("insertOrderedList")}>
          <Icon d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
        </ToolbarButton>
        <ToolbarButton label="Quote" title="Quote block" onClick={() => exec("formatBlock", "<blockquote>")}>
          <Icon d="M6 17h3l2-4V7H5v6h3M14 17h3l2-4V7h-6v6h3" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
        <ToolbarButton label="Insert link" title="Insert link" onClick={insertLink}>
          <Icon d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </ToolbarButton>
        <ToolbarButton
          label="Insert image"
          title="Upload and insert an image"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden />
          ) : (
            <Icon d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3zM12 15a3 3 0 100-6 3 3 0 000 6z" />
          )}
        </ToolbarButton>
        <ToolbarButton label="Clear formatting" title="Clear formatting" onClick={() => exec("removeFormat")}>
          <Icon d="M17 3L21 7M15 5l4 4M4 7h9M20 17l-4 4M14 17l4 4M4 17h9" />
        </ToolbarButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void insertImage(file);
          }}
        />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Post body"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          // Files pasted directly (e.g. screenshots) upload as images.
          const file = e.clipboardData.files?.[0];
          if (file && file.type.startsWith("image/")) {
            e.preventDefault();
            void insertImage(file);
          }
        }}
        className={cn(
          "rich-editor rich-text min-h-[220px] max-w-none p-4 text-base",
          "empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]",
        )}
      />
      {error && <p className="border-t border-slate-200 px-4 py-2 text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}
