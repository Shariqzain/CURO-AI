'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ResultsDashboard from './ResultsDashboard';
import HistorySidebar from './HistorySidebar';
import { Send, Activity, Sparkles, Brain, Search, BookOpen, FlaskConical, History, LogOut, Mic, MicOff, ChevronDown, ChevronUp, UserSquare2, RefreshCw, FolderOpen, Database } from 'lucide-react';
import VoiceVisualizer from './VoiceVisualizer';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

interface AnalysisResult {
  response: string;
  extracted_ddx: string[];
  winning_diagnosis: string;
  abstracts: Array<{ title: string; abstract: string; url?: string }>;
  graph_data: {
    nodes: Array<{ id: string; label: string; fx?: number; fy?: number }>;
    links: Array<{ source: string; target: string; label: string }>;
  };
}

const PIPELINE_STEPS = [
  { label: 'Extracting clinical entities…', icon: Brain, duration: 4000 },
  { label: 'Retrieving medical literature…', icon: Search, duration: 8000 },
  { label: 'Building knowledge graph…', icon: FlaskConical, duration: 6000 },
  { label: 'Synthesizing clinical analysis…', icon: Sparkles, duration: 12000 },
];



export default function ChatInterface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);
  
  // Demographics state
  const [isVitalsOpen, setIsVitalsOpen] = useState(false);
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('Not specified');
  const [heartRate, setHeartRate] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temp, setTemp] = useState('');
  const [respRate, setRespRate] = useState('');

  // Speech Recognition state
  const [isRecording, setIsRecording] = useState(false);
  
  // Health Records state
  const [recordsCount, setRecordsCount] = useState(0);

  // Auto-run analysis if query param 'q' is provided (from triage page)
  const [autoRunDone, setAutoRunDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pipelineInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Recording & ASR state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);

  // Fetch health records count
  useEffect(() => {
    const fetchRecordsCount = async () => {
      if (!auth.currentUser) return;
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/records/list?user_id=${encodeURIComponent(auth.currentUser.uid)}`);
        if (res.ok) {
          const data = await res.json();
          setRecordsCount(data.total_chunks || 0);
        }
      } catch { /* silent */ }
    };
    fetchRecordsCount();
  }, []);

  const encodeWAV = (samples: Float32Array, sampleRate: number) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsRecording(true);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      // Load the worklet from the public folder
      await audioContext.audioWorklet.addModule('/audio-processor.js');
      
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
      workletNodeRef.current = workletNode;
      
      audioChunksRef.current = [];
      
      workletNode.port.onmessage = (e) => {
        audioChunksRef.current.push(new Float32Array(e.data));
      };
      
      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
    } catch (err) {
      console.error("Recording error:", err);
      setError("Could not access microphone.");
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    
    setIsRecording(false);
    setIsTranscribing(true);
    
    // Stop tracks
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
    
    // Disconnect worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Merge chunks
    const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const mergedSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    if (totalLength === 0) {
      setIsTranscribing(false);
      return;
    }

    const wavBlob = encodeWAV(mergedSamples, 16000);
    
    try {
      const formData = new FormData();
      formData.append('file', wavBlob, 'audio.wav');
      
      const response = await fetch('http://localhost:8000/api/asr', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('ASR server error');
      
      const data = await response.json();
      if (data.transcript) {
        setQuery(prev => (prev.trim() + ' ' + data.transcript).trim());
      }
    } catch (err) {
      console.error("ASR error:", err);
      setError("Speech transcription failed. Please try typing.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [query]);

  // Pipeline animation
  useEffect(() => {
    if (loading) {
      setPipelineStep(0);
      let step = 0;
      const advance = () => {
        step++;
        if (step < PIPELINE_STEPS.length) {
          setPipelineStep(step);
          pipelineInterval.current = setTimeout(advance, PIPELINE_STEPS[step].duration);
        }
      };
      pipelineInterval.current = setTimeout(advance, PIPELINE_STEPS[0].duration);
    } else {
      if (pipelineInterval.current) clearTimeout(pipelineInterval.current);
    }
    return () => {
      if (pipelineInterval.current) clearTimeout(pipelineInterval.current);
    };
  }, [loading]);

  const runAnalysis = async (targetQuery: string) => {
    if (!targetQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const payload = {
        query: targetQuery,
        demography: {
          age: age || undefined,
          sex: sex !== 'Not specified' ? sex : undefined,
          heartRate: heartRate || undefined,
          bloodPressure: bloodPressure || undefined,
          spo2: spo2 || undefined,
          temp: temp || undefined,
          respRate: respRate || undefined
        },
        user_id: auth.currentUser?.uid || undefined
      };

      const response = await fetch('http://127.0.0.1:8000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Analysis failed (${response.status})`);
      }

      const data = await response.json();
      setResult(data);

      try {
        if (auth.currentUser && data.winning_diagnosis) {
          const docRef = await addDoc(collection(db, 'sessions'), {
            userId: auth.currentUser.uid,
            query: targetQuery,
            winning_diagnosis: data.winning_diagnosis,
            result_data: data,
            messages: [],
            timestamp: serverTimestamp()
          });
          setCurrentSessionId(docRef.id);
        }
      } catch (fbErr) {
        console.error('Failed to save session to Firestore', fbErr);
      }

    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setError('Analysis timed out. The backend may be overloaded — please try again.');
      } else if (err.message === 'Failed to fetch') {
        setError('Cannot reach the backend server. Make sure the backend is running on port 8000 (cd backend && python main.py).');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    runAnalysis(query);
  };

  const handleNewQuery = () => {
    setResult(null);
    setError(null);
    setLoading(false);
    setQuery('');
    setIsHistoryView(false);
    setAge('');
    setSex('Not specified');
    setHeartRate('');
    setBloodPressure('');
    setSpo2('');
    setTemp('');
    setRespRate('');
  };

  // Auto-run analysis if coming from Triage Assistant with query param
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !autoRunDone) {
      setQuery(q);
      setAutoRunDone(true);
      // Small delay so UI renders the query first
      setTimeout(() => runAnalysis(q), 500);
    }
  }, [searchParams, autoRunDone]);

  // ─── RESULTS VIEW ──────────────────
  if (result) {
    return (
      <div className="min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 glass-card-strong border-t-0 border-x-0 rounded-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-curo-accent to-curo-teal flex items-center justify-center">
                  <Activity size={18} className="text-white" />
                </div>
                <h1 onClick={() => router.push('/')} className="text-lg font-bold gradient-text cursor-pointer hover:opacity-80 transition-opacity" title="Back to Home">CURO AI</h1>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-curo-border bg-white/[0.02] hover:bg-white/[0.05] text-sm text-curo-text-muted hover:text-curo-text transition-colors">
                  <History size={16} /> History
                </button>
                <button
                  type="button"
                  onClick={handleNewQuery}
                  className="curo-pill curo-pill-active cursor-pointer hover:scale-105 transition-transform"
                >
                  <Sparkles size={14} />
                  New Analysis
                </button>
                <button onClick={() => signOut(auth)} className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-curo-rose/10 text-curo-rose hover:bg-curo-rose/20 transition-colors" title="Sign Out">
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ResultsDashboard 
            result={result} 
            sessionId={currentSessionId}
            userQuery={query}
            userId={auth.currentUser?.uid}
            initialMessages={initialMessages}
            isHistoryView={isHistoryView}
            onBack={handleNewQuery} 
            onNodeClick={(label) => {
              setQuery(label);
              runAnalysis(label);
            }} 
          />
        </main>

        <HistorySidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          onSelectHistory={(data, pastQuery, id, pastMessages) => {
            setQuery(pastQuery);
            setResult(data);
            setCurrentSessionId(id);
            setInitialMessages(pastMessages || []);
            setIsHistoryView(true);
          }} 
        />
      </div>
    );
  }

  // ─── LANDING VIEW ──────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card-strong border-t-0 border-x-0 rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-curo-accent to-curo-teal flex items-center justify-center">
                <Activity size={18} className="text-white" />
              </div>
              <h1 onClick={() => router.push('/')} className="text-lg font-bold gradient-text cursor-pointer hover:opacity-80 transition-opacity" title="Back to Home">CURO AI</h1>
              <span className="hidden sm:inline-block text-xs text-curo-text-dim ml-2 border border-curo-border rounded-full px-2.5 py-0.5">
                Clinical RAG Engine
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/records')} className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-curo-teal/20 bg-curo-teal/5 hover:bg-curo-teal/10 text-sm text-curo-teal transition-colors">
                <FolderOpen size={16} /> Health Records
                {recordsCount > 0 && <span className="text-[10px] bg-curo-teal/20 px-1.5 py-0.5 rounded-full">{recordsCount}</span>}
              </button>
              <button onClick={() => router.push('/triage')} className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-curo-accent/20 bg-curo-accent/5 hover:bg-curo-accent/10 text-sm text-curo-accent transition-colors">
                <Brain size={16} /> Curo Assistant
              </button>
              <button onClick={() => setIsSidebarOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-curo-border bg-white/[0.02] hover:bg-white/[0.05] text-sm text-curo-text-muted hover:text-curo-text transition-colors">
                <History size={16} /> History
              </button>
              <button onClick={() => router.push('/')} className="flex items-center justify-center w-8 h-8 rounded-lg bg-curo-rose/10 text-curo-rose hover:bg-curo-rose/20 transition-colors" title="Home">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-8 animate-fade-in">
          {/* Title */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 curo-pill curo-pill-active mb-4">
              <FlaskConical size={14} />
              <span>Evidence-Based Clinical Analysis</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-curo-text leading-tight">
              Describe your{' '}
              <span className="gradient-text">symptoms</span>
            </h2>
            <p className="text-curo-text-muted text-sm sm:text-base max-w-lg mx-auto">
              CURO analyzes your symptoms against medical literature 
              and builds a clinical knowledge graph for evidence-based insights.
            </p>
          </div>

          {/* Input Card */}
          <div className="glass-card p-6 sm:p-8 animate-pulse-glow">
            
            {/* Vitals Accordion */}
            <div className="mb-6 rounded-xl border border-curo-border bg-white/[0.02] overflow-hidden transition-all">
              <button 
                onClick={() => setIsVitalsOpen(!isVitalsOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                type="button"
              >
                <div className="flex items-center gap-2 text-curo-text">
                  <UserSquare2 size={18} className="text-curo-accent" />
                  <span className="font-medium text-sm">Patient Demographics & Vitals (Optional)</span>
                </div>
                {isVitalsOpen ? <ChevronUp size={16} className="text-curo-text-dim" /> : <ChevronDown size={16} className="text-curo-text-dim" />}
              </button>
              
              {isVitalsOpen && (
                <div className="p-4 border-t border-curo-border grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-curo-text-muted mb-1">Age</label>
                    <input type="number" placeholder="e.g. 65" className="w-full bg-transparent border border-curo-border rounded-lg p-2 text-sm text-curo-text focus:border-curo-accent outline-none" value={age} onChange={e => setAge(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-curo-text-muted mb-1">Sex</label>
                    <select className="w-full bg-[#0d1221] border border-curo-border rounded-lg p-2 text-sm text-curo-text focus:border-curo-accent outline-none appearance-none" value={sex} onChange={e => setSex(e.target.value)}>
                      <option>Not specified</option>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-curo-text-muted mb-1">Heart Rate (bpm)</label>
                    <input type="number" placeholder="e.g. 110" className="w-full bg-transparent border border-curo-border rounded-lg p-2 text-sm text-curo-text focus:border-curo-accent outline-none" value={heartRate} onChange={e => setHeartRate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-curo-text-muted mb-1">BP (mmHg)</label>
                    <input type="text" placeholder="e.g. 140/90" className="w-full bg-transparent border border-curo-border rounded-lg p-2 text-sm text-curo-text focus:border-curo-accent outline-none" value={bloodPressure} onChange={e => setBloodPressure(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-curo-text-muted mb-1">SpO2 (%)</label>
                    <input type="number" placeholder="e.g. 98" className="w-full bg-transparent border border-curo-border rounded-lg p-2 text-sm text-curo-text focus:border-curo-accent outline-none" value={spo2} onChange={e => setSpo2(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-curo-text-muted mb-1">Temp (°C)</label>
                    <input type="number" step="0.1" placeholder="e.g. 37.2" className="w-full bg-transparent border border-curo-border rounded-lg p-2 text-sm text-curo-text focus:border-curo-accent outline-none" value={temp} onChange={e => setTemp(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-curo-text-muted mb-1">Resp. Rate</label>
                    <input type="number" placeholder="e.g. 18" className="w-full bg-transparent border border-curo-border rounded-lg p-2 text-sm text-curo-text focus:border-curo-accent outline-none" value={respRate} onChange={e => setRespRate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Health Records Indicator */}
              {recordsCount > 0 && (
                <div className="flex items-center gap-2 mb-2 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => router.push('/records')}
                    className="flex items-center gap-2 bg-curo-teal/10 border border-curo-teal/30 rounded-lg px-3 py-1.5 hover:bg-curo-teal/20 transition-colors"
                  >
                    <Database size={14} className="text-curo-teal" />
                    <span className="text-xs font-medium text-curo-teal">{recordsCount} health record chunks indexed</span>
                  </button>
                </div>
              )}

              <div className="relative">
                {isRecording && (
                  <div className="absolute top-2 left-0 right-0 z-10">
                    <VoiceVisualizer isRecording={isRecording} stream={audioStream} />
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`curo-input resize-none min-h-[120px] pb-12 transition-all duration-300 ${isRecording ? 'pt-10 ring-2 ring-curo-accent/30' : ''}`}
                  placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing clinical audio..." : "e.g. I have been experiencing persistent headaches, blurred vision, and neck stiffness for the past two weeks..."}
                  required
                  disabled={loading || isTranscribing}
                  rows={4}
                />
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={loading || isTranscribing}
                  className={`absolute bottom-3 left-3 p-2 rounded-lg transition-colors flex items-center justify-center z-20 ${isRecording ? 'bg-curo-rose/20 text-curo-rose animate-pulse' : 'bg-curo-bg/50 text-curo-text-dim hover:text-curo-accent'}`}
                  title={isRecording ? 'Stop Recording' : 'Start Voice Dictation'}
                >
                  {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-curo-rose/10 border border-curo-rose/30 text-curo-rose text-sm animate-fade-in">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <div>
                    <p className="font-medium">Analysis Failed</p>
                    <p className="text-curo-rose/80 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Loading Pipeline */}
              {loading && (
                <div className="space-y-2 animate-fade-in">
                  {PIPELINE_STEPS.map((step, i) => {
                    const StepIcon = step.icon;
                    const isActive = i === pipelineStep;
                    const isDone = i < pipelineStep;
                    return (
                      <div
                        key={i}
                        className={`pipeline-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                      >
                        <div className={`pipeline-dot ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`} />
                        <StepIcon size={16} className={isActive ? 'text-curo-accent' : isDone ? 'text-curo-teal' : 'text-curo-text-dim'} />
                        <span className={`text-sm ${isActive ? 'text-curo-accent font-medium' : isDone ? 'text-curo-teal' : 'text-curo-text-dim'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                  {/* Progress bar */}
                  <div className="mt-3 h-1 rounded-full bg-curo-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-curo-accent to-curo-teal transition-all duration-1000 ease-out"
                      style={{ width: `${((pipelineStep + 1) / PIPELINE_STEPS.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="glow-btn w-full flex items-center justify-center gap-2.5 text-base"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing…</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Analyze Symptoms</span>
                  </>
                )}
              </button>
            </form>
          </div>


          {!loading && !query && (
            <div className="text-center mt-8 animate-fade-in">
              <button 
                onClick={() => router.push('/triage')}
                className="curo-pill border-curo-accent/30 text-curo-accent hover:bg-curo-accent/10 px-6 py-2"
              >
                <Brain size={14} className="mr-2" /> Try Curo Assistant Instead
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-curo-text-dim">
        <p>CURO AI is not a substitute for professional medical advice.</p>
      </footer>
      {/* History Sidebar overlay logic for landing page too */}
      <HistorySidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onSelectHistory={(data, pastQuery) => {
          setQuery(pastQuery);
          setResult(data);
        }} 
      />
    </div>
  );
}