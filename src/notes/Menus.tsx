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
  Plus,
} from 'lucide-react';
import { NOTION_COLORS } from './types';

// ============================================================================
// FUNÇÕES DE CÁLCULO SIMPLIFICADO (APENAS SOMA E SUBTRAÇÃO)
// ============================================================================
export function getSafeBlockInsertPos($pos: any): number {
  for (let d = $pos.depth; d >= 1; d--) {
    const parentName = $pos.node(d - 1).type.name;
    if (
      parentName === 'doc' ||
      parentName === 'column' ||
      parentName === 'calloutBlock' ||
      parentName === 'toggleBlock' ||
      parentName === 'blockquote' ||
      parentName === 'tableCell' ||
      parentName === 'tableHeader'
    ) {
      return $pos.after(d);
    }
  }
  return $pos.end();
}

export function parseBrazilianNumber(raw: string): number | null {
  const cleaned = raw.replace(/[R$\s]/g, '').trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes('.') && cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  }

  const val = Number(normalized);
  return Number.isFinite(val) ? val : null;
}

export function formatMathValue(val: number, asCurrency = true): string {
  const formatted = val.toLocaleString('pt-BR', {
    minimumFractionDigits: asCurrency || !Number.isInteger(val) ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return asCurrency ? `R$ ${formatted}` : formatted;
}

export function calculateSumAndSubtraction(text: string): {
  numbers: number[];
  hasCurrency: boolean;
  sum: number;
  subtraction: number;
} | null {
  const hasCurrency = /R\$/i.test(text);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const numbers: number[] = [];

  for (const line of lines) {
    if (/^(total|restante|saldo|resultado)\s*:/i.test(line)) {
      continue;
    }

    const currencyMatches = Array.from(
      line.matchAll(/(R\$\s*\d+(?:\.\d{3})*(?:,\d+)?)/gi)
    );

    if (currencyMatches.length > 0) {
      for (const m of currencyMatches) {
        const val = parseBrazilianNumber(m[0]);
        if (val !== null) {
          numbers.push(Math.abs(val));
        }
      }
      continue;
    }

    const numberMatches = Array.from(
      line.matchAll(
        /(?:^|[\s:+-])(\d+(?:\.\d{3})*,\d+|\d+(?:\.\d{3})+|\d+(?:\.\d+)?)(?=\s|$)/g
      )
    );
    if (numberMatches.length > 0) {
      const lastMatch = numberMatches[numberMatches.length - 1][1];
      const val = parseBrazilianNumber(lastMatch);
      if (val !== null) {
        numbers.push(Math.abs(val));
      }
    }
  }

  if (numbers.length === 0) return null;

  const sum = numbers.reduce((acc, n) => acc + n, 0);
  const subtraction =
    numbers.length >= 2
      ? numbers[0] - numbers.slice(1).reduce((acc, n) => acc + n, 0)
      : sum;

  return {
    numbers,
    hasCurrency,
    sum,
    subtraction,
  };
}

// ============================================================================
// 1. BUBBLE TOOLBAR (APENAS OPÇÕES DE FORMATAÇÃO DE TEXTO)
// ============================================================================
interface BubbleToolbarProps {
  editor: Editor | null;
  onAddComment: (selectedText: string) => void;
  onCreateSubpage?: () => void;
}

export const BubbleToolbar: React.FC<BubbleToolbarProps> = ({
  editor,
  onAddComment,
}) => {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [openMenu, setOpenMenu] = useState<'none' | 'turnInto' | 'color' | 'link'>('none');
  const [linkUrl, setLinkUrl] = useState('');
  const [, setFormatTick] = useState(0);

  const updateSelection = useCallback(() => {
    if (!editor) return;
    const { selection, doc } = editor.state;
    const { from, to, empty } = selection;

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
      const isMobileOrTouch =
        window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches;

      const toolbarWidth = isMobileOrTouch
        ? Math.min(310, window.innerWidth - 16)
        : 340;

      // Mantém margem segura à esquerda para não cobrir os botões "+" e "::"
      const minLeft = window.innerWidth >= 400 ? 54 : 12;
      const x = Math.max(
        minLeft,
        Math.min(
          (start.left + end.left) / 2 - toolbarWidth / 2,
          window.innerWidth - toolbarWidth - 8
        )
      );

      // No celular: posiciona ABAIXO da seleção (+34px) para não colidir com o Copiar/Colar nativo
      // No PC: posiciona ACIMA da seleção (-44px) em linha única sem cobrir o "+"
      let y: number;
      if (isMobileOrTouch) {
        const belowY = end.bottom + 34;
        y = belowY + 56 > window.innerHeight ? Math.max(12, start.top - 92) : belowY;
      } else {
        y = start.top - 44 < 12 ? end.bottom + 12 : start.top - 44;
      }

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

  const openUpwards = coords.y > window.innerHeight - 340;
  const dropdownPositionClass = openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5';

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
    return 'Texto';
  };

  const applyTextColor = (color: string) => {
    if (color === '#EDEDED' || color === '#F1F5F9') {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(color).run();
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

  // Apenas conversões diretas de texto e lista (sem duplicar blocos estruturais do menu "+")
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
      label: 'Lista de tarefas',
      icon: CheckSquare,
      action: () => editor.chain().focus().toggleTaskList().run(),
      active: editor.isActive('taskList'),
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
      label: 'Citação',
      icon: Quote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive('blockquote'),
    },
    {
      label: 'Bloco de código',
      icon: Code,
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      active: editor.isActive('codeBlock'),
    },
  ];

  return (
    <div
      style={{ left: coords.x, top: coords.y }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          e.preventDefault();
        }
      }}
      className="fixed z-50 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl px-1.5 py-1 flex flex-nowrap items-center gap-0.5 text-xs text-[#F1F5F9] select-none whitespace-nowrap max-w-[calc(100vw-16px)]"
    >
      {/* Seletor "Texto" (Transformar em) */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'turnInto' ? 'none' : 'turnInto')}
          className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[#222A33] font-medium transition"
        >
          <Type className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>{currentTypeLabel()}</span>
          <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
        </button>

        {openMenu === 'turnInto' && (
          <div
            className={`absolute left-0 ${dropdownPositionClass} w-52 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1.5 space-y-0.5 max-h-72 overflow-y-auto z-50`}
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

      <div className="w-[1px] h-4 bg-[#1E293B] mx-0.5 shrink-0" />

      {/* Botão Paleta de Cores "A" */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'color' ? 'none' : 'color')}
          className="px-1.5 py-1 rounded hover:bg-[#222A33] font-bold border border-[#1E293B] text-xs"
          title="Cor do texto e fundo"
        >
          A
        </button>

        {openMenu === 'color' && (
          <div
            className={`absolute left-0 ${dropdownPositionClass} w-52 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-3 space-y-3 z-50 max-h-[70vh] overflow-y-auto whitespace-normal`}
          >
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
        className={`p-1 sm:p-1.5 rounded hover:bg-[#222A33] shrink-0 ${
          editor.isActive('bold') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1 sm:p-1.5 rounded hover:bg-[#222A33] shrink-0 ${
          editor.isActive('italic') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-1 sm:p-1.5 rounded hover:bg-[#222A33] shrink-0 ${
          editor.isActive('underline') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`p-1 sm:p-1.5 rounded hover:bg-[#222A33] shrink-0 ${
          editor.isActive('strike') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Tachado (Ctrl+Shift+X)"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`p-1 sm:p-1.5 rounded hover:bg-[#222A33] shrink-0 ${
          editor.isActive('code') ? 'text-blue-400 bg-[#222A33]' : ''
        }`}
        title="Código em linha"
      >
        <Code className="w-3.5 h-3.5" />
      </button>

      {/* Inserir / Editar Link */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            const existingHref = editor.getAttributes('link').href || '';
            setLinkUrl(existingHref);
            setOpenMenu(openMenu === 'link' ? 'none' : 'link');
          }}
          className={`p-1 sm:p-1.5 rounded hover:bg-[#222A33] ${
            editor.isActive('link') ? 'text-blue-400 bg-[#222A33]' : ''
          }`}
          title="Inserir Link (Ctrl+K)"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>

        {openMenu === 'link' && (
          <div
            className={`absolute right-0 ${dropdownPositionClass} w-60 bg-[#181E24] border border-[#1E293B] rounded-xl p-2 shadow-2xl flex items-center gap-1 z-50`}
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

      <div className="w-[1px] h-4 bg-[#1E293B] mx-0.5 shrink-0" />

      {/* Botão Comentário */}
      <button
        type="button"
        onClick={() => {
          const text = getSelectedText();
          if (text) onAddComment(text);
          setCoords(null);
        }}
        className="flex items-center gap-1 p-1 sm:px-2 sm:py-1 rounded hover:bg-[#222A33] text-[#F1F5F9] shrink-0"
        title="Comentar trecho selecionado"
      >
        <MessageSquare className="w-3.5 h-3.5 text-[#94A3B8]" />
        <span className="hidden sm:inline">Comentário</span>
      </button>
    </div>
  );
};

// ============================================================================
// 2. SLASH COMMAND MENU (MENU DO BOTÃO "+" E ATALHO "/")
// ============================================================================
interface SlashCommandMenuProps {
  editor: Editor | null;
  visible: boolean;
  x: number;
  y: number;
  initialQuery?: string;
  onClose: () => void;
  onCreateSubpage: () => void;
  onAutoCalculate?: (mode: 'sum' | 'subtraction') => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  editor,
  visible,
  x,
  y,
  initialQuery = '',
  onClose,
  onCreateSubpage,
  onAutoCalculate,
}) => {
  const [filter, setFilter] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isDesktop =
    typeof window !== 'undefined'
      ? window.innerWidth >= 1024 && !window.matchMedia('(pointer: coarse)').matches
      : true;

  useEffect(() => {
    setFilter(initialQuery);
    setSelectedIndex(0);
  }, [initialQuery, visible]);

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
        label: 'Lista de tarefas',
        desc: 'Acompanhe tarefas com caixas de seleção.',
        icon: CheckSquare,
        action: () => editor?.chain().focus().toggleTaskList().run(),
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
      // Cálculo (Apenas Soma e Subtração)
      {
        group: 'Cálculo',
        label: 'Somar valores (+)',
        desc: 'Soma os valores da lista ou seção atual.',
        icon: Plus,
        action: () => onAutoCalculate?.('sum'),
      },
      {
        group: 'Cálculo',
        label: 'Subtrair valores (-)',
        desc: 'Subtrai os gastos do primeiro valor da seção.',
        icon: Minus,
        action: () => onAutoCalculate?.('subtraction'),
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
    [editor, onCreateSubpage, onAutoCalculate]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
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
            onClose();
            editor.commands.focus();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            editor.commands.focus();
          }
        }}
        placeholder="Filtrar blocos..."
        autoFocus={isDesktop}
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