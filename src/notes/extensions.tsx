import React, { useState, useEffect } from 'react';
import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import {
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Trash2,
  Copy,
  Edit3,
  Globe,
  Sigma,
} from 'lucide-react';
import { CALLOUT_ICONS } from './types';

// ============================================================================
// PONTE DE COMUNICAÇÃO ENTRE O EDITOR E A ÁRVORE DE PÁGINAS
// ============================================================================
export interface PageBridge {
  getPageInfo: (id: string) => { title: string; icon: string } | null;
  openPage: (id: string) => void;
  renamePage: (id: string, newTitle: string) => void;
  duplicatePage: (id: string) => void;
  deletePage: (id: string) => void;
}

export const PageBridgeContext = React.createContext<PageBridge>({
  getPageInfo: () => null,
  openPage: () => {},
  renamePage: () => {},
  duplicatePage: () => {},
  deletePage: () => {},
});

// ============================================================================
// 1. NÓ DE SUBPÁGINA / LINK DE PÁGINA (pageLink)
// ============================================================================
const PageLinkComponent = ({ node, deleteNode }: any) => {
  const bridge = React.useContext(PageBridgeContext);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const pageId = node.attrs.pageId;
  const liveInfo = bridge.getPageInfo(pageId);
  const displayTitle = liveInfo ? liveInfo.title : node.attrs.title || 'Subpágina';
  const displayIcon = liveInfo ? liveInfo.icon : '📄';

  useEffect(() => {
    if (!ctxMenu) return;
    const handleGlobalClick = () => setCtxMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [ctxMenu]);

  return (
    <NodeViewWrapper
      data-type="page-link"
      className="my-1 select-none relative"
      contentEditable={false}
    >
      <div
        onClick={() => pageId && bridge.openPage(pageId)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width - 210));
          const y = e.clientY - rect.top;
          setCtxMenu({ x, y });
        }}
        className="group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-[#181E24] cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base md:text-xl leading-none">{displayIcon}</span>
          <span className="text-sm md:text-lg font-semibold text-[#F1F5F9] border-b border-[#475569] group-hover:border-[#F1F5F9] transition-colors">
            {displayTitle || 'Sem título'}
          </span>
        </div>
        <span className="text-[11px] text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity">
          Botão direito para opções
        </span>
      </div>

      {ctxMenu && (
        <div
          style={{ left: ctxMenu.x, top: ctxMenu.y + 8 }}
          onClick={(e) => e.stopPropagation()}
          onMouseLeave={() => setCtxMenu(null)}
          className="absolute z-50 w-52 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1 text-xs text-[#F1F5F9] space-y-0.5"
        >
          <div className="px-2 py-1 text-[10px] text-[#94A3B8] font-semibold uppercase">
            Página
          </div>
          <button
            type="button"
            onClick={() => {
              setCtxMenu(null);
              if (pageId) bridge.openPage(pageId);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#222A33] text-left"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8]" /> Abrir página
          </button>
          <button
            type="button"
            onClick={() => {
              setCtxMenu(null);
              const next = window.prompt('Novo nome da subpágina:', displayTitle);
              if (next && next.trim() && pageId) bridge.renamePage(pageId, next.trim());
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#222A33] text-left"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#94A3B8]" /> Renomear
          </button>
          <button
            type="button"
            onClick={() => {
              setCtxMenu(null);
              if (pageId) bridge.duplicatePage(pageId);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#222A33] text-left"
          >
            <Copy className="w-3.5 h-3.5 text-[#94A3B8]" /> Duplicar subpágina
          </button>
          <div className="border-t border-[#1E293B] my-1" />
          <button
            type="button"
            onClick={() => {
              setCtxMenu(null);
              if (pageId) bridge.deletePage(pageId);
              deleteNode();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#472222] text-[#D44C47] text-left"
          >
            <Trash2 className="w-3.5 h-3.5" /> Mover para a lixeira
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const PageLinkNode = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      pageId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-page-id') || '',
        renderHTML: (attrs) => ({ 'data-page-id': attrs.pageId }),
      },
      title: {
        default: 'Subpágina',
        parseHTML: (el) => el.getAttribute('data-title') || 'Subpágina',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="page-link"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page-link' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PageLinkComponent);
  },
});

// ============================================================================
// 2. SISTEMA DE COLUNAS LADO A LADO (columnList & column)
// ============================================================================
export const ColumnNode = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column',
        class: 'notion-column min-w-0',
      }),
      0,
    ];
  },
});

export const ColumnListNode = Node.create({
  name: 'columnList',
  group: 'block',
  content: 'column{2,3}',
  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: (el) => parseInt(el.getAttribute('data-cols') || '2', 10) || 2,
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="column-list"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const cols = node.attrs.columns || 2;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column-list',
        'data-cols': cols,
        class: `notion-column-list notion-cols-${cols}`,
      }),
      0,
    ];
  },
});

