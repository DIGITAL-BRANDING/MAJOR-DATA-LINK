import type { ReactNode } from 'react';

function inlineFormatting(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function NotificationMessage({ body }: { body: string }) {
  const lines = body.replace(/\r\n?/g, '\n').replace(/\s+🔹\s+/g, '\n- 🔹 ').split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="mb-4 last:mb-0">
        {paragraph.map((line, index) => <span key={index}>{index > 0 && <br />}{inlineFormatting(line)}</span>)}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="mb-4 list-disc space-y-2 pl-5 last:mb-0">
        {list.map((line, index) => <li key={index}>{inlineFormatting(line.replace(/^\s*[-*]\s+/, ''))}</li>)}
      </ul>
    );
    list = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      list.push(line);
    } else {
      flushList();
      paragraph.push(line);
    }
  }

  flushParagraph();
  flushList();
  return <div className="break-words text-left text-sm leading-6 text-slate-600">{blocks}</div>;
}
