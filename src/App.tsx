import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  Zap, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  RefreshCcw, 
  Terminal,
  Target,
  ShieldAlert,
  Copy,
  Check,
  Plus,
  Trash2,
  GripVertical,
  Star,
  CreditCard,
  X,
  Mic,
  MicOff,
  Undo2,
  MessageSquare,
  Send,
  Calendar
} from 'lucide-react';
import { getCoachingResponse, CoachResponse } from './services/geminiService';

const BOTTLENECK_COLORS = {
  laziness: 'text-orange-500',
  fear: 'text-red-500',
  confusion: 'text-blue-500',
  clarity: 'text-purple-500',
  distraction: 'text-yellow-500'
};

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  urgent?: boolean;
  dueDate?: string;
}

function Tooltip({ text, children, position = 'top' }: { text: string; children: React.ReactNode; position?: 'top' | 'bottom' | 'left' | 'right'; key?: React.Key }) {
  const positions = {
    top: '-top-10 left-1/2 -translate-x-1/2',
    bottom: '-bottom-10 left-1/2 -translate-x-1/2',
    left: 'top-1/2 -right-full translate-x-4 -translate-y-1/2',
    right: 'top-1/2 -left-full -translate-x-4 -translate-y-1/2'
  };

  return (
    <div className="relative group/tooltip">
      {children}
      <div className={`absolute ${positions[position]} hidden group-hover/tooltip:block bg-brand-black border border-white/20 px-2 py-1 rounded-sm text-[8px] font-black uppercase tracking-widest text-white whitespace-nowrap z-[100] pointer-events-none shadow-2xl`}>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 bg-brand-red animate-pulse" />
          {text}
        </div>
        <div className={`absolute w-1.5 h-1.5 bg-brand-black border-r border-b border-white/20 rotate-45 ${
          position === 'top' ? '-bottom-[4px] left-1/2 -translate-x-1/2' :
          position === 'bottom' ? '-top-[4px] left-1/2 -translate-x-1/2' :
          position === 'left' ? 'top-1/2 -right-[4px] -translate-y-1/2' :
          'top-1/2 -left-[4px] -translate-y-1/2'
        }`} />
      </div>
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [taskList, setTaskList] = useState<TaskItem[]>(() => {
    const saved = localStorage.getItem('elite-execution-tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>(() => {
    const saved = localStorage.getItem('elite-execution-filter');
    return (saved === 'all' || saved === 'active' || saved === 'completed') ? saved : 'all';
  });
  const [newTask, setNewTask] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [sortBy, setSortBy] = useState<'manual' | 'dueDate' | 'priority'>('manual');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [response, setResponse] = useState<CoachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPremium, setIsPremium] = useState(() => {
    return localStorage.getItem('elite-execution-premium') === 'true';
  });
  const [diagnosesCount, setDiagnosesCount] = useState(() => {
    const saved = localStorage.getItem('elite-execution-diagnoses-count');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [undoState, setUndoState] = useState<{ previousList: TaskItem[], message: string } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('elite-execution-onboarding-seen');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('elite-execution-onboarding-seen', 'true');
    setShowOnboarding(false);
  };

  useEffect(() => {
    localStorage.setItem('elite-execution-tasks', JSON.stringify(taskList));
  }, [taskList]);

  useEffect(() => {
    localStorage.setItem('elite-execution-premium', isPremium.toString());
  }, [isPremium]);

  useEffect(() => {
    localStorage.setItem('elite-execution-diagnoses-count', diagnosesCount.toString());
  }, [diagnosesCount]);

  useEffect(() => {
    localStorage.setItem('elite-execution-filter', filter);
  }, [filter]);

  const saveForUndo = (message: string) => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoState({ previousList: [...taskList], message });
    undoTimeoutRef.current = setTimeout(() => setUndoState(null), 5000);
  };

  const undo = () => {
    if (undoState) {
      setTaskList(undoState.previousList);
      setUndoState(null);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    }
  };

  const handleDiagnose = async () => {
    if (!input.trim() || taskList.length === 0) return;

    // Soft paywall after 1 diagnosis for demonstration
    if (!isPremium && diagnosesCount >= 3) {
      setShowPaywall(true);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResponse(null);

    try {
      const taskString = taskList.filter(t => !t.completed).map(t => t.text).join('\n');
      if (!taskString) {
        throw new Error("No pending tasks to analyze. All tasks are marked complete.");
      }
      const data = await getCoachingResponse(input, taskString);
      setResponse(data);
      
      // Robust time parsing
      const hMatch = data.timeConstraint.match(/(\d+)\s*h/i);
      const mMatch = data.timeConstraint.match(/(\d+)\s*m/i);
      const sMatch = data.timeConstraint.match(/(\d+)\s*s/i);
      
      let totalSeconds = 0;
      if (hMatch) totalSeconds += parseInt(hMatch[1]) * 3600;
      if (mMatch) totalSeconds += parseInt(mMatch[1]) * 60;
      if (sMatch) totalSeconds += parseInt(sMatch[1]);
      
      if (totalSeconds === 0) {
        const fullMinMatch = data.timeConstraint.match(/(\d+)\s*min/i);
        if (fullMinMatch) totalSeconds = parseInt(fullMinMatch[1]) * 60;
      }

      if (totalSeconds > 0) {
        setTimeLeft(totalSeconds);
        setTotalTime(totalSeconds);
      } else {
        setTimeLeft(data.timeConstraint.match(/0/) ? 0 : null);
        setTotalTime(null);
      }
      
      setDiagnosesCount(prev => prev + 1);
    } catch (err: any) {
      setError(err?.message || 'Communication failure. Try again.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    saveForUndo("Objective Added");
    setTaskList([...taskList, { 
      id: Math.random().toString(36).substr(2, 9), 
      text: newTask.trim(), 
      completed: false,
      priority: newPriority,
      urgent: isUrgent,
      dueDate: newDueDate || undefined
    }]);
    setNewTask('');
    setNewPriority('medium');
    setIsUrgent(false);
    setNewDueDate('');
  };

  const removeTask = (id: string) => {
    saveForUndo("Objective Removed");
    setTaskList(taskList.filter(t => t.id !== id));
  };

  const toggleTask = (id: string) => {
    saveForUndo("Status Changed");
    setTaskList(taskList.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleTaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey || !e.shiftKey) {
        e.preventDefault();
        addTask();
      }
    }
  };

  const handleSituationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleDiagnose();
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL + C to copy if response is active and no text is selected
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && response) {
        const selection = window.getSelection()?.toString();
        if (!selection) {
          e.preventDefault();
          handleCopy();
        }
      }

      // CMD/CTRL + ENTER to diagnose if on input screen, or copy/reset if on response screen
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!response) {
          handleDiagnose();
        } else {
          handleCopy();
        }
      }

      // ESC to go back/reset
      if (e.key === 'Escape') {
        if (showPaywall) {
          setShowPaywall(false);
        } else if (response) {
          reset();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [response, showPaywall, taskList, input]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || !response) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [response, timeLeft !== null && timeLeft > 0]);

  const reset = () => {
    setResponse(null);
    setInput('');
    setTaskList([]);
    setNewTask('');
    setTimeLeft(null);
    setIsCopied(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.exactAction);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser does not support Speech Recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.start();
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setIsSubmittingFeedback(true);
    try {
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, userId: isPremium ? 'premium-user' : 'trial-user' }),
      });
      if (resp.ok) {
        setFeedbackSuccess(true);
        setFeedback('');
        setTimeout(() => {
          setFeedbackSuccess(false);
          setShowFeedback(false);
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const completedCount = taskList.filter(t => t.completed).length;
  
  const sortedTasks = [...taskList].sort((a, b) => {
    if (sortBy === 'priority') {
      const pMap = { high: 3, medium: 2, low: 1 };
      const priorityDiff = pMap[b.priority] - pMap[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
    }
    if (sortBy === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0;
  });

  const filteredTasks = (sortBy === 'manual' ? taskList : sortedTasks).filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  const onboardingSteps = [
    {
      title: "Welcome to HQ",
      description: "Elite Execution is a tactical dashboard designed to break paralysis. Let's configure your current mission.",
      target: null
    },
    {
      title: "1. Capture Situation",
      description: "Be brutally honest. Describe your current mental state or environment in the SITREP terminal.",
      target: "situation-input"
    },
    {
      title: "2. Define Objectives",
      description: "Add specific tasks you're avoiding. Break them down into small, executable chunks.",
      target: "objective-input"
    },
    {
      title: "3. Triage Priority",
      description: "Set the urgency for each task. High-priority tasks are visually flagged in the stack.",
      target: "triage-controls"
    },
    {
      title: "4. Execute Analysis",
      description: "When ready, engage the AI for a ruthless diagnosis and your exact starting directive.",
      target: "execute-button"
    },
    {
      title: "Priority Access",
      description: "Standard users get limited daily pings. Upgrade here for unlimited high-frequency execution.",
      target: "premium-button"
    }
  ];

  const getSpotlightClass = (target: string) => {
    if (!showOnboarding) return "";
    return onboardingSteps[onboardingStep].target === target 
      ? "relative z-[110] outline outline-[2px] outline-brand-red outline-offset-4 glow-red shadow-[0_0_30px_rgba(255,51,68,0.4)]" 
      : "transition-opacity duration-500 opacity-20 grayscale scale-[0.98]";
  };

  return (
    <div className="relative min-h-screen bg-brand-black flex flex-col font-mono text-gray-200 overflow-hidden">
      <div className="scanline absolute inset-0 z-50 pointer-events-none opacity-50" />
      
      {/* Onboarding Overlay */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-brand-black/80 backdrop-blur-sm pointer-events-auto" onClick={completeOnboarding} />
            
            {/* Step Card */}
            <motion.div
              key={onboardingStep}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="relative w-full max-w-sm bg-brand-gray border border-brand-red/30 p-8 space-y-6 pointer-events-auto shadow-[0_0_50px_rgba(255,51,68,0.15)]"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-[10px] text-brand-red font-bold uppercase tracking-[0.2em]">Module Tutorial</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{onboardingStep + 1} / {onboardingSteps.length}</div>
                </div>
                <h3 className="text-2xl font-display uppercase italic italic">{onboardingSteps[onboardingStep].title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed uppercase font-bold tracking-tight">
                  {onboardingSteps[onboardingStep].description}
                </p>
              </div>

              <div className="flex gap-2">
                {onboardingStep > 0 && (
                  <button
                    onClick={() => setOnboardingStep(prev => prev - 1)}
                    className="flex-1 border border-white/10 py-3 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/5 transition-all"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => {
                    if (onboardingStep < onboardingSteps.length - 1) {
                      setOnboardingStep(prev => prev + 1);
                    } else {
                      completeOnboarding();
                    }
                  }}
                  className="flex-[2] bg-brand-red text-black py-3 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-red-600 transition-all shadow-[0_0_20px_rgba(255,51,68,0.3)]"
                >
                  {onboardingStep === onboardingSteps.length - 1 ? 'Begin Operation' : 'Continue'}
                </button>
              </div>

              <button
                onClick={completeOnboarding}
                className="w-full text-[8px] text-gray-600 hover:text-gray-400 uppercase tracking-widest transition-colors font-bold"
              >
                Skip Walkthrough
              </button>

              {/* Indicator pulse for targets could go here if we used refs, but manual is safer for now */}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-5">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-brand-red rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-red rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-40 border-b border-white/10 bg-brand-black/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-red flex items-center justify-center rounded-sm">
            <Zap className="w-5 h-5 text-black fill-current" />
          </div>
          <h1 className="text-sm font-bold tracking-[0.2em] uppercase">Elite Execution</h1>
          {isPremium && (
            <div className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 text-[8px] px-1.5 py-0.5 font-bold uppercase tracking-widest rounded-sm flex items-center gap-1">
              <Star className="w-2 h-2 fill-current" /> Premium
            </div>
          )}
        </div>
        <div className="flex items-center gap-6">
          {isPremium ? (
            <Tooltip text={showPaywall ? "Return to main dashboard" : "Manage your tier and billing"}>
              <button 
                onClick={() => setShowPaywall(!showPaywall)}
                className={`${showPaywall ? 'bg-brand-red text-black border-brand-red' : 'bg-brand-gray border-white/10 text-gray-400 hover:text-white'} border hover:border-white/30 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-black/20`}
              >
                <CreditCard className={`w-3 h-3 ${showPaywall ? 'animate-pulse' : ''}`} /> 
                {showPaywall ? 'Return to HQ' : 'Manage Subscription'}
              </button>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-[10px] hidden sm:block">
                <span className="text-gray-500 mr-2 italic tracking-tighter uppercase">Standard Trial Active</span>
              </div>
              <Tooltip text="Unlock unlimited execution coaching">
                <button 
                  onClick={() => setShowPaywall(true)}
                  className={`bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all transform active:scale-95 glow-yellow shadow-[0_0_15px_rgba(234,179,8,0.3)] flex items-center gap-2 ${getSpotlightClass('premium-button')}`}
                >
                  <Star className="w-3 h-3 fill-current" /> Upgrade to Premium
                </button>
              </Tooltip>
            </div>
          )}
          <div className="text-[10px] opacity-40 uppercase tracking-widest hidden lg:block">
            STATUS: {isPremium ? 'PRIORITY_ACCESS' : 'STANDARD_TRIAL'} // PERSISTENCE: ON
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 mt-16 max-w-5xl mx-auto w-full relative z-10">
        <AnimatePresence mode="wait">
          {showPaywall ? (
            <motion.div
              key="paywall"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="w-full max-w-2xl bg-brand-gray/80 backdrop-blur-xl terminal-border p-12 text-center space-y-8 relative overflow-hidden"
            >
              <Tooltip text="Return to HQ" position="left">
                <button 
                  onClick={() => setShowPaywall(false)}
                  className="absolute top-6 right-6 flex items-center gap-2 group/back"
                >
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover/back:text-white transition-colors opacity-0 group-hover/back:opacity-100 -translate-x-2 group-hover/back:translate-x-0 transition-all">Back to HQ</div>
                  <X className="w-6 h-6 opacity-40 group-hover/back:opacity-100 transition-opacity" />
                </button>
              </Tooltip>

              {isPremium ? (
                <div className="space-y-8">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-green-500/10 text-green-500 mx-auto rounded-full flex items-center justify-center mb-6">
                      <Star className="w-8 h-8 fill-current" />
                    </div>
                    <h2 className="text-5xl font-display uppercase tracking-tight italic">
                      Subscription <span className="text-green-500">Active</span>
                    </h2>
                    <p className="text-gray-400 max-w-sm mx-auto uppercase text-[10px] tracking-widest leading-loose">
                      System Status: Fully Authorized<br />
                      Priority: Highest<br />
                      Bandwidth: Unlimited
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { icon: <Target className="w-4 h-4" />, label: 'Unlimited Ops' },
                      { icon: <Zap className="w-4 h-4" />, label: 'Priority Proc' },
                      { icon: <Mic className="w-4 h-4" />, label: 'Voice Tier 1' }
                    ].map((feat, i) => (
                      <div key={i} className="p-4 bg-white/5 border border-white/10 flex flex-col items-center gap-2">
                        <div className="text-green-500">{feat.icon}</div>
                        <div className="text-[10px] font-bold uppercase tracking-tighter">{feat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-8 flex flex-col gap-3">
                    <Tooltip text="Examine previous transactions" position="bottom">
                      <button
                        className="w-full border border-white/10 py-3 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/5 transition-all"
                      >
                        View Billing History
                      </button>
                    </Tooltip>
                    <Tooltip text="Return to restricted standard tier" position="bottom">
                      <button
                        onClick={() => setIsPremium(false)}
                        className="w-full py-3 text-[10px] text-red-500/40 hover:text-red-500 font-bold uppercase tracking-[0.2em] transition-all"
                      >
                        Downgrade Account
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 mx-auto rounded-full flex items-center justify-center mb-6">
                      <Star className="w-8 h-8 fill-current" />
                    </div>
                    <h2 className="text-5xl font-display uppercase tracking-tight italic">
                      High-Frequency <span className="text-yellow-500">Premium</span>
                    </h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                      You are an elite individual. Standard tools aren't enough. Unlock the full weight of the coach's authority.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-white/5 border border-white/10 rounded-sm text-left">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Standard</div>
                      <div className="text-2xl font-bold mb-2 uppercase italic">Free Trial</div>
                      <ul className="text-xs space-y-2 text-gray-500">
                        <li>• 60 Days Duration</li>
                        <li>• Standard Diagnostics</li>
                        <li>• Basic Timer</li>
                      </ul>
                      <div className="mt-6 text-xl font-bold italic">$0 <span className="text-[10px] font-normal not-italic opacity-40">/ 2 MO</span></div>
                    </div>

                    <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-sm text-left relative">
                      <div className="absolute top-4 right-4 bg-yellow-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-sm">RECOMMENDED</div>
                      <div className="text-[10px] text-yellow-500 uppercase tracking-widest mb-1">Ultimate</div>
                      <div className="text-2xl font-bold mb-2 uppercase italic">Priority Access</div>
                      <ul className="text-xs space-y-2 text-gray-400">
                        <li>• Unlimited Diagnostics</li>
                        <li>• Ruthless Voice Engine (Soon)</li>
                        <li>• Priority Processing</li>
                      </ul>
                      <div className="mt-6 text-xl text-yellow-500 font-bold italic">$20 <span className="text-[10px] font-normal not-italic opacity-40">/ MONTH</span></div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsPremium(true);
                      setShowPaywall(false);
                    }}
                    className="w-full bg-brand-red py-4 text-xl font-bold uppercase hover:bg-red-600 transition-all transform active:scale-95 flex items-center justify-center gap-3 italic"
                  >
                    <CreditCard className="w-5 h-5" /> Start Priority Access
                  </button>
                  
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest italic">
                    No bullshit. Cancel anytime. Execution is mandatory.
                  </p>
                </>
              )}
            </motion.div>
          ) : !response ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-4xl md:text-6xl font-display uppercase leading-tight italic tracking-tighter">
                  Stop thinking.<br />
                  <span className="text-brand-red">Diagnose the rot.</span>
                </h2>
                <p className="text-sm text-gray-500 max-w-md">
                  State your situation and list your pending tasks. Prioritize by dragging.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative group">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">1. Situation</label>
                      <span className="text-[8px] text-gray-700 font-mono hidden sm:inline">[CMD+ENTER TO EXEC]</span>
                    </div>
                    <Tooltip text={isRecording ? "Stop recording" : "Dictate your situation (Speech-to-Text)"}>
                      <button
                        onClick={startRecording}
                        className={`flex items-center gap-1.5 text-[10px] uppercase font-bold transition-all px-2 py-1 rounded-sm ${
                          isRecording 
                          ? 'bg-brand-red text-black animate-pulse' 
                          : 'bg-brand-gray text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                      >
                        {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        {isRecording ? 'Listening...' : 'Voice Input'}
                      </button>
                    </Tooltip>
                  </div>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleSituationKeyDown}
                    placeholder="I've been doomscrolling for 3 hours and I feel paralyzed..."
                    className={`w-full h-[320px] bg-brand-gray/50 terminal-border p-4 text-lg focus:outline-none focus:border-brand-red/50 transition-colors resize-none placeholder:opacity-20 ${getSpotlightClass('situation-input')}`}
                  />
                </div>
                
                <div className="space-y-4 flex flex-col h-full">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">2. Prioritize Tasks</label>
                        <div className="flex items-center bg-brand-gray/50 p-0.5 rounded-sm border border-white/5">
                          {(['all', 'active', 'completed'] as const).map((f) => (
                            <Tooltip key={f} text={`Show ${f} objectives`}>
                              <button
                                onClick={() => setFilter(f)}
                                className={`text-[8px] uppercase px-2 py-1 rounded-sm transition-all ${
                                  filter === f 
                                    ? 'bg-brand-red text-black font-bold' 
                                    : 'text-gray-500 hover:text-white'
                                }`}
                              >
                                {f}
                              </button>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Sort By</label>
                        <div className="flex items-center bg-brand-gray/50 p-0.5 rounded-sm border border-white/5">
                          {(['manual', 'dueDate', 'priority'] as const).map((s) => (
                            <Tooltip key={s} text={`Sort by ${s === 'manual' ? 'manual order' : s === 'dueDate' ? 'due date' : 'priority rank'}`}>
                              <button
                                onClick={() => setSortBy(s)}
                                className={`text-[8px] uppercase px-2 py-1 rounded-sm transition-all ${
                                  sortBy === s 
                                    ? 'bg-brand-red text-black font-bold' 
                                    : 'text-gray-500 hover:text-white'
                                }`}
                              >
                                {s === 'manual' ? 'Order' : s === 'dueDate' ? 'Date' : 'Rank'}
                              </button>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-brand-red font-bold tabular-nums">
                      {completedCount} / {taskList.length} DONE
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className={`flex gap-2 ${getSpotlightClass('objective-input')}`}>
                      <Tooltip text="Describe a specific tactical objective" position="bottom">
                        <input
                          type="text"
                          value={newTask}
                          onChange={(e) => setNewTask(e.target.value)}
                          onKeyDown={handleTaskKeyDown}
                          placeholder="Add an objective..."
                          className="flex-1 bg-brand-gray/50 terminal-border px-4 py-2 text-sm focus:outline-none focus:border-brand-red/50 transition-colors placeholder:opacity-20"
                        />
                      </Tooltip>
                      <Tooltip text="Deploy objective to stack">
                        <button
                          onClick={addTask}
                          disabled={!newTask.trim()}
                          className="bg-gray-800 hover:bg-brand-red hover:text-black disabled:bg-gray-900 disabled:text-gray-700 px-4 transition-all terminal-border cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                    
                    <div className={`flex items-center gap-2 ${getSpotlightClass('triage-controls')}`}>
                      <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mr-1">Triage:</span>
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <Tooltip key={p} text={`Set ${p} priority rank`}>
                          <button
                            onClick={() => setNewPriority(p)}
                            className={`text-[9px] uppercase font-bold px-2 py-1 transition-all rounded-sm border ${
                              newPriority === p 
                              ? p === 'high' ? 'bg-red-500 border-red-500 text-black' 
                              : p === 'medium' ? 'bg-yellow-500 border-yellow-500 text-black'
                              : 'bg-blue-500 border-blue-500 text-black'
                              : 'border-white/10 text-gray-500 hover:border-white/20'
                            }`}
                          >
                            {p}
                          </button>
                        </Tooltip>
                      ))}
                      
                      <div className="h-4 w-[1px] bg-white/10 mx-1" />

                      <Tooltip text="Set completion deadline">
                        <div className="relative flex items-center bg-brand-gray/50 border border-white/10 rounded-sm">
                          <Calendar className="w-3 h-3 absolute left-2 text-gray-500 pointer-events-none" />
                          <input
                            type="date"
                            value={newDueDate}
                            onChange={(e) => setNewDueDate(e.target.value)}
                            className="bg-transparent text-[9px] uppercase font-bold pl-7 pr-2 py-1 focus:outline-none text-gray-300 [color-scheme:dark]"
                          />
                        </div>
                      </Tooltip>

                      <div className="h-4 w-[1px] bg-white/10 mx-1" />

                      <Tooltip text="Mark as critical urgency">
                        <button
                          onClick={() => setIsUrgent(!isUrgent)}
                          className={`text-[9px] uppercase font-bold px-3 py-1 transition-all rounded-sm border flex items-center gap-1.5 ${
                            isUrgent 
                              ? 'bg-brand-red border-brand-red text-black animate-pulse shadow-[0_0_10px_rgba(255,51,68,0.3)]' 
                              : 'border-white/10 text-gray-500 hover:border-brand-red/30 hover:text-brand-red'
                          }`}
                        >
                          <Zap className={`w-3 h-3 ${isUrgent ? 'fill-current' : ''}`} />
                          Urgent
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[264px] bg-brand-gray/20 rounded-sm border border-white/5 overflow-hidden">
                    <Reorder.Group 
                      axis="y" 
                      values={taskList} 
                      onReorder={setTaskList} 
                      className="space-y-1 p-2 max-h-[264px] overflow-y-auto scrollbar-thin scrollbar-thumb-brand-red/20"
                    >
                      <AnimatePresence initial={false}>
                        {filteredTasks.length === 0 ? (
                          <div className="h-full min-h-[200px] flex items-center justify-center text-[10px] text-gray-600 uppercase tracking-[0.2em] italic">
                            {filter === 'all' ? 'Empty Stack' : `No ${filter} objectives`}
                          </div>
                        ) : (
                          filteredTasks.map((task) => (
                            <Reorder.Item
                              key={task.id}
                              value={task}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              className={`relative bg-brand-gray/40 border p-3 flex items-center gap-3 group/item cursor-grab active:cursor-grabbing hover:bg-brand-gray/60 transition-all duration-300 ${
                                task.completed 
                                  ? 'opacity-40 border-green-500/30' 
                                  : task.priority === 'high' 
                                    ? 'border-brand-red/40 shadow-[inset_0_0_20px_rgba(255,51,68,0.07)]' 
                                    : 'border-white/5'
                              }`}
                            >
                              {/* Completion Flash & Flourish */}
                              <AnimatePresence>
                                {task.completed && (
                                  <>
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="absolute inset-0 bg-green-500/5 pointer-events-none z-0"
                                    />
                                    {/* Particle Burst */}
                                    {[...Array(6)].map((_, i) => (
                                      <motion.div
                                        key={i}
                                        initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                                        animate={{ 
                                          opacity: 0, 
                                          scale: 1, 
                                          x: (Math.random() - 0.5) * 100, 
                                          y: (Math.random() - 0.5) * 50 
                                        }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                        className="absolute left-1/2 top-1/2 w-1 h-1 bg-green-500 rounded-full z-20 pointer-events-none"
                                      />
                                    ))}
                                  </>
                                )}
                              </AnimatePresence>

                              <div className="flex items-center gap-2 z-10">
                                <Tooltip text={task.completed ? "Re-activate objective" : "Clear objective"}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTask(task.id);
                                    }}
                                    className={`p-1 rounded-sm border transition-all duration-300 ${
                                      task.completed 
                                        ? 'bg-green-500 border-green-500 text-black' 
                                        : 'border-white/20 hover:border-brand-red text-transparent'
                                    }`}
                                  >
                                    <motion.div
                                      animate={task.completed ? { scale: [0.5, 1.2, 1], rotate: [0, 10, 0] } : {}}
                                    >
                                      <Check className="w-3 h-3" />
                                    </motion.div>
                                  </button>
                                </Tooltip>
                                <Tooltip text="Drag to re-order priority">
                                  <div className="text-gray-600 group-hover/item:text-white transition-colors cursor-grab active:cursor-grabbing flex-shrink-0">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                </Tooltip>
                                <div className="relative flex items-center">
                                  {task.priority === 'high' && !task.completed && (
                                    <motion.div
                                      animate={{ opacity: [0.4, 1, 0.4] }}
                                      transition={{ duration: 2, repeat: Infinity }}
                                      className="absolute -left-6"
                                    >
                                      <AlertTriangle className="w-3 h-3 text-brand-red" />
                                    </motion.div>
                                  )}
                                  <div className={`w-1 h-8 rounded-full ${
                                    task.priority === 'high' ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]' :
                                    task.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                  }`} />
                                </div>
                              </div>

                              <div className="relative flex-1 min-w-0 flex items-center gap-2">
                                <span className={`block text-sm truncate z-10 transition-all duration-500 ${task.completed ? 'text-gray-500 italic' : ''}`}>
                                  {task.text}
                                </span>
                                {task.dueDate && !task.completed && (
                                  <div className="flex items-center gap-1 text-[9px] text-gray-500 bg-brand-gray/50 px-1.5 py-0.5 border border-white/5 whitespace-nowrap">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                                {task.urgent && !task.completed && (
                                  <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-brand-red text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter shrink-0 animate-pulse"
                                  >
                                    Urgent
                                  </motion.span>
                                )}
                                <AnimatePresence>
                                  {task.completed && (
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: "100%" }}
                                      exit={{ width: 0 }}
                                      transition={{ duration: 0.3, ease: "easeInOut" }}
                                      className="absolute top-1/2 left-0 h-[1.5px] bg-green-500/50 z-20"
                                    />
                                  )}
                                </AnimatePresence>
                              </div>
                              
                              <Tooltip text="Purge objective from stack">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTask(task.id);
                                  }}
                                  className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 transition-opacity p-1 text-white hover:text-brand-red flex-shrink-0 z-10"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </Tooltip>
                            </Reorder.Item>
                          ))
                        )}
                      </AnimatePresence>
                    </Reorder.Group>
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-col sm:flex-row justify-end items-center gap-4 mt-4">
                  <AnimatePresence>
                    {undoState && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex-1 flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-2 rounded-sm"
                      >
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                          {undoState.message}
                        </span>
                        <Tooltip text="Revert previous status change">
                          <button
                            onClick={undo}
                            className="flex items-center gap-1.5 text-[10px] text-brand-red hover:text-white transition-colors uppercase font-bold"
                          >
                            <Undo2 className="w-3 h-3" /> Undo
                          </button>
                        </Tooltip>
                      </motion.div>
                    )}
                  </AnimatePresence>
                   <span className="text-[10px] text-gray-600 uppercase tracking-widest tabular-nums">
                    {completedCount}/{taskList.length} TASKS COMPLETED // {input.length} SITREP
                  </span>
                  <Tooltip text="Process data and generate instruction" position="left">
                    <button
                      onClick={handleDiagnose}
                      disabled={isAnalyzing || !input.trim() || taskList.length === 0}
                      className={`w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-red hover:bg-red-600 disabled:bg-gray-800 disabled:text-gray-600 px-10 py-3 font-bold uppercase transition-all duration-300 transform active:scale-95 group-hover:glow-red ${getSpotlightClass('execute-button')}`}
                    >
                      {isAnalyzing ? (
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Execute Analysis <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-brand-red/5 border border-brand-red/20 space-y-4 mt-12 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-brand-red" />
                  <div className="flex items-start gap-4">
                    <ShieldAlert className="w-6 h-6 text-brand-red shrink-0 mt-1" />
                    <div className="space-y-2">
                      <div className="text-[10px] text-brand-red uppercase tracking-widest font-bold">System Failure Detected</div>
                      <p className="text-xl font-bold leading-tight uppercase italic">"{error}"</p>
                      <div className="flex gap-4">
                        <Tooltip text="Perform logic re-check">
                          <button 
                            onClick={handleDiagnose}
                            className="text-[10px] text-white hover:text-brand-red transition-colors uppercase font-bold underline underline-offset-4 decoration-brand-red/30"
                          >
                            Retry Signal
                          </button>
                        </Tooltip>
                        <Tooltip text="Wipe error buffer">
                          <button 
                            onClick={() => setError(null)}
                            className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase font-bold"
                          >
                            Clear Log
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                  {/* Decorative error glitch effect */}
                  <div className="absolute -bottom-4 -right-4 text-[40px] font-black text-brand-red opacity-5 select-none pointer-events-none">
                    ERROR_CODE_{error.includes(':') ? error.split(':')[0] : 'SYS'}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="response"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full space-y-8"
            >
              {/* Diagnosis Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Diagnosis Complete</div>
                  <h2 className="text-3xl font-display uppercase tracking-tight">
                    Root Cause: <span className={BOTTLENECK_COLORS[response.bottleneck]}>{response.bottleneck}</span>
                  </h2>
                </div>
                <Tooltip text="Discard analysis and reset workspace">
                  <button 
                    onClick={reset}
                    className="text-[10px] opacity-40 hover:opacity-100 flex items-center gap-1 uppercase transition-opacity"
                  >
                    <RefreshCcw className="w-3 h-3" /> New Diagnosis
                  </button>
                </Tooltip>
              </div>

              {/* Response Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Reality Check */}
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="p-6 bg-brand-gray/30 terminal-border space-y-4"
                >
                  <div className="flex items-center gap-2 text-brand-red text-[10px] uppercase tracking-widest font-bold">
                    <AlertTriangle className="w-3 h-3" /> Reality Check
                  </div>
                  <p className="text-xl font-semibold leading-relaxed">
                    "{response.realityCheck}"
                  </p>
                </motion.div>

                {/* The Action */}
                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="p-6 bg-brand-red/5 border border-brand-red/20 space-y-4 relative overflow-hidden"
                >
                  {/* Progress Fill Indicator */}
                  {totalTime && timeLeft !== null && (
                    <motion.div 
                      key={`progress-fill-${totalTime}`}
                      initial={{ scaleX: 1 }}
                      animate={{ scaleX: timeLeft / totalTime }}
                      transition={{ duration: 1, ease: "linear" }}
                      className="absolute inset-0 bg-brand-red/5 origin-left pointer-events-none z-0"
                    />
                  )}

                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2 text-brand-red text-[10px] uppercase tracking-widest font-bold">
                      <Target className="w-3 h-3 " /> Exact Action
                    </div>
                    <div className="flex items-center gap-4">
                      <Tooltip text="Copy instruction to clipboard" position="left">
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-500 hover:text-white transition-colors"
                        >
                          {isCopied ? (
                            <><Check className="w-3 h-3 text-green-500" /> Copied</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Copy Action</>
                          )}
                        </button>
                      </Tooltip>
                      {timeLeft !== null && totalTime !== null && (
                        <CircularTimer current={timeLeft} total={totalTime} />
                      )}
                    </div>
                  </div>
                  <p className="text-2xl font-bold leading-tight relative z-10 italic">
                    "{response.exactAction}"
                  </p>
                  
                  {timeLeft === 0 && totalTime !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative z-10 bg-brand-red text-black text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 flex items-center justify-center gap-2 animate-bounce mt-2"
                    >
                      <AlertTriangle className="w-3 h-3" /> CRITICAL: TIME OVER LIMIT // EXECUTE IMMEDIATELY
                    </motion.div>
                  )}

                  {/* Progress Line Bar */}
                  {totalTime && timeLeft !== null && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden z-20">
                      <motion.div 
                        key={`progress-line-${totalTime}`}
                        initial={{ scaleX: 1 }}
                        animate={{ scaleX: timeLeft / totalTime }}
                        transition={{ duration: 1, ease: "linear" }}
                        className="h-full bg-brand-red origin-left"
                      />
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Time & Command */}
              <div className="flex flex-col md:flex-row gap-6">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex-1 p-6 bg-brand-gray/30 terminal-border flex flex-col justify-center items-center text-center gap-2"
                >
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">Time Constraint</div>
                  <div className="text-4xl font-display text-brand-red uppercase">{response.timeConstraint}</div>
                  {timeLeft !== null && <Timer seconds={timeLeft} />}
                </motion.div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex-[2] p-8 bg-white text-black flex flex-col justify-center items-center text-center gap-4 overflow-hidden relative"
                >
                  <div className="absolute top-2 left-2 opacity-10">
                    <Terminal className="w-20 h-20 -rotate-12" />
                  </div>
                  <h3 className="text-4xl md:text-5xl font-display uppercase italic tracking-[0.05em] leading-none mb-2">
                    {response.command}
                  </h3>
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
                    Execute now. report back.
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-6 text-[8px] text-gray-600 flex justify-between items-center uppercase tracking-widest">
        <div>© 2026 E.E. SYSTEMS // V 4.2.1-PRIORITY_MODULE</div>
        <div className="flex gap-6">
          <Tooltip text="Submit report to Headquarters" position="left">
            <button 
              onClick={() => setShowFeedback(true)}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 outline-none"
            >
              <MessageSquare className="w-2.5 h-2.5" /> FEEDBACK
            </button>
          </Tooltip>
          <span>OPTIMIZED FOR HIGH FREQUENCY EXECUTION</span>
        </div>
      </footer>

      {/* Feedback Overlay */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-brand-black/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-brand-gray terminal-border p-8 space-y-6 relative"
            >
              <Tooltip text="Close report" position="left">
                <button 
                  onClick={() => setShowFeedback(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </Tooltip>

              <div className="space-y-2">
                <div className="text-brand-red text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" /> Intel Report
                </div>
                <h3 className="text-2xl font-display uppercase italic italic">Report to Headquarters</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Identify tactical failures or suggest module enhancements.</p>
              </div>

              {feedbackSuccess ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-12 h-12 bg-green-500/10 text-green-500 mx-auto rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold uppercase tracking-[0.2em] text-green-500">Transmission Successful</div>
                </div>
              ) : (
                <form onSubmit={submitFeedback} className="space-y-4">
                  <textarea
                    autoFocus
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Describe the issue or suggestion..."
                    className="w-full h-32 bg-brand-black/50 border border-white/10 p-3 text-sm focus:outline-none focus:border-brand-red/50 transition-colors resize-none placeholder:opacity-20"
                  />
                  <Tooltip text="Send intel report to HQ">
                    <button
                      disabled={!feedback.trim() || isSubmittingFeedback}
                      className="w-full bg-brand-red hover:bg-red-600 disabled:bg-gray-800 disabled:text-gray-600 py-3 font-bold uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmittingFeedback ? (
                        <RefreshCcw className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3 h-3" /> Transmit Signal
                        </>
                      )}
                    </button>
                  </Tooltip>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CircularTimer({ current, total }: { current: number; total: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? (current / total) : 0;
  const offset = circumference - progress * circumference;
  const isOver = current <= 0;
  const isUrgent = current > 0 && current <= 10;

  return (
    <div className="relative flex items-center justify-center group/timer">
      <motion.div
        animate={isUrgent ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={isUrgent ? { duration: 0.5, repeat: Infinity } : {}}
        className="relative flex items-center justify-center"
      >
        <svg className="w-10 h-10 -rotate-90">
          <circle
            cx="20"
            cy="20"
            r={radius}
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            className="text-white/10"
          />
          <motion.circle
            cx="20"
            cy="20"
            r={radius}
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "linear" }}
            className={isOver ? 'text-brand-red' : isUrgent ? 'text-brand-red' : 'text-brand-red'}
            strokeLinecap="round"
          />
        </svg>
        <div className={`absolute text-[9px] font-bold tabular-nums flex flex-col items-center leading-none ${isOver || isUrgent ? 'text-brand-red' : 'text-white'}`}>
          <span>{Math.floor(current / 60)}:{(current % 60).toString().padStart(2, '0')}</span>
        </div>
      </motion.div>
      
      {/* Tooltip on hover */}
      <div className={`absolute top-10 right-0 hidden group-hover/timer:block border px-2 py-1.5 rounded-sm text-[8px] font-black uppercase tracking-wider whitespace-nowrap z-50 shadow-2xl ${
        isOver 
          ? 'bg-brand-red text-black border-brand-red animate-bounce' 
          : 'bg-brand-black text-white border-white/20'
      }`}>
        <div className="flex items-center gap-2">
          {isOver && <AlertTriangle className="w-3 h-3" />}
          {isOver ? 'STATUS: DEPLOYMENT WINDOW CLOSED' : 'STATUS: ACTIVE DIRECTIVE WINDOW'}
        </div>
        {isUrgent && <div className="text-[7px] mt-0.5 opacity-80 decoration-white/30 underline">CRITICAL: EXECUTION SIGNAL FADING</div>}
      </div>
    </div>
  );
}

function Timer({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isExpired = seconds <= 0;

  return (
    <div className="flex flex-col items-center gap-1 font-mono">
      <div className="flex items-center gap-2 text-sm">
        <Clock className={`w-4 h-4 ${isExpired ? 'text-brand-red animate-pulse' : 'text-gray-400'}`} />
        <span className={`${isExpired ? 'text-brand-red font-bold' : ''} tabular-nums`}>
          {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
        </span>
      </div>
      {isExpired && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[8px] text-brand-red font-bold uppercase tracking-tighter"
        >
          Time Over Limit
        </motion.div>
      )}
    </div>
  );
}

