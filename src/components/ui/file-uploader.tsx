"use client";

import { ChangeEvent, useState, useRef, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { HoverAnimatedIcon } from "@/components/ui/hover-animated-icon";

type FileUploaderProps = {
  buttonLabel: string;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  onButtonClick?: () => void;
  icon?: ComponentType<{ className?: string; size?: number }>;
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
};

export function FileUploader({
  buttonLabel,
  onFilesSelected,
  onButtonClick,
  icon,
  accept,
  disabled = false,
  multiple = false,
  variant = "primary",
  className,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isHovered, setIsHovered] = useState(false);

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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          onButtonClick?.();
          inputRef.current?.click();
        }}
      >
        {icon ? (
          <span className="mr-1 inline-flex items-center">
            <HoverAnimatedIcon icon={icon} active={isHovered} size={16} />
          </span>
        ) : null}
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
