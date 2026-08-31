'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [folders, setFolders] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    fetch('/api/folders')
      .then(res => res.json())
      .then(data => { if (data.folders) setFolders(data.folders); })
      .catch(console.error);
  }, []);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolderName }) });
      const folder = await res.json();
      if (res.ok) {
        setFolders([folder, ...folders]);
        setNewFolderName('');
        setIsCreating(false);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, folderId: string, folderName: string) => {
    e.preventDefault(); 
    if (!window.confirm(`Are you sure you want to delete "${folderName}" and all its flashcards?`)) return;

    try {
      const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      if (res.ok) {
        setFolders(folders.filter(f => f.id !== folderId));
        if (pathname === `/folder/${folderId}`) {
          router.push('/');
        }
      }
    } catch (err) { console.error(err); }
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shrink-0">
      <div className="p-4 border-b border-slate-800">
        <Link href="/">
          <h1 className="text-xl font-bold tracking-tight text-indigo-400 cursor-pointer hover:text-indigo-300 transition-colors">YO PALP</h1>
          <p className="text-xs text-slate-400 mt-1 cursor-pointer">Workspace</p>
        </Link>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">My Folders</h2>
          <ul className="space-y-1">
            {folders.length === 0 && <li className="text-slate-500 text-xs italic px-2 py-2">No folders yet.</li>}
            {folders.map(folder => {
              const isActive = pathname === `/folder/${folder.id}`;
              return (
                <li key={folder.id}>
                  <div className={`group flex items-center justify-between rounded-md transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                    <Link href={`/folder/${folder.id}`} className="flex-1 flex items-center gap-2 px-2 py-1.5 min-w-0">
                      <span>📁</span> 
                      <span className="truncate text-sm">{folder.name}</span>
                    </Link>
                    <button 
                      onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
                      className={`px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 flex-shrink-0 ${isActive ? 'text-indigo-200 hover:text-white' : 'text-slate-400'}`}
                      title="Delete Folder"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      
      <div className="p-4 border-t border-slate-800">
        {isCreating ? (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
            <input type="text" autoFocus className="w-full bg-slate-800 text-white text-sm rounded-md px-3 py-2 border border-slate-700 outline-none focus:border-indigo-500" placeholder="Folder name..." value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} />
            <div className="flex gap-2">
              <button onClick={handleCreateFolder} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-md transition-colors">Save</button>
              <button onClick={() => setIsCreating(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold py-2 rounded-md transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsCreating(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 rounded-md transition-colors">+ New Folder</button>
        )}
      </div>
    </aside>
  );
}
