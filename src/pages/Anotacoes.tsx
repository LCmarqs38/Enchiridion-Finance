import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import {
  Plus,
  Trash2,
  Search,
  Star,
  Image as ImageIcon,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Download,
  Upload,
  RotateCcw,
  Check,
  FolderPlus,
  Copy,
  ArrowUp,
  ArrowDown,
  PanelLeftClose,
  PanelLeftOpen,
  CheckSquare,
  Bold,
  Calculator,
  Indent,
  Outdent,
} from 'lucide-react';
import { NotePage, PAGE_ICONS, PAGE_COVERS } from '@/notes/types';
import {
  loadAndMigratePages,
  savePagesToStorage,
  extractPlainTextFromJSON,
  jsonToMarkdown,
  markdownToTiptapJSON,
} from '@/notes/migrationAndStorage';
import { createEnchiridionExtensions, PageBridgeContext, PageBridge } from '@/notes/extensions';
import {
  BubbleToolbar,
  SlashCommandMenu,
  evaluateMathExpression,
  analyzeTextNumbers,
  formatMathValue,
  getSafeBlockInsertPos,
} from '@/notes/Menus';

// ============================================================================
// TIPAGENS INTERNAS
// ============================================================================
interface SlashMenuState {
  visible: boolean;
  x: number;
  y: number;
  query: string;
}

interface GutterState {
  visible: boolean;
  top: number;
  left: number;
  pos: number;
}

interface BlockActionMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetPos: number;
}

