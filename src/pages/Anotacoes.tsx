import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, Square, Plus, FolderPlus, ChevronRight, ChevronDown, ChevronLeft,
  Bold, Italic, Underline as UnderlineIcon, Palette, Heading1, Heading2, Heading3,
  Quote, Trash2, List, ListOrdered, Type, Columns, GripVertical
} from 'lucide-react';

// ==========================================
// INTERFACES & CONSTANTES
// ==========================================
interface Block {
  id: string;
  type: 'h1' | 'h2' | 'h3' | 'text' | 'todo' | 'bullet' | 'number' | 'quote' | 'page' | '2-col';
  content: string;
  content2?: string;
  targetPageId?: string;
  checked?: boolean;
  listNumber?: number;
}

interface NotePage {
  id: string;
  title: string;
  description: string;
  icon: string;
  parentId: string | null;
  blocks: Block[];
}

const DEFAULT_PAGES: NotePage[] = [{
  id: 'root-1', title: 'Caderno Principal', description: 'Adicione uma breve descrição...',
  icon: '📝', parentId: null, blocks: [{ id: 'b-init', type: 'text', content: '' }]
}];

const TEXT_COLORS = [
  { name: 'Padrão', hex: '#e2e8f0' }, { name: 'Cinza', hex: '#94a3b8' }, { name: 'Azul', hex: '#60a5fa' },
  { name: 'Verde', hex: '#34d399' }, { name: 'Amarelo', hex: '#fbbf24' }, { name: 'Vermelho', hex: '#fb7185' },
  { name: 'Roxo', hex: '#c084fc' },
];

const BG_COLORS = [
  { name: 'Transparente', hex: 'transparent' }, { name: 'Cinza Escuro', hex: '#1e293b' }, { name: 'Azul', hex: '#172554' },
  { name: 'Verde', hex: '#022c22' }, { name: 'Amarelo', hex: '#451a03' }, { name: 'Vermelho', hex: '#4c0519' },
  { name: 'Roxo', hex: '#3b0764' },
];

const PLACEHOLDERS: Record<string, string> = {
  h1: 'Título 1...',
  h2: 'Título 2...',
  h3: 'Título 3...',
  todo: 'Tarefa...',
  bullet: 'Item da lista...',
  number: 'Item numerado...',
  quote: 'Citação...',
  text: 'Digite algo...'
};

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================

const MenuItem = ({ icon: Icon, label, color = "text-slate-400", onClick, rightIcon: RightIcon }: any) => (
  <button onClick={onClick} className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-800 text-left">
    <div className="flex items-center gap-2">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span>{label}</span>
    </div>
    {RightIcon && <RightIcon className="w-3.5 h-3.5 text-slate-500" />}
  </button>
);