// ============================================================================
// 3. LISTA DE ALTERNANTES / TOGGLE BLOCK (toggleBlock)
// ============================================================================
const ToggleComponent = ({ node, updateAttributes }: any) => {
  const open = Boolean(node.attrs.open);
  return (
    <NodeViewWrapper data-type="toggle-block" className="my-2">
      <div className="flex items-center gap-1.5" contentEditable={false}>
        <button
          type="button"
          onClick={() => updateAttributes({ open: !open })}
          className="p-0.5 rounded hover:bg-[#181E24] text-[#94A3B8] hover:text-[#F1F5F9] transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <input
          type="text"
          value={node.attrs.summary || ''}
          onChange={(e) => updateAttributes({ summary: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          placeholder="Alternante..."
          className="flex-1 bg-transparent font-semibold text-[#F1F5F9] placeholder-[#64748B] focus:outline-none text-sm md:text-base"
        />
      </div>
      <div className={open ? 'pl-6 mt-1.5 border-l border-[#1E293B]' : 'hidden'}>
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
};

export const ToggleNode = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  addAttributes() {
    return {
      summary: { default: 'Lista de alternantes' },
      open: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="toggle-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle-block' }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToggleComponent);
  },
});

// ============================================================================
// 4. FRASE DE DESTAQUE / CALLOUT (calloutBlock)
// ============================================================================
const CalloutComponent = ({ node, updateAttributes }: any) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleGlobalClick = () => setPickerOpen(false);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [pickerOpen]);

  return (
    <NodeViewWrapper
      data-type="callout-block"
      style={{ backgroundColor: node.attrs.bgColor || '#181E24' }}
      className="my-2.5 p-3.5 rounded-xl border border-[#1E293B] flex items-start gap-3 relative"
    >
      <div
        className="relative"
        contentEditable={false}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setPickerOpen((prev) => !prev)}
          className="text-xl hover:bg-[#222A33] p-1 rounded transition"
          title="Trocar ícone"
        >
          {node.attrs.icon || '💡'}
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-9 z-40 bg-[#181E24] border border-[#1E293B] rounded-xl p-1.5 shadow-xl flex gap-1">
            {CALLOUT_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => {
                  updateAttributes({ icon: ic });
                  setPickerOpen(false);
                }}
                className="p-1 hover:bg-[#222A33] rounded text-base"
              >
                {ic}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
};

export const CalloutNode = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  addAttributes() {
    return {
      icon: { default: '💡' },
      bgColor: { default: '#181E24' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout-block' }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent);
  },
});

// ============================================================================
// 5. EQUAÇÃO MATEMÁTICA (mathBlock)
// ============================================================================
const MathComponent = ({ node, updateAttributes }: any) => {
  const [editing, setEditing] = useState(false);
  return (
    <NodeViewWrapper
      data-type="math-block"
      contentEditable={false}
      className="my-2 p-3 rounded-xl bg-[#181E24] border border-[#1E293B] flex items-center justify-between cursor-pointer"
      onClick={() => setEditing(true)}
    >
      <div className="flex items-center gap-2.5 font-mono text-sm text-amber-300 flex-1 mr-3">
        <Sigma className="w-4 h-4 text-[#94A3B8] shrink-0" />
        {editing ? (
          <input
            type="text"
            autoFocus
            value={node.attrs.latex || ''}
            onChange={(e) => updateAttributes({ latex: e.target.value })}
            onBlur={() => setEditing(false)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' || e.key === 'Escape') {
                setEditing(false);
              }
            }}
            className="w-full bg-[#12161A] text-[#F1F5F9] px-2 py-0.5 rounded border border-[#1E293B] focus:outline-none"
          />
        ) : (
          <span className="truncate">{node.attrs.latex || 'E = mc^2'}</span>
        )}
      </div>
      <span className="text-[10px] text-[#94A3B8] shrink-0">LaTeX</span>
    </NodeViewWrapper>
  );
};

export const MathNode = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      latex: {
        default: 'f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\,e^{2 \\pi i \\xi x} \\,d\\xi',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math-block' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathComponent);
  },
});

