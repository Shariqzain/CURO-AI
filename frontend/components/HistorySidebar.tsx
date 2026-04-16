'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, limit, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { History, ChevronRight, Search, Activity, Stethoscope, Trash2 } from 'lucide-react';

interface HistoryItem {
  id: string;
  query: string;
  winning_diagnosis: string;
  timestamp: any;
  result_data: any;
  messages: Array<{role: 'user' | 'assistant', content: string}>;
}

export default function HistorySidebar({
  isOpen,
  onClose,
  onSelectHistory
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectHistory: (data: any, query: string, id: string, messages: any[]) => void;
}) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'sessions'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as HistoryItem[];
        setHistory(records);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch history:", err);
        if (err.code === 'permission-denied') {
          setError("Firestore access denied. Please check your Security Rules in the Firebase Console to allow clinical data access.");
        } else if (err.code === 'failed-precondition') {
          setError("Database index required. Please check your browser console (F12) and click the Firebase link to enable history sorting.");
        } else if (err.message?.includes('blocked')) {
          setError("Clinical data blocked. Please disable ad-blockers for this site.");
        } else {
          setError("Offline or connection lost. Check your clinical network.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'sessions', id));
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error("Failed to delete chat session:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      
      <div className="fixed top-0 right-0 w-full sm:w-96 h-full glass-card-strong border-r-0 border-t-0 border-b-0 rounded-none z-50 transform transition-transform duration-300 shadow-2xl flex flex-col">
        <div className="p-6 border-b border-curo-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-curo-purple/20 flex items-center justify-center">
              <History size={16} className="text-curo-purple" />
            </div>
            <h2 className="text-lg font-bold text-curo-text">Case History</h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-curo-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-curo-text-dim">
              <div className="w-5 h-5 rounded-full bg-curo-purple animate-pulse"></div>
              <p className="text-sm">Loading history…</p>
            </div>
          ) : error ? (
            <div className="text-center mt-10 p-6 rounded-xl border border-curo-rose/20 bg-curo-rose/5">
              <Activity size={32} className="mx-auto mb-3 text-curo-rose opacity-50" />
              <p className="text-sm text-curo-rose font-medium mb-1">Connection Blocked</p>
              <p className="text-xs text-curo-rose/70 leading-relaxed">
                {error}
              </p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center mt-10 text-curo-text-muted">
              <Activity size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No clinical history found.</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="relative group block w-full"
              >
                <button
                  onClick={() => {
                    onSelectHistory(item.result_data, item.query, item.id, item.messages || []);
                    onClose();
                  }}
                  className="w-full text-left p-4 rounded-xl border border-curo-border bg-white/[0.02] hover:bg-white/[0.05] hover:border-curo-purple/30 transition-all"
                >
                  <div className="flex items-start gap-3 pr-8">
                    <Search size={14} className="mt-1 shrink-0 text-curo-text-dim group-hover:text-curo-purple transition-colors" />
                    <div>
                      <p className="text-sm text-curo-text font-medium line-clamp-2 leading-snug mb-2">
                        "{item.query}"
                      </p>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Stethoscope size={12} className={item.winning_diagnosis === 'None' ? 'text-curo-text-dim' : 'text-curo-accent'} />
                        <span className={item.winning_diagnosis === 'None' ? 'text-curo-text-dim' : 'text-curo-accent font-medium'}>
                          {item.winning_diagnosis}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(item.id, e)}
                  title="Delete Session"
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-curo-text-dim/50 hover:text-white hover:bg-curo-rose transition-all opacity-0 group-hover:opacity-100 z-10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
