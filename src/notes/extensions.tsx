import React, { useState } from 'react';
import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import {
  ChevronRight, ChevronDown, ExternalLink, Trash2, Edit2, Copy,
  Globe, Sigma, Paperclip
} from 'lucide-react';
import { PAGE_ICONS, NOTION_COLORS } from './types';

// Contexto global leve para comunicação entre os nós do Tiptap e o gerenciador de páginas
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

  return (
    <NodeViewWrapper className="my-1 select-none relative" contentEditable={false}>
      <div
        onClick={() => pageId && bridge.openPage(pageId)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCtxMenu({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
        }}
        className="group flex items-center justify-between py-1 px-2 -mx-2 rounded-md hover:bg-[#181E24] cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base md:text-xl leading-none">{displayIcon}</span>
          <span className="text-sm md:text-lg font-semibold text-[#EDEDED] border-b border-[#454545] group-hover:border-[#EDEDED] transition-colors">
            {displayTitle || 'Sem título'}
          </span>
        </div>
        <span className="text-[11px] text-[#858585] opacity-0 group-hover:opacity-100 transition-opacity">
          Botão direito para opções
        </span>
      </div>

      {ctxMenu && (
        <div
          style={{ left: ctxMenu.x, top: ctxMenu.y + 24 }}
          onMouseLeave={() => setCtxMenu(null)}
          className="absolute z-50 w-52 bg-[#181E24] border border-[#1E293B] rounded-lg shadow-2xl p-1 text-xs text-[#EDEDED] space-y-0.5"
        >
          <div className="px-2 py-1 text-[10px] text-[#858585] font-semibold uppercase">Página</div>
          <button
            onClick={() => {
              setCtxMenu(null);
              if (pageId) bridge.openPage(pageId);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#222A33] text-left"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#858585]" /> Abrir página
          </button>
          <button
            onClick={() => {
              setCtxMenu(null);
              const next = window.prompt('Renomear página:', displayTitle);
              if (next !== null && pageId) bridge.renamePage(pageId, next);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#222A33] text-left"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#858585]" /> Renomear
          </button>
          <button
            onClick={() => {
              setCtxMenu(null);
              if (pageId) bridge.duplicatePage(pageId);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#222A33] text-left"
          >
            <Copy className="w-3.5 h-3.5 text-[#858585]" /> Duplicar
          </button>
          <div className="border-t border-[#1E293B] my-1" />
          <button
            onClick={() => {
              setCtxMenu(null);
              deleteNode();
              if (pageId) bridge.deletePage(pageId);
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
  draggable: true,
  addAttributes() {
    return {
      pageId: { default: '' },
      title: { default: 'Subpágina' },
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
// 2. SISTEMA DE COLUNAS REAIS (columnList + column)
// ============================================================================
export const ColumnNode = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'notion-column' }), 0];
  },
});

export const ColumnListNode = Node.create({
  name: 'columnList',
  group: 'block',
  content: 'column+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      columns: { default: 2 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="column-list"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column-list',
        class: `notion-column-list cols-${HTMLAttributes.columns || 2}`,
      }),
      0,
    ];
  },
});

// ============================================================================
// 3. LISTA DE ALTERNANTES / TOGGLE (toggleBlock)
// ============================================================================
const ToggleComponent = ({ node, updateAttributes }: any) => {
  const isOpen = node.attrs.open !== false;

  return (
    <NodeViewWrapper className="my-1.5">
      <div className="flex items-center gap-1.5" contentEditable={false}>
        <button
          type="button"
          onClick={() => updateAttributes({ open: !isOpen })}
          className="p-0.5 rounded hover:bg-[#181E24] text-[#858585] hover:text-[#EDEDED] transition"
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <input
          type="text"
          value={node.attrs.summary || ''}
          onChange={(e) => updateAttributes({ summary: e.target.value })}
          placeholder="Título do alternante..."
          className="flex-1 bg-transparent text-sm font-medium text-[#EDEDED] placeholder-[#555555] focus:outline-none"
        />
      </div>
      <div className={`pl-6 mt-1 border-l border-[#1E293B] ${isOpen ? 'block' : 'hidden'}`}>
        <NodeViewContent className="toggle-content" />
      </div>
    </NodeViewWrapper>
  );
};

export const ToggleNode = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,
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
// 4. CALLOUT / FRASE DE DESTAQUE (calloutBlock)
// ============================================================================
const CalloutComponent = ({ node, updateAttributes }: any) => {
  const [showPicker, setShowPicker] = useState(false);
  const bg = node.attrs.bgColor || '#181E24';

  return (
    <NodeViewWrapper className="my-2">
      <div
        style={{ backgroundColor: bg }}
        className="flex items-start gap-3 p-3.5 rounded-lg border border-[#1E293B] relative"
      >
        <div className="relative select-none" contentEditable={false}>
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="text-lg hover:bg-[#222A33] p-1 rounded transition"
            title="Trocar ícone ou cor"
          >
            {node.attrs.icon || '💡'}
          </button>
          {showPicker && (
            <div className="absolute left-0 top-9 z-50 bg-[#181E24] border border-[#1E293B] rounded-lg p-2 shadow-xl w-52">
              <div className="text-[10px] text-[#858585] mb-1 uppercase font-semibold">Ícone</div>
              <div className="grid grid-cols-5 gap-1 mb-2">
                {PAGE_ICONS.slice(0, 10).map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => {
                      updateAttributes({ icon: ic });
                      setShowPicker(false);
                    }}
                    className="p-1 hover:bg-[#222A33] rounded text-sm"
                  >
                    {ic}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-[#858585] mb-1 uppercase font-semibold">Fundo</div>
              <div className="grid grid-cols-5 gap-1">
                {NOTION_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      updateAttributes({ bgColor: c.bg === 'transparent' ? '#181E24' : c.bg });
                      setShowPicker(false);
                    }}
                    style={{ backgroundColor: c.bg === 'transparent' ? '#181E24' : c.bg }}
                    className="w-6 h-6 rounded border border-[#454545]"
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <NodeViewContent className="flex-1 min-w-0 text-sm text-[#EDEDED]" />
      </div>
    </NodeViewWrapper>
  );
};

export const CalloutNode = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  defining: true,
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
// 5. EQUAÇÃO MATEMÁTICA EM BLOCO (mathBlock)
// ============================================================================
const MathComponent = ({ node, updateAttributes }: any) => {
  const [editing, setEditing] = useState(!node.attrs.latex);

  return (
    <NodeViewWrapper className="my-2 select-none" contentEditable={false}>
      <div
        onClick={() => setEditing(true)}
        className="p-3 bg-[#202020] hover:bg-[#181E24] border border-[#1E293B] rounded-lg cursor-pointer transition"
      >
        {editing ? (
          <div className="flex items-center gap-2">
            <Sigma className="w-4 h-4 text-[#858585]" />
            <input
              type="text"
              autoFocus
              value={node.attrs.latex || ''}
              onChange={(e) => updateAttributes({ latex: e.target.value })}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
              placeholder="Ex: \sum_{i=1}^{n} R_i - D_i = \text{Saldo}"
              className="flex-1 bg-transparent text-xs font-mono text-[#EDEDED] focus:outline-none"
            />
          </div>
        ) : (
          <div className="text-center font-serif italic text-base text-[#EDEDED] py-1">
            {node.attrs.latex || 'Clique para inserir uma equação LaTeX'}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const MathNode = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      latex: { default: 'E = mc^2' },
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
// 6. BOOKMARK / ARQUIVO / VÍDEO EMBED (bookmarkBlock)
// ============================================================================
const BookmarkComponent = ({ node, deleteNode }: any) => {
  const { url, title, kind, size } = node.attrs;

  return (
    <NodeViewWrapper className="my-2 select-none" contentEditable={false}>
      <div className="flex items-center justify-between p-3 bg-[#202020] hover:bg-[#181E24] border border-[#1E293B] rounded-lg transition group">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          {kind === 'file' ? (
            <Paperclip className="w-4 h-4 text-blue-400 shrink-0" />
          ) : (
            <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <div className="truncate">
            <div className="text-xs font-semibold text-[#EDEDED] truncate">{title || url}</div>
            <div className="text-[11px] text-[#858585] truncate">
              {size ? `${size} • ` : ''}{url}
            </div>
          </div>
        </a>
        <button
          type="button"
          onClick={deleteNode}
          className="opacity-0 group-hover:opacity-100 p-1 text-[#858585] hover:text-[#D44C47] rounded transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
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
      kind: { default: 'bookmark' },
      size: { default: '' },
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
              keepOnSplit: true, // Mantém a identação na linha seguinte ao apertar Enter
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
          // Se estiver em lista ou checklist, deixa o comportamento padrão de sub-item
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
          return true; // Impede o navegador de tirar o foco do editor ao apertar Tab
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
// CONFIGURAÇÃO CENTRAL DAS EXTENSÕES DO TIPTAP
// ============================================================================
export function createEnchiridionExtensions() {
  return [
    StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: false,
        underline: false,
      }),
    Placeholder.configure({
      includeChildren: true,
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return `Título ${node.attrs.level}`;
        }
        return "Digite '/' para comandos...";
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
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
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({
      HTMLAttributes: {
        class: 'rounded-lg max-w-full my-3 border border-[#1E293B]',
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