// ============================================================================
// 6. FAVORITO DA WEB / WEB BOOKMARK (bookmarkBlock)
// ============================================================================
const BookmarkComponent = ({ node }: any) => {
  const rawUrl = (node.attrs.url || '').trim();
  const safeHref = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl || 'google.com'}`;
  const title = node.attrs.title || rawUrl || safeHref;

  return (
    <NodeViewWrapper data-type="bookmark-block" contentEditable={false} className="my-2">
      <a
        href={safeHref}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between p-3 rounded-xl bg-[#181E24] hover:bg-[#222A33] border border-[#1E293B] transition group"
      >
        <div className="flex items-center gap-3 truncate">
          <Globe className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="truncate">
            <div className="text-xs font-semibold text-[#F1F5F9] truncate">{title}</div>
            <div className="text-[11px] text-[#94A3B8] truncate">{safeHref}</div>
          </div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#F1F5F9] shrink-0" />
      </a>
    </NodeViewWrapper>
  );
};

export const BookmarkNode = Node.create({
  name: 'bookmarkBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="bookmark-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'bookmark-block' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BookmarkComponent);
  },
});

// ============================================================================
// 7. IDENTAÇÃO ESTILO NOTION (Tab / Shift+Tab em Parágrafos e Títulos)
// ============================================================================
export const IndentExtension = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            keepOnSplit: true,
            parseHTML: (element) => {
              const attr = element.getAttribute('data-indent');
              if (attr) return parseInt(attr, 10) || 0;
              const pl = parseInt(element.style.paddingLeft || '0', 10);
              return pl ? Math.round(pl / 24) : 0;
            },
            renderHTML: (attributes) => {
              if (!attributes.indent || attributes.indent <= 0) return {};
              return {
                'data-indent': attributes.indent,
                style: `padding-left: ${attributes.indent * 24}px`,
              };
            },
          },
        },
      },
    ];
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return false;
        }
        const { state, dispatch } = this.editor.view;
        const { from, to } = state.selection;
        let tr = state.tr;
        let changed = false;

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph' || node.type.name === 'heading') {
            const currentIndent = node.attrs.indent || 0;
            if (currentIndent < 6) {
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: currentIndent + 1,
              });
              changed = true;
            }
            return false;
          }
        });

        if (changed && dispatch) dispatch(tr);
        return true;
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return false;
        }
        const { state, dispatch } = this.editor.view;
        const { from, to } = state.selection;
        let tr = state.tr;
        let changed = false;

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph' || node.type.name === 'heading') {
            const currentIndent = node.attrs.indent || 0;
            if (currentIndent > 0) {
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: currentIndent - 1,
              });
              changed = true;
            }
            return false;
          }
        });

        if (changed && dispatch) dispatch(tr);
        return true;
      },
      Backspace: () => {
        const { state, dispatch } = this.editor.view;
        const { empty, $from } = state.selection;
        if (!empty || $from.parentOffset !== 0) return false;

        const node = $from.parent;
        if (
          (node.type.name === 'paragraph' || node.type.name === 'heading') &&
          (node.attrs.indent || 0) > 0
        ) {
          if (dispatch) {
            const pos = $from.before();
            dispatch(
              state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: node.attrs.indent - 1,
              })
            );
          }
          return true;
        }
        return false;
      },
    };
  },
});

// ============================================================================
// 8. TASK ITEM CUSTOMIZADO (MARCA CHECKBOX SEM ABRIR TECLADO E SEM ROLAR TELA)
// ============================================================================
const CustomTaskItem = TaskItem.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('li');
      const checkboxWrapper = document.createElement('label');
      const checkboxStyler = document.createElement('span');
      const checkbox = document.createElement('input');
      const content = document.createElement('div');

      checkboxWrapper.contentEditable = 'false';
      checkbox.type = 'checkbox';
      checkbox.tabIndex = -1;

      // Impede que o clique no checkbox foque o contenteditable ou mova o cursor do editor
      checkboxWrapper.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      checkboxWrapper.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      checkboxWrapper.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      checkbox.addEventListener('change', (event) => {
        event.stopPropagation();
        if (!editor.isEditable || typeof getPos !== 'function') return;

        const savedScrollY = window.scrollY;

        // Remove qualquer foco residual do editor no celular antes de despachar a atualização
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        checkbox.blur();

        const position = getPos();
        if (typeof position !== 'number') return;

        const currentNode = editor.state.doc.nodeAt(position);
        if (!currentNode) return;

        const { checked } = event.target as HTMLInputElement;
        const tr = editor.state.tr.setNodeMarkup(position, undefined, {
          ...currentNode.attrs,
          checked,
        });
        tr.setMeta('scrollIntoView', false);

        // Despacha apenas a mudança de atributo sem chamar editor.focus()
        editor.view.dispatch(tr);

        requestAnimationFrame(() => {
          if (Math.abs(window.scrollY - savedScrollY) > 2) {
            window.scrollTo({ top: savedScrollY, behavior: 'instant' as ScrollBehavior });
          }
        });
      });

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      listItem.dataset.checked = String(Boolean(node.attrs.checked));
      checkbox.checked = Boolean(node.attrs.checked);

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      checkboxWrapper.append(checkbox, checkboxStyler);
      listItem.append(checkboxWrapper, content);

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }
          listItem.dataset.checked = String(Boolean(updatedNode.attrs.checked));
          checkbox.checked = Boolean(updatedNode.attrs.checked);
          return true;
        },
      };
    };
  },
});

// ============================================================================
// 9. FÁBRICA COMPLETA DE EXTENSÕES DO ENCHIRIDION
// ============================================================================
export function createEnchiridionExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
    }),
    Placeholder.configure({
      placeholder: "Digite '/' para comandos...",
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-400 underline cursor-pointer',
      },
    }),
    TaskList,
    CustomTaskItem.configure({
      nested: true,
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({
      HTMLAttributes: {
        class: 'rounded-xl max-w-full my-3 border border-[#1E293B]',
      },
    }),
    PageLinkNode,
    ColumnNode,
    ColumnListNode,
    ToggleNode,
    CalloutNode,
    MathNode,
    BookmarkNode,
    IndentExtension,
  ];
}