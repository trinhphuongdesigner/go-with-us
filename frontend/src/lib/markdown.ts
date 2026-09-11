import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

/** Renders Markdown source to HTML for the split-editor preview pane. */
export function mdToHtml(markdownSource: string): string {
  if (!markdownSource.trim()) return '';
  return marked.parse(markdownSource, { async: false }) as string;
}
