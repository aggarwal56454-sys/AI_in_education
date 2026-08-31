'use client';
import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import EmbeddedChat from '@/components/EmbeddedChat';

const BionicText = ({ text }: { text: string }) => {
  return (
    <>
      {text.split(' ').map((word, i) => {
        if (word.length <= 1) return <span key={i}>{word} </span>;
        const mid = Math.ceil(word.length / 2);
        return <span key={i}><b className="font-extrabold text-black">{word.slice(0, mid)}</b>{word.slice(mid)} </span>;
      })}
    </>
  );
};

const parseConceptMeta = (rawSummary: string) => {
  if (!rawSummary) return { text: '', bloom: null, prereqs: null, citations: null };
  if (rawSummary.includes('__META__')) {
    const parts = rawSummary.split('__META__');
    return {
      text: parts[0] || '',
      bloom: parts[1] || 'Understand',
      prereqs: parts[2] ? parts[2].trim() : null,
      citations: parts[3] ? parts[3].trim() : null
    };
  }
  return { text: rawSummary, bloom: null, prereqs: null, citations: null };
};

const getBloomColor = (level: string) => {
  switch (level?.toLowerCase()) {
    case 'remember': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'understand': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'apply': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'analyze': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'evaluate': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'create': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-stone-100 text-stone-700 border-stone-200';
  }
};

const TOP_LANGUAGES = [
  'English', 'Mandarin Chinese', 'Hindi', 'Spanish', 'French', 
  'Modern Standard Arabic', 'Bengali', 'Russian', 'Portuguese', 'Urdu', 
  'Indonesian', 'German', 'Japanese', 'Marathi', 'Telugu', 
  'Turkish', 'Tamil', 'Cantonese', 'Vietnamese', 'Tagalog'
];

