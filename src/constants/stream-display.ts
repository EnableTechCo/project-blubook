const STREAM_DISPLAY_OVERRIDES: Record<string, string> = {
  "Mgt Consulting": "Management Consulting and Advisory",
  "Sales Ops": "Sales Operations",
  "Post Sales Support": "Customer Support and Success",
};

export function getStreamDisplayName(stream: string | null | undefined) {
  if (!stream) {
    return "Unknown Stream";
  }

  return STREAM_DISPLAY_OVERRIDES[stream] ?? stream;
}
