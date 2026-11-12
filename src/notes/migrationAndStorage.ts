import type { JSONContent } from '@tiptap/react';
import type { NotePage } from './types';

export interface LegacyBlock {
  id?: string;
  type: string;
  content?: string;
  content2?: string;
  checked?: boolean;
  targetPageId?: string;
}

const STORAGE_KEY = 'enchiridion_notion_pages_v8';
const BACKUP_MIGRATION_KEY = 'enchiridion_pre_tiptap_backup_v8';

// Garante que nunca seja criado um nó { type: 'text', text: '' } (proibido pelo ProseMirror)
function createTextContent(text: string): JSONContent[] {
  return text ? [{ type: 'text', text }] : [];
}

function createParagraphNode(inlineContent?: JSONContent[]): JSONContent {
  return inlineContent && inlineContent.length > 0
    ? { type: 'paragraph', content: inlineContent }
    : { type: 'paragraph' };
}

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
      if (
        tag === 'b' ||
        tag === 'strong' ||
        el.style.fontWeight === 'bold' ||
        Number(el.style.fontWeight) >= 600
      ) {
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
      if (tag === 'code') {
        nextMarks.push({ type: 'code' });
      }
      if (tag === 'a' && el.getAttribute('href')) {
        nextMarks.push({ type: 'link', attrs: { href: el.getAttribute('href') } });
      }
      if (el.style.color) {
        nextMarks.push({ type: 'textStyle', attrs: { color: el.style.color } });
      } else if (el.getAttribute('color')) {
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

// Faz o merge de itens de lista consecutivos (tarefas, marcadores, numeradas) no mesmo bloco pai
function appendListItem(
  content: JSONContent[],
  listType: 'taskList' | 'bulletList' | 'orderedList',
  itemNode: JSONContent
) {
  const prev = content[content.length - 1];
  if (prev && prev.type === listType && Array.isArray(prev.content)) {
    prev.content.push(itemNode);
  } else {
    content.push({
      type: listType,
      content: [itemNode],
    });
  }
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
      case 'h2':
      case 'h3': {
        const level = b.type === 'h1' ? 1 : b.type === 'h2' ? 2 : 3;
        content.push({
          type: 'heading',
          attrs: { level },
          ...(inlineContent.length > 0 ? { content: inlineContent } : {}),
        });
        break;
      }
      case 'todo':
        appendListItem(content, 'taskList', {
          type: 'taskItem',
          attrs: { checked: Boolean(b.checked) },
          content: [createParagraphNode(inlineContent)],
        });
        break;
      case 'bullet':
        appendListItem(content, 'bulletList', {
          type: 'listItem',
          content: [createParagraphNode(inlineContent)],
        });
        break;
      case 'number':
        appendListItem(content, 'orderedList', {
          type: 'listItem',
          content: [createParagraphNode(inlineContent)],
        });
        break;
      case 'quote':
        content.push({
          type: 'blockquote',
          content: [createParagraphNode(inlineContent)],
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
            title: (b.content || 'Subpágina').replace(/<[^>]*>?/gm, '').trim() || 'Subpágina',
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
            { type: 'column', content: [createParagraphNode(col1Inline)] },
            { type: 'column', content: [createParagraphNode(col2Inline)] },
          ],
        });
        break;
      }
      default:
        content.push(createParagraphNode(inlineContent));
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
      const migrated: NotePage[] = parsed.map((p: any, idx: number) => {
        const hasValidTiptapContent =
          p.content && typeof p.content === 'object' && p.content.type === 'doc';

        return {
          id: p.id || `page-${now}-${idx}`,
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

// Extrai texto puro de um JSONContent para busca global (inclui blocos especiais)
export function extractPlainTextFromJSON(node?: JSONContent): string {
  if (!node) return '';
  const parts: string[] = [];

  if (node.text) parts.push(node.text);
  if (node.attrs?.title) parts.push(String(node.attrs.title));
  if (node.attrs?.summary) parts.push(String(node.attrs.summary));
  if (node.attrs?.latex) parts.push(String(node.attrs.latex));
  if (node.attrs?.url) parts.push(String(node.attrs.url));

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const childText = extractPlainTextFromJSON(child);
      if (childText) parts.push(childText);
    }
  }

  return parts.join(' ').trim();
}

// Converte JSONContent do Tiptap para Markdown preservando formatações e blocos customizados
export function jsonToMarkdown(doc: JSONContent, pageTitle: string): string {
  const lines: string[] = [`# ${pageTitle || 'Sem título'}\n`];

  function serializeInline(nodes?: JSONContent[]): string {
    if (!nodes) return '';
    return nodes
      .map((n) => {
        if (n.type === 'hardBreak') return '\n';
        let t = n.text || '';
        if (n.marks && t) {
          for (const m of n.marks) {
            if (m.type === 'code') t = `\`${t}\``;
            if (m.type === 'bold') t = `**${t}**`;
            if (m.type === 'italic') t = `*${t}*`;
            if (m.type === 'strike') t = `~~${t}~~`;
            if (m.type === 'link' && m.attrs?.href) t = `[${t}](${m.attrs.href})`;
          }
        }
        return t;
      })
      .join('');
  }

  function serializeBlockChildrenInline(block?: JSONContent): string {
    if (!block?.content) return '';
    return block.content
      .map((child) =>
        child.type === 'paragraph' || child.type === 'heading'
          ? serializeInline(child.content)
          : extractPlainTextFromJSON(child)
      )
      .filter(Boolean)
      .join(' ');
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
          lines.push(`- ${serializeBlockChildrenInline(li)}`);
        });
        lines.push('');
        break;
      case 'orderedList':
        b.content?.forEach((li, i) => {
          lines.push(`${i + 1}. ${serializeBlockChildrenInline(li)}`);
        });
        lines.push('');
        break;
      case 'taskList':
        b.content?.forEach((ti) => {
          const mark = ti.attrs?.checked ? 'x' : ' ';
          lines.push(`- [${mark}] ${serializeBlockChildrenInline(ti)}`);
        });
        lines.push('');
        break;
      case 'blockquote':
        lines.push(`> ${serializeBlockChildrenInline(b)}\n`);
        break;
      case 'calloutBlock':
        lines.push(`> ${b.attrs?.icon || '💡'} ${serializeBlockChildrenInline(b)}\n`);
        break;
      case 'toggleBlock':
        lines.push(`▸ **${b.attrs?.summary || 'Alternante'}**`);
        b.content?.forEach(walkBlock);
        break;
      case 'codeBlock': {
        const rawCode = b.content?.map((n) => n.text || '').join('\n') || '';
        lines.push(`\`\`\`${b.attrs?.language || ''}\n${rawCode}\n\`\`\`\n`);
        break;
      }
      case 'mathBlock':
        lines.push(`$$\n${b.attrs?.latex || ''}\n$$\n`);
        break;
      case 'bookmarkBlock':
        lines.push(
          `🔗 [${b.attrs?.title || b.attrs?.url || 'Link'}](${b.attrs?.url || ''})\n`
        );
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

// Importa Markdown para JSONContent do Tiptap agrupando listas e evitando nós vazios
export function markdownToTiptapJSON(md: string): { title: string; content: JSONContent } {
  const rawLines = md.split(/\r?\n/);
  let title = 'Documento Importado';
  const content: JSONContent[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (i === 0 && line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim() || 'Documento Importado';
      continue;
    }

    if (line.startsWith('#### ')) {
      const textContent = createTextContent(line.slice(5).trim());
      content.push({
        type: 'heading',
        attrs: { level: 4 },
        ...(textContent.length > 0 ? { content: textContent } : {}),
      });
    } else if (line.startsWith('### ')) {
      const textContent = createTextContent(line.slice(4).trim());
      content.push({
        type: 'heading',
        attrs: { level: 3 },
        ...(textContent.length > 0 ? { content: textContent } : {}),
      });
    } else if (line.startsWith('## ')) {
      const textContent = createTextContent(line.slice(3).trim());
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        ...(textContent.length > 0 ? { content: textContent } : {}),
      });
    } else if (line.startsWith('# ')) {
      const textContent = createTextContent(line.slice(2).trim());
      content.push({
        type: 'heading',
        attrs: { level: 1 },
        ...(textContent.length > 0 ? { content: textContent } : {}),
      });
    } else if (/^-\s\[([ xX])\](\s|$)/.test(line)) {
      const checked = /^-\s\[[xX]\]/.test(line);
      const text = line.replace(/^-\s\[[ xX]\]\s?/, '');
      appendListItem(content, 'taskList', {
        type: 'taskItem',
        attrs: { checked },
        content: [createParagraphNode(createTextContent(text))],
      });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.slice(2);
      appendListItem(content, 'bulletList', {
        type: 'listItem',
        content: [createParagraphNode(createTextContent(text))],
      });
    } else if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, '');
      appendListItem(content, 'orderedList', {
        type: 'listItem',
        content: [createParagraphNode(createTextContent(text))],
      });
    } else if (line.trim() === '---') {
      content.push({ type: 'horizontalRule' });
    } else if (line.startsWith('> ')) {
      const text = line.slice(2);
      content.push({
        type: 'blockquote',
        content: [createParagraphNode(createTextContent(text))],
      });
    } else if (line.trim() !== '') {
      content.push(createParagraphNode(createTextContent(line)));
    }
  }

  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  return { title, content: { type: 'doc', content } };
}