const FormatBtn = ({ icon: Icon, active, onClick, color = "text-slate-200" }: any) => (
  <button onMouseDown={(e) => { e.preventDefault(); onClick(); }} 
    className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${active ? 'bg-slate-700 text-blue-400' : color}`}>
    <Icon className="w-3.5 h-3.5" />
  </button>
);

const BlockEditor = ({ 
  domId, htmlContent, blockType, checked, showPlaceholder, placeholderText,
  onChange, onSelectionCheck, onKeyDown, onFocus 
}: any) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (elRef.current && elRef.current.innerHTML !== htmlContent) {
      elRef.current.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  // Limpa formatação externa ao colar texto (Ctrl + V)
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const isTrulyEmpty = !htmlContent || htmlContent === '<br>' || htmlContent.trim() === '';

  return (
    <div
      id={domId}
      ref={elRef}
      contentEditable
      suppressContentEditableWarning
      onFocus={onFocus}
      onPaste={handlePaste}
      onInput={(e) => {
        const val = e.currentTarget.innerHTML;
        onChange(val === '<br>' ? '' : val);
      }}
      onMouseUp={() => onSelectionCheck()}
      onTouchEnd={() => setTimeout(() => onSelectionCheck(), 100)}
      onKeyUp={() => onSelectionCheck()}
      onKeyDown={onKeyDown}
      data-placeholder={showPlaceholder && isTrulyEmpty ? (placeholderText || PLACEHOLDERS[blockType] || 'Digite algo...') : ''}
      className={`flex-1 bg-transparent focus:outline-none min-h-[28px] outline-none break-words break-all whitespace-pre-wrap min-w-0 before:content-[attr(data-placeholder)] before:text-slate-600 before:pointer-events-none transition-colors ${
        blockType === 'h1' ? 'text-2xl font-bold text-white mt-4 mb-2' :
        blockType === 'h2' ? 'text-xl font-semibold text-slate-100 mt-3 mb-1' :
        blockType === 'h3' ? 'text-lg font-medium text-slate-200 mt-2 mb-1' :
        blockType === 'todo' ? `text-sm ${checked ? 'line-through text-slate-500' : 'text-slate-200'}` :
        blockType === 'quote' ? 'text-sm italic text-amber-200/90 pl-1 py-1' : 'text-sm text-slate-200'
      }`}
    />
  );
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function Anotacoes() {
  const [pages, setPages] = useState<NotePage[]>(() => {
    try { return JSON.parse(localStorage.getItem('enchiridion_notion_pages_v8') || '') || DEFAULT_PAGES; } 
    catch { return DEFAULT_PAGES; }
  });
  
  const [workspaceTitle, setWorkspaceTitle] = useState(() => localStorage.getItem('enchiridion_workspace_title') || 'ENCHIRIDION');
  const [activePageId, setActivePageId] = useState<string>(() => pages[0]?.id || 'root-1');
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  
  // Estados Drag and Drop
  const [draggableBlockId, setDraggableBlockId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  // Estados de Menus Flutuantes
  const [formatMenu, setFormatMenu] = useState({ 
    visible: false, x: 0, y: 0, 
    blockId: null as string | null, 
    domId: '' as string,
    field: 'content' as 'content' | 'content2',
    activeFormats: { bold: false, italic: false, underline: false } 
  });
  const [insertMenu, setInsertMenu] = useState({ visible: false, x: 0, y: 0, blockId: null as string | null, view: 'main' as 'main' | 'titles' | 'lists' });
  const [showColorPalette, setShowColorPalette] = useState(false);
  
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const activePage = pages.find((p) => p.id === activePageId) || pages[0] || DEFAULT_PAGES[0];

  useEffect(() => { localStorage.setItem('enchiridion_notion_pages_v8', JSON.stringify(pages)); }, [pages]);
  useEffect(() => { localStorage.setItem('enchiridion_workspace_title', workspaceTitle); }, [workspaceTitle]);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      const selection = window.getSelection();
      
      if (formatMenu.visible && !target.closest('.format-menu-container') && (!selection || selection.toString().trim() === '')) {
        setFormatMenu((prev) => ({ ...prev, visible: false }));
        setShowColorPalette(false);
      }
      if (insertMenu.visible && !target.closest('.insert-menu-container') && !target.closest('.btn-plus')) {
        setInsertMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [formatMenu.visible, insertMenu.visible]);

  // Move o cursor com precisão para o bloco desejado
  const focusBlock = (domId: string, toEnd = true) => {
    setTimeout(() => {
      const el = document.getElementById(domId);
      if (!el) return;
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(!toEnd);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 20);
  };

  // --- HANDLERS: DRAG AND DROP ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null); setDragOverId(null); return;
    }
    
    setPages(prev => prev.map(page => {
      if (page.id !== activePage.id) return page;
      const blocks = [...page.blocks];
      const draggedIdx = blocks.findIndex(b => b.id === draggedId);
      const targetIdx = blocks.findIndex(b => b.id === targetId);
      if (draggedIdx === -1 || targetIdx === -1) return page;
      
      const [draggedBlock] = blocks.splice(draggedIdx, 1);
      blocks.splice(targetIdx, 0, draggedBlock);
      return { ...page, blocks };
    }));
    
    setDraggedId(null); setDragOverId(null); setDraggableBlockId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null); setDragOverId(null); setDraggableBlockId(null);
  };

  // --- HANDLERS: MENUS & FORMATAÇÃO ---
  const handleSelectionCheck = (blockId: string, domId: string, field: 'content' | 'content2' = 'content') => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setFormatMenu((prev) => ({ ...prev, visible: false }));
      setShowColorPalette(false); return;
    }
    if (editorContainerRef.current) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const contRect = editorContainerRef.current.getBoundingClientRect();
      setFormatMenu({
        visible: true, blockId, domId, field,
        x: Math.max(10, Math.min(rect.left - contRect.left + (rect.width / 2) - 112, contRect.width - 240)),
        y: rect.bottom - contRect.top + 8,
        activeFormats: {
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline')
        }
      });
    }
  };

  const handleOpenInsertMenu = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    if (editorContainerRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const contRect = editorContainerRef.current.getBoundingClientRect();
      setInsertMenu({
        visible: true, blockId, view: 'main',
        x: Math.max(10, Math.min(rect.left - contRect.left, contRect.width - 200)),
        y: rect.bottom - contRect.top + 8
      });
      setFormatMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const applyInlineFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    setFormatMenu((prev) => ({
      ...prev, activeFormats: { bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline') }
    }));
    if (formatMenu.blockId && formatMenu.domId) {
      const el = document.getElementById(formatMenu.domId);
      if (el) updateBlock(formatMenu.blockId, { [formatMenu.field]: el.innerHTML });
    }
  };

  // --- HANDLERS: PÁGINAS E BLOCOS ---
  const updatePage = (id: string, updates: Partial<NotePage>) => setPages(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  const updateBlock = (blockId: string, updates: Partial<Block>) => setPages(prev => prev.map(p => p.id !== activePage.id ? p : { ...p, blocks: p.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b) }));
  
  const createPage = (parentId: string | null = null, title = 'Nova Página') => {
    const newId = 'page-' + Date.now();
    const firstBlockId = 'b-' + Date.now();
    setPages(prev => [...prev, { id: newId, title, description: '', icon: parentId ? '📄' : '📝', parentId, blocks: [{ id: firstBlockId, type: 'text', content: '' }] }]);
    if (parentId) setExpandedPages(prev => ({ ...prev, [parentId]: true }));
    setActivePageId(newId);
    return newId;
  };

  const deletePageRecursively = (pageId: string) => {
    if (pages.length <= 1) return;
    const findChildrenIds = (id: string): string[] => [id, ...pages.filter(p => p.parentId === id).flatMap(c => findChildrenIds(c.id))];
    const idsToDelete = new Set(findChildrenIds(pageId));
    
    // Remove as páginas e também limpa blocos 'page' que apontavam para elas
    const remaining = pages
      .filter(p => !idsToDelete.has(p.id))
      .map(p => ({
        ...p,
        blocks: p.blocks.filter(b => !(b.type === 'page' && b.targetPageId && idsToDelete.has(b.targetPageId)))
      }));

    setPages(remaining);
    if (idsToDelete.has(activePageId)) setActivePageId(remaining[0]?.id || '');
  };

  const addBlockAfter = (currentBlockId: string, type: Block['type'] = 'text') => {
    const newBlockId = 'b-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const newBlock: Block = { id: newBlockId, type, content: '', content2: '', checked: false };
    
    setPages(prev => prev.map(p => {
      if (p.id !== activePage.id) return p;
      const index = p.blocks.findIndex(b => b.id === currentBlockId);
      const updated = [...p.blocks];
      updated.splice(index + 1, 0, newBlock);
      return { ...p, blocks: updated };
    }));
    
    setActiveBlockId(newBlockId);
    focusBlock(`block-${newBlockId}`, false);
  };

  const handleInsertBlock = (type: Block['type']) => {
    if (!insertMenu.blockId) return;
    const targetBlockId = insertMenu.blockId;
    const block = activePage.blocks.find(b => b.id === targetBlockId);
    const isEmpty = block && (!block.content || block.content === '<br>' || block.content.trim() === '');

    if (type === 'page') {
      const newPageId = 'page-' + Date.now();
      const newPage: NotePage = {
        id: newPageId, title: 'Subpágina', description: '', icon: '📄',
        parentId: activePage.id, blocks: [{ id: 'b-' + Date.now(), type: 'text', content: '' }]
      };

      setPages(prev => {
        const updatedPages = prev.map(p => {
          if (p.id !== activePage.id) return p;
          if (isEmpty) {
            return { ...p, blocks: p.blocks.map(b => b.id === targetBlockId ? { ...b, type: 'page' as const, targetPageId: newPageId, content: 'Subpágina' } : b) };
          }
          const idx = p.blocks.findIndex(b => b.id === targetBlockId);
          const updatedBlocks = [...p.blocks];
          updatedBlocks.splice(idx + 1, 0, { id: 'b-' + Date.now(), type: 'page', content: 'Subpágina', targetPageId: newPageId });
          return { ...p, blocks: updatedBlocks };
        });
        return [...updatedPages, newPage];
      });

      setExpandedPages(prev => ({ ...prev, [activePage.id]: true }));
      setActivePageId(newPageId);
    } else {
      if (isEmpty) {
        updateBlock(targetBlockId, { type, content: '', content2: '' });
        focusBlock(`block-${targetBlockId}`, false);
      } else {
        addBlockAfter(targetBlockId, type);
      }
    }
    setInsertMenu({ ...insertMenu, visible: false });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, block: Block, index: number, isSecondCol = false) => {
    // No bloco de 2 colunas, Enter simples pula linha dentro da coluna; Shift+Enter cria bloco abaixo
    if (block.type === '2-col') {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        addBlockAfter(block.id, 'text');
        return;
      }
    } else {
      // Nos demais blocos, Enter simples cria uma nova linha (bloco) abaixo e foca nela
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addBlockAfter(block.id, ['todo', 'bullet', 'number'].includes(block.type) ? block.type : 'text');
        return;
      }
    }

    // Navegação com Seta para Cima e para Baixo entre blocos
    if (e.key === 'ArrowUp' && index > 0 && block.type !== '2-col') {
      const prevBlock = activePage.blocks[index - 1];
      if (prevBlock && prevBlock.type !== 'page') {
        e.preventDefault();
        setActiveBlockId(prevBlock.id);
        focusBlock(`block-${prevBlock.id}`, true);
        return;
      }
    }
    if (e.key === 'ArrowDown' && index < activePage.blocks.length - 1 && block.type !== '2-col') {
      const nextBlock = activePage.blocks[index + 1];
      if (nextBlock && nextBlock.type !== 'page') {
        e.preventDefault();
        setActiveBlockId(nextBlock.id);
        focusBlock(`block-${nextBlock.id}`, true);
        return;
      }
    }

    // Backspace em linha vazia
    const currentText = e.currentTarget.textContent || '';
    if (e.key === 'Backspace' && currentText.trim() === '') {
      if (block.type === '2-col') {
        const col1Empty = !block.content || block.content === '<br>' || block.content.trim() === '';
        const col2Empty = !block.content2 || block.content2 === '<br>' || block.content2.trim() === '';
        if (!col1Empty || !col2Empty) return; // Só apaga as 2 colunas se ambas estiverem vazias
      } else if (block.type !== 'text') {
        e.preventDefault();
        updateBlock(block.id, { type: 'text' });
        return;
      }

      if (activePage.blocks.length > 1 && !isSecondCol) {
        e.preventDefault();
        const prevBlock = activePage.blocks[index - 1];
        setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, blocks: p.blocks.filter(b => b.id !== block.id) } : p));
        if (prevBlock) {
          setActiveBlockId(prevBlock.id);
          focusBlock(`block-${prevBlock.id}`, true);
        }
      }
    }
  };

  // --- RENDER HELPERS ---
  const renderPageTree = (parentId: string | null = null, depth = 0) => {
    const currentPages = pages.filter(p => p.parentId === parentId);
    if (currentPages.length === 0) return null;
    return (
      <div className="space-y-0.5">
        {currentPages.map((page) => (
          <div key={page.id} className="flex flex-col">
            <div style={{ paddingLeft: `${depth * 12 + 6}px` }} onClick={() => setActivePageId(page.id)}
              className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg text-sm cursor-pointer transition-all ${page.id === activePage.id ? 'bg-blue-600/15 text-blue-400 font-medium' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}>
              <div className="flex items-center gap-1.5 truncate">
                {pages.some(p => p.parentId === page.id) ? (
                  <button onClick={(e) => { e.stopPropagation(); setExpandedPages(prev => ({ ...prev, [page.id]: !prev[page.id] })); }} className="p-0.5 hover:text-white text-slate-500 rounded">
                    {expandedPages[page.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ) : <span className="w-4" />}
                <span className="text-base select-none">{page.icon}</span><span className="truncate text-xs">{page.title || 'Sem título'}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); createPage(page.id, 'Subpágina'); }} className="p-1 hover:text-blue-400 text-slate-500 hover:bg-slate-800 rounded" title="Nova subpágina"><Plus className="w-3.5 h-3.5" /></button>
                {pages.length > 1 && <button onClick={(e) => { e.stopPropagation(); deletePageRecursively(page.id); }} className="p-1 hover:text-red-400 text-slate-500 hover:bg-slate-800 rounded" title="Excluir página"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
            {expandedPages[page.id] && renderPageTree(page.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  const renderBlockControls = (blockId: string, mtClass = "mt-1.5") => (
    <div className={`flex items-center gap-0.5 ${mtClass} w-12 shrink-0 transition-opacity ${activeBlockId === blockId || draggableBlockId === blockId ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
      <button onClick={(e) => handleOpenInsertMenu(e, blockId)} className="btn-plus p-0.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors" title="Inserir bloco"><Plus className="w-4 h-4" /></button>
      <div 
        onMouseEnter={() => setDraggableBlockId(blockId)}
        onMouseLeave={() => setDraggableBlockId(null)}
        className="cursor-grab active:cursor-grabbing p-0.5 text-slate-600 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors" title="Arraste para mover"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>
    </div>
  );

  const renderBlockPrefix = (block: Block) => {
    if (block.type === 'todo') return (
      <button onClick={() => updateBlock(block.id, { checked: !block.checked })} className="mt-0.5 text-slate-500 hover:text-blue-400 transition-colors shrink-0">
        {block.checked ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
      </button>
    );
    if (block.type === 'bullet') return <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0" />;
    if (block.type === 'number') return <div className="text-sm font-medium text-slate-400 mt-0.5 shrink-0 select-none min-w-[18px] text-right">{block.listNumber}.</div>;
    if (block.type === 'quote') return <div className="w-1 bg-amber-400 self-stretch rounded-full shrink-0" />;
    return null;
  };

  let listIndex = 1;
  const blocksWithContext = activePage.blocks.map(b => (b.type === 'number' ? { ...b, listNumber: listIndex++ } : (listIndex = 1, { ...b, listNumber: 0 })));
  
  const breadcrumbs: NotePage[] = [];
  let curr: NotePage | undefined = activePage;
  while (curr) { breadcrumbs.unshift(curr); curr = pages.find(p => p.id === curr?.parentId); }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[650px] text-slate-100 select-none">
      {/* MENU LATERAL */}
      <div className="w-full lg:w-72 bg-[#0E1318]/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <input type="text" value={workspaceTitle} onChange={(e) => setWorkspaceTitle(e.target.value)} className="bg-transparent text-xs font-semibold tracking-wider text-slate-400 uppercase focus:text-white focus:outline-none w-full" />
            <button onClick={() => createPage(null)} className="text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded-md ml-2" title="Nova página raiz"><FolderPlus className="w-4 h-4" /></button>
          </div>
          <div className="overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-800">{renderPageTree()}</div>
        </div>
        <button onClick={() => createPage(null)} className="w-full mt-4 flex items-center justify-center gap-2 py-2 border border-dashed border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-white rounded-xl"><Plus className="w-3.5 h-3.5" /> Nova Página Raiz</button>
      </div>

      {/* EDITOR PRINCIPAL */}
      <div ref={editorContainerRef} className="relative flex-1 bg-[#0E1318]/90 border border-slate-800/80 rounded-2xl p-6 sm:p-10 flex flex-col select-text overflow-hidden">
        
        {/* MODAL INSERIR BLOCO (+) */}
        {insertMenu.visible && (
          <div style={{ top: `${insertMenu.y}px`, left: `${insertMenu.x}px` }} className="insert-menu-container absolute z-50 w-56 bg-[#191919] border border-slate-700/80 rounded-xl shadow-2xl p-1.5 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-100">
            {insertMenu.view === 'main' && (
              <div className="space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Inserir Bloco</div>
                <MenuItem icon={FolderPlus} color="text-blue-400" label="Subpágina" onClick={() => handleInsertBlock('page')} />
                <MenuItem icon={Type} color="text-indigo-400" label="Títulos" rightIcon={ChevronRight} onClick={() => setInsertMenu({ ...insertMenu, view: 'titles' })} />
                <MenuItem icon={List} color="text-emerald-400" label="Listas" rightIcon={ChevronRight} onClick={() => setInsertMenu({ ...insertMenu, view: 'lists' })} />
                <MenuItem icon={Quote} color="text-amber-400" label="Citação" onClick={() => handleInsertBlock('quote')} />
                <MenuItem icon={Columns} color="text-slate-400" label="2 Colunas" onClick={() => handleInsertBlock('2-col')} />
              </div>
            )}
            {insertMenu.view === 'titles' && (
              <div className="space-y-0.5">
                <button onClick={() => setInsertMenu({ ...insertMenu, view: 'main' })} className="w-full flex items-center gap-1.5 px-1.5 py-1 mb-1 rounded hover:bg-slate-800 text-slate-400"><ChevronLeft className="w-3.5 h-3.5" /> Voltar</button>
                <MenuItem icon={Heading1} color="text-indigo-400" label="Título 1" onClick={() => handleInsertBlock('h1')} />
                <MenuItem icon={Heading2} color="text-blue-400" label="Título 2" onClick={() => handleInsertBlock('h2')} />
                <MenuItem icon={Heading3} color="text-slate-400" label="Título 3" onClick={() => handleInsertBlock('h3')} />
              </div>
            )}
            {insertMenu.view === 'lists' && (
              <div className="space-y-0.5">
                <button onClick={() => setInsertMenu({ ...insertMenu, view: 'main' })} className="w-full flex items-center gap-1.5 px-1.5 py-1 mb-1 rounded hover:bg-slate-800 text-slate-400"><ChevronLeft className="w-3.5 h-3.5" /> Voltar</button>
                <MenuItem icon={CheckSquare} color="text-emerald-400" label="Lista de tarefas" onClick={() => handleInsertBlock('todo')} />
                <MenuItem icon={List} color="text-slate-400" label="Lista c/ marcadores" onClick={() => handleInsertBlock('bullet')} />
                <MenuItem icon={ListOrdered} color="text-slate-400" label="Lista numerada" onClick={() => handleInsertBlock('number')} />
              </div>
            )}
          </div>
        )}

        {/* MODAL FORMATAÇÃO DE TEXTO */}
        {formatMenu.visible && (
          <div style={{ top: `${formatMenu.y}px`, left: `${formatMenu.x}px` }} className="format-menu-container absolute z-50 w-auto min-w-[140px] bg-[#1a1a1a] border border-slate-700/80 rounded-xl shadow-2xl p-2 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between gap-1 px-1">
              <FormatBtn icon={Bold} active={formatMenu.activeFormats.bold} onClick={() => applyInlineFormat('bold')} />
              <FormatBtn icon={Italic} active={formatMenu.activeFormats.italic} onClick={() => applyInlineFormat('italic')} />
              <FormatBtn icon={UnderlineIcon} active={formatMenu.activeFormats.underline} onClick={() => applyInlineFormat('underline')} />
              <div className="w-px h-4 bg-slate-700 mx-1" />
              <FormatBtn icon={Palette} color="text-amber-400" onClick={() => setShowColorPalette(!showColorPalette)} />
            </div>
            {showColorPalette && (
              <div className="space-y-2 max-h-48 overflow-y-auto p-1 mt-2 border-t border-slate-700/60 pt-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Cor do Texto</span>
                  <div className="grid grid-cols-7 gap-1 mt-1">
                    {TEXT_COLORS.map((c) => <button key={c.name} onMouseDown={(e) => { e.preventDefault(); applyInlineFormat('foreColor', c.hex); }} className="text-center py-1 rounded text-[11px] border border-slate-700 hover:border-slate-500" style={{ color: c.hex }}>A</button>)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Cor de Fundo</span>
                  <div className="grid grid-cols-7 gap-1 mt-1">
                    {BG_COLORS.map((bg) => <button key={bg.name} onMouseDown={(e) => { e.preventDefault(); applyInlineFormat('hiliteColor', bg.hex); }} className="h-5 rounded border border-slate-700 hover:border-slate-500" style={{ backgroundColor: bg.hex !== 'transparent' ? bg.hex : undefined }} title={bg.name} />)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 pb-2 border-b border-slate-800/40">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                {idx > 0 && <span className="text-slate-600">/</span>}
                <button onClick={() => setActivePageId(crumb.id)} className={`hover:text-slate-300 transition-colors ${crumb.id === activePage.id ? 'text-slate-300 font-semibold' : ''}`}>{crumb.icon} {crumb.title}</button>
              </React.Fragment>
            ))}
          </div>

          <div className="space-y-3 pb-2">
            <input type="text" value={activePage.icon} onChange={(e) => updatePage(activePage.id, { icon: e.target.value })} className="text-3xl bg-transparent w-12 border-b border-transparent hover:border-slate-800 focus:outline-none" />
            <input type="text" value={activePage.title} onChange={(e) => updatePage(activePage.id, { title: e.target.value })} placeholder="Sem título" className="w-full bg-transparent text-3xl font-bold tracking-tight text-white focus:outline-none pb-1" />
            <input type="text" value={activePage.description} onChange={(e) => updatePage(activePage.id, { description: e.target.value })} placeholder="Adicione uma breve descrição..." className="w-full bg-transparent text-sm text-slate-500 focus:text-slate-300 focus:outline-none" />
          </div>

          {/* Renderização de Blocos com Drag & Drop */}
          <div className="space-y-0.5 min-h-[300px] pb-20">
            {blocksWithContext.map((block, index) => {
              
              // Bloco: Subpágina sincronizado com a página real
              if (block.type === 'page') {
                const targetPage = pages.find(p => p.id === block.targetPageId);
                return (
                  <div 
                    key={block.id} draggable={draggableBlockId === block.id}
                    onDragStart={(e) => handleDragStart(e, block.id)} onDragOver={(e) => handleDragOver(e, block.id)} onDrop={(e) => handleDrop(e, block.id)} onDragEnd={handleDragEnd}
                    className={`group relative flex items-center gap-1 my-2 rounded-lg transition-all min-w-0 ${dragOverId === block.id ? 'border-t-2 border-blue-500 pt-2' : ''} ${draggedId === block.id ? 'opacity-40' : ''}`}
                  >
                    {renderBlockControls(block.id, "mt-0")}
                    <div onClick={() => block.targetPageId && setActivePageId(block.targetPageId)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer text-slate-300 border border-slate-800/60 flex-1 min-w-0">
                      <span className="text-base select-none">{targetPage?.icon || '📄'}</span>
                      <span className="text-sm font-medium underline underline-offset-4 truncate">{targetPage?.title || block.content || 'Página sem título'}</span>
                    </div>
                  </div>
                );
              }

              // Bloco: 2 Colunas
              if (block.type === '2-col') return (
                <div 
                  key={block.id} draggable={draggableBlockId === block.id}
                  onDragStart={(e) => handleDragStart(e, block.id)} onDragOver={(e) => handleDragOver(e, block.id)} onDrop={(e) => handleDrop(e, block.id)} onDragEnd={handleDragEnd}
                  className={`group relative flex items-start gap-1 py-1 rounded w-full transition-all min-w-0 ${dragOverId === block.id ? 'border-t-2 border-blue-500 pt-2' : ''} ${draggedId === block.id ? 'opacity-40' : ''}`}
                >
                  {renderBlockControls(block.id, "mt-1")}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full flex-1 min-w-0 border-l-2 border-slate-800/40 pl-3">
                    <div className="min-w-0 overflow-hidden">
                      <BlockEditor 
                        domId={`block-${block.id}`} htmlContent={block.content} blockType="text"
                        showPlaceholder={true} placeholderText="Coluna 1..."
                        onChange={(val: string) => updateBlock(block.id, { content: val })}
                        onSelectionCheck={() => handleSelectionCheck(block.id, `block-${block.id}`, 'content')}
                        onKeyDown={(e: any) => handleKeyDown(e, block, index, false)}
                        onFocus={() => setActiveBlockId(block.id)}
                      />
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <BlockEditor 
                        domId={`block-${block.id}-col2`} htmlContent={block.content2 || ''} blockType="text"
                        showPlaceholder={true} placeholderText="Coluna 2..."
                        onChange={(val: string) => updateBlock(block.id, { content2: val })}
                        onSelectionCheck={() => handleSelectionCheck(block.id, `block-${block.id}-col2`, 'content2')}
                        onKeyDown={(e: any) => handleKeyDown(e, block, index, true)}
                        onFocus={() => setActiveBlockId(block.id)}
                      />
                    </div>
                  </div>
                </div>
              );

              // Blocos Padrão
              return (
                <div 
                  key={block.id} draggable={draggableBlockId === block.id}
                  onDragStart={(e) => handleDragStart(e, block.id)} onDragOver={(e) => handleDragOver(e, block.id)} onDrop={(e) => handleDrop(e, block.id)} onDragEnd={handleDragEnd}
                  className={`group relative flex items-start gap-1 py-0.5 rounded transition-all min-w-0 ${dragOverId === block.id ? 'border-t-2 border-blue-500 pt-2' : ''} ${draggedId === block.id ? 'opacity-40' : ''}`}
                >
                  {renderBlockControls(block.id)}
                  <div className="flex items-start gap-2 flex-1 w-full mt-1 min-w-0">
                    {renderBlockPrefix(block as Block)}
                    <BlockEditor 
                      domId={`block-${block.id}`} htmlContent={block.content} blockType={block.type} checked={block.checked}
                      showPlaceholder={(index === 0 && activePage.blocks.length === 1) || activeBlockId === block.id || block.type !== 'text'}
                      onChange={(val: string) => updateBlock(block.id, { content: val })}
                      onSelectionCheck={() => handleSelectionCheck(block.id, `block-${block.id}`, 'content')}
                      onKeyDown={(e: any) => handleKeyDown(e, block, index)}
                      onFocus={() => setActiveBlockId(block.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}