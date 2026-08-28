import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpenText, ChevronLeft, ChevronRight, CircleHelp, Construction, Headphones, UserCog, UsersRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const tools = [
  { path: '/support/inbox', label: 'Conversation inbox', icon: Headphones },
  { path: '/admin/users', label: 'User lookup', icon: UsersRound },
  { path: '/admin/roles', label: 'Member roles', icon: UserCog },
  { path: '/admin/articles', label: 'Upload news-blog article', icon: BookOpenText },
  { path: '/admin/faqs', label: 'Write FAQ', icon: CircleHelp },
];

//渲染:渲染AdminToolRail组件或页面内容
export default function AdminToolRail() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);

  if (!isAdmin()) return null;

  return (
    <aside className="fixed left-3 top-28 z-40" aria-label="Admin tools">
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl shadow-slate-900/10 backdrop-blur">
        <button
          type="button"
          onClick={() => {
                     //处理页面交互事件
                     return setExpanded((value) => {
                                       //处理页面交互事件
                                       return !value;
                                     });
                   }}
          className="group flex h-11 items-center rounded-xl bg-slate-900 text-white transition-colors hover:bg-slate-800"
          aria-expanded={expanded}
          title={expanded ? 'Collapse admin tools' : 'Expand admin tools'}
        >
          <span className="flex w-11 shrink-0 items-center justify-center">{expanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}</span>
          {expanded && <span className="whitespace-nowrap pr-4 text-sm font-semibold">Admin tools</span>}
        </button>

        {expanded && tools.map(({ path, label, icon: Icon }) => {
          //渲染:渲染列表内容
          return (
<Link
            key={path}
            to={path}
            title={label}
            className={`flex h-11 items-center rounded-xl transition-colors ${pathname === path ? 'bg-primary text-white' : 'text-slate-600 hover:bg-orange-50 hover:text-primary'}`}
          >
            <span className="flex w-11 shrink-0 items-center justify-center"><Icon size={20} /></span>
            <span className="whitespace-nowrap pr-4 text-sm font-medium">{label}</span>
          </Link>
          );
        })}

        {expanded && (
          <button type="button" disabled title="Reserved for a future admin tool" className="flex h-11 cursor-not-allowed items-center rounded-xl text-slate-300">
            <span className="flex w-11 shrink-0 items-center justify-center"><Construction size={20} /></span>
            <span className="whitespace-nowrap pr-4 text-sm font-medium">Coming soon</span>
          </button>
        )}
      </div>
    </aside>
  );
}