export default function FolderView({ params }: { params: Promise<{ id: string }> }) {
  const folderId = use(params).id;
  const [folder, setFolder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'live' | 'library' | 'notes' | 'quiz' | 'pal' | 'vm'>('upload');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [targetLanguage, setTargetLanguage] = useState('Auto-Detect');
  
  const [inputType, setInputType] = useState<'pdf' | 'text'>('pdf');
  const [rawText, setRawText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  
  const [notesView, setNotesView] = useState<'cards' | 'doc'>('cards');
  const [isDyslexic, setIsDyslexic] = useState(false);
  const [isBionic, setIsBionic] = useState(false);

  // SPACED REPETITION STATE
  const [leitnerData, setLeitnerData] = useState<Record<string, { box: number, nextReview: number }>>({});
  
  useEffect(() => {
    const saved = localStorage.getItem('yopalp_leitner');
    if (saved) setLeitnerData(JSON.parse(saved));
  }, []);

  const saveLeitnerData = (newData: Record<string, { box: number, nextReview: number }>) => {
    setLeitnerData(newData);
    localStorage.setItem('yopalp_leitner', JSON.stringify(newData));
  };

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeLeft > 0) interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    else if (timeLeft === 0) { setIsTimerRunning(false); alert("Flow session complete!"); setTimeLeft(5 * 60); }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);
  const resetTimer = () => { setIsTimerRunning(false); setTimeLeft(25 * 60); };
  const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m}:${s.toString().padStart(2, '0')}`; };

  const [quizConfig, setQuizConfig] = useState({ type: 'mcq', count: 3, documentId: 'all', conceptId: 'all' });
  const [quiz, setQuiz] = useState<any[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [pastQuizzes, setPastQuizzes] = useState<any[]>([]);
  const [viewingPastQuiz, setViewingPastQuiz] = useState<any | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const fetchFolder = () => {
    fetch(`/api/folders/${folderId}`).then(res => res.json()).then(data => setFolder(data.folder));
    fetch('/api/folders').then(res => res.json()).then(data => setAllFolders(data.folders || [])).catch(() => setAllFolders([]));
  };
  const loadPastQuizzes = () => fetch(`/api/quiz-history?folderId=${folderId}`).then(res => res.json()).then(setPastQuizzes).catch(() => {});

  useEffect(() => { fetchFolder(); loadPastQuizzes(); }, [folderId]);

  const exportToAnki = () => {
    if (!folder || !folder.documents) return;
    let fileContent = "#separator:tab\n#html:true\n#tags column:3\n";
    let count = 0;
    folder.documents.forEach((doc: any) => {
      doc.concepts?.forEach((c: any) => {
        count++;
        const meta = parseConceptMeta(c.summary);
        const front = c.name.replace(/\t/g, ' ').replace(/\n/g, '<br>');
        let back = meta.text.replace(/\t/g, ' ').replace(/\n/g, '<br>');
        if (meta.bloom || meta.prereqs) {
          back += `<br><br><small style="color:#777;">`;
          if (meta.bloom) back += `<b>Depth:</b> ${meta.bloom} `;
          if (meta.prereqs) back += `| <b>Prerequisites:</b> ${meta.prereqs}`;
          back += `</small>`;
        }
        const tag = folder.name.replace(/\s+/g, '_');
        fileContent += `${front}\t${back}\t${tag}\n`;
      });
    });
    if (count === 0) { alert("No concepts found to export. Add some notes first!"); return; }
    const blob = new Blob([fileContent], { type: "text/tab-separated-values;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${folder.name.toLowerCase().replace(/\s+/g, '-')}-anki-deck.txt`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.start(); setIsRecording(true);
    } catch (err) { alert("Microphone access denied. Please check your browser permissions."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioBase64 = await new Promise((resolve) => {
          const reader = new FileReader(); reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.readAsDataURL(audioBlob);
        });
        setIsUploading(true); setUploadStatus('Sending audio to Gemini...');
        try {
          await fetch('/api/documents', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId, title: `Live Audio - ${new Date().toLocaleTimeString()}`, audioBase64, audioMimeType: 'audio/webm', language: targetLanguage })
          });
          fetchFolder(); setActiveTab('notes');
        } catch (err: any) { setUploadStatus(`Error: ${err.message}`); } 
        finally { setTimeout(() => { setIsUploading(false); setUploadStatus(''); }, 2000); }
      };
      mediaRecorderRef.current.stop(); mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); setIsRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true); setUploadStatus(`Translating and Processing in ${targetLanguage}...`);
    try {
      const pdfBase64 = await new Promise((resolve) => {
        const reader = new FileReader(); reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.readAsDataURL(file);
      });
      const formData = new FormData(); formData.append('file', file);
      const pythonRes = await fetch('http://localhost:8000/extract-pdf', { method: 'POST', body: formData });
      const pythonData = await pythonRes.json();
      const nextRes = await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, title: file.name, content: pythonData.text || "", pdfBase64, language: targetLanguage })
      });
      const newDoc = await nextRes.json();
      const fileData = new FormData(); fileData.append('file', file); fileData.append('docId', newDoc.id);
      await fetch('/api/upload', { method: 'POST', body: fileData });
      fetchFolder(); setActiveTab('notes');
    } catch (err: any) { setUploadStatus(`Error: ${err.message}`); } 
    finally { setTimeout(() => { setIsUploading(false); setUploadStatus(''); }, 2000); }
  };

  const handleTextSubmit = async () => {
    if (!rawText.trim()) return;
    setIsUploading(true); setUploadStatus(`Translating and Analyzing in ${targetLanguage}...`);
    try {
      await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, title: `Text Note - ${new Date().toLocaleDateString()}`, content: rawText, language: targetLanguage })
      });
      setRawText(''); fetchFolder(); setActiveTab('notes');
    } catch (err: any) { setUploadStatus(`Error: ${err.message}`); } 
    finally { setTimeout(() => { setIsUploading(false); setUploadStatus(''); }, 2000); }
  };

  const loadQuiz = async (customConcepts?: string[]) => {
    setQuizLoading(true); setSelectedAnswers({}); setRevealedAnswers({}); setQuiz([]); setViewingPastQuiz(null);
    try {
      const res = await fetch(`/api/quiz`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, ...quizConfig, customConcepts, language: targetLanguage })
      });
      const data = await res.json(); setQuiz(data.questions || []);
    } catch (e) { console.error(e); } finally { setQuizLoading(false); }
  };

  const finishAndSaveQuiz = async () => {
    let score = 0;
    const newLeitner = { ...leitnerData };
    const now = Date.now();
    
    // Spaced Repetition Grading Logic
    quiz.forEach((q, i) => {
      const isCorrect = selectedAnswers[i] === q.answer;
      if (isCorrect) score++;
      
      if (q.conceptId) {
        const currentBox = newLeitner[q.conceptId]?.box || 0;
        if (isCorrect) {
          const nextBox = Math.min(currentBox + 1, 5);
          const daysToAdd = nextBox === 1 ? 1 : nextBox === 2 ? 3 : nextBox === 3 ? 7 : nextBox === 4 ? 14 : 30;
          newLeitner[q.conceptId] = { box: nextBox, nextReview: now + (daysToAdd * 86400000) };
        } else {
          newLeitner[q.conceptId] = { box: 0, nextReview: now }; // Back to start, review immediately
        }
      }
    });
    
    saveLeitnerData(newLeitner);

    await fetch('/api/quiz-history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId, type: quizConfig.type, score, total: quiz.length, quizData: { questions: quiz, answers: selectedAnswers, revealed: revealedAnswers } })
    });
    setQuiz([]); loadPastQuizzes();
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Delete this material?')) return;
    await fetch(`/api/documents?id=${id}`, { method: 'DELETE' }); fetchFolder();
  };
  const deleteConcept = async (id: string) => {
    await fetch(`/api/concepts?id=${id}`, { method: 'DELETE' }); fetchFolder();
  };

  if (!folder) return <div className="p-10 text-stone-400">Loading Study Studio...</div>;
  const selectedDoc = folder.documents?.find((d: any) => d.id === quizConfig.documentId);
  const availableConcepts = selectedDoc ? selectedDoc.concepts : folder.documents?.flatMap((d:any)=>d.concepts) || [];
  
  // Calculate due concepts for Spaced Repetition
  const dueConcepts = availableConcepts.filter((c: any) => {
    const data = leitnerData[c.id];
    return !data || data.nextReview <= Date.now();
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;600&display=swap');
        @media print { .no-print { display: none !important; } body { background: white; color: black; } .print-page { padding: 0; } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(217, 119, 87, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(217, 119, 87, 0); } 100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(217, 119, 87, 0); } }
        .recording-pulse { animation: pulse-ring 2s infinite; }
      `}} />

      <div className="flex h-screen bg-stone-50 font-sans print-page overflow-hidden selection:bg-[#D97757] selection:text-white">
        
        <div className={`bg-[#FDFBF7] border-r border-stone-200 flex flex-col shrink-0 z-20 no-print transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-none'}`}>
          <div className="w-72 p-6 flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-3 mb-8 shrink-0">
              <div className="w-10 h-10 bg-[#D97757] rounded-full flex items-center justify-center text-white text-lg shadow-sm">🌿</div>
              <h2 className="text-xl font-bold text-stone-800 truncate">{folder.name}</h2>
            </div>
            
            <div className="space-y-1 overflow-y-auto pb-4 flex-1 pr-2">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4 mb-2 mt-2">Materials</p>
              <button onClick={() => setActiveTab('upload')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${activeTab === 'upload' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}>📤 Add Material</button>
              <button onClick={() => setActiveTab('live')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${activeTab === 'live' ? 'bg-red-50 text-red-600' : 'text-stone-500 hover:bg-stone-100'}`}>🎙️ Live Audio</button>
              <button onClick={() => setActiveTab('library')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${activeTab === 'library' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}>📚 Library</button>
              
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4 mb-2 mt-6">Study Tools</p>
              <button onClick={() => setActiveTab('notes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${activeTab === 'notes' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}>📝 Core Concepts</button>
              <button onClick={() => { setActiveTab('quiz'); setQuiz([]); setViewingPastQuiz(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${activeTab === 'quiz' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}>
                🎯 Quizzes {dueConcepts.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-auto">{dueConcepts.length} Due</span>}
              </button>
              
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4 mb-2 mt-6">AI Assistants</p>
              <button onClick={() => setActiveTab('pal')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${activeTab === 'pal' ? 'bg-[#5C715E] text-white shadow-sm' : 'text-stone-500 hover:bg-stone-100'}`}>🧠 Pal Tutor</button>
              <button onClick={() => setActiveTab('vm')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors ${activeTab === 'vm' ? 'bg-[#8A9A86] text-white shadow-sm' : 'text-stone-500 hover:bg-stone-100'}`}>🍵 Aura (Wellbeing)</button>
            </div>
            
            <div className="shrink-0 pt-4 border-t border-stone-100 mt-2">
              <Link href="/" className="text-sm text-stone-400 hover:text-stone-800 font-bold px-4 block transition-colors">← Home</Link>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden print-page relative">
          
          <div className="h-16 shrink-0 flex items-center px-8 border-b border-stone-200 bg-[#FDFBF7] no-print z-10 justify-between">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="px-4 py-2 bg-stone-100 rounded-full text-stone-600 font-bold text-xs hover:text-stone-800 hover:bg-stone-200 transition-all">
              {isSidebarOpen ? 'Collapse Menu' : 'Open Menu'}
            </button>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-full px-4 py-1.5 shadow-sm">
                <div className={`w-2 h-2 rounded-full ${isTimerRunning ? 'bg-[#D97757] animate-pulse' : 'bg-stone-300'}`}></div>
                <span className="text-sm font-bold text-stone-700 tracking-wider w-12 text-center">{formatTime(timeLeft)}</span>
                <button onClick={toggleTimer} className="text-xs font-bold text-stone-500 hover:text-[#5C715E] transition-colors ml-2">
                  {isTimerRunning ? 'PAUSE' : 'START'}
                </button>
                <button onClick={resetTimer} className="text-xs font-bold text-stone-400 hover:text-red-500 transition-colors ml-2 border-l border-stone-200 pl-2">
                  RESET
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Language:</span>
                <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="bg-stone-100 border-none rounded-full px-4 py-2 text-xs font-bold text-stone-700 outline-none cursor-pointer hover:bg-stone-200 transition-colors">
                  <option value="Auto-Detect">Auto-Detect</option>
                  {TOP_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 p-10 overflow-auto">
            
            {activeTab === 'live' && (
              <div className="max-w-3xl mx-auto w-full no-print">
                <h1 className="text-4xl font-bold text-stone-800 mb-2 tracking-tight">Live Audio</h1>
                <p className="text-stone-500 mb-8">Record natively in any browser. The audio file will be analyzed directly by Gemini.</p>
                <div className="bg-[#FDFBF7] border border-stone-200 rounded-3xl p-12 mb-8 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl mb-8 shadow-md transition-all ${isRecording ? 'bg-red-500 text-white recording-pulse' : 'bg-stone-100 text-stone-400'}`}>🎙️</div>
                  <div className="flex flex-col gap-4 items-center w-full">
                    {!isRecording ? (
                      <button onClick={startRecording} disabled={isUploading} className="px-8 py-4 bg-[#D97757] text-white rounded-full font-bold shadow-md hover:bg-[#C26447] transition-all disabled:opacity-50 text-lg w-64">{isUploading ? 'Analyzing...' : 'Start Recording'}</button>
                    ) : (
                      <button onClick={stopRecording} className="px-8 py-4 bg-stone-800 text-white rounded-full font-bold shadow-md hover:bg-stone-900 transition-all text-lg w-64">Stop & Analyze</button>
                    )}
                    {uploadStatus && <p className="text-sm font-medium text-[#D97757] mt-4">{uploadStatus}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* UPLOAD & LIBRARY RETAINED EXACTLY AS IS */}
            {activeTab === 'upload' && (
              <div className="max-w-3xl mx-auto w-full no-print">
                <h1 className="text-4xl font-bold text-stone-800 mb-8 tracking-tight">Add Material</h1>
                <div className="flex gap-4 mb-8">
                  <button onClick={() => setInputType('pdf')} className={`px-6 py-2 rounded-full font-bold text-sm transition-colors ${inputType === 'pdf' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-600'}`}>Upload PDF</button>
                  <button onClick={() => setInputType('text')} className={`px-6 py-2 rounded-full font-bold text-sm transition-colors ${inputType === 'text' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-600'}`}>Paste Text</button>
                </div>
                {inputType === 'pdf' ? (
                  <div className="border border-dashed border-stone-300 rounded-3xl p-12 flex flex-col items-center justify-center bg-[#FDFBF7] relative hover:bg-stone-100">
                    <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="text-4xl mb-4 opacity-50">{isUploading ? '⏳' : '📄'}</div>
                    <p className="text-lg font-bold text-stone-700">{isUploading ? 'Processing...' : 'Drop your PDF here'}</p>
                    <p className="text-sm font-medium mt-2 text-[#D97757]">{uploadStatus}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Paste your notes here..." className="w-full h-64 bg-[#FDFBF7] border border-stone-200 rounded-3xl p-6 text-stone-700 focus:outline-none focus:border-[#D97757] resize-none leading-relaxed" />
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-[#D97757]">{uploadStatus}</p>
                      <button onClick={handleTextSubmit} disabled={isUploading || !rawText.trim()} className="px-8 py-3 bg-[#D97757] text-white rounded-full font-bold hover:bg-[#C26447] disabled:opacity-50">Generate</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'library' && (
              <div className="max-w-5xl mx-auto w-full h-full pr-4 pb-10">
                <h1 className="text-4xl font-bold text-stone-800 mb-8 tracking-tight">Library</h1>
                {folder.documents?.length === 0 ? <div className="text-center py-20 text-stone-400">No materials added yet.</div> : (
                  <div className="space-y-4">
                    {folder.documents?.map((doc: any) => (
                      <div key={doc.id} className="bg-[#FDFBF7] rounded-3xl border border-stone-200 overflow-hidden">
                        <div className="p-6 flex justify-between items-center">
                          <div className="flex gap-4 items-center">
                            <div className="text-2xl opacity-50">{(doc.title.includes('Text Note') || doc.title.includes('Live Audio')) ? '📝' : '📄'}</div>
                            <h3 className="font-bold text-stone-800">{doc.title}</h3>
                          </div>
                          <div className="flex gap-2">
                            {!(doc.title.includes('Text Note') || doc.title.includes('Live Audio')) && <button onClick={() => setViewingDocId(viewingDocId === doc.id ? null : doc.id)} className="text-stone-600 bg-stone-200 px-4 py-2 rounded-full font-bold text-xs hover:bg-stone-300">{viewingDocId === doc.id ? 'Close' : 'View'}</button>}
                            <button onClick={() => deleteDocument(doc.id)} className="text-[#D97757] bg-red-50 px-4 py-2 rounded-full font-bold text-xs">Delete</button>
                          </div>
                        </div>
                        {viewingDocId === doc.id && <iframe src={`/uploads/${doc.id}.pdf`} className="w-full h-[650px] border-t border-stone-200" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className={`max-w-5xl mx-auto w-full h-full ${isDyslexic ? "font-['Lexend'] tracking-wide" : ""}`}>
                <div className="flex justify-between items-end mb-8 no-print border-b border-stone-200 pb-6">
                  <div>
                    <h1 className="text-4xl font-bold text-stone-800 tracking-tight">Core Concepts</h1>
                    <p className="text-xs font-semibold text-stone-400 mt-1 uppercase tracking-wider">Spaced Repetition Enabled</p>
                  </div>
                  
                  <div className="flex flex-col gap-3 items-end">
                    <div className="flex gap-2">
                      <button onClick={() => setIsBionic(!isBionic)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border ${isBionic ? 'bg-[#5C715E] text-white border-[#5C715E]' : 'bg-transparent text-stone-500 border-stone-300'}`}>Bionic Reading</button>
                      <button onClick={() => setIsDyslexic(!isDyslexic)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border ${isDyslexic ? 'bg-[#D97757] text-white border-[#D97757]' : 'bg-transparent text-stone-500 border-stone-300'}`}>Dyslexia Font</button>
                    </div>
                    
                    <div className="flex gap-2">
                      <button onClick={exportToAnki} className="px-4 py-2 bg-[#5C715E] text-white rounded-full font-bold text-xs hover:bg-[#4A5C4B] transition-colors shadow-sm">
                        📥 Export Anki (.txt)
                      </button>
                      <button onClick={() => setNotesView(notesView === 'cards' ? 'doc' : 'cards')} className="px-4 py-2 bg-stone-200 text-stone-700 rounded-full font-bold text-xs">
                        {notesView === 'cards' ? 'Document View' : 'Card View'}
                      </button>
                    </div>
                  </div>
                </div>

                {notesView === 'cards' ? (
                  <div className="space-y-8 no-print">
                    {folder.documents?.map((doc: any) => (
                      <div key={doc.id} className="bg-transparent border-none p-0">
                        <h3 className="font-bold text-stone-500 mb-4 text-sm uppercase tracking-widest">{doc.title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {doc.concepts?.map((c: any) => {
                            const meta = parseConceptMeta(c.summary);
                            const lData = leitnerData[c.id];
                            const isDue = !lData || lData.nextReview <= Date.now();
                            
                            return (
                              <div key={c.id} className={`p-6 bg-[#FDFBF7] border rounded-3xl relative group flex flex-col justify-between transition-all ${isDue ? 'border-[#D97757] shadow-sm' : 'border-stone-200 opacity-80'}`}>
                                <div className="absolute top-4 right-4 flex gap-2">
                                  {isDue ? 
                                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Due Review</span> :
                                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Mastery Lvl {lData.box}</span>
                                  }
                                  <button onClick={() => deleteConcept(c.id)} className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-400">✕</button>
                                </div>
                                
                                <div className="mt-4">
                                  {meta.bloom && <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider mb-2.5 ${getBloomColor(meta.bloom)}`}>{meta.bloom}</span>}
                                  <h4 className="font-bold text-stone-800 mb-3 leading-snug pr-12">{isBionic ? <BionicText text={c.name} /> : c.name}</h4>
                                  <p className={`text-sm text-stone-600 leading-relaxed ${isDyslexic ? 'leading-loose text-[15px]' : ''}`}>{isBionic ? <BionicText text={meta.text} /> : meta.text}</p>
                                </div>
                                
                                <div className="mt-4 pt-4 border-t border-stone-100">
                                  {meta.prereqs && <div className="text-[11px] text-stone-500 mb-3"><span className="font-bold text-stone-700">Prereq: </span>{meta.prereqs}</div>}
                                  {meta.citations && meta.citations !== 'No verified citations found.' && meta.citations !== 'Citation fetch failed.' && (
                                    <div className="text-[10px] text-stone-500 bg-stone-100 p-3 rounded-xl">
                                      <p className="font-bold text-stone-700 mb-1 uppercase tracking-wider">Related Research</p>
                                      <ul className="space-y-1.5">
                                        {meta.citations.split(' || ').map((cite: string, i: number) => {
                                          const urlMatch = cite.match(/\((https:\/\/[^\)]+)\)/);
                                          const text = cite.replace(/\(https:\/\/[^\)]+\)/, '');
                                          return <li key={i} className="truncate">{text} {urlMatch && <a href={urlMatch[1]} target="_blank" className="text-[#D97757] font-bold hover:underline ml-1">Read →</a>}</li>
                                        })}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#FDFBF7] p-16 rounded-3xl border border-stone-200 max-w-4xl mx-auto print:border-none print:p-0">
                    <h1 className="text-4xl font-black text-stone-900 mb-2 text-center tracking-tight">{folder.name}</h1>
                    <p className="text-center text-stone-500 mb-12 pb-8 border-b border-stone-200 uppercase tracking-widest text-xs font-bold">Comprehensive Study Guide</p>
                    {folder.documents?.map((doc: any) => (
                      <div key={doc.id} className="mb-12">
                        <h2 className="text-lg font-bold text-stone-400 mb-6 uppercase tracking-wider">{doc.title}</h2>
                        <div className="space-y-8">
                          {doc.concepts?.map((c: any) => {
                            const meta = parseConceptMeta(c.summary);
                            return (
                              <div key={c.id} className="pl-6 border-l-2 border-[#D97757]">
                                <div className="flex items-center gap-2 mb-1">
                                  {meta.bloom && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getBloomColor(meta.bloom)}`}>{meta.bloom}</span>}
                                  <h3 className="text-lg font-bold text-stone-800">{isBionic ? <BionicText text={c.name} /> : c.name}</h3>
                                </div>
                                <p className={`text-stone-700 leading-relaxed ${isDyslexic ? 'leading-loose text-[17px]' : ''}`}>{isBionic ? <BionicText text={meta.text} /> : meta.text}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'quiz' && (
              <div className="max-w-4xl mx-auto w-full h-full no-print">
                {!viewingPastQuiz && quiz.length === 0 && (
                  <>
                    <h1 className="text-4xl font-bold text-stone-800 mb-8 tracking-tight">Test Your Knowledge</h1>
                    
                    <div className="bg-[#FDFBF7] border border-[#D97757] rounded-3xl p-8 mb-8 shadow-sm flex justify-between items-center relative overflow-hidden">
                      <div className="relative z-10">
                        <h3 className="text-2xl font-bold text-stone-800 mb-2">🧠 Smart Review Session</h3>
                        <p className="text-stone-600 font-medium">You have <span className="text-[#D97757] font-bold">{dueConcepts.length} concepts</span> ready for spaced repetition review.</p>
                      </div>
                      <button 
                        onClick={() => loadQuiz(dueConcepts.map((c:any) => c.id))} 
                        disabled={quizLoading || dueConcepts.length === 0} 
                        className="px-8 py-4 bg-[#D97757] text-white rounded-full font-bold hover:bg-[#C26447] disabled:opacity-50 relative z-10 transition-transform active:scale-95"
                      >
                        {quizLoading ? 'Generating...' : 'Start Smart Review →'}
                      </button>
                    </div>

                    <div className="bg-[#FDFBF7] border border-stone-200 rounded-3xl p-8 mb-10 flex flex-col gap-6">
                      <h4 className="font-bold text-stone-400 uppercase text-xs tracking-widest border-b border-stone-100 pb-3">Or create a custom quiz</h4>
                      <div className="flex flex-wrap gap-4 items-end justify-between">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Source Document</label>
                          <select value={quizConfig.documentId} onChange={(e) => setQuizConfig({...quizConfig, documentId: e.target.value, conceptId: 'all'})} className="bg-stone-100 border-none rounded-2xl px-4 py-3 font-semibold text-stone-700 outline-none w-48">
                            <option value="all">All Documents</option>
                            {folder.documents?.map((d: any) => <option key={d.id} value={d.id} className="truncate">{d.title}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Specific Topic</label>
                          <select value={quizConfig.conceptId} onChange={(e) => setQuizConfig({...quizConfig, conceptId: e.target.value})} disabled={quizConfig.documentId === 'all'} className="bg-stone-100 border-none rounded-2xl px-4 py-3 font-semibold text-stone-700 outline-none disabled:opacity-50 w-48">
                            <option value="all">All Topics</option>
                            {availableConcepts?.map((c: any) => <option key={c.id} value={c.id} className="truncate">{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 items-end justify-between pt-4 border-t border-stone-200">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Quiz Format</label>
                          <select value={quizConfig.type} onChange={(e) => setQuizConfig({...quizConfig, type: e.target.value})} className="bg-stone-100 border-none rounded-2xl px-4 py-3 font-semibold text-stone-700 outline-none">
                            <option value="mcq">Multiple Choice</option>
                            <option value="short">Short Answer</option>
                            <option value="long">Long Essay</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Questions</label>
                          <select value={quizConfig.count} onChange={(e) => setQuizConfig({...quizConfig, count: Number(e.target.value)})} className="bg-stone-100 border-none rounded-2xl px-4 py-3 font-semibold text-stone-700 outline-none">
                            <option value={3}>3 Questions</option>
                            <option value={5}>5 Questions</option>
                            <option value={10}>10 Questions</option>
                          </select>
                        </div>
                        <button onClick={() => loadQuiz()} disabled={quizLoading} className="px-8 py-3 bg-[#5C715E] text-white rounded-full font-bold hover:bg-[#4A5C4B] disabled:opacity-50">
                          {quizLoading ? 'Generating...' : '+ Start Custom Quiz'}
                        </button>
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-stone-800 mb-4">Past Quizzes</h2>
                    {pastQuizzes.length === 0 ? <p className="text-stone-400">No quizzes taken yet.</p> : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pastQuizzes.map((pq) => (
                          <div key={pq.id} onClick={() => setViewingPastQuiz(pq)} className="bg-[#FDFBF7] border border-stone-200 rounded-2xl p-6 cursor-pointer hover:border-[#D97757] transition">
                            <h4 className="font-bold text-stone-800 uppercase text-xs tracking-widest mb-2">{pq.type === 'mcq' ? 'Multiple Choice' : 'Written Answer'}</h4>
                            <p className="text-sm text-stone-500 mb-3">Total Questions: {pq.total}</p>
                            {pq.type === 'mcq' && <div className="text-xs font-bold px-3 py-1 bg-green-100 text-green-700 rounded-full inline-block">Score: {pq.score}/{pq.total}</div>}
                            <p className="text-[10px] text-stone-400 mt-4 uppercase tracking-wider">{new Date(pq.createdAt).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {quiz.length > 0 && (
                  <div className="space-y-8">
                    <div className="flex justify-between items-center bg-[#FDFBF7] border border-stone-200 p-4 rounded-2xl">
                      <h2 className="font-bold text-stone-800 ml-4">Quiz in Progress</h2>
                      <button onClick={finishAndSaveQuiz} className="px-6 py-2 bg-[#D97757] text-white rounded-full font-bold text-sm">💾 Submit & Grade</button>
                    </div>
                    {quiz.map((q, idx) => (
                      <div key={idx} className="bg-[#FDFBF7] border border-stone-200 rounded-3xl p-8">
                        <h3 className="text-lg font-bold text-stone-800 mb-6 leading-relaxed">{idx + 1}. {q.question}</h3>
                        {quizConfig.type === 'mcq' ? (
                          <div className="space-y-3">
                            {q.options?.map((opt: string, oIdx: number) => {
                              const isSelected = selectedAnswers[idx] === opt;
                              return <button key={oIdx} onClick={() => setSelectedAnswers(prev => ({...prev, [idx]: opt}))} className={`w-full text-left p-4 rounded-2xl font-medium transition-colors ${isSelected ? 'bg-[#5C715E] text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'}`}>{opt}</button>
                            })}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <textarea onChange={(e) => setSelectedAnswers(prev => ({...prev, [idx]: e.target.value}))} value={selectedAnswers[idx] || ''} placeholder="Type your answer here..." className="w-full h-32 bg-stone-100 border-none rounded-2xl p-6 outline-none focus:ring-2 focus:ring-[#D97757]"></textarea>
                            <button onClick={() => setRevealedAnswers(p => ({...p, [idx]: true}))} className="px-6 py-2 bg-stone-200 font-bold text-xs rounded-full hover:bg-stone-300">Reveal Model Answer</button>
                          </div>
                        )}
                        {revealedAnswers[idx] && quizConfig.type !== 'mcq' && (
                          <div className="mt-6 p-6 rounded-2xl bg-stone-100 border border-stone-200">
                            <p className="font-bold text-stone-800 mb-2">Ideal Answer: <span className="font-normal text-stone-600">{q.answer}</span></p>
                            <p className="font-bold text-stone-800">Explanation: <span className="font-normal text-stone-600">{q.explanation}</span></p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {viewingPastQuiz && (
                  <div className="space-y-8">
                    <button onClick={() => setViewingPastQuiz(null)} className="font-bold text-stone-500 hover:text-stone-800 text-sm">← Back to Menu</button>
                    <h2 className="text-3xl font-bold text-stone-800 tracking-tight">Quiz Results</h2>
                    {JSON.parse(viewingPastQuiz.quizData).questions.map((q: any, idx: number) => {
                      const savedAnswers = JSON.parse(viewingPastQuiz.quizData).answers || {};
                      return (
                        <div key={idx} className="bg-[#FDFBF7] border border-stone-200 rounded-3xl p-8">
                          <h3 className="text-lg font-bold text-stone-800 mb-6">{idx + 1}. {q.question}</h3>
                          {viewingPastQuiz.type === 'mcq' ? (
                            <div className="space-y-3">
                              {q.options?.map((opt: string, oIdx: number) => {
                                const isSelected = savedAnswers[idx] === opt;
                                const isCorrect = opt === q.answer;
                                let style = "bg-stone-50 opacity-50 text-stone-500";
                                if (isCorrect) style = "bg-[#8A9A86]/20 border border-[#8A9A86] text-[#4A5C4B]";
                                else if (isSelected) style = "bg-red-50 border border-red-200 text-red-700";
                                return <div key={oIdx} className={`w-full p-4 rounded-2xl font-medium ${style}`}>{opt}</div>
                              })}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="w-full bg-stone-100 rounded-2xl p-6 text-stone-600 italic">{savedAnswers[idx] || 'No answer provided.'}</div>
                              <div className="mt-6 p-6 rounded-2xl bg-stone-50 border border-stone-200">
                                <p className="font-bold text-stone-800 mb-2">Ideal Answer: <span className="font-normal text-stone-600">{q.answer}</span></p>
                                <p className="font-bold text-stone-800">Explanation: <span className="font-normal text-stone-600">{q.explanation}</span></p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'pal' && <EmbeddedChat folderId={folderId} persona="Pal"/>}
            {activeTab === 'vm' && <EmbeddedChat folderId={folderId} persona="VM"/>}
          </div>
        </div>
      </div>
    </>
  );
}
