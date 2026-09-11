interface HtmlPreviewProps {
  html: string;
  height?: number | string;
}

/**
 * Renders AI-authored HTML (e.g. a future Draft Design / User Flow style
 * skill output) in a sandboxed iframe — `sandbox=""` disables script
 * execution and same-origin access entirely. Never trust this content
 * enough to render it any other way; see
 * D:\Coding\AI_Tool\docs\skills.md's `user-flow.generate` note for why.
 */
export default function HtmlPreview({ html, height = 480 }: HtmlPreviewProps) {
  return (
    <iframe
      title="html-preview"
      srcDoc={html}
      sandbox=""
      style={{
        width: '100%',
        height,
        border: 'none',
        borderRadius: 8,
        backgroundColor: '#ffffff',
      }}
    />
  );
}
