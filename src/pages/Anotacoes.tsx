import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useEditor, EditorContent, JSONContent } from '@tiptap/react';
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
import { BubbleToolbar, SlashCommandMenu } from '@/notes/Menus';

// ============================================================================
// TIPAGENS INTERNAS DE ESTADO E COMPONENTES
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

  // 2. Estados de Interface e Painéis
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [selectedQuoteForComment, setSelectedQuoteForComment] = useState<string | undefined>();

  // 3. Estados de Menus Flutuantes do Editor e Gutter ("+" e "::")
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>({
    visible: false,
    x: 0,
    y: 0,
    query: '',
  });
  const [gutter, setGutter] = useState<GutterState>({
    visible: false,
    top: 0,
    left: 8,
    pos: -1,
  });
  const [blockActionMenu, setBlockActionMenu] = useState<BlockActionMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetPos: -1,
  });

  // 4. Referências para evitar Stale Closures no Tiptap
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const activePageIdRef = useRef<string>(activePageId);
  const slashMenuVisibleRef = useRef<boolean>(slashMenu.visible);

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId && !p.isDeleted) || pages.find((p) => !p.isDeleted) || pages[0],
    [pages, activePageId]
  );

  useEffect(() => {
    if (activePage) {
      activePageIdRef.current = activePage.id;
    }
  }, [activePage]);

  useEffect(() => {
    slashMenuVisibleRef.current = slashMenu.visible;
  }, [slashMenu.visible]);

  // 5. Inicialização do Motor Tiptap
  const extensions = useMemo(() => createEnchiridionExtensions(), []);

  const editor = useEditor({
    extensions,
    content: activePage?.content || { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none min-h-[55vh] text-[#EDEDED] text-sm md:text-[1.1rem] leading-relaxed',
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/' && !slashMenuVisibleRef.current) {
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

  // 6. Sincronização de Conteúdo ao Alternar de Página
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
    setGutter((prev) => ({ ...prev, visible: false }));
    setBlockActionMenu((prev) => ({ ...prev, visible: false }));
    setSlashMenu((prev) => ({ ...prev, visible: false }));
  }, [activePage?.id, editor]);

  // 7. Salvamento Automático com Debounce (400ms)
  useEffect(() => {
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
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p)));
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

      setPages((prev) => prev.map((p) => (toTrash.has(p.id) ? { ...p, isDeleted: true } : p)));
      if (toTrash.has(activePageId)) {
        const remaining = pages.filter((p) => !p.isDeleted && !toTrash.has(p.id));
        if (remaining[0]) setActivePageId(remaining[0].id);
      }
    },
    [pages, activePageId]
  );

  const restorePage = useCallback(
    (pageId: string) => {
      updatePage(pageId, { isDeleted: false });
    },
    [updatePage]
  );

  const permanentDeletePage = useCallback((pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  }, []);

  // Ponte de contexto para os blocos PageLink dentro do Tiptap
  const pageBridge: PageBridge = useMemo(
    () => ({
      getPageInfo: (id) => {
        const found = pages.find((p) => p.id === id && !p.isDeleted);
        return found ? { title: found.title, icon: found.icon } : null;
      },
      openPage: (id) => {
        const exists = pages.find((p) => p.id === id && !p.isDeleted);
        if (exists) setActivePageId(id);
      },
      renamePage: (id, newTitle) => updatePage(id, { title: newTitle }),
      duplicatePage: (id) => duplicatePage(id),
      deletePage: (id) => softDeletePage(id),
    }),
    [pages, updatePage, duplicatePage, softDeletePage]
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
  // GUTTER LATERAL ("+" E "::") E MANIPULAÇÃO DE BLOCOS
  // ============================================================================
  const handleEditorMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editorWrapperRef.current || !editor || blockActionMenu.visible) return;

    const targetEl = e.target as HTMLElement;

    // 1. Se o cursor já estiver sobre os botões "+" ou "::", mantém travado sem recalcular nem sumir
    if (targetEl.closest('.gutter-controls')) {
      return;
    }

    // 2. Oculta os controles se o mouse estiver sobre uma linha divisória (hr)
    if (targetEl.tagName === 'HR') {
      setGutter((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const tiptapEl = editorWrapperRef.current.querySelector('.tiptap') as HTMLElement | null;
    if (!tiptapEl) return;

    const blockElements = Array.from(
      tiptapEl.querySelectorAll(
        'li, p:not(li p), h1, h2, h3, h4, pre, table, [data-type="page-link"], [data-type="math-block"], [data-type="bookmark-block"]'
      )
    ) as HTMLElement[];

    for (let i = blockElements.length - 1; i >= 0; i--) {
      const el = blockElements[i];
      const rect = el.getBoundingClientRect();

      // Ancora pela borda da coluna (se dentro de coluna) ou pela margem principal do editor
      const colEl = el.closest('.notion-column') as HTMLElement | null;
      const anchorLeft = colEl
        ? colEl.getBoundingClientRect().left
        : tiptapEl.getBoundingClientRect().left;

      const isWithinY = e.clientY >= rect.top - 6 && e.clientY <= rect.bottom + 6;
      const isWithinX = e.clientX >= anchorLeft - 72 && e.clientX <= rect.right + 28;

      if (isWithinY && isWithinX) {
        const wrapperRect = editorWrapperRef.current.getBoundingClientRect();
        const targetForPos = (el.querySelector('p, h1, h2, h3, h4') as HTMLElement) || el;
        let pos = -1;
        try {
          pos = editor.view.posAtDOM(targetForPos, 0);
        } catch {}

        setGutter({
          visible: true,
          top: rect.top - wrapperRect.top,
          left: anchorLeft - wrapperRect.left - 56,
          pos,
        });
        return;
      }
    }
  };

  const manipulateBlockAtPos = (action: 'delete' | 'duplicate' | 'up' | 'down', targetPos: number) => {
    if (!editor || targetPos < 0) return;
    const { state, view } = editor;
    const { doc } = state;

    try {
      const $pos = doc.resolve(Math.min(targetPos, doc.content.size));
      let targetDepth = -1;

      // 1. Prioriza itens de lista ou tarefa (li)
      for (let d = $pos.depth; d >= 1; d--) {
        const name = $pos.node(d).type.name;
        if (name === 'taskItem' || name === 'listItem') {
          targetDepth = d;
          break;
        }
      }

      // 2. Caso contrário, busca o bloco mais próximo
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
          if (parent.childCount <= 1 && (parent.type.name === 'doc' || parent.type.name === 'column')) {
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
      contentStr = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activePage.title}</title></head><body style="background:#12161A;color:#EDEDED;font-family:sans-serif;padding:2rem;"><h1>${activePage.icon} ${activePage.title}</h1>${editor.getHTML()}</body></html>`;
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
            setActivePageId(newId);
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
      <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-5rem)] text-[#EDEDED]">
        <input
          ref={importInputRef}
          type="file"
          accept=".md,.json"
          className="hidden"
          onChange={handleImportDocument}
        />

        {/* ===================================================================
            SIDEBAR HIERÁRQUICA DE PÁGINAS
           =================================================================== */}
        {sidebarOpen && (
          <aside className="w-full lg:w-64 bg-[#12161A] border border-[#1E293B] rounded-2xl p-3.5 flex flex-col justify-between shrink-0 select-none">
            <div>
              {/* Topo da Sidebar */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1E293B]">
                <span className="text-xs font-bold tracking-wider text-[#EDEDED] uppercase">
                  ENCHIRIDION
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => createPage(null, 'Nova página', true)}
                    title="Nova Página Raiz"
                    className="p-1 hover:bg-[#181E24] text-[#858585] hover:text-[#EDEDED] rounded transition"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    title="Recolher barra lateral"
                    className="p-1 hover:bg-[#181E24] text-[#858585] hover:text-[#EDEDED] rounded transition lg:inline-flex hidden"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Busca Global */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-[#858585] absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar em títulos e notas..."
                  className="w-full bg-[#181E24] border border-[#1E293B] rounded-lg pl-8 pr-2.5 py-1 text-xs text-[#EDEDED] placeholder-[#858585] focus:outline-none"
                />
              </div>

              {/* Resultados da Busca ou Árvore de Páginas */}
              {searchQuery.trim() !== '' ? (
                <div className="space-y-1 mb-4 max-h-56 overflow-y-auto">
                  <div className="text-[10px] font-semibold uppercase text-[#858585] px-2">
                    Resultados ({searchResults.length})
                  </div>
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setActivePageId(p.id);
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
                      <div className="text-[10px] font-semibold uppercase text-[#858585] px-2 mb-1">
                        Favoritos
                      </div>
                      {pages
                        .filter((p) => p.isFavorite && !p.isDeleted)
                        .map((fav) => (
                          <button
                            key={fav.id}
                            type="button"
                            onClick={() => setActivePageId(fav.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs md:text-sm mb-0.5 transition ${
                              fav.id === activePage.id
                                ? 'bg-[#181E24] text-white font-semibold'
                                : 'text-[#858585] hover:bg-[#181E24] hover:text-[#EDEDED]'
                            }`}
                          >
                            <span>{fav.icon}</span>
                            <span className="truncate">{fav.title}</span>
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Lista Hierárquica de Páginas */}
                  <div className="text-[10px] font-semibold uppercase text-[#858585] px-2 mb-1">
                    Páginas
                  </div>
                  <div className="space-y-0.5 overflow-y-auto max-h-[52vh] pr-1">
                    {pages
                      .filter((p) => !p.parentId && !p.isDeleted)
                      .map((page) => (
                        <SidebarItem
                          key={page.id}
                          page={page}
                          allPages={pages.filter((p) => !p.isDeleted)}
                          activeId={activePage.id}
                          expanded={expandedPages}
                          onSelect={setActivePageId}
                          onToggle={(id) =>
                            setExpandedPages((prev) => ({ ...prev, [id]: !prev[id] }))
                          }
                          onCreateChild={(parentId) => {
                            const subId = createPage(parentId, 'Subpágina', true);
                            const parentPage = pages.find((p) => p.id === parentId);
                            if (parentPage) {
                              const nextContent: JSONContent = {
                                type: 'doc',
                                content: [
                                  ...(parentPage.content.content || []),
                                  { type: 'pageLink', attrs: { pageId: subId, title: 'Subpágina' } },
                                ],
                              };
                              updatePage(parentId, { content: nextContent });
                            }
                          }}
                          onDuplicate={duplicatePage}
                          onDelete={softDeletePage}
                        />
                      ))}
                  </div>
                </>
              )}
            </div>

            {/* Rodapé da Sidebar (Lixeira e Nova Página Raiz) */}
            <div className="pt-3 border-t border-[#1E293B] space-y-1.5">
              <button
                type="button"
                onClick={() => setShowTrash(!showTrash)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-[#858585] hover:text-[#EDEDED] hover:bg-[#181E24] transition"
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
                    <div className="text-[11px] text-[#858585] text-center py-2">Lixeira vazia</div>
                  ) : (
                    pages
                      .filter((p) => p.isDeleted)
                      .map((del) => (
                        <div key={del.id} className="flex items-center justify-between text-xs py-1 px-1">
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
                className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-[#1E293B] hover:border-[#858585] text-xs text-[#858585] hover:text-[#EDEDED] rounded-xl transition"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Página Raiz
              </button>
            </div>
          </aside>
        )}

        {/* ===================================================================
            ÁREA PRINCIPAL DO DOCUMENTO (#12161A NOTION DARK THEME)
           =================================================================== */}
        <main
          onClick={closeAllFloatingMenus}
          className="flex-1 bg-[#12161A] border border-[#1E293B] rounded-2xl overflow-hidden flex flex-col min-h-[75vh] relative"
        >
          {/* Barra Superior: Breadcrumbs, Status de Salvamento e Opções */}
          <div className="flex items-center justify-between px-4 sm:px-6 h-12 border-b border-[#1E293B] text-xs select-none">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 mr-1 hover:bg-[#181E24] rounded text-[#858585] hover:text-[#EDEDED]"
                  title="Mostrar barra lateral"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <span className="text-[#555555]">/</span>}
                  <button
                    type="button"
                    onClick={() => setActivePageId(crumb.id)}
                    className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[#181E24] text-[#EDEDED] truncate max-w-[140px]"
                  >
                    <span>{crumb.icon}</span>
                    <span className="truncate">{crumb.title || 'Sem título'}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Indicador de Salvamento Automático */}
              <span className="text-[11px] text-[#858585] flex items-center gap-1">
                {saveStatus === 'saving' && 'Salvando...'}
                {saveStatus === 'saved' && (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" /> Salvo
                  </>
                )}
                {saveStatus === 'error' && <span className="text-rose-400">Erro ao salvar</span>}
              </span>

              {/* Favoritar Página */}
              <button
                type="button"
                onClick={() => updatePage(activePage.id, { isFavorite: !activePage.isFavorite })}
                className={`p-1.5 rounded hover:bg-[#181E24] transition ${
                  activePage.isFavorite ? 'text-amber-400' : 'text-[#858585] hover:text-[#EDEDED]'
                }`}
                title="Favoritar página"
              >
                <Star className="w-4 h-4" fill={activePage.isFavorite ? 'currentColor' : 'none'} />
              </button>

              {/* Painel de Comentários */}
              <button
                type="button"
                onClick={() => setShowComments(!showComments)}
                className="p-1.5 rounded hover:bg-[#181E24] text-[#858585] hover:text-[#EDEDED] relative"
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
                  className="px-2 py-1 rounded bg-[#181E24] hover:bg-[#222A33] border border-[#1E293B] text-xs text-[#EDEDED] flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Opções</span>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-8 z-50 w-48 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1.5 space-y-0.5 text-xs">
                    <div className="px-2 py-1 text-[10px] text-[#858585] uppercase font-semibold">
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

          {/* Corpo Centralizado Estilo Notion */}
          <div className="max-w-5xl w-full mx-auto px-6 sm:px-14 py-8 flex-1 flex flex-col">
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
              <div className="flex items-center gap-3 text-xs text-[#858585] mb-2 h-6 opacity-80 group-hover:opacity-100 transition-opacity select-none">
                {!activePage.cover && (
                  <button
                    type="button"
                    onClick={() => updatePage(activePage.id, { cover: PAGE_COVERS[0] })}
                    className="flex items-center gap-1.5 hover:text-[#EDEDED] transition"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Adicionar capa</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowComments(true)}
                  className="flex items-center gap-1.5 hover:text-[#EDEDED] transition"
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
                      className="w-16 h-10 rounded border border-[#454545] shrink-0"
                    />
                  ))}
                </div>
              )}

              {/* Título Editável Direto */}
              <input
                type="text"
                value={activePage.title}
                onChange={(e) => updatePage(activePage.id, { title: e.target.value })}
                placeholder="Sem título"
                className="w-full bg-transparent text-3xl sm:text-5xl font-extrabold text-[#EDEDED] tracking-tight placeholder-[#454545] focus:outline-none"
              />
            </div>

            {/* Painel de Comentários (Se aberto) */}
            {showComments && (
              <div className="mb-6 bg-[#202020] border border-[#1E293B] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#858585] uppercase">
                  <span>Comentários ({activePage.comments?.length || 0})</span>
                  <button
                    type="button"
                    onClick={() => setShowComments(false)}
                    className="hover:text-[#EDEDED]"
                  >
                    Fechar
                  </button>
                </div>

                {selectedQuoteForComment && (
                  <div className="text-xs italic border-l-2 border-amber-500 pl-2 text-[#858585]">
                    Trecho: "{selectedQuoteForComment}"
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCommentText.trim()) {
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
                      }
                    }}
                    placeholder="Escreva um comentário..."
                    className="flex-1 bg-[#12161A] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#EDEDED] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCommentText.trim()) return;
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
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
                  >
                    Enviar
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(activePage.comments || []).map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 bg-[#181E24] rounded-lg border border-[#1E293B] flex items-start justify-between text-xs"
                    >
                      <div>
                        {c.selectedText && (
                          <div className="text-[11px] text-amber-300/90 border-l-2 border-amber-400 pl-2 mb-1">
                            "{c.selectedText}"
                          </div>
                        )}
                        <div className={c.resolved ? 'line-through text-[#858585]' : 'text-[#EDEDED]'}>
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

            {/* Container do Editor Tiptap com área de captura estendida (-ml-16 pl-16) */}
            <div
              ref={editorWrapperRef}
              onMouseMove={handleEditorMouseMove}
              onMouseLeave={() => {
                if (!blockActionMenu.visible) {
                  setGutter((prev) => ({ ...prev, visible: false }));
                }
              }}
              className="relative flex-1 -ml-16 pl-16"
            >
              {/* Alças "+" e "::" com ponte de hover contínua até o texto */}
              {gutter.visible && (
                <div
                  style={{ top: gutter.top, left: gutter.left }}
                  className="gutter-controls absolute flex items-center gap-0.5 pr-3 py-0.5 select-none z-20"
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
                    className="p-1 rounded hover:bg-[#181E24] text-[#858585] hover:text-[#EDEDED]"
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
                        x: rect.left,
                        y: rect.bottom + 6,
                        targetPos: gutter.pos,
                      });
                    }}
                    className="p-1 rounded hover:bg-[#181E24] text-[#858585] hover:text-[#EDEDED] cursor-grab"
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
                  className="fixed z-50 w-48 bg-[#181E24] border border-[#1E293B] rounded-xl shadow-2xl p-1 text-xs text-[#EDEDED] space-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => manipulateBlockAtPos('duplicate', blockActionMenu.targetPos)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#222A33] text-left"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#858585]" /> Duplicar bloco
                  </button>
                  <button
                    type="button"
                    onClick={() => manipulateBlockAtPos('up', blockActionMenu.targetPos)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#222A33] text-left"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-[#858585]" /> Mover para cima
                  </button>
                  <button
                    type="button"
                    onClick={() => manipulateBlockAtPos('down', blockActionMenu.targetPos)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#222A33] text-left"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-[#858585]" /> Mover para baixo
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
            : 'text-[#858585] hover:text-[#EDEDED] hover:bg-[#181E24]/60'
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
              className="p-0.5 hover:bg-[#222A33] rounded text-[#858585] hover:text-[#EDEDED]"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span>{page.icon}</span>
          <span className="truncate">{page.title || 'Sem título'}</span>
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(page.id);
            }}
            className="p-1 hover:bg-[#222A33] text-[#858585] hover:text-[#EDEDED] rounded"
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
            className="p-1 hover:bg-[#222A33] text-[#858585] hover:text-[#EDEDED] rounded"
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
              className="p-1 hover:bg-[#222A33] text-[#858585] hover:text-rose-400 rounded"
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