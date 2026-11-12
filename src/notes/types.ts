import type { JSONContent } from '@tiptap/react';

// ============================================================================
// TIPAGENS DE COMENTÁRIOS E PÁGINAS DE NOTAS
// ============================================================================
export interface PageComment {
  id: string;
  author: string;
  text: string;
  selectedText?: string;
  resolved: boolean;
  createdAt: number;
}

export interface NotePage {
  id: string;
  title: string;
  icon: string;
  cover?: string;
  parentId: string | null;
  isFavorite: boolean;
  isDeleted?: boolean;
  createdAt: number;
  updatedAt: number;
  comments?: PageComment[];
  content: JSONContent;
}

export interface LegacyNota {
  id: string;
  titulo: string;
  conteudo: string;
  categoria?: string;
  cor?: string;
  fixada?: boolean;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

// ============================================================================
// PALETA DE CORES, ÍCONES E CAPAS (TEMA ENCHIRIDION)
// ============================================================================
export interface NotionColor {
  name: string;
  text: string;
  bg: string;
  border: string;
}

export const NOTION_COLORS: NotionColor[] = [
  { name: 'Padrão', text: '#F1F5F9', bg: 'transparent', border: '#1E293B' },
  { name: 'Cinza', text: '#94A3B8', bg: '#222A33', border: '#334155' },
  { name: 'Marrom', text: '#BA856F', bg: '#3D2E28', border: '#5A4239' },
  { name: 'Laranja', text: '#D9730D', bg: '#492914', border: '#6B3D1E' },
  { name: 'Amarelo', text: '#DFAB01', bg: '#473815', border: '#66511F' },
  { name: 'Verde', text: '#448361', bg: '#1E382D', border: '#2D5443' },
  { name: 'Azul', text: '#337EA9', bg: '#1D3347', border: '#2B4C69' },
  { name: 'Roxo', text: '#9065B0', bg: '#31243E', border: '#4A365D' },
  { name: 'Rosa', text: '#C14C8A', bg: '#402233', border: '#5E324B' },
  { name: 'Vermelho', text: '#D44C47', bg: '#472222', border: '#693232' },
];

export const PAGE_ICONS: string[] = [
  '💰', '📝', '📄', '📊', '📈', '🏦', '💳', '🎯', '🚀', '⚡',
  '📌', '🗂️', '📅', '✅', '🔒', '💡', '🛠️', '📦', '🏠', '🎓',
];

export const CALLOUT_ICONS: string[] = [
  '💡', '⚠️', '📌', '🔥', '✅', '💰', '🚀', '📢',
];

export const PAGE_COVERS: string[] = [
  'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
  'linear-gradient(135deg, #1E382D 0%, #12161A 100%)',
  'linear-gradient(135deg, #31243E 0%, #12161A 100%)',
  'linear-gradient(135deg, #492914 0%, #12161A 100%)',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1200&q=80',
];