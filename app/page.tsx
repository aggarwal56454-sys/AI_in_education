'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Workspace() {
  const [folders, setFolders] = useState<any[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();

  const fetchFolders = async () => {
    const res = await fetch('/api/folders');
    const data = await res.json();
    setFolders(data.folders || []);
  };

  useEffect(() => { fetchFolders(); }, []);

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() })
      });
      const data = await res.json();
      setNewFolderName(''); fetchFolders(); router.push(`/folder/${data.id}`);
    } catch (err) { console.error(err); } finally { setIsCreating(false); }
  };

  const deleteFolder = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Delete this folder and everything inside it?')) return;
    await fetch(`/api/folders?id=${id}`, { method: 'DELETE' });
    fetchFolders();
  };

  return (
    <div className="flex h-screen bg-stone-50 font-sans overflow-hidden selection:bg-[#D97757] selection:text-white">
      
      {/* Soft Sidebar */}
      <div className={`bg-[#FDFBF7] border-r border-stone-200 flex flex-col shrink-0 z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-none'}`}>
        <div className="w-72 p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 mb-8 shrink-0">
            <div className="w-10 h-10 bg-[#D97757] rounded-full flex items-center justify-center text-white text-xl shadow-sm">🌿</div>
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight">Yo Palp</h2>
          </div>
          
          <form onSubmit={createFolder} className="mb-6 shrink-0">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-2 mb-2">New Subject</p>
            <div className="flex gap-2">
              <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="E.g. Macroeconomics..." className="flex-1 bg-stone-100 border-none rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#D97757]/50 transition-all" />
              <button type="submit" disabled={isCreating || !newFolderName.trim()} className="bg-[#5C715E] text-white px-4 py-3 rounded-2xl font-bold hover:bg-[#4A5C4B] disabled:opacity-50 transition-colors shadow-sm">+</button>
            </div>
          </form>

          <div className="space-y-1 overflow-y-auto flex-1 pr-2">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-2 mb-2 mt-4">Your Folders</p>
            {folders.length === 0 && <p className="text-sm text-stone-400 px-2 italic">Your desk is empty.</p>}
            {folders.map(folder => (
              <div key={folder.id} className="group flex items-center justify-between px-3 py-3 rounded-2xl hover:bg-stone-100 transition-colors">
                <Link href={`/folder/${folder.id}`} className="flex items-center gap-3 flex-1 overflow-hidden">
                  <span className="text-xl opacity-80">📁</span>
                  <span className="font-semibold text-sm text-stone-600 group-hover:text-stone-900 truncate">{folder.name}</span>
                </Link>
                <button onClick={(e) => deleteFolder(e, folder.id)} className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-400 transition-opacity p-2 text-sm">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="h-16 shrink-0 flex items-center px-8 bg-transparent z-10 mt-2">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="px-5 py-2 bg-white/50 backdrop-blur-md rounded-full text-stone-500 font-bold text-xs hover:text-stone-800 border border-stone-200 transition-all">
            {isSidebarOpen ? 'Close Menu' : 'Open Menu'}
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-10 pb-32">
          <div className="text-7xl mb-8 opacity-90">🪴</div>
          <h1 className="text-5xl font-black text-stone-800 mb-6 tracking-tight text-center">Your Study Studio</h1>
          <p className="text-stone-500 text-center max-w-md leading-relaxed text-lg">
            {folders.length > 0 
              ? "Select a subject from your sidebar to start studying, reviewing flashcards, or chatting with Aura." 
              : "Create your first subject folder in the sidebar to begin organizing your thoughts and materials."}
          </p>
        </div>
      </div>
    </div>
  );
}
