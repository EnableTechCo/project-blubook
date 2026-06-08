"use client";

import { ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";

type FileUploaderProps = {
  buttonLabel: string;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
};

export function FileUploader({
  buttonLabel,
  onFilesSelected,
  accept,
  disabled = false,
  multiple = false,
  variant = "primary",
  className,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    void onFilesSelected(selectedFiles);

    // Reset the input so selecting the same file again still fires onChange.
    event.target.value = "";
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {buttonLabel}
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onInputChange}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
      />
    </>
  );
}
