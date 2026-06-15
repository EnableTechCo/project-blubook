import { FileUploader } from "@/components/ui/file-uploader";

export function DocumentUploadField({
  title,
  helper,
  fileName,
  disabled,
  onSelect,
}: {
  title: string;
  helper: string;
  fileName: string | null;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
        {title}
      </p>
      <p className="mt-1 text-xs text-slate-600">{helper}</p>
      <div className="mt-3 flex items-center gap-3">
        <FileUploader
          buttonLabel={fileName ? "Replace File" : "Upload File"}
          onFilesSelected={(files) => onSelect(files[0] ?? null)}
          accept="application/pdf,image/*"
          disabled={disabled}
          variant="ghost"
          className="h-8 border border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-100"
        />
        <p className="text-xs text-slate-600">
          {fileName ?? "No file selected"}
        </p>
      </div>
    </div>
  );
}
