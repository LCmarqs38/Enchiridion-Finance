import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  MessageSquare,
  ChevronRight,
  Check,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Columns,
  FileText,
  Minus,
  Table as TableIcon,
  Image as ImageIcon,
  Globe,
  Sigma,
  Sparkles,
  Type,
  ChevronDown,
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
  const [recentColors, setRecentColors] = useState<string[]>([
    '#D44C47',
    '#D9730D',
    '#448361',
    '#337EA9',
    '#9065B0',
  ]);
  const [, setFormatTick] = useState(0);

  const updateSelection = useCallback(() => {
    if (!editor) return;
    const { selection, doc } = editor.state;
    const { from, to, empty } = selection;

    // Ignora seleções automáticas de blocos (como Subpágina) e seleções sem texto real
    const isNodeSelection = 'node' in selection && Boolean((selection as any).node);
    const selectedText = doc.textBetween(from, to, ' ');

    if (empty || from === to || isNodeSelection || !selectedText.trim()) {
      setCoords((prev) => (prev ? null : prev));
      setOpenMenu((prev) => (prev !== 'none' ? 'none' : prev));
      return;
    }

    try {
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const toolbarWidth = Math.min(360, window.innerWidth - 20);
      const x = Math.max(
        10,
        Math.min(
          (start.left + end.left) / 2 - toolbarWidth / 2,
          window.innerWidth - toolbarWidth - 10
        )
      );

      // Se estiver muito perto do topo da janela, posiciona abaixo da seleção para não cobrir o texto
      const y = start.top - 48 < 12 ? Math.min(window.innerHeight - 60, end.bottom + 10) : start.top - 48;

      setCoords((prev) => {
        if (prev && Math.abs(prev.x - x) < 1 && Math.abs(prev.y - y) < 1) {
          return prev;
        }
        return { x, y };
      });
    } catch {
      setCoords((prev) => (prev ? null : prev));
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleTransaction = () => {
      updateSelection();
      // Só força atualização dos botões ativos quando houver texto selecionado visível
      if (!editor.state.selection.empty) {
        setFormatTick((t) => t + 1);
      }
    };

    editor.on('selectionUpdate', updateSelection);
    editor.on('transaction', handleTransaction);
    window.addEventListener('scroll', updateSelection, true);
    window.addEventListener('resize', updateSelection);

    return () => {
      editor.off('selectionUpdate', updateSelection);
      editor.off('transaction', handleTransaction);
      window.removeEventListener('scroll', updateSelection, true);
      window.removeEventListener('resize', updateSelection);
    };
  }, [editor, updateSelection]);

  if (!editor || !coords) return null;

  // Abre os submenus para cima quando a barra está perto da borda inferior da tela
  const openUpwards = coords.y > window.innerHeight - 360;
  const dropdownPositionClass = openUpwards ? 'bottom-10 mb-1' : 'top-9 mt-1';

  const currentTypeLabel = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Título 1';
    if (editor.isActive('heading', { level: 2 })) return 'Título 2';
    if (editor.isActive('heading', { level: 3 })) return 'Título 3';
    if (editor.isActive('heading', { level: 4 })) return 'Título 4';
    if (editor.isActive('bulletList')) return 'Lista';
    if (editor.isActive('orderedList')) return 'Numerada';
    if (editor.isActive('taskList')) return 'Tarefas';
    if (editor.isActive('toggleBlock')) return 'Alternante';
    if (editor.isActive('calloutBlock')) return 'Destaque';
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
    setOpenMenu('none');
  };

  const applyBgColor = (bg: string) => {
    if (bg === 'transparent') {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color: bg }).run();
    }
    setOpenMenu('none');
  };

  const applyLink = () => {
    const raw = linkUrl.trim();
    if (raw) {
      const normalizedHref = /^(https?:\/\/|mailto:|tel:|\/)/i.test(raw)
        ? raw
        : `https://${raw}`;
      editor.chain().focus().setLink({ href: normalizedHref }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkUrl('');
    setOpenMenu('none');
  };

  const getSelectedText = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  };

  const turnIntoItems = [
    {
      label: 'Texto',
      icon: Type,
      action: () => editor.chain().focus().setParagraph().run(),
      active: editor.isActive('paragraph'),
    },
    {
      label: 'Título 1',
      icon: Heading1,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      active: editor.isActive('heading', { level: 1 }),
    },
    {
      label: 'Título 2',
      icon: Heading2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive('heading', { level: 2 }),
    },
    {
      label: 'Título 3',
      icon: Heading3,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive('heading', { level: 3 }),
    },
    {
      label: 'Título 4',
      icon: Heading4,
      action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
      active: editor.isActive('heading', { level: 4 }),
    },
    {
      label: 'Página',
      icon: FileText,
      action: () => onCreateSubpage(),
      active: false,
    },
    {
      label: 'Lista com marcadores',
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
    },
    {
      label: 'Lista numerada',
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive('orderedList'),
    },
    {
      label: 'Lista de tarefas',
      icon: CheckSquare,
      action: () => editor.chain().focus().toggleTaskList().run(),
      active: editor.isActive('taskList'),
    },
    {
      label: 'Lista de alternantes',
      icon: ChevronRight,
      action: () => {
        const text = getSelectedText().trim();
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'toggleBlock',
            attrs: { summary: text || 'Lista de alternantes', open: true },
            content: [{ type: 'paragraph' }],
          })
          .run();
      },
      active: editor.isActive('toggleBlock'),
    },
    {
      label: 'Código',
      icon: Code,
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      active: editor.isActive('codeBlock'),
    },
    {
      label: 'Citação',
      icon: Quote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive('blockquote'),
    },
    {
      label: 'Frase de destaque',
      icon: Sparkles,
      action: () => {
        const text = getSelectedText().trim();
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'calloutBlock',
            content: [
              {
                type: 'paragraph',
                content: text ? [{ type: 'text', text }] : [],
              },
            ],
          })
          .run();
      },
      active: editor.isActive('calloutBlock'),
    },
    {
      label: '2 colunas',
      icon: Columns,
      action: () => {
        const text = getSelectedText().trim();
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'columnList',
            attrs: { columns: 2 },
            content: [
              {
                type: 'column',
                content: [
                  {
                    type: 'paragraph',
                    content: text ? [{ type: 'text', text }] : [],
                  },
                ],
              },
              { type: 'column', content: [{ type: 'paragraph' }] },
            ],
          })
          .run();
      },
      active: false,
    },
  ];

  return (
    <div
      style={{ left: coords.x, top: coords.y }}
      onMouseDown={(e) => {
        // Permite clicar normalmente no input de URL sem perder a seleção nos demais botões
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          e.preventDefault();
        }
      }}
      className="fixed z-50 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1 flex flex-wrap items-center gap-0.5 text-xs text-[#F1F5F9] select-none max-w-[calc(100vw-20px)]"
    >
      {/* Seletor "Texto normal" (Transformar em) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'turnInto' ? 'none' : 'turnInto')}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#222A33] font-medium transition"
        >
          <Type className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>{currentTypeLabel()}</span>
          <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
        </button>

        {openMenu === 'turnInto' && (
          <div
            className={`absolute left-0 ${dropdownPositionClass} w-56 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1.5 space-y-0.5 max-h-72 overflow-y-auto z-50`}
          >
            <div className="px-2 py-1 text-[10px] text-[#94A3B8] uppercase font-semibold">
              Transformar em
            </div>
            {turnIntoItems.map((item) => (
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
                  <item.icon className="w-3.5 h-3.5 text-[#94A3B8]" />
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
          <div
            className={`absolute left-0 ${dropdownPositionClass} w-56 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-3 space-y-3 z-50 max-h-[75vh] overflow-y-auto`}
          >
            <div>
              <div className="text-[11px] text-[#94A3B8] mb-1.5 font-medium">
                Usado recentemente
              </div>
              <div className="flex items-center gap-1.5">
                {recentColors.map((hex, i) => (
                  <button
                    key={`${hex}-${i}`}
                    type="button"
                    onClick={() => applyTextColor(hex)}
                    style={{ color: hex }}
                    className="w-7 h-7 rounded-md border border-[#1E293B] hover:border-[#F1F5F9] flex items-center justify-center font-bold text-sm bg-[#12161A]"
                  >
                    A
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#94A3B8] mb-1.5 font-medium">Cor do texto</div>
              <div className="grid grid-cols-5 gap-1.5">
                {NOTION_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => applyTextColor(c.text)}
                    style={{ color: c.text }}
                    title={c.name}
                    className="w-8 h-8 rounded-md border border-[#1E293B] hover:border-[#F1F5F9] flex items-center justify-center font-bold text-sm bg-[#12161A]"
                  >
                    A
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#94A3B8] mb-1.5 font-medium">Cor de fundo</div>
              <div className="grid grid-cols-5 gap-1.5">
                {NOTION_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => applyBgColor(c.bg)}
                    style={{ backgroundColor: c.bg === 'transparent' ? '#12161A' : c.bg }}
                    title={c.name}
                    className="w-8 h-8 rounded-md border border-[#1E293B] hover:border-[#F1F5F9]"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Formatações Inline: B, I, U, S, Code */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${
          editor.isActive('bold') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${
          editor.isActive('italic') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${
          editor.isActive('underline') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${
          editor.isActive('strike') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Tachado (Ctrl+Shift+X)"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`p-1.5 rounded hover:bg-[#222A33] ${
          editor.isActive('code') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Código em linha"
      >
        <Code className="w-3.5 h-3.5" />
      </button>

      {/* Inserir / Editar Link */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            const existingHref = editor.getAttributes('link').href || '';
            setLinkUrl(existingHref);
            setOpenMenu(openMenu === 'link' ? 'none' : 'link');
          }}
          className={`p-1.5 rounded hover:bg-[#222A33] ${
            editor.isActive('link') ? 'text-blue-400 bg-[#222A33]' : ''
          }`}
          title="Inserir Link (Ctrl+K)"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>

        {openMenu === 'link' && (
          <div
            className={`absolute right-0 sm:left-0 ${dropdownPositionClass} w-60 bg-[#181E24] border border-[#1E293B] rounded-xl p-2 shadow-2xl flex items-center gap-1 z-50`}
          >
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === 'Escape') {
                  setOpenMenu('none');
                }
              }}
              placeholder="https://..."
              autoFocus
              className="flex-1 bg-[#12161A] border border-[#1E293B] rounded px-2 py-1 text-xs text-[#F1F5F9] focus:outline-none"
            />
            <button
              type="button"
              onClick={applyLink}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium"
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
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#222A33] text-[#F1F5F9]"
        title="Comentar trecho selecionado"
      >
        <MessageSquare className="w-3.5 h-3.5 text-[#94A3B8]" />
        <span className="hidden sm:inline">Comentário</span>
      </button>
    </div>
  );
};

// ============================================================================
// 2. SLASH COMMAND MENU (MENU DE COMANDOS "/" E BOTÃO "+")
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
  const [filter, setFilter] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setFilter(initialQuery);
    setSelectedIndex(0);
  }, [initialQuery, visible]);

  // Mantém o item selecionado sempre visível ao navegar pelas setas do teclado
  useEffect(() => {
    if (visible && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, visible]);

  const items = useMemo(
    () => [
      // Blocos Básicos
      {
        group: 'Blocos básicos',
        label: 'Texto',
        desc: 'Comece a escrever com texto simples.',
        icon: Type,
        action: () => editor?.chain().focus().setParagraph().run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Título 1',
        desc: 'Título de seção grande.',
        icon: Heading1,
        action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Título 2',
        desc: 'Título de seção médio.',
        icon: Heading2,
        action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Título 3',
        desc: 'Título de seção pequeno.',
        icon: Heading3,
        action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Título 4',
        desc: 'Subtítulo compacto.',
        icon: Heading4,
        action: () => editor?.chain().focus().toggleHeading({ level: 4 }).run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Lista com marcadores',
        desc: 'Crie uma lista simples.',
        icon: List,
        action: () => editor?.chain().focus().toggleBulletList().run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Lista numerada',
        desc: 'Crie uma lista com numeração.',
        icon: ListOrdered,
        action: () => editor?.chain().focus().toggleOrderedList().run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Lista de tarefas',
        desc: 'Acompanhe tarefas com caixas de seleção.',
        icon: CheckSquare,
        action: () => editor?.chain().focus().toggleTaskList().run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Lista de alternantes',
        desc: 'Recolha e expanda conteúdos.',
        icon: ChevronRight,
        action: () =>
          editor
            ?.chain()
            .focus()
            .insertContent({ type: 'toggleBlock', content: [{ type: 'paragraph' }] })
            .run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Página',
        desc: 'Incorpore uma subpágina dentro desta página.',
        icon: FileText,
        action: () => onCreateSubpage(),
      },
      {
        group: 'Blocos básicos',
        label: 'Frase de destaque',
        desc: 'Destaque informações importantes.',
        icon: Sparkles,
        action: () =>
          editor
            ?.chain()
            .focus()
            .insertContent({ type: 'calloutBlock', content: [{ type: 'paragraph' }] })
            .run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Citação',
        desc: 'Capture uma citação.',
        icon: Quote,
        action: () => editor?.chain().focus().toggleBlockquote().run(),
      },
      {
        group: 'Blocos básicos',
        label: 'Divisor',
        desc: 'Divida blocos visualmente com uma linha.',
        icon: Minus,
        action: () => editor?.chain().focus().setHorizontalRule().run(),
      },
      // Layout & Avançado
      {
        group: 'Layout & Avançado',
        label: '2 colunas',
        desc: 'Crie duas colunas lado a lado.',
        icon: Columns,
        action: () =>
          editor
            ?.chain()
            .focus()
            .insertContent({
              type: 'columnList',
              attrs: { columns: 2 },
              content: [
                { type: 'column', content: [{ type: 'paragraph' }] },
                { type: 'column', content: [{ type: 'paragraph' }] },
              ],
            })
            .run(),
      },
      {
        group: 'Layout & Avançado',
        label: '3 colunas',
        desc: 'Crie três colunas lado a lado.',
        icon: Columns,
        action: () =>
          editor
            ?.chain()
            .focus()
            .insertContent({
              type: 'columnList',
              attrs: { columns: 3 },
              content: [
                { type: 'column', content: [{ type: 'paragraph' }] },
                { type: 'column', content: [{ type: 'paragraph' }] },
                { type: 'column', content: [{ type: 'paragraph' }] },
              ],
            })
            .run(),
      },
      {
        group: 'Layout & Avançado',
        label: 'Tabela',
        desc: 'Adicione uma tabela simples 3x3.',
        icon: TableIcon,
        action: () =>
          editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        group: 'Layout & Avançado',
        label: 'Código',
        desc: 'Capture um trecho de código.',
        icon: Code,
        action: () => editor?.chain().focus().toggleCodeBlock().run(),
      },
      {
        group: 'Layout & Avançado',
        label: 'Equação matemática',
        desc: 'Exiba uma expressão LaTeX.',
        icon: Sigma,
        action: () => editor?.chain().focus().insertContent({ type: 'mathBlock' }).run(),
      },
      // Mídia
      {
        group: 'Mídia',
        label: 'Imagem',
        desc: 'Insira uma imagem por URL.',
        icon: ImageIcon,
        action: () => {
          const url = window.prompt('URL da imagem:');
          if (url && url.trim()) {
            editor?.chain().focus().setImage({ src: url.trim() }).run();
          }
        },
      },
      {
        group: 'Mídia',
        label: 'Favorito da Web',
        desc: 'Salve um cartão de link visual.',
        icon: Globe,
        action: () => {
          const url = window.prompt('URL do link:', 'https://');
          if (url && url.trim()) {
            const cleanUrl = url.trim();
            editor
              ?.chain()
              .focus()
              .insertContent({ type: 'bookmarkBlock', attrs: { url: cleanUrl, title: cleanUrl } })
              .run();
          }
        },
      },
    ],
    [editor, onCreateSubpage]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    );
  }, [items, filter]);

  if (!visible || !editor) return null;

  const removeSlashCharIfPresent = () => {
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from);
    if (textBefore === '/') {
      editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
    }
  };

  // Garante que o menu (w-72 = 288px) nunca saia da tela no celular ou perto do rodapé
  const safeLeft = Math.max(12, Math.min(x, window.innerWidth - 300));
  const safeTop = y > window.innerHeight - 340 ? Math.max(16, y - 330) : y;

  return (
    <div
      style={{ left: safeLeft, top: safeTop }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 w-72 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-2 text-xs text-[#F1F5F9] select-none"
    >
      <input
        type="text"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          setSelectedIndex(0);
        }}
        onKeyDown={(e) => {
          const count = Math.max(1, filtered.length);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % count);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + count) % count);
          } else if (e.key === 'Enter' && filtered[selectedIndex]) {
            e.preventDefault();
            removeSlashCharIfPresent();
            filtered[selectedIndex].action();
            onClose();
          } else if (e.key === 'Backspace' && filter === '') {
            // Fecha o menu se o usuário apagar o filtro vazio e devolve o foco ao editor
            onClose();
            editor.commands.focus();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            editor.commands.focus();
          }
        }}
        placeholder="Filtrar blocos..."
        autoFocus
        className="w-full bg-[#12161A] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#F1F5F9] placeholder-[#94A3B8] mb-2 focus:outline-none"
      />

      <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-4 text-[#94A3B8]">Nenhum bloco encontrado</div>
        ) : (
          filtered.map((item, idx) => {
            const showGroupHeader = idx === 0 || filtered[idx - 1].group !== item.group;
            return (
              <React.Fragment key={item.label}>
                {showGroupHeader && (
                  <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase text-[#94A3B8]">
                    {item.group}
                  </div>
                )}
                <button
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => {
                    removeSlashCharIfPresent();
                    item.action();
                    onClose();
                  }}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition ${
                    idx === selectedIndex ? 'bg-[#222A33]' : 'hover:bg-[#222A33]/70'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#12161A] border border-[#1E293B] flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-[#F1F5F9]" />
                  </div>
                  <div className="truncate">
                    <div className="font-medium text-[#F1F5F9] truncate">{item.label}</div>
                    <div className="text-[10px] text-[#94A3B8] truncate">{item.desc}</div>
                  </div>
                </button>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
};