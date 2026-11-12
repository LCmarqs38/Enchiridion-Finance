import React, { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link as LinkIcon,
  MessageSquare, ChevronRight, Check, Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, CheckSquare, Quote, Columns, FileText, Minus, Table as TableIcon,
  Image as ImageIcon, Globe, Sigma, Sparkles, Type, ChevronDown, Paperclip
} from 'lucide-react';
import { NOTION_COLORS } from './types';

// ============================================================================
// 1. BUBBLE TOOLBAR (BARRA FLUTUANTE DE SELEÇÃO DE TEXTO)
// ============================================================================
interface BubbleToolbarProps {
  editor: Editor | null;
  onAddComment: (selectedText: string) => void;
  onCreateSubpage: () => void;
}

export const BubbleToolbar: React.FC<BubbleToolbarProps> = ({
  editor,
  onAddComment,
  onCreateSubpage,
}) => {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [openMenu, setOpenMenu] = useState<'none' | 'turnInto' | 'color' | 'link'>('none');
  const [linkUrl, setLinkUrl] = useState('');
  const [recentColors, setRecentColors] = useState<string[]>(['#448361', '#D9730D', '#337EA9', '#9065B0']);

  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) {
        setCoords(null);
        setOpenMenu('none');
        return;
      }

      try {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        const x = Math.max(16, Math.min((start.left + end.left) / 2 - 140, window.innerWidth - 340));
        const y = Math.max(12, start.top - 48);
        setCoords({ x, y });
      } catch {
        setCoords(null);
      }
    };

    editor.on('selectionUpdate', updateSelection);
    editor.on('blur', () => {
      // Mantém aberto se o clique foi dentro da própria barra
    });

    return () => {
      editor.off('selectionUpdate', updateSelection);
    };
  }, [editor]);

  if (!editor || !coords) return null;

  const currentTypeLabel = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Título 1';
    if (editor.isActive('heading', { level: 2 })) return 'Título 2';
    if (editor.isActive('heading', { level: 3 })) return 'Título 3';
    if (editor.isActive('heading', { level: 4 })) return 'Título 4';
    if (editor.isActive('bulletList')) return 'Lista';
    if (editor.isActive('orderedList')) return 'Numerada';
    if (editor.isActive('taskList')) return 'Tarefas';
    if (editor.isActive('blockquote')) return 'Citação';
    if (editor.isActive('codeBlock')) return 'Código';
    return 'Texto normal';
  };

  const applyTextColor = (color: string) => {
    if (color === '#EDEDED' || color === '#F1F5F9') {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(color).run();
      setRecentColors((prev) => [color, ...prev.filter((c) => c !== color)].slice(0, 5));
    }
  };

  const applyBgColor = (bg: string) => {
    if (bg === 'transparent') {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color: bg }).run();
    }
  };

  const getSelectedText = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  };

  return (
    <div
      style={{ left: coords.x, top: coords.y }}
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-50 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1 flex items-center gap-0.5 text-xs text-[#EDEDED] select-none"
    >
      {/* Seletor "Texto normal" (Transformar em) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'turnInto' ? 'none' : 'turnInto')}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#222A33] font-medium transition"
        >
          <Type className="w-3.5 h-3.5 text-[#858585]" />
          <span>{currentTypeLabel()}</span>
          <ChevronDown className="w-3 h-3 text-[#858585]" />
        </button>

        {openMenu === 'turnInto' && (
          <div className="absolute left-0 top-9 w-56 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1.5 space-y-0.5 max-h-80 overflow-y-auto z-50">
            <div className="px-2 py-1 text-[10px] text-[#858585] uppercase font-semibold">Transformar em</div>
            {[
              { label: 'Texto', icon: Type, action: () => editor.chain().focus().setParagraph().run(), active: editor.isActive('paragraph') },
              { label: 'Título 1', icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
              { label: 'Título 2', icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
              { label: 'Título 3', icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
              { label: 'Título 4', icon: Heading4, action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(), active: editor.isActive('heading', { level: 4 }) },
              { label: 'Página', icon: FileText, action: () => onCreateSubpage(), active: false },
              { label: 'Lista com marcadores', icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
              { label: 'Lista numerada', icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
              { label: 'Lista de tarefas', icon: CheckSquare, action: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive('taskList') },
              { label: 'Lista de alternantes', icon: ChevronRight, action: () => editor.chain().focus().insertContent({ type: 'toggleBlock', content: [{ type: 'paragraph' }] }).run(), active: false },
              { label: 'Código', icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock') },
              { label: 'Citação', icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
              { label: 'Frase de destaque', icon: Sparkles, action: () => editor.chain().focus().insertContent({ type: 'calloutBlock', content: [{ type: 'paragraph' }] }).run(), active: false },
              {
                label: '2 colunas',
                icon: Columns,
                action: () =>
                  editor.chain().focus().insertContent({
                    type: 'columnList',
                    attrs: { columns: 2 },
                    content: [
                      { type: 'column', content: [{ type: 'paragraph' }] },
                      { type: 'column', content: [{ type: 'paragraph' }] },
                    ],
                  }).run(),
                active: false,
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.action();
                  setOpenMenu('none');
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#222A33] text-left"
              >
                <div className="flex items-center gap-2">
                  <item.icon className="w-3.5 h-3.5 text-[#858585]" />
                  <span>{item.label}</span>
                </div>
                {item.active && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-[#1E293B] mx-0.5" />

      {/* Botão Paleta de Cores "A" */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'color' ? 'none' : 'color')}
          className="px-2 py-1 rounded hover:bg-[#222A33] font-bold border border-[#1E293B] text-xs"
          title="Cor do texto e fundo"
        >
          A
        </button>

        {openMenu === 'color' && (
          <div className="absolute left-0 top-9 w-56 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-3 space-y-3 z-50">
            <div>
              <div className="text-[11px] text-[#858585] mb-1.5 font-medium">Usado recentemente</div>
              <div className="flex items-center gap-1.5">
                {recentColors.map((hex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyTextColor(hex)}
                    style={{ color: hex }}
                    className="w-7 h-7 rounded-md border border-[#1E293B] hover:border-[#EDEDED] flex items-center justify-center font-bold text-sm bg-[#1F1F1F]"
                  >
                    A
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#858585] mb-1.5 font-medium">Cor do texto</div>
              <div className="grid grid-cols-5 gap-1.5">
                {NOTION_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => applyTextColor(c.text)}
                    style={{ color: c.text }}
                    title={c.name}
                    className="w-8 h-8 rounded-md border border-[#1E293B] hover:border-[#EDEDED] flex items-center justify-center font-bold text-sm bg-[#1F1F1F]"
                  >
                    A
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#858585] mb-1.5 font-medium">Cor de fundo</div>
              <div className="grid grid-cols-5 gap-1.5">
                {NOTION_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => applyBgColor(c.bg)}
                    style={{ backgroundColor: c.bg === 'transparent' ? '#12161A' : c.bg }}
                    title={c.name}
                    className="w-8 h-8 rounded-md border border-[#1E293B] hover:border-[#EDEDED]"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Formatações Inline: B, I, U, S, Code, Link */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${editor.isActive('bold') ? 'text-blue-400 bg-[#222A33]' : ''}`}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${editor.isActive('italic') ? 'text-blue-400 bg-[#222A33]' : ''}`}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${editor.isActive('underline') ? 'text-blue-400 bg-[#222A33]' : ''}`}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${editor.isActive('strike') ? 'text-blue-400 bg-[#222A33]' : ''}`}
        title="Tachado (Ctrl+Shift+X)"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${editor.isActive('code') ? 'text-blue-400 bg-[#222A33]' : ''}`}
        title="Código em linha"
      >
        <Code className="w-3.5 h-3.5" />
      </button>

      {/* Inserir Link */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'link' ? 'none' : 'link')}
          className={`p-1.5 rounded hover:bg-[#222A33] ${editor.isActive('link') ? 'text-blue-400 bg-[#222A33]' : ''}`}
          title="Inserir Link (Ctrl+K)"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>

        {openMenu === 'link' && (
          <div className="absolute left-0 top-9 w-60 bg-[#181E24] border border-[#1E293B] rounded-xl p-2 shadow-2xl flex items-center gap-1 z-50">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 bg-[#12161A] border border-[#1E293B] rounded px-2 py-1 text-xs text-[#EDEDED] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (linkUrl.trim()) {
                  editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
                } else {
                  editor.chain().focus().unsetLink().run();
                }
                setLinkUrl('');
                setOpenMenu('none');
              }}
              className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium"
            >
              OK
            </button>
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-[#1E293B] mx-0.5" />

      {/* Botão Comentário */}
      <button
        type="button"
        onClick={() => {
          const text = getSelectedText();
          if (text) onAddComment(text);
          setCoords(null);
        }}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#222A33] text-[#EDEDED]"
        title="Comentar trecho selecionado"
      >
        <MessageSquare className="w-3.5 h-3.5 text-[#858585]" />
        <span>Comentário</span>
      </button>
    </div>
  );
};

// ============================================================================
// 2. SLASH COMMAND MENU (MENU "/" DE COMANDOS E PESQUISA)
// ============================================================================
interface SlashCommandMenuProps {
  editor: Editor | null;
  visible: boolean;
  x: number;
  y: number;
  initialQuery?: string;
  onClose: () => void;
  onCreateSubpage: () => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  editor,
  visible,
  x,
  y,
  initialQuery = '',
  onClose,
  onCreateSubpage,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setQuery(initialQuery);
    setSelectedIndex(0);
  }, [initialQuery, visible]);

  if (!visible || !editor) return null;

  const removeSlashTriggerIfPresent = () => {
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 15), from, '\n');
    const match = textBefore.match(/\/([a-zA-Z0-9À-ÿ]*)$/);
    if (match) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: from - match[0].length, to: from })
        .run();
    }
  };

  const items = [
    { category: 'Blocos básicos', id: 'text', label: 'Texto', shortcut: '', icon: Type, run: () => editor.chain().focus().setParagraph().run() },
    { category: 'Blocos básicos', id: 'h1', label: 'Título 1', shortcut: '#', icon: Heading1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { category: 'Blocos básicos', id: 'h2', label: 'Título 2', shortcut: '##', icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { category: 'Blocos básicos', id: 'h3', label: 'Título 3', shortcut: '###', icon: Heading3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { category: 'Blocos básicos', id: 'h4', label: 'Título 4', shortcut: '####', icon: Heading4, run: () => editor.chain().focus().toggleHeading({ level: 4 }).run() },
    { category: 'Blocos básicos', id: 'page', label: 'Página', shortcut: '/page', icon: FileText, run: () => onCreateSubpage() },
    { category: 'Blocos básicos', id: 'bullet', label: 'Lista com marcadores', shortcut: '-', icon: List, run: () => editor.chain().focus().toggleBulletList().run() },
    { category: 'Blocos básicos', id: 'number', label: 'Lista numerada', shortcut: '1.', icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { category: 'Blocos básicos', id: 'todo', label: 'Lista de tarefas', shortcut: '[]', icon: CheckSquare, run: () => editor.chain().focus().toggleTaskList().run() },
    { category: 'Blocos básicos', id: 'toggle', label: 'Lista de alternantes', shortcut: '>', icon: ChevronRight, run: () => editor.chain().focus().insertContent({ type: 'toggleBlock', content: [{ type: 'paragraph' }] }).run() },

    { category: 'Formatação', id: 'quote', label: 'Citação', shortcut: '"', icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { category: 'Formatação', id: 'callout', label: 'Frase de destaque (Callout)', shortcut: '/callout', icon: Sparkles, run: () => editor.chain().focus().insertContent({ type: 'calloutBlock', content: [{ type: 'paragraph' }] }).run() },
    { category: 'Formatação', id: 'code', label: 'Código', shortcut: '```', icon: Code, run: () => editor.chain().focus().toggleCodeBlock().run() },
    { category: 'Formatação', id: 'math', label: 'Equação em bloco', shortcut: '/math', icon: Sigma, run: () => editor.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '\\sum_{i=1}^{n} x_i' } }).run() },
    { category: 'Formatação', id: 'divider', label: 'Separador', shortcut: '---', icon: Minus, run: () => editor.chain().focus().setHorizontalRule().run() },

    {
      category: 'Avançados',
      id: 'col2',
      label: '2 colunas',
      shortcut: '/2col',
      icon: Columns,
      run: () =>
        editor.chain().focus().insertContent({
          type: 'columnList',
          attrs: { columns: 2 },
          content: [
            { type: 'column', content: [{ type: 'paragraph' }] },
            { type: 'column', content: [{ type: 'paragraph' }] },
          ],
        }).run(),
    },
    {
      category: 'Avançados',
      id: 'col3',
      label: '3 colunas',
      shortcut: '/3col',
      icon: Columns,
      run: () =>
        editor.chain().focus().insertContent({
          type: 'columnList',
          attrs: { columns: 3 },
          content: [
            { type: 'column', content: [{ type: 'paragraph' }] },
            { type: 'column', content: [{ type: 'paragraph' }] },
            { type: 'column', content: [{ type: 'paragraph' }] },
          ],
        }).run(),
    },
    {
      category: 'Avançados',
      id: 'table',
      label: 'Tabela',
      shortcut: '/table',
      icon: TableIcon,
      run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },

    {
      category: 'Mídia',
      id: 'image',
      label: 'Imagem',
      shortcut: '/img',
      icon: ImageIcon,
      run: () => {
        const url = window.prompt('URL da imagem:');
        if (url) editor.chain().focus().setImage({ src: url }).run();
      },
    },
    {
      category: 'Mídia',
      id: 'bookmark',
      label: 'Bookmark da Web',
      shortcut: '/web',
      icon: Globe,
      run: () => {
        const url = window.prompt('URL do site (Bookmark):');
        if (url) {
          editor.chain().focus().insertContent({
            type: 'bookmarkBlock',
            attrs: { url, title: url.replace(/^https?:\/\//, ''), kind: 'bookmark' },
          }).run();
        }
      },
    },
    {
      category: 'Mídia',
      id: 'file',
      label: 'Anexo / Arquivo',
      shortcut: '/file',
      icon: Paperclip,
      run: () => {
        const name = window.prompt('Nome do arquivo ou link:');
        if (name) {
          editor.chain().focus().insertContent({
            type: 'bookmarkBlock',
            attrs: { url: name, title: name, kind: 'file', size: 'Anexo' },
          }).run();
        }
      },
    },
  ];

  const filtered = items.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.id.toLowerCase().includes(query.toLowerCase())
  );

  const executeItem = (idx: number) => {
    const target = filtered[idx];
    if (!target) return;
    removeSlashTriggerIfPresent();
    target.run();
    onClose();
  };

  return (
    <div
      style={{ left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 360) }}
      className="fixed z-50 w-64 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs text-[#EDEDED]"
    >
      <div className="p-2 border-b border-[#1E293B]">
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex((prev) => (prev - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              executeItem(selectedIndex);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder="Digite para filtrar..."
          className="w-full bg-[#12161A] border border-[#1E293B] rounded-md px-2.5 py-1.5 text-xs text-[#EDEDED] placeholder-[#858585] focus:outline-none"
        />
      </div>

      <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-[#858585]">Nenhum bloco encontrado</div>
        ) : (
          filtered.map((item, idx) => {
            const showCategory = idx === 0 || filtered[idx - 1].category !== item.category;
            return (
              <React.Fragment key={item.id}>
                {showCategory && (
                  <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-[#858585] uppercase">
                    {item.category}
                  </div>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => executeItem(idx)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition ${
                    idx === selectedIndex ? 'bg-[#222A33] text-white' : 'text-[#EDEDED] hover:bg-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="w-4 h-4 text-[#858585]" />
                    <span>{item.label}</span>
                  </div>
                  {item.shortcut && <span className="text-[10px] text-[#858585] font-mono">{item.shortcut}</span>}
                </button>
              </React.Fragment>
            );
          })
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-[#1E293B] bg-[#1F1F1F] flex items-center justify-between text-[10px] text-[#858585]">
        <span>Fechar menu</span>
        <span className="font-mono">esc</span>
      </div>
    </div>
  );
};