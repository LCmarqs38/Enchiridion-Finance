import { JSONContent } from '@tiptap/react';

export interface LegacyBlock {
  id: string;
  type: string;
  content: string;
  content2?: string;
  targetPageId?: string;
  checked?: boolean;
}

export interface NoteComment {
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
  isFavorite?: boolean;
  isDeleted?: boolean;
  content: JSONContent;
  comments?: NoteComment[];
  createdAt: number;
  updatedAt: number;
  // Mantido opcionalmente para retrocompatibilidade na leitura inicial
  blocks?: LegacyBlock[];
}

export interface NotionColor {
  name: string;
  text: string;
  bg: string;
  border: string;
}

export const NOTION_COLORS: NotionColor[] = [
  { name: 'Padrão', text: '#EDEDED', bg: 'transparent', border: '#373737' },
  { name: 'Cinza', text: '#9B9A97', bg: '#2F2F2F', border: '#454545' },
  { name: 'Marrom', text: '#BA856F', bg: '#3D2E28', border: '#5A4239' },
  { name: 'Laranja', text: '#D9730D', bg: '#492914', border: '#6B3D1E' },
  { name: 'Amarelo', text: '#DFAB01', bg: '#473815', border: '#66511F' },
  { name: 'Verde', text: '#448361', bg: '#1E382D', border: '#2D5443' },
  { name: 'Azul', text: '#337EA9', bg: '#1D3347', border: '#2B4C69' },
  { name: 'Roxo', text: '#9065B0', bg: '#31243E', border: '#4A365D' },
  { name: 'Rosa', text: '#C14C8A', bg: '#402233', border: '#5E324B' },
  { name: 'Vermelho', text: '#D44C47', bg: '#472222', border: '#693232' },
];

export const PAGE_ICONS = [
  '💰', '📝', '📄', '💸', '📊', '📈', '🏦', '💳', '🏠', '🏍️',
  '🛒', '🎯', '🚀', '📚', '💡', '⚡', '🔒', '📅', '🗂️', '✅'
];

export const PAGE_COVERS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
  'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  'linear-gradient(135deg, #31102F 0%, #191919 100%)',
  'linear-gradient(135deg, #0f291e 0%, #191919 100%)',
];