interface SidebarItemProps {
  page: NotePage;
  allPages: NotePage[];
  activeId: string;
  expanded: Record<string, boolean>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

// Remove recursivamente links de subpáginas que foram movidas para a lixeira
function removeDeletedPageLinksFromContent(
  node: JSONContent,
  deletedIds: Set<string>
): JSONContent {
  if (!node.content) return node;
  const filteredContent = node.content
    .filter((child) => !(child.type === 'pageLink' && deletedIds.has(child.attrs?.pageId)))
    .map((child) => removeDeletedPageLinksFromContent(child, deletedIds));

  return {
    ...node,
    content: filteredContent.length > 0 ? filteredContent : [{ type: 'paragraph' }],
  };
}

// ============================================================================
// COMPONENTE PRINCIPAL: ANOTAÇÕES
// ============================================================================
export default function Anotacoes() {
  // 1. Estados de Dados e Navegação
  const [pages, setPages] = useState<NotePage[]>(() => loadAndMigratePages());
  const [activePageId, setActivePageId] = useState<string>(() => {
    const firstValid = pages.find((p) => !p.isDeleted);
    return firstValid?.id || pages[0]?.id || 'root-1';
  });
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({ 'root-1': true });
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // 2. Estados de Interface (Acordeão inicia recolhido no celular e aberto no PC)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [showTrash, setShowTrash] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [selectedQuoteForComment, setSelectedQuoteForComment] = useState<string | undefined>();

  // 3. Estados da Barra Rápida Mobile (acima do teclado)
  const [editorFocused, setEditorFocused] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // 4. Estados dos Menus Flutuantes do Editor e Gutter ("+" e "::")
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>({
    visible: false,
    x: 0,
    y: 0,
    query: '',
  });
  const [gutter, setGutter] = useState<GutterState>({
    visible: false,
    top: 0,
    left: 6,
    pos: -1,
  });
  const [blockActionMenu, setBlockActionMenu] = useState<BlockActionMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetPos: -1,
  });

  // 5. Referências para evitar Stale Closures nos callbacks do Tiptap
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const activePageIdRef = useRef<string>(activePageId);
  const slashMenuVisibleRef = useRef<boolean>(slashMenu.visible);
  const isInitialMountRef = useRef<boolean>(true);

  const activePage = useMemo(
    () =>
      pages.find((p) => p.id === activePageId && !p.isDeleted) ||
      pages.find((p) => !p.isDeleted) ||
      pages[0],
    [pages, activePageId]
  );

  // Seleciona página e recolhe automaticamente o acordeão no celular
  const handleSelectPage = useCallback((id: string) => {
    setActivePageId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    if (activePage) {
      activePageIdRef.current = activePage.id;
    }
  }, [activePage]);

  useEffect(() => {
    slashMenuVisibleRef.current = slashMenu.visible;
  }, [slashMenu.visible]);

  // Monitora a altura do teclado virtual no celular via visualViewport
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handleViewportChange = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);
    return () => {
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  // 6. Inicialização do Motor Tiptap com Avaliação Automática ao digitar "=" + Espaço/Enter
  const extensions = useMemo(() => createEnchiridionExtensions(), []);

  const editor = useEditor({
    extensions,
    content: activePage?.content || { type: 'doc', content: [{ type: 'paragraph' }] },
    onFocus: () => setEditorFocused(true),
    onBlur: () => {
      setTimeout(() => setEditorFocused(false), 180);
    },
    editorProps: {
      attributes: {
        class:
          'tiptap focus:outline-none min-h-[55vh] text-[#F1F5F9] text-sm md:text-[1.1rem] leading-relaxed',
      },
      handleKeyDown: (view, event) => {
        // Abre menu "/" apenas no início da linha (permite usar "/" em datas, divisões e textos como Netflix/HBO)
        if (event.key === '/' && !slashMenuVisibleRef.current) {
          const { $from } = view.state.selection;
          const textBefore = $from.parent.textBetween(0, $from.parentOffset, '');
          if (textBefore.trim() === '') {
            setTimeout(() => {
              const { from } = view.state.selection;
              const coords = view.coordsAtPos(from);
              setSlashMenu({
                visible: true,
                x: coords.left,
                y: coords.bottom + 6,
                query: '',
              });
            }, 10);
          }
          return false;
        }

        // Destrava o Backspace em torno de blocos de colunas (columnList)
        if (event.key === 'Backspace') {
          const { state, dispatch } = view;
          const { empty, $from } = state.selection;

          if (empty && $from.parentOffset === 0) {
            // Caso 1: Cursor no início de um parágrafo logo abaixo de um bloco de colunas
            if ($from.depth === 1 && $from.index(0) > 0) {
              const prevNode = state.doc.child($from.index(0) - 1);
              if (prevNode.type.name === 'columnList') {
                const currNode = $from.parent;
                const currStart = $from.before(1);
                const currEnd = $from.after(1);

                event.preventDefault();
                if (currNode.textContent.trim() === '') {
                  // Se a linha estiver vazia, apaga a linha
                  dispatch(state.tr.delete(currStart, currEnd));
                } else {
                  // Se tiver texto (ex: Total que caiu fora da coluna), move para o final da última coluna
                  const insertInsideColPos = currStart - 2;
                  const tr = state.tr.delete(currStart, currEnd);
                  dispatch(tr.insert(insertInsideColPos, currNode));
                }
                return true;
              }
            }

            // Caso 2: Cursor no primeiro parágrafo de uma coluna quando todo o columnList está vazio
            for (let d = $from.depth; d >= 1; d--) {
              if ($from.node(d).type.name === 'columnList') {
                const colListNode = $from.node(d);
                if (colListNode.textContent.trim() === '' && $from.index(d - 1) >= 0) {
                  event.preventDefault();
                  const start = $from.before(d);
                  const end = $from.after(d);
                  const pNode = state.schema.nodes.paragraph.create();
                  dispatch(state.tr.replaceWith(start, end, pNode));
                  return true;
                }
                break;
              }
            }
          }
        }

        // Cálculo automático em linha quando termina com "=" e aperta Espaço ou Enter
        // Ex: "1500 - 80 - 485 - 200 =" -> "1500 - 80 - 485 - 200 = R$ 735,00"
        if (event.key === ' ' || event.key === 'Enter') {
          const { $from, empty } = view.state.selection;
          if (empty) {
            const lineTextBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '');
            if (lineTextBeforeCursor.trimEnd().endsWith('=')) {
              const evaluated = evaluateMathExpression(lineTextBeforeCursor);
              if (evaluated) {
                event.preventDefault();
                const formatted = formatMathValue(evaluated.result, evaluated.hasCurrency);
                const prefix = lineTextBeforeCursor.endsWith(' ') ? '' : ' ';
                view.dispatch(view.state.tr.insertText(`${prefix}${formatted}`));
                return true;
              }
            }
          }
        }

        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const currentId = activePageIdRef.current;
      const json = editor.getJSON();
      setSaveStatus('saving');
      setPages((prev) =>
        prev.map((p) => (p.id === currentId ? { ...p, content: json, updatedAt: Date.now() } : p))
      );
    },
  });

  // Executa cálculo automático mantendo o resultado sempre dentro da mesma coluna/bloco
  const triggerSmartCalculation = useCallback(
    (defaultMode: 'sum' | 'subtraction' = 'sum') => {
      if (!editor) return;
      const { state } = editor;
      const { from, to, empty, $from } = state.selection;

      // 1. Se houver texto selecionado, calcula o trecho e insere logo abaixo dentro da mesma coluna
      if (!empty && from !== to) {
        const selectedText = state.doc.textBetween(from, to, '\n');
        const summary = analyzeTextNumbers(selectedText);
        if (summary) {
          const val =
            summary.expressionResult !== null
              ? summary.expressionResult
              : defaultMode === 'subtraction'
              ? summary.subtraction
              : summary.sum;
          const label =
            summary.expressionResult !== null
              ? 'Resultado'
              : defaultMode === 'subtraction'
              ? 'Restante'
              : 'Total';

          let safeTo = to;
          while (safeTo > from) {
            const charBefore = state.doc.textBetween(safeTo - 1, safeTo, '');
            if (charBefore.trim().length > 0) break;
            safeTo--;
          }

          const $end = state.doc.resolve(safeTo);
          const insertPos = getSafeBlockInsertPos($end);

          editor
            .chain()
            .focus()
            .insertContentAt(insertPos, {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `${label}: ${formatMathValue(val, summary.hasCurrency)}`,
                  marks: [{ type: 'bold' }],
                },
              ],
            })
            .run();
        }
        return;
      }

      // 2. Se a linha atual tiver uma expressão matemática (ex: "1500 - 80 - 485"), resolve na mesma linha
      const currentLineText = $from.parent.textContent;
      const lineEval = evaluateMathExpression(currentLineText);
      if (lineEval) {
        const endOfLinePos = $from.end();
        const suffix = currentLineText.trimEnd().endsWith('=')
          ? ` ${formatMathValue(lineEval.result, lineEval.hasCurrency)}`
          : ` = ${formatMathValue(lineEval.result, lineEval.hasCurrency)}`;
        editor.chain().focus().insertContentAt(endOfLinePos, suffix).run();
        return;
      }

      // 3. Caso contrário, lê todos os valores da coluna/lista atual do topo do bloco até o cursor
      let containerText = '';
      for (let d = $from.depth; d >= 1; d--) {
        const node = $from.node(d);
        if (
          node.type.name === 'column' ||
          node.type.name === 'taskList' ||
          node.type.name === 'bulletList' ||
          node.type.name === 'orderedList' ||
          node.type.name === 'toggleBlock' ||
          node.type.name === 'calloutBlock'
        ) {
          containerText = state.doc.textBetween($from.start(d), $from.end(), '\n');
          break;
        }
      }
      if (!containerText) {
        containerText = state.doc.textBetween(0, $from.end(), '\n');
      }

      const summary = analyzeTextNumbers(containerText);
      if (!summary || summary.numbers.length === 0) return;

      const value = defaultMode === 'subtraction' ? summary.subtraction : summary.sum;
      const label = defaultMode === 'subtraction' ? 'Restante' : 'Total';
      const formatted = formatMathValue(value, summary.hasCurrency);

      if (currentLineText.trim() === '') {
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'text',
            text: `${label}: ${formatted}`,
            marks: [{ type: 'bold' }],
          })
          .run();
      } else {
        const insertPos = getSafeBlockInsertPos($from);
        editor
          .chain()
          .focus()
          .insertContentAt(insertPos, {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `${label}: ${formatted}`,
                marks: [{ type: 'bold' }],
              },
            ],
          })
          .run();
      }
    },
    [editor]
  );

  // Funções de recuo (Tab / Shift+Tab) para os botões da Barra Rápida Mobile
  const handleMobileIndent = (direction: 'in' | 'out') => {
    if (!editor) return;
    if (editor.isActive('taskItem')) {
      if (direction === 'in') editor.chain().focus().sinkListItem('taskItem').run();
      else editor.chain().focus().liftListItem('taskItem').run();
      return;
    }
    if (editor.isActive('listItem')) {
      if (direction === 'in') editor.chain().focus().sinkListItem('listItem').run();
      else editor.chain().focus().liftListItem('listItem').run();
      return;
    }

    const { state, dispatch } = editor.view;
    const { from, to } = state.selection;
    let tr = state.tr;
    let changed = false;

    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === 'paragraph' || node.type.name === 'heading') {
        const currentIndent = node.attrs.indent || 0;
        const nextIndent =
          direction === 'in' ? Math.min(6, currentIndent + 1) : Math.max(0, currentIndent - 1);
        if (nextIndent !== currentIndent) {
          tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: nextIndent });
          changed = true;
        }
        return false;
      }
    });

    if (changed && dispatch) dispatch(tr);
    editor.commands.focus();
  };

  // 7. Sincronização de Conteúdo ao Alternar de Página
  useEffect(() => {
    if (!editor || !activePage) return;
    const currentJSON = JSON.stringify(editor.getJSON());
    const targetJSON = JSON.stringify(activePage.content);
    if (currentJSON !== targetJSON) {
      editor.commands.setContent(
        activePage.content || { type: 'doc', content: [{ type: 'paragraph' }] },
        { emitUpdate: false }
      );
    }
    setGutter((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setBlockActionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setSlashMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, [activePage?.id, editor]);

  // 8. Salvamento Automático com Debounce (400ms)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      const ok = savePagesToStorage(pages);
      setSaveStatus(ok ? 'saved' : 'error');
    }, 400);
    return () => clearTimeout(timer);
  }, [pages]);

  // ============================================================================
  // GERENCIAMENTO DE PÁGINAS E SUBPÁGINAS
  // ============================================================================
  const updatePage = useCallback((id: string, updates: Partial<NotePage>) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p))
    );
  }, []);

  const createPage = useCallback(
    (parentId: string | null = null, title = 'Nova página', openImmediately = true) => {
      const newId = `page-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newPage: NotePage = {
        id: newId,
        title,
        icon: parentId ? '📄' : '📝',
        parentId,
        isFavorite: false,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        comments: [],
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      };

      setPages((prev) => [...prev, newPage]);
      if (parentId) {
        setExpandedPages((prev) => ({ ...prev, [parentId]: true }));
      }
      if (openImmediately) {
        setActivePageId(newId);
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          setSidebarOpen(false);
        }
      }
      return newId;
    },
    []
  );

  const createSubpageInsideEditor = useCallback(() => {
    if (!editor || !activePage) return;
    const subId = createPage(activePage.id, 'Subpágina', false);
    editor
      .chain()
      .focus()
      .insertContent([
        { type: 'pageLink', attrs: { pageId: subId, title: 'Subpágina' } },
        { type: 'paragraph' },
      ])
      .run();
  }, [editor, activePage, createPage]);

  const duplicatePage = useCallback(
    (pageId: string) => {
      const orig = pages.find((p) => p.id === pageId);
      if (!orig) return;
      const newId = `page-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const copy: NotePage = {
        ...JSON.parse(JSON.stringify(orig)),
        id: newId,
        title: `${orig.title} (Cópia)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setPages((prev) => [...prev, copy]);
    },
    [pages]
  );

  const softDeletePage = useCallback(
    (pageId: string) => {
      const activeCount = pages.filter((p) => !p.isDeleted).length;
      if (activeCount <= 1) return;

      const findDescendants = (id: string): string[] => [
        id,
        ...pages.filter((p) => p.parentId === id).flatMap((child) => findDescendants(child.id)),
      ];
      const toTrash = new Set(findDescendants(pageId));

      setPages((prev) =>
        prev.map((p) => {
          if (toTrash.has(p.id)) {
            return { ...p, isDeleted: true, updatedAt: Date.now() };
          }
          const cleanedContent = removeDeletedPageLinksFromContent(p.content, toTrash);
          return cleanedContent !== p.content ? { ...p, content: cleanedContent } : p;
        })
      );

      if (editor && activePage && !toTrash.has(activePage.id)) {
        const currentEditorClean = removeDeletedPageLinksFromContent(editor.getJSON(), toTrash);
        if (JSON.stringify(currentEditorClean) !== JSON.stringify(editor.getJSON())) {
          editor.commands.setContent(currentEditorClean, { emitUpdate: false });
        }
      }

      if (toTrash.has(activePageId)) {
        const remaining = pages.filter((p) => !p.isDeleted && !toTrash.has(p.id));
        if (remaining[0]) setActivePageId(remaining[0].id);
      }
    },
    [pages, activePageId, editor, activePage]
  );

  const restorePage = useCallback((pageId: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === pageId);
      if (!target) return prev;

      const parentValid =
        target.parentId && prev.some((p) => p.id === target.parentId && !p.isDeleted);

      return prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              isDeleted: false,
              parentId: parentValid ? p.parentId : null,
              updatedAt: Date.now(),
            }
          : p
      );
    });
  }, []);

  const permanentDeletePage = useCallback((pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  }, []);

  const handleAddComment = useCallback(() => {
    if (!newCommentText.trim() || !activePage) return;
    const nextComments = [
      ...(activePage.comments || []),
      {
        id: `c-${Date.now()}`,
        author: 'Você',
        text: newCommentText.trim(),
        selectedText: selectedQuoteForComment,
        resolved: false,
        createdAt: Date.now(),
      },
    ];
    updatePage(activePage.id, { comments: nextComments });
    setNewCommentText('');
    setSelectedQuoteForComment(undefined);
  }, [newCommentText, activePage, selectedQuoteForComment, updatePage]);

  // Ponte de contexto para os blocos PageLink dentro do Tiptap
  const pageBridge: PageBridge = useMemo(
    () => ({
      getPageInfo: (id) => {
        const found = pages.find((p) => p.id === id && !p.isDeleted);
        return found ? { title: found.title, icon: found.icon } : null;
      },
      openPage: (id) => {
        const exists = pages.find((p) => p.id === id && !p.isDeleted);
        if (exists) handleSelectPage(id);
      },
      renamePage: (id, newTitle) => updatePage(id, { title: newTitle }),
      duplicatePage: (id) => duplicatePage(id),
      deletePage: (id) => softDeletePage(id),
    }),
    [pages, handleSelectPage, updatePage, duplicatePage, softDeletePage]
  );

  // ============================================================================
  // BUSCA E NAVEGAÇÃO (BREADCRUMBS)
  // ============================================================================
  const breadcrumbs = useMemo(() => {
    const trail: NotePage[] = [];
    let curr: NotePage | undefined = activePage;
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      trail.unshift(curr);
      curr = pages.find((p) => p.id === curr?.parentId);
    }
    return trail;
  }, [activePage, pages]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return pages.filter(
      (p) =>
        !p.isDeleted &&
        (p.title.toLowerCase().includes(q) ||
          extractPlainTextFromJSON(p.content).toLowerCase().includes(q))
    );
  }, [pages, searchQuery]);

  // ============================================================================
  // GUTTER LATERAL ("+" E "::") E MANIPULAÇÃO DE BLOCOS (PC E MOBILE)
  // ============================================================================
  const updateGutterByCoordinates = useCallback(
    (clientX: number, clientY: number, targetEl: HTMLElement | null) => {
      if (!editorWrapperRef.current || !editor || blockActionMenu.visible) return;

      if (targetEl?.closest('.gutter-controls')) {
        return;
      }

      if (targetEl?.tagName === 'HR') {
        setGutter((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const tiptapEl = editorWrapperRef.current.querySelector('.tiptap') as HTMLElement | null;
      if (!tiptapEl) return;

      const blockElements = Array.from(
        tiptapEl.querySelectorAll(
          'li, p:not(li p), h1, h2, h3, h4, pre, table, [data-type="page-link"], [data-type="callout-block"], [data-type="toggle-block"], [data-type="math-block"], [data-type="bookmark-block"]'
        )
      ) as HTMLElement[];

      const isMobile = window.innerWidth < 640;
      const gutterOffset = isMobile ? 50 : 56;

      for (let i = blockElements.length - 1; i >= 0; i--) {
        const el = blockElements[i];
        const rect = el.getBoundingClientRect();

        const colEl = el.closest('.notion-column') as HTMLElement | null;
        const anchorLeft = colEl
          ? colEl.getBoundingClientRect().left
          : tiptapEl.getBoundingClientRect().left;

        const isWithinY = clientY >= rect.top - 6 && clientY <= rect.bottom + 6;
        const isWithinX = clientX >= anchorLeft - 72 && clientX <= rect.right + 28;

        if (isWithinY && isWithinX) {
          const wrapperRect = editorWrapperRef.current.getBoundingClientRect();
          const targetForPos = (el.querySelector('p, h1, h2, h3, h4') as HTMLElement) || el;
          let pos = -1;
          try {
            pos = editor.view.posAtDOM(targetForPos, 0);
          } catch {}

          const rawLeft = anchorLeft - wrapperRect.left - gutterOffset;
          const safeLeft = Math.max(4, rawLeft);
          const nextTop = rect.top - wrapperRect.top;

          setGutter((prev) => {
            if (
              prev.visible &&
              Math.abs(prev.top - nextTop) < 1 &&
              Math.abs(prev.left - safeLeft) < 1 &&
              prev.pos === pos
            ) {
              return prev;
            }
            return {
              visible: true,
              top: nextTop,
              left: safeLeft,
              pos,
            };
          });
          return;
        }
      }
    },
    [editor, blockActionMenu.visible]
  );

  const handleEditorMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    updateGutterByCoordinates(e.clientX, e.clientY, e.target as HTMLElement);
  };

  const handleEditorTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) {
      updateGutterByCoordinates(touch.clientX, touch.clientY, e.target as HTMLElement);
    }
  };

  const manipulateBlockAtPos = (
    action: 'delete' | 'duplicate' | 'up' | 'down',
    targetPos: number
  ) => {
    if (!editor || targetPos < 0) return;
    const { state, view } = editor;
    const { doc } = state;

    try {
      const $pos = doc.resolve(Math.min(targetPos, doc.content.size));
      let targetDepth = -1;

      for (let d = $pos.depth; d >= 1; d--) {
        const name = $pos.node(d).type.name;
        if (name === 'taskItem' || name === 'listItem') {
          targetDepth = d;
          break;
        }
      }

      if (targetDepth === -1) {
        for (let d = $pos.depth; d >= 1; d--) {
          const name = $pos.node(d).type.name;
          if (
            [
              'paragraph',
              'heading',
              'codeBlock',
              'blockquote',
              'horizontalRule',
              'pageLink',
              'mathBlock',
              'bookmarkBlock',
              'calloutBlock',
              'toggleBlock',
              'table',
            ].includes(name)
          ) {
            targetDepth = d;
            break;
          }
        }
      }

      if (targetDepth > 0) {
        const node = $pos.node(targetDepth);
        const start = $pos.before(targetDepth);
        const end = $pos.after(targetDepth);
        const parent = $pos.node(targetDepth - 1);
        const index = $pos.index(targetDepth - 1);

        if (action === 'delete') {
          if (
            parent.childCount <= 1 &&
            (parent.type.name === 'doc' || parent.type.name === 'column')
          ) {
            const pNode = state.schema.nodes.paragraph.create();
            view.dispatch(state.tr.replaceWith(start, end, pNode));
          } else {
            editor.chain().focus().deleteRange({ from: start, to: end }).run();
          }
        } else if (action === 'duplicate') {
          editor.chain().focus().insertContentAt(end, node.toJSON()).run();
        } else if (action === 'up' && index > 0) {
          const prevNode = parent.child(index - 1);
          const prevStart = start - prevNode.nodeSize;
          view.dispatch(state.tr.replaceWith(prevStart, end, [node, prevNode]));
        } else if (action === 'down' && index < parent.childCount - 1) {
          const nextNode = parent.child(index + 1);
          const nextEnd = end + nextNode.nodeSize;
          view.dispatch(state.tr.replaceWith(start, nextEnd, [nextNode, node]));
        }
      }
    } catch (err) {
      console.error('Erro ao manipular bloco:', err);
    }

    setBlockActionMenu((prev) => ({ ...prev, visible: false }));
  };

  // ============================================================================
  // EXPORTAÇÃO E IMPORTAÇÃO DE DOCUMENTOS
  // ============================================================================
  const handleExportDocument = (format: 'md' | 'html' | 'json') => {
    if (!activePage || !editor) return;
    let contentStr = '';
    let mime = 'text/plain';
    const ext = format;

    if (format === 'md') {
      contentStr = jsonToMarkdown(editor.getJSON(), activePage.title);
      mime = 'text/markdown';
    } else if (format === 'html') {
      contentStr = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activePage.title}</title></head><body style="background:#12161A;color:#F1F5F9;font-family:sans-serif;padding:2rem;"><h1>${activePage.icon} ${activePage.title}</h1>${editor.getHTML()}</body></html>`;
      mime = 'text/html';
    } else {
      contentStr = JSON.stringify(activePage, null, 2);
      mime = 'application/json';
    }

    const blob = new Blob([contentStr], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePage.title || 'documento'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleImportDocument = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (file.name.endsWith('.md')) {
        const parsed = markdownToTiptapJSON(text);
        const id = createPage(null, parsed.title, true);
        updatePage(id, { content: parsed.content });
      } else if (file.name.endsWith('.json')) {
        try {
          const obj = JSON.parse(text);
          if (obj.content && obj.title) {
            const newId = `page-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            setPages((prev) => [...prev, { ...obj, id: newId, isDeleted: false }]);
            handleSelectPage(newId);
          }
        } catch {
          alert('Arquivo JSON inválido.');
        }
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const closeAllFloatingMenus = () => {
    setSlashMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setBlockActionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setShowIconPicker(false);
    setShowCoverPicker(false);
    setShowExportMenu(false);
  };

  // ============================================================================
  // RENDERIZAÇÃO
  // ============================================================================
  return (
    <PageBridgeContext.Provider value={pageBridge}>
      <div
        onClick={closeAllFloatingMenus}
        className="flex flex-col lg:flex-row gap-3 lg:gap-4 min-h-[calc(100vh-5rem)] text-[#F1F5F9]"
      >
        <input
          ref={importInputRef}
          type="file"
          accept=".md,.json"
          className="hidden"
          onChange={handleImportDocument}
        />

        {/* ===================================================================
            ACORDEÃO NO CELULAR ("ENCHIRIDION • PÁGINA") E SIDEBAR NO PC
           =================================================================== */}
        <aside
          className={`w-full lg:w-64 bg-[#12161A] border border-[#1E293B] rounded-2xl px-3.5 ${
            sidebarOpen ? 'py-3.5' : 'py-2.5 lg:hidden'
          } flex flex-col justify-between shrink-0 select-none transition-all`}
        >
          <div>
            {/* Linha Principal "ENCHIRIDION": clicável no celular para expandir/recolher */}
            <div
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setSidebarOpen((prev) => !prev);
                }
              }}
              className={`flex items-center justify-between cursor-pointer lg:cursor-default ${
                sidebarOpen ? 'pb-3 mb-3 border-b border-[#1E293B]' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold tracking-wider text-[#F1F5F9] uppercase shrink-0">
                  ENCHIRIDION
                </span>

                {/* Quando recolhido no celular, exibe a página atual ao lado de ENCHIRIDION */}
                {!sidebarOpen && (
                  <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] truncate lg:hidden">
                    <span className="text-[#475569]">•</span>
                    <span>{activePage.icon}</span>
                    <span className="text-[#F1F5F9] font-medium truncate">
                      {activePage.title || 'Sem título'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    createPage(null, 'Nova página', true);
                  }}
                  title="Nova Página Raiz"
                  className="p-1 hover:bg-[#181E24] text-[#94A3B8] hover:text-[#F1F5F9] rounded transition"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>

                {/* Seta indicadora de acordeão no celular */}
                <span className="p-1 text-[#94A3B8] lg:hidden">
                  {sidebarOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>

                {/* Botão de recolher exclusivo para PC */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSidebarOpen(false);
                  }}
                  title="Recolher barra lateral"
                  className="hidden lg:inline-flex p-1 hover:bg-[#181E24] text-[#94A3B8] hover:text-[#F1F5F9] rounded transition"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conteúdo interno do Acordeão / Sidebar (visível apenas quando aberto) */}
            {sidebarOpen && (
              <>
                {/* Busca Global */}
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar em títulos e notas..."
                    className="w-full bg-[#181E24] border border-[#1E293B] rounded-lg pl-8 pr-2.5 py-1 text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none"
                  />
                </div>

                {/* Resultados da Busca ou Árvore de Páginas */}
                {searchQuery.trim() !== '' ? (
                  <div className="space-y-1 mb-4 max-h-56 overflow-y-auto">
                    <div className="text-[10px] font-semibold uppercase text-[#94A3B8] px-2">
                      Resultados ({searchResults.length})
                    </div>
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          handleSelectPage(p.id);
                          setSearchQuery('');
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[#181E24] text-left truncate"
                      >
                        <span>{p.icon}</span>
                        <span className="truncate">{p.title}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Favoritos */}
                    {pages.some((p) => p.isFavorite && !p.isDeleted) && (
                      <div className="mb-4">
                        <div className="text-[10px] font-semibold uppercase text-[#94A3B8] px-2 mb-1">
                          Favoritos
                        </div>
                        {pages
                          .filter((p) => p.isFavorite && !p.isDeleted)
                          .map((fav) => (
                            <button
                              key={fav.id}
                              type="button"
                              onClick={() => handleSelectPage(fav.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs md:text-sm mb-0.5 transition ${
                                fav.id === activePage.id
                                  ? 'bg-[#181E24] text-white font-semibold'
                                  : 'text-[#94A3B8] hover:bg-[#181E24] hover:text-[#F1F5F9]'
                              }`}
                            >
                              <span>{fav.icon}</span>
                              <span className="truncate">{fav.title}</span>
                            </button>
                          ))}
                      </div>
                    )}

                    {/* Lista Hierárquica de Páginas */}
                    <div className="text-[10px] font-semibold uppercase text-[#94A3B8] px-2 mb-1">
                      Páginas
                    </div>
                    <div className="space-y-0.5 overflow-y-auto max-h-[36vh] lg:max-h-[52vh] pr-1">
                      {pages
                        .filter((p) => !p.parentId && !p.isDeleted)
                        .map((page) => (
                          <SidebarItem
                            key={page.id}
                            page={page}
                            allPages={pages.filter((p) => !p.isDeleted)}
                            activeId={activePage.id}
                            expanded={expandedPages}
                            onSelect={handleSelectPage}
                            onToggle={(id) =>
                              setExpandedPages((prev) => ({ ...prev, [id]: !prev[id] }))
                            }
                            onCreateChild={(parentId) => {
                              const subId = createPage(parentId, 'Subpágina', true);
                              setPages((prev) =>
                                prev.map((p) => {
                                  if (p.id !== parentId) return p;
                                  const nextContent: JSONContent = {
                                    type: 'doc',
                                    content: [
                                      ...(p.content.content || []),
                                      {
                                        type: 'pageLink',
                                        attrs: { pageId: subId, title: 'Subpágina' },
                                      },
                                      { type: 'paragraph' },
                                    ],
                                  };
                                  return { ...p, content: nextContent, updatedAt: Date.now() };
                                })
                              );
                            }}
                            onDuplicate={duplicatePage}
                            onDelete={softDeletePage}
                          />
                        ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Rodapé da Sidebar (Lixeira e Nova Página Raiz) */}
          {sidebarOpen && (
            <div className="pt-3 mt-3 border-t border-[#1E293B] space-y-1.5">
              <button
                type="button"
                onClick={() => setShowTrash(!showTrash)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#181E24] transition"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Lixeira</span>
                </div>
                <span className="text-[10px] bg-[#181E24] px-1.5 py-0.5 rounded">
                  {pages.filter((p) => p.isDeleted).length}
                </span>
              </button>

              {showTrash && (
                <div className="bg-[#181E24] border border-[#1E293B] rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                  {pages.filter((p) => p.isDeleted).length === 0 ? (
                    <div className="text-[11px] text-[#94A3B8] text-center py-2">Lixeira vazia</div>
                  ) : (
                    pages
                      .filter((p) => p.isDeleted)
                      .map((del) => (
                        <div
                          key={del.id}
                          className="flex items-center justify-between text-xs py-1 px-1"
                        >
                          <span className="truncate">
                            {del.icon} {del.title}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => restorePage(del.id)}
                              title="Restaurar"
                              className="p-1 hover:bg-[#222A33] text-emerald-400 rounded"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => permanentDeletePage(del.id)}
                              title="Excluir permanentemente"
                              className="p-1 hover:bg-[#222A33] text-rose-400 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => createPage(null, 'Nova página', true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-[#1E293B] hover:border-[#94A3B8] text-xs text-[#94A3B8] hover:text-[#F1F5F9] rounded-xl transition"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Página Raiz
              </button>
            </div>
          )}
        </aside>

        {/* ===================================================================
            ÁREA PRINCIPAL DO DOCUMENTO (#12161A ENCHIRIDION THEME)
           =================================================================== */}
        <main className="flex-1 bg-[#12161A] border border-[#1E293B] rounded-2xl overflow-hidden flex flex-col min-h-[75vh] relative">
          {/* Barra Superior: Breadcrumbs limpos no mobile, Status, Calculadora e Opções */}
          <div className="flex items-center justify-between px-3 sm:px-6 h-12 border-b border-[#1E293B] text-xs select-none">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {/* Botão de reabrir sidebar visível APENAS no PC quando recolhida */}
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="hidden lg:inline-flex items-center gap-1.5 p-1.5 rounded-lg bg-[#181E24]/80 hover:bg-[#181E24] border border-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] transition shrink-0"
                  title="Mostrar barra lateral"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}

              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <span className="text-[#475569]">/</span>}
                  <button
                    type="button"
                    onClick={() => handleSelectPage(crumb.id)}
                    className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[#181E24] text-[#F1F5F9] truncate max-w-[150px] sm:max-w-[180px]"
                  >
                    <span>{crumb.icon}</span>
                    <span className="truncate font-medium">{crumb.title || 'Sem título'}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Indicador de Salvamento Automático */}
              <span className="text-[11px] text-[#94A3B8] flex items-center gap-1">
                {saveStatus === 'saving' && 'Salvando...'}
                {saveStatus === 'saved' && (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="hidden sm:inline">Salvo</span>
                  </>
                )}
                {saveStatus === 'error' && <span className="text-rose-400">Erro</span>}
              </span>

              {/* Botão de Cálculo Automático Rápido no topo */}
              <button
                type="button"
                onClick={() => triggerSmartCalculation('sum')}
                className="p-1.5 rounded hover:bg-[#181E24] text-[#94A3B8] hover:text-emerald-400 transition"
                title="Calcular linha/coluna atual automaticamente"
              >
                <Calculator className="w-4 h-4" />
              </button>

              {/* Favoritar Página */}
              <button
                type="button"
                onClick={() => updatePage(activePage.id, { isFavorite: !activePage.isFavorite })}
                className={`p-1.5 rounded hover:bg-[#181E24] transition ${
                  activePage.isFavorite ? 'text-amber-400' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
                title="Favoritar página"
              >
                <Star className="w-4 h-4" fill={activePage.isFavorite ? 'currentColor' : 'none'} />
              </button>

              {/* Painel de Comentários */}
              <button
                type="button"
                onClick={() => setShowComments(!showComments)}
                className="p-1.5 rounded hover:bg-[#181E24] text-[#94A3B8] hover:text-[#F1F5F9] relative"
                title="Comentários da página"
              >
                <MessageSquare className="w-4 h-4" />
                {(activePage.comments?.length || 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-blue-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {activePage.comments?.length}
                  </span>
                )}
              </button>

              {/* Menu Opções (Exportar / Importar) */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-2 py-1 rounded bg-[#181E24] hover:bg-[#222A33] border border-[#1E293B] text-xs text-[#F1F5F9] flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Opções</span>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-8 z-50 w-48 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1.5 space-y-0.5 text-xs">
                    <div className="px-2 py-1 text-[10px] text-[#94A3B8] uppercase font-semibold">
                      Exportar Página
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExportDocument('md')}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#222A33]"
                    >
                      Markdown (.md)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportDocument('html')}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#222A33]"
                    >
                      HTML (.html)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportDocument('json')}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#222A33]"
                    >
                      JSON (.json)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        window.print();
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#222A33]"
                    >
                      Imprimir / Salvar PDF
                    </button>
                    <div className="border-t border-[#1E293B] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        importInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#222A33] text-emerald-400"
                    >
                      <Upload className="w-3.5 h-3.5" /> Importar (.md / .json)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Capa do Documento (Opcional) */}
          {activePage.cover && (
            <div
              style={{
                backgroundImage: activePage.cover.startsWith('http')
                  ? `url(${activePage.cover})`
                  : activePage.cover,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              className="w-full h-40 relative group border-b border-[#1E293B]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute right-4 bottom-3 opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
                <button
                  type="button"
                  onClick={() => setShowCoverPicker(!showCoverPicker)}
                  className="px-2.5 py-1 bg-[#12161A]/90 hover:bg-[#181E24] text-xs rounded border border-[#1E293B]"
                >
                  Alterar capa
                </button>
                <button
                  type="button"
                  onClick={() => updatePage(activePage.id, { cover: undefined })}
                  className="px-2.5 py-1 bg-[#12161A]/90 hover:bg-[#181E24] text-xs text-rose-400 rounded border border-[#1E293B]"
                >
                  Remover
                </button>
              </div>
            </div>
          )}

          {/* Corpo Centralizado com Margem Esquerda Calibrada (pl-14 no mobile / sm:px-16 no PC) */}
          <div className="max-w-5xl w-full mx-auto pl-14 pr-4 sm:px-16 py-6 sm:py-8 pb-24 flex-1 flex flex-col">
            {/* Cabeçalho da Página: Ícone, Botões Discretos e Título */}
            <div className="group mb-6">
              {/* Seletor de Ícone */}
              <div className="relative inline-block mb-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="text-5xl sm:text-6xl hover:bg-[#181E24] p-1.5 rounded-xl transition select-none"
                  title="Clique para alterar o ícone"
                >
                  {activePage.icon || '💰'}
                </button>

                {showIconPicker && (
                  <div className="absolute left-0 top-20 z-50 bg-[#181E24] border border-[#1E293B] rounded-xl p-2.5 shadow-2xl w-64 grid grid-cols-5 gap-1.5">
                    {PAGE_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => {
                          updatePage(activePage.id, { icon: ic });
                          setShowIconPicker(false);
                        }}
                        className="text-xl p-1.5 hover:bg-[#222A33] rounded-lg transition"
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Ações discretas estilo Notion ("Adicionar capa", "Adicionar comentário") */}
              <div className="flex items-center gap-3 text-xs text-[#94A3B8] mb-2 h-6 opacity-80 group-hover:opacity-100 transition-opacity select-none">
                {!activePage.cover && (
                  <button
                    type="button"
                    onClick={() => updatePage(activePage.id, { cover: PAGE_COVERS[0] })}
                    className="flex items-center gap-1.5 hover:text-[#F1F5F9] transition"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Adicionar capa</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowComments(true)}
                  className="flex items-center gap-1.5 hover:text-[#F1F5F9] transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Adicionar comentário</span>
                </button>
              </div>

              {showCoverPicker && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mb-4 p-2.5 bg-[#181E24] border border-[#1E293B] rounded-xl flex items-center gap-2 overflow-x-auto"
                >
                  {PAGE_COVERS.map((cov, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        updatePage(activePage.id, { cover: cov });
                        setShowCoverPicker(false);
                      }}
                      style={{
                        backgroundImage: cov.startsWith('http') ? `url(${cov})` : cov,
                        backgroundSize: 'cover',
                      }}
                      className="w-16 h-10 rounded border border-[#1E293B] shrink-0"
                    />
                  ))}
                </div>
              )}

              {/* Título Editável Direto */}
              <input
                type="text"
                value={activePage.title}
                onChange={(e) => updatePage(activePage.id, { title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    editor?.commands.focus('start');
                  }
                }}
                placeholder="Sem título"
                className="w-full bg-transparent text-3xl sm:text-5xl font-extrabold text-[#F1F5F9] tracking-tight placeholder-[#475569] focus:outline-none"
              />
            </div>

            {/* Painel de Comentários (Se aberto) */}
            {showComments && (
              <div className="mb-6 bg-[#181E24] border border-[#1E293B] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#94A3B8] uppercase">
                  <span>Comentários ({activePage.comments?.length || 0})</span>
                  <button
                    type="button"
                    onClick={() => setShowComments(false)}
                    className="hover:text-[#F1F5F9]"
                  >
                    Fechar
                  </button>
                </div>

                {selectedQuoteForComment && (
                  <div className="text-xs italic border-l-2 border-amber-500 pl-2 text-[#94A3B8]">
                    Trecho: "{selectedQuoteForComment}"
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    placeholder="Escreva um comentário..."
                    className="flex-1 bg-[#12161A] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#F1F5F9] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
                  >
                    Enviar
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(activePage.comments || []).map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 bg-[#12161A] rounded-lg border border-[#1E293B] flex items-start justify-between text-xs"
                    >
                      <div>
                        {c.selectedText && (
                          <div className="text-[11px] text-amber-300/90 border-l-2 border-amber-400 pl-2 mb-1">
                            "{c.selectedText}"
                          </div>
                        )}
                        <div
                          className={
                            c.resolved ? 'line-through text-[#94A3B8]' : 'text-[#F1F5F9]'
                          }
                        >
                          {c.text}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (activePage.comments || []).map((item) =>
                              item.id === c.id ? { ...item, resolved: !item.resolved } : item
                            );
                            updatePage(activePage.id, { comments: updated });
                          }}
                          className="p-1 hover:bg-[#222A33] text-emerald-400 rounded"
                          title="Marcar como resolvido"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (activePage.comments || []).filter(
                              (item) => item.id !== c.id
                            );
                            updatePage(activePage.id, { comments: updated });
                          }}
                          className="p-1 hover:bg-[#222A33] text-rose-400 rounded"
                          title="Excluir comentário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Container do Editor com área de captura estendida (-ml-14 pl-14 no mobile / sm:-ml-16 sm:pl-16 no PC) */}
            <div
              ref={editorWrapperRef}
              onMouseMove={handleEditorMouseMove}
              onTouchStart={handleEditorTouchStart}
              onMouseLeave={() => {
                if (!blockActionMenu.visible) {
                  setGutter((prev) => (prev.visible ? { ...prev, visible: false } : prev));
                }
              }}
              className="relative flex-1 -ml-14 pl-14 sm:-ml-16 sm:pl-16"
            >
              {/* Alças "+" e "::" visíveis por completo no Celular e no PC sem invadir a primeira letra */}
              {gutter.visible && (
                <div
                  style={{ top: gutter.top, left: gutter.left }}
                  className="gutter-controls absolute flex items-center gap-0.5 pr-2 sm:pr-3 py-0.5 select-none z-20"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editor && gutter.pos >= 0) {
                        editor.chain().focus().setTextSelection(gutter.pos).run();
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      setSlashMenu({
                        visible: true,
                        x: rect.left,
                        y: rect.bottom + 6,
                        query: '',
                      });
                    }}
                    className="p-0.5 sm:p-1 rounded hover:bg-[#181E24] text-[#94A3B8] hover:text-[#F1F5F9]"
                    title="Clique para inserir bloco"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setBlockActionMenu({
                        visible: true,
                        x: Math.max(12, Math.min(rect.left, window.innerWidth - 208)),
                        y:
                          rect.bottom + 180 > window.innerHeight
                            ? Math.max(16, rect.top - 160)
                            : rect.bottom + 6,
                        targetPos: gutter.pos,
                      });
                    }}
                    className="p-0.5 sm:p-1 rounded hover:bg-[#181E24] text-[#94A3B8] hover:text-[#F1F5F9] cursor-grab"
                    title="Opções e movimentação do bloco"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Menu Contextual do Bloco (ao clicar em "::") */}
              {blockActionMenu.visible && (
                <div
                  style={{ left: blockActionMenu.x, top: blockActionMenu.y }}
                  onClick={(e) => e.stopPropagation()}
                  className="fixed z-50 w-48 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1 text-xs text-[#F1F5F9] space-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => manipulateBlockAtPos('duplicate', blockActionMenu.targetPos)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#222A33] text-left"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#94A3B8]" /> Duplicar bloco
                  </button>
                  <button
                    type="button"
                    onClick={() => manipulateBlockAtPos('up', blockActionMenu.targetPos)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#222A33] text-left"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-[#94A3B8]" /> Mover para cima
                  </button>
                  <button
                    type="button"
                    onClick={() => manipulateBlockAtPos('down', blockActionMenu.targetPos)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#222A33] text-left"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-[#94A3B8]" /> Mover para baixo
                  </button>
                  <div className="border-t border-[#1E293B] my-1" />
                  <button
                    type="button"
                    onClick={() => manipulateBlockAtPos('delete', blockActionMenu.targetPos)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#472222] text-[#D44C47] text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir bloco
                  </button>
                </div>
              )}

              {/* Editor de Documento Tiptap */}
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* =================================================================
              BARRA RÁPIDA MOBILE ACIMA DO TECLADO (EXCLUSIVA PARA CELULAR)
             ================================================================= */}
          {editorFocused && editor && (
            <div
              style={{
                bottom: keyboardOffset > 0 ? `${keyboardOffset + 8}px` : '4.5rem',
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="lg:hidden fixed left-2.5 right-2.5 z-40 bg-[#181E24]/95 backdrop-blur-md border border-[#1E293B] rounded-xl shadow-2xl px-2 py-1.5 flex items-center justify-between gap-1 text-xs text-[#F1F5F9] select-none"
            >
              <div className="flex items-center gap-1 overflow-x-auto">
                {/* Abrir Menu de Blocos (+) */}
                <button
                  type="button"
                  onClick={() => {
                    const { from } = editor.state.selection;
                    const coords = editor.view.coordsAtPos(from);
                    setSlashMenu({
                      visible: true,
                      x: coords.left,
                      y: coords.bottom + 6,
                      query: '',
                    });
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#222A33] text-[#F1F5F9] font-medium shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Bloco</span>
                </button>

                {/* Alternar Tarefa / Checkbox */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                  className={`p-1.5 rounded-lg shrink-0 ${
                    editor.isActive('taskList')
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'hover:bg-[#222A33] text-[#94A3B8]'
                  }`}
                  title="Lista de tarefas"
                >
                  <CheckSquare className="w-4 h-4" />
                </button>

                {/* Diminuir Recuo (Shift+Tab) */}
                <button
                  type="button"
                  onClick={() => handleMobileIndent('out')}
                  className="p-1.5 rounded-lg hover:bg-[#222A33] text-[#94A3B8] shrink-0"
                  title="Diminuir recuo"
                >
                  <Outdent className="w-4 h-4" />
                </button>

                {/* Aumentar Recuo (Tab) */}
                <button
                  type="button"
                  onClick={() => handleMobileIndent('in')}
                  className="p-1.5 rounded-lg hover:bg-[#222A33] text-[#94A3B8] shrink-0"
                  title="Aumentar recuo (Tab)"
                >
                  <Indent className="w-4 h-4" />
                </button>

                {/* Negrito */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1.5 rounded-lg shrink-0 ${
                    editor.isActive('bold')
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'hover:bg-[#222A33] text-[#94A3B8]'
                  }`}
                  title="Negrito"
                >
                  <Bold className="w-4 h-4" />
                </button>

                {/* Cálculo Automático (+ / -) */}
                <button
                  type="button"
                  onClick={() => triggerSmartCalculation('sum')}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold shrink-0"
                  title="Calcular automaticamente"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Calc</span>
                </button>
              </div>

              {/* Fechar Teclado */}
              <button
                type="button"
                onClick={() => {
                  editor.commands.blur();
                  setEditorFocused(false);
                }}
                className="px-2 py-1 rounded-lg bg-[#12161A] border border-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] shrink-0"
                title="Ocultar teclado"
              >
                OK
              </button>
            </div>
          )}

          {/* Barra Flutuante de Seleção de Texto */}
          <BubbleToolbar
            editor={editor}
            onAddComment={(quote) => {
              setSelectedQuoteForComment(quote);
              setShowComments(true);
            }}
            onCreateSubpage={createSubpageInsideEditor}
          />

          {/* Menu Slash "/" */}
          <SlashCommandMenu
            editor={editor}
            visible={slashMenu.visible}
            x={slashMenu.x}
            y={slashMenu.y}
            initialQuery={slashMenu.query}
            onClose={() => setSlashMenu((prev) => ({ ...prev, visible: false }))}
            onCreateSubpage={createSubpageInsideEditor}
            onAutoCalculate={triggerSmartCalculation}
          />
        </main>
      </div>
    </PageBridgeContext.Provider>
  );
}

// ============================================================================
// COMPONENTE RECURSIVO DA SIDEBAR (SidebarItem)
// ============================================================================
function SidebarItem({
  page,
  allPages,
  activeId,
  expanded,
  onSelect,
  onToggle,
  onCreateChild,
  onDuplicate,
  onDelete,
}: SidebarItemProps) {
  const children = allPages.filter((p) => p.parentId === page.id);
  const isExpanded = Boolean(expanded[page.id]);
  const isActive = activeId === page.id;

  return (
    <div>
      <div
        onClick={() => onSelect(page.id)}
        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium cursor-pointer transition ${
          isActive
            ? 'bg-[#181E24] text-white font-semibold'
            : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#181E24]/60'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {children.length > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(page.id);
              }}
              className="p-0.5 hover:bg-[#222A33] rounded text-[#94A3B8] hover:text-[#F1F5F9]"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span>{page.icon}</span>
          <span className="truncate">{page.title || 'Sem título'}</span>
        </div>

        <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(page.id);
            }}
            className="p-1 hover:bg-[#222A33] text-[#94A3B8] hover:text-[#F1F5F9] rounded"
            title="Adicionar subpágina"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(page.id);
            }}
            className="p-1 hover:bg-[#222A33] text-[#94A3B8] hover:text-[#F1F5F9] rounded"
            title="Duplicar página"
          >
            <Copy className="w-3 h-3" />
          </button>
          {allPages.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(page.id);
              }}
              className="p-1 hover:bg-[#222A33] text-[#94A3B8] hover:text-rose-400 rounded"
              title="Mover para a lixeira"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && children.length > 0 && (
        <div className="ml-3 pl-2 border-l border-[#1E293B] space-y-0.5 mt-0.5">
          {children.map((child) => (
            <SidebarItem
              key={child.id}
              page={child}
              allPages={allPages}
              activeId={activeId}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
              onCreateChild={onCreateChild}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}