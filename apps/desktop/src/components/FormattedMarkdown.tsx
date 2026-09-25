import React from 'react';
import katex from 'katex';

interface FormattedMarkdownProps {
  content: string;
}

export const FormattedMarkdown: React.FC<FormattedMarkdownProps> = ({ content }) => {
  if (!content) return null;

  // 1. Parse Block Math ($$...$$ or \[...\]) and Inline Math ($...$ or \(...\)) using KaTeX
  const parseMathAndMarkdown = (text: string) => {
    // Replace Block Math ($$...$$ or \[...\])
    let processed = text.replace(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/g, (match) => {
      const formula = match.replace(/^(\$\$|\\\[)|(\$\$|\\\])$/g, '').trim();
      try {
        return `<div class="katex-display-block my-2.5 p-2 bg-[#121319] border border-white/10 rounded-xl overflow-x-auto text-center">${katex.renderToString(
          formula,
          { displayMode: true, throwOnError: false }
        )}</div>`;
      } catch (e) {
        return match;
      }
    });

    // Replace Inline Math ($...$ or \(...\)) - avoid matching currency like $100
    processed = processed.replace(/(\$([^\$\n]+)\$|\\\(([^\)\n]+)\\\))/g, (match, p1, p2, p3) => {
      const formula = (p2 || p3 || '').trim();
      if (!formula || /^\d+(\.\d+)?$/.test(formula)) return match; // Skip standalone numbers/currency
      try {
        return `<span class="katex-inline-block px-1 font-mono">${katex.renderToString(formula, {
          displayMode: false,
          throwOnError: false,
        })}</span>`;
      } catch (e) {
        return match;
      }
    });

    // Replace Fenced Code Blocks (```lang ... ```)
    processed = processed.replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      return `<pre class="my-2 p-3 bg-[#111218] border border-white/10 rounded-xl overflow-x-auto font-mono text-[11px] text-amber-300 leading-normal"><div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-sans border-b border-white/5 pb-1 flex justify-between"><span>${lang || 'code'}</span></div><code>${escapeHtml(code.trim())}</code></pre>`;
    });

    // Replace Inline Code (`code`)
    processed = processed.replace(/`([^`]+)`/g, '<code class="bg-black/40 border border-white/10 px-1.5 py-0.5 rounded text-[11px] font-mono text-amber-300">$1</code>');

    // Split into paragraphs / lines for list and bold processing
    const lines = processed.split('\n');
    const resultHtml: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Format Bold (**text**) and Italics (*text*)
      line = line.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white font-sans">$1</strong>');
      line = line.replace(/\*([^*]+)\*/g, '<em class="italic text-slate-200">$1</em>');

      // Detect Headings (### Heading)
      if (/^#{1,3}\s+/.test(line)) {
        if (inList) {
          resultHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
          listType = null;
        }
        const title = line.replace(/^#{1,3}\s+/, '');
        resultHtml.push(`<h4 class="text-[13px] font-bold text-blue-400 mt-3 mb-1.5 border-b border-white/5 pb-1 flex items-center space-x-1.5 font-sans"><span>${title}</span></h4>`);
        continue;
      }

      // Detect Bullet Lists (- item or * item)
      const bulletMatch = line.match(/^[\s]*[-*•]\s+(.*)/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) resultHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
          resultHtml.push('<ul class="space-y-1.5 my-1.5 pl-1">');
          inList = true;
          listType = 'ul';
        }
        resultHtml.push(`<li class="flex items-start space-x-2 text-[12px] text-[#e3e3e3] leading-relaxed"><span class="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span><span class="flex-1">${bulletMatch[1]}</span></li>`);
        continue;
      }

      // Detect Numbered Lists (1. item)
      const numberMatch = line.match(/^[\s]*(\d+)\.\s+(.*)/);
      if (numberMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) resultHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
          resultHtml.push('<ol class="space-y-1.5 my-1.5 pl-1">');
          inList = true;
          listType = 'ol';
        }
        resultHtml.push(`<li class="flex items-start space-x-2 text-[12px] text-[#e3e3e3] leading-relaxed"><span class="font-semibold text-blue-400 text-[11px] shrink-0 font-mono">${numberMatch[1]}.</span><span class="flex-1">${numberMatch[2]}</span></li>`);
        continue;
      }

      // Close list if line is normal text
      if (inList && line.trim() === '') {
        resultHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
        continue;
      }

      // Normal paragraph / line
      if (line.trim().length > 0) {
        resultHtml.push(`<p class="my-1 text-[12px] text-[#e3e3e3] leading-relaxed font-sans">${line}</p>`);
      }
    }

    if (inList) {
      resultHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
    }

    return resultHtml.join('');
  };

  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formattedHtml = parseMathAndMarkdown(content);

  return (
    <div
      className="formatted-markdown-body space-y-1 leading-relaxed break-words font-sans text-xs text-[#e3e3e3]"
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
};
