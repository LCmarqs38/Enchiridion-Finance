import { LucideIcon } from 'lucide-react';

type Props = {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

export default function NavItem({ active, label, icon: Icon, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200 flex-1 ${
        active ? 'bg-slate-800 text-blue-400 font-semibold' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] leading-none truncate w-full text-center">{label}</span>
    </button>
  );
}
