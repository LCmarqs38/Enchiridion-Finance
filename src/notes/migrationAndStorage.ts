import { JSONContent } from '@tiptap/react';
import { NotePage, LegacyBlock } from './types';

const STORAGE_KEY = 'enchiridion_notion_pages_v8';
const BACKUP_MIGRATION_KEY = 'enchiridion_pre_tiptap_backup_v8';

// Converte string HTML simples de blocos legados para nós de texto/marks do Tiptap
export function parseHtmlToTiptapInline(html: string): JSONContent[] {
  if (!html || html === '<br>') return [];
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const result: JSONContent[] = [];

  function traverse(node: Node, activeMarks: { type: string; attrs?: Record<string, any> }[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        result.push({
          type: 'text',
          text,
          ...(activeMarks.length > 0 ? { marks: [...activeMarks] } : {}),
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'br') {
        result.push({ type: 'hardBreak' });
        return;
      }

      const nextMarks = [...activeMarks];
      if (tag === 'b' || tag === 'strong' || el.style.fontWeight === 'bold') {
        nextMarks.push({ type: 'bold' });
      }
      if (tag === 'i' || tag === 'em' || el.style.fontStyle === 'italic') {
        nextMarks.push({ type: 'italic' });
      }
      if (tag === 'u' || el.style.textDecoration.includes('underline')) {
        nextMarks.push({ type: 'underline' });
      }
      if (tag === 's' || tag === 'strike' || el.style.textDecoration.includes('line-through')) {
        nextMarks.push({ type: 'strike' });
      }
      if (el.style.color) {
        nextMarks.push({ type: 'textStyle', attrs: { color: el.style.color } });
      }
      if (el.getAttribute('color')) {
        nextMarks.push({ type: 'textStyle', attrs: { color: el.getAttribute('color') } });
      }
      if (el.style.backgroundColor && el.style.backgroundColor !== 'transparent') {
        nextMarks.push({ type: 'highlight', attrs: { color: el.style.backgroundColor } });
      }

      el.childNodes.forEach((child) => traverse(child, nextMarks));
    }
  }

  temp.childNodes.forEach((child) => traverse(child, []));
  return result;
}

export function migrateLegacyBlocksToTiptap(blocks: LegacyBlock[]): JSONContent {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const content: JSONContent[] = [];

  for (const b of blocks) {
    const inlineContent = parseHtmlToTiptapInline(b.content || '');

    switch (b.type) {
      case 'h1':
        content.push({ type: 'heading', attrs: { level: 1 }, content: inlineContent });
        break;
      case 'h2':
        content.push({ type: 'heading', attrs: { level: 2 }, content: inlineContent });
        break;
      case 'h3':
        content.push({ type: 'heading', attrs: { level: 3 }, content: inlineContent });
        break;
      case 'todo':
        content.push({
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: Boolean(b.checked) },
              content: [{ type: 'paragraph', content: inlineContent }],
            },
          ],
        });
        break;
      case 'bullet':
        content.push({
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: inlineContent }] }],
        });
        break;
      case 'number':
        content.push({
          type: 'orderedList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: inlineContent }] }],
        });
        break;
      case 'quote':
        content.push({
          type: 'blockquote',
          content: [{ type: 'paragraph', content: inlineContent }],
        });
        break;
      case 'divider':
        content.push({ type: 'horizontalRule' });
        break;
      case 'page':
        content.push({
          type: 'pageLink',
          attrs: {
            pageId: b.targetPageId || '',
            title: (b.content || 'Subpágina').replace(/<[^>]*>?/gm, ''),
          },
        });
        break;
      case '2-col': {
        const col1Inline = parseHtmlToTiptapInline(b.content || '');
        const col2Inline = parseHtmlToTiptapInline(b.content2 || '');
        content.push({
          type: 'columnList',
          attrs: { columns: 2 },
          content: [
            { type: 'column', content: [{ type: 'paragraph', content: col1Inline }] },
            { type: 'column', content: [{ type: 'paragraph', content: col2Inline }] },
          ],
        });
        break;
      }
      default:
        content.push({
          type: 'paragraph',
          ...(inlineContent.length > 0 ? { content: inlineContent } : {}),
        });
        break;
    }
  }

  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  return { type: 'doc', content };
}

export function loadAndMigratePages(): NotePage[] {
  const keys = [
    'enchiridion_notion_pages_v8',
    'enchiridion_notion_pages_v7',
    'enchiridion_notion_pages_v6',
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      // Salva backup intocado antes da primeira migração
      if (!localStorage.getItem(BACKUP_MIGRATION_KEY)) {
        localStorage.setItem(BACKUP_MIGRATION_KEY, raw);
      }

      const now = Date.now();
      const migrated: NotePage[] = parsed.map((p: any) => {
        const hasValidTiptapContent =
          p.content && typeof p.content === 'object' && p.content.type === 'doc';

        return {
          id: p.id || `page-${now}-${Math.random().toString(36).slice(2, 7)}`,
          title: p.title ?? 'Sem título',
          icon: p.icon || (p.parentId ? '📄' : '💰'),
          cover: p.cover || undefined,
          parentId: p.parentId || null,
          isFavorite: Boolean(p.isFavorite),
          isDeleted: Boolean(p.isDeleted),
          content: hasValidTiptapContent
            ? p.content
            : migrateLegacyBlocksToTiptap(p.blocks || []),
          comments: Array.isArray(p.comments) ? p.comments : [],
          createdAt: p.createdAt || now,
          updatedAt: p.updatedAt || now,
        };
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (err) {
      console.error('Erro ao ler/migrar chave:', key, err);
    }
  }

  const defaultPage: NotePage = {
    id: 'root-1',
    title: 'CONTAS',
    icon: '💰',
    parentId: null,
    isFavorite: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    comments: [],
    content: {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
  };

  return [defaultPage];
}

export function savePagesToStorage(pages: NotePage[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
    return true;
  } catch (err) {
    console.error('Erro ao salvar páginas no localStorage:', err);
    return false;
  }
}

// Extrai texto puro de um JSONContent para busca global
export function extractPlainTextFromJSON(node?: JSONContent): string {
  if (!node) return '';
  let text = node.text || '';
  if (node.attrs?.title) text += ' ' + node.attrs.title;
  if (Array.isArray(node.content)) {
    text += ' ' + node.content.map(extractPlainTextFromJSON).join(' ');
  }
  return text.trim();
}

// Converte JSONContent do Tiptap para Markdown
export function jsonToMarkdown(doc: JSONContent, pageTitle: string): string {
  const lines: string[] = [`# ${pageTitle}\n`];

  function serializeInline(nodes?: JSONContent[]): string {
    if (!nodes) return '';
    return nodes
      .map((n) => {
        if (n.type === 'hardBreak') return '\n';
        let t = n.text || '';
        if (n.marks) {
          for (const m of n.marks) {
            if (m.type === 'bold') t = `**${t}**`;
            if (m.type === 'italic') t = `*${t}*`;
            if (m.type === 'strike') t = `~~${t}~~`;
            if (m.type === 'code') t = `\`${t}\``;
            if (m.type === 'link' && m.attrs?.href) t = `[${t}](${m.attrs.href})`;
          }
        }
        return t;
      })
      .join('');
  }

  function walkBlock(b: JSONContent) {
    switch (b.type) {
      case 'heading': {
        const hashes = '#'.repeat(b.attrs?.level || 1);
        lines.push(`${hashes} ${serializeInline(b.content)}\n`);
        break;
      }
      case 'paragraph':
        lines.push(`${serializeInline(b.content)}\n`);
        break;
      case 'bulletList':
        b.content?.forEach((li) => {
          lines.push(`- ${extractPlainTextFromJSON(li)}`);
        });
        lines.push('');
        break;
      case 'orderedList':
        b.content?.forEach((li, i) => {
          lines.push(`${i + 1}. ${extractPlainTextFromJSON(li)}`);
        });
        lines.push('');
        break;
      case 'taskList':
        b.content?.forEach((ti) => {
          const mark = ti.attrs?.checked ? 'x' : ' ';
          lines.push(`- [${mark}] ${extractPlainTextFromJSON(ti)}`);
        });
        lines.push('');
        break;
      case 'blockquote':
        lines.push(`> ${extractPlainTextFromJSON(b)}\n`);
        break;
      case 'codeBlock':
        lines.push(`\`\`\`${b.attrs?.language || ''}\n${extractPlainTextFromJSON(b)}\n\`\`\`\n`);
        break;
      case 'horizontalRule':
        lines.push(`---\n`);
        break;
      case 'pageLink':
        lines.push(`📄 **[${b.attrs?.title || 'Subpágina'}]**\n`);
        break;
      default:
        if (b.content) b.content.forEach(walkBlock);
    }
  }

  doc.content?.forEach(walkBlock);
  return lines.join('\n');
}

// Importa Markdown para JSONContent do Tiptap
export function markdownToTiptapJSON(md: string): { title: string; content: JSONContent } {
  const rawLines = md.split(/\r?\n/);
  let title = 'Documento Importado';
  const content: JSONContent[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (i === 0 && line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }
    if (line.startsWith('#### ')) {
      content.push({ type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: line.slice(5) }] });
    } else if (line.startsWith('### ')) {
      content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: line.slice(4) }] });
    } else if (line.startsWith('## ')) {
      content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: line.slice(3) }] });
    } else if (line.startsWith('# ')) {
      content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: line.slice(2) }] });
    } else if (/^-\s\[([ xX])\]\s/.test(line)) {
      const checked = /^-\s\[[xX]\]/.test(line);
      const text = line.replace(/^-\s\[[ xX]\]\s/, '');
      content.push({
        type: 'taskList',
        content: [{ type: 'taskItem', attrs: { checked }, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }],
      });
    } else if (line.startsWith('- ')) {
      content.push({
        type: 'bulletList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: line.slice(2) }] }] }],
      });
    } else if (line.trim() === '---') {
      content.push({ type: 'horizontalRule' });
    } else if (line.startsWith('> ')) {
      content.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: line.slice(2) }] }],
      });
    } else if (line.trim() !== '') {
      content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
    }
  }

  if (content.length === 0) content.push({ type: 'paragraph' });
  return { title, content: { type: 'doc', content } };
}