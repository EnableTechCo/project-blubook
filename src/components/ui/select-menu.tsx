"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SelectMenuOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SelectMenuProps = {
  id?: string;
  name?: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  emptyLabel?: string;
};

export function SelectMenu({
  id,
  name,
  value,
  options,
  onChange,
  placeholder = "Select an option",
  searchable,
  searchPlaceholder = "Search options...",
  noResultsLabel = "No matching results",
  disabled = false,
  className,
  buttonClassName,
  menuClassName,
  emptyLabel = "No options",
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const shouldShowSearch =
    (searchable ?? options.length >= 8) && options.length > 0;
  const normalizedSearch = searchValue.trim().toLowerCase();

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const visibleOptions = useMemo(() => {
    if (!normalizedSearch) {
      return options.map((option, originalIndex) => ({
        option,
        originalIndex,
      }));
    }

    return options
      .map((option, originalIndex) => ({ option, originalIndex }))
      .filter(({ option }) => {
        const label = option.label.toLowerCase();
        const description = option.description?.toLowerCase() ?? "";
        const optionValue = option.value.toLowerCase();

        return (
          label.includes(normalizedSearch) ||
          description.includes(normalizedSearch) ||
          optionValue.includes(normalizedSearch)
        );
      });
  }, [normalizedSearch, options]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearchValue("");
      return;
    }

    const selectedIndex = visibleOptions.findIndex(
      ({ option }) => option.value === value,
    );
    const fallbackIndex = visibleOptions.findIndex(
      ({ option }) => !option.disabled,
    );
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : fallbackIndex);
  }, [open, value, visibleOptions]);

  useEffect(() => {
    if (open && shouldShowSearch) {
      searchInputRef.current?.focus();
    }
  }, [open, shouldShowSearch]);

  useEffect(() => {
    if (!open || highlightedIndex < 0) {
      return;
    }

    const activeItem = listRef.current?.querySelector<HTMLElement>(
      `[data-visible-index='${highlightedIndex}']`,
    );

    activeItem?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  function moveHighlight(direction: 1 | -1) {
    if (visibleOptions.length === 0) {
      return;
    }

    let next = highlightedIndex;
    for (let step = 0; step < visibleOptions.length; step += 1) {
      next = (next + direction + visibleOptions.length) % visibleOptions.length;
      if (!visibleOptions[next]?.option.disabled) {
        setHighlightedIndex(next);
        return;
      }
    }
  }

  function commitSelection(index: number) {
    const option = visibleOptions[index]?.option;
    if (!option || option.disabled) {
      return;
    }

    onChange(option.value);
    setOpen(false);
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      commitSelection(highlightedIndex);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  function onButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveHighlight(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveHighlight(-1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else if (highlightedIndex >= 0) {
        commitSelection(highlightedIndex);
      }
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onButtonKeyDown}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 transition focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60",
          buttonClassName,
        )}
      >
        <span className={cn(!selectedOption && "text-slate-500")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          ref={listRef}
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-auto border border-slate-200 bg-white shadow-[0_10px_24px_-14px_rgba(15,23,42,0.45)]",
            menuClassName,
          )}
        >
          {shouldShowSearch ? (
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={onListKeyDown}
                placeholder={searchPlaceholder}
                className="h-9 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          ) : null}

          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">{emptyLabel}</p>
          ) : visibleOptions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">{noResultsLabel}</p>
          ) : (
            visibleOptions.map(({ option, originalIndex }, index) => {
              const isSelected = option.value === value;
              const isHighlighted = highlightedIndex === index;

              return (
                <button
                  key={`${option.value}-${originalIndex}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-visible-index={index}
                  disabled={option.disabled}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => commitSelection(index)}
                  onKeyDown={onListKeyDown}
                  className={cn(
                    "w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0",
                    option.disabled
                      ? "cursor-not-allowed text-slate-400"
                      : isHighlighted
                        ? "bg-cyan-50"
                        : "hover:bg-slate-50",
                  )}
                >
                  <p
                    className={cn(
                      "text-sm",
                      isSelected
                        ? "font-semibold text-cyan-800"
                        : "text-slate-800",
                    )}
                  >
                    {option.label}
                  </p>
                  {option.description ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {option.description}
                    </p>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
