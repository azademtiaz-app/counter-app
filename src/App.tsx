/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Upload, 
  Plus, 
  Minus,
  RotateCcw, 
  Trash2, 
  Banknote, 
  Store, 
  FileText,
  Calendar,
  Printer,
  Save,
  FileUp,
  FileDown,
  Eye,
  EyeOff,
  Edit3,
  X,
  QrCode,
  Share2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  PenTool,
  Download,
  Settings2,
  Search,
  Lock,
  Unlock,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { format, parseISO, parse } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  Document, 
  Packer, 
  Paragraph, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle, 
  TextRun,
  VerticalAlign,
  ImageRun
} from 'docx';
import { saveAs } from 'file-saver';
import LZString from 'lz-string';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CashRow {
  id: string;
  denomination: number;
  qty: number;
}

interface ExtraRow {
  id: string;
  label: string;
  qty: number;
  amount: number;
}

interface OutletRow {
  id: string;
  name: string;
  amount: number;
}

interface SignatureRow {
  id: string;
  name: string;
  designation: string;
}

interface NoteRow {
  id: string;
  text: string;
}

interface SectionLayout {
  width?: number;
  height?: number;
}

interface AppState {
  id?: string;
  headerNote: string;
  date: string;
  cashRows: CashRow[];
  extraRows: ExtraRow[];
  outletRows: OutletRow[];
  signatureRows: SignatureRow[];
  noteRows: NoteRow[];
  logo: string | null;
  isLogoLocked: boolean;
  isSignaturesLocked: boolean;
  gridRatio: number; // 0 to 100, percentage of the first column
  config: {
    cashSectionTitle: string;
    outletSectionTitle: string;
    signaturesSectionTitle: string;
    notesSectionTitle: string;
    outletColumnLabel: string;
    outletTotalLabel: string;
    showCashSection: boolean;
    showOutletSection: boolean;
    showSignaturesSection: boolean;
    showNotesSection: boolean;
    showBalanceRow: boolean;
    showLogo: boolean;
    showReportTitle: boolean;
    showDate: boolean;
  };
  userId?: string;
  createdAt?: any;
  updatedAt?: any;
}

const getBusinessDate = () => {
  const now = new Date();
  // If before 6 AM, use yesterday's date
  if (now.getHours() < 6) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return format(yesterday, 'yyyy-MM-dd');
  }
  return format(now, 'yyyy-MM-dd');
};

const initialState: AppState = {
  headerNote: '',
  date: getBusinessDate(),
  cashRows: [
    { id: '1', denomination: 1000, qty: 0 },
    { id: '2', denomination: 500, qty: 0 },
    { id: '3', denomination: 200, qty: 0 },
    { id: '4', denomination: 100, qty: 0 },
    { id: '5', denomination: 50, qty: 0 },
    { id: '6', denomination: 20, qty: 0 },
    { id: '7', denomination: 10, qty: 0 },
    { id: '8', denomination: 5, qty: 0 },
    { id: '9', denomination: 2, qty: 0 },
  ],
  extraRows: [
    { id: 'e1', label: 'Voucher', qty: 0, amount: 0 },
  ],
  outletRows: [
    { id: 'o1', name: 'Front Office', amount: 0 },
    { id: 'o2', name: 'Restaurant', amount: 0 },
    { id: 'o3', name: 'Laundry', amount: 0 },
    { id: 'o4', name: 'Spa', amount: 0 },
  ],
  signatureRows: [
    { id: '1', name: '', designation: '' },
    { id: '2', name: '', designation: '' },
  ],
  noteRows: [
    { id: '1', text: '' },
  ],
  logo: null,
  isLogoLocked: false,
  isSignaturesLocked: false,
  gridRatio: 50,
  config: {
    cashSectionTitle: 'CASH',
    outletSectionTitle: 'OUTLET',
    signaturesSectionTitle: 'SIGNATURES',
    notesSectionTitle: 'NOTES',
    outletColumnLabel: 'NAME',
    outletTotalLabel: 'OUTLET TOTAL',
    showCashSection: true,
    showOutletSection: true,
    showSignaturesSection: true,
    showNotesSection: true,
    showBalanceRow: true,
    showLogo: true,
    showReportTitle: true,
    showDate: true,
  },
};

const EditableTableLabel = ({ 
  value, 
  onChange, 
  className 
}: { 
  value: string, 
  onChange: (val: string) => void,
  className?: string
}) => {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input 
          autoFocus
          className={cn("bg-white border-b border-indigo-500 focus:outline-none px-1 py-0.5 w-full text-slate-900 font-black", className)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
        />
        <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors print:hidden">
          <X size={12} className="text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group/label">
      <span className={cn("truncate font-black", className)}>{value}</span>
      <button 
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover/label:opacity-100 p-1 text-slate-300 hover:text-indigo-600 transition-all print:hidden"
      >
        <Edit3 size={12} />
      </button>
    </div>
  );
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const evaluateMath = (input: string): number => {
  if (!input) return 0;
  try {
    // Remove commas and other non-math characters except numbers, operators, and dots
    const sanitized = input.replace(/,/g, '').replace(/[^0-9+\-*/.()]/g, '');
    // Use Function constructor as a safer alternative to eval for simple math
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${sanitized}`)();
    return typeof result === 'number' && !isNaN(result) ? Math.round(result) : 0;
  } catch (e) {
    return 0;
  }
};

const MathInput = ({ 
  value, 
  onChange, 
  placeholder, 
  className,
  showCommas = true,
  disabled = false
}: { 
  value: number | string, 
  onChange: (val: number) => void, 
  placeholder?: string, 
  className?: string,
  type?: "number" | "text",
  showCommas?: boolean,
  disabled?: boolean
}) => {
  const [localValue, setLocalValue] = useState((value || '').toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      const safeValue = value ?? 0;
      setLocalValue(typeof safeValue === 'number' ? (showCommas ? safeValue.toLocaleString('en-IN') : safeValue.toString()) : safeValue.toString());
    }
  }, [value, isFocused, showCommas]);

  const handleBlur = () => {
    setIsFocused(false);
    const result = evaluateMath(localValue);
    onChange(result);
    setLocalValue(showCommas ? result.toLocaleString('en-IN') : result.toString());
  };

  const handleFocus = () => {
    setIsFocused(true);
    // When focusing, show raw number without commas for easier editing
    const rawValue = evaluateMath(localValue).toString();
    setLocalValue(rawValue === '0' ? '' : rawValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const current = e.currentTarget;
      const rect = current.getBoundingClientRect();
      const section = current.closest('[data-nav-section]');
      const inputs = Array.from(section ? section.querySelectorAll('.nav-input') : document.querySelectorAll('.nav-input')) as HTMLElement[];
      
      let bestMatch: HTMLElement | null = null;
      let minDistance = Infinity;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      inputs.forEach(input => {
        if (input === current) return;
        const inputRect = input.getBoundingClientRect();
        const inputCenterX = inputRect.left + inputRect.width / 2;
        const inputCenterY = inputRect.top + inputRect.height / 2;
        
        let isCorrectDirection = false;
        let distance = 0;

        if (e.key === 'ArrowUp' && inputCenterY < centerY - 5) {
          isCorrectDirection = true;
          distance = Math.abs(inputCenterX - centerX) + Math.abs(inputCenterY - centerY) * 2;
        } else if (e.key === 'ArrowDown' && inputCenterY > centerY + 5) {
          isCorrectDirection = true;
          distance = Math.abs(inputCenterX - centerX) + Math.abs(inputCenterY - centerY) * 2;
        } else if (e.key === 'ArrowLeft' && inputCenterX < centerX - 5) {
          isCorrectDirection = true;
          distance = Math.abs(inputCenterX - centerX) * 2 + Math.abs(inputCenterY - centerY);
        } else if (e.key === 'ArrowRight' && inputCenterX > centerX + 5) {
          isCorrectDirection = true;
          distance = Math.abs(inputCenterX - centerX) * 2 + Math.abs(inputCenterY - centerY);
        }

        if (isCorrectDirection && distance < minDistance) {
          minDistance = distance;
          bestMatch = input;
        }
      });

      if (bestMatch) {
        e.preventDefault();
        bestMatch.focus();
        if (bestMatch instanceof HTMLInputElement || bestMatch instanceof HTMLTextAreaElement) {
          (bestMatch as any).select?.();
        }
      }
    }
  };

  return (
    <input
      type="text"
      className={cn("nav-input", className, disabled && "cursor-not-allowed opacity-70")}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      disabled={disabled}
    />
  );
};

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 max-w-md w-full"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-500">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">{title}</h3>
            <p className="text-slate-500 text-sm font-bold">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
          >
            Confirm
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SectionHeader = ({ 
  title, 
  onTitleChange, 
  onToggle, 
  isVisible, 
  icon: Icon, 
  onAdd, 
  onReset, 
  resetOptions,
  isLocked,
  onLock,
  hideTitleInPrint
}: { 
  title: string, 
  onTitleChange?: (val: string) => void,
  onToggle?: () => void,
  isVisible?: boolean,
  icon: any,
  onAdd?: (count: number) => void,
  onReset?: () => void,
  resetOptions?: { label: string, onClick: () => void }[],
  isLocked?: boolean,
  onLock?: () => void,
  hideTitleInPrint?: boolean
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [addCount, setAddCount] = useState(1);
  const [showResetMenu, setShowResetMenu] = useState(false);

  return (
    <div className="flex items-center justify-between group/header mb-2 print:mb-1">
      <div className="flex items-center gap-3 print:gap-1">
        <div className="p-2 bg-slate-100 rounded-lg text-slate-600 group-hover/header:bg-indigo-600 group-hover/header:text-white transition-all duration-300 print:hidden">
          <Icon size={18} />
        </div>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input 
              autoFocus
              className="bg-white border-b-2 border-indigo-500 focus:outline-none font-black uppercase tracking-widest text-slate-900 px-1 py-0.5 text-sm"
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            />
            <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X size={14} className="text-slate-400" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-slate-700 font-black uppercase tracking-widest text-sm flex items-center gap-2",
              hideTitleInPrint ? "print:hidden" : "print:text-[10px]"
            )}>
              {title}
              {isLocked && <Lock size={12} className="text-indigo-500 print:hidden" />}
            </span>
            {onTitleChange && !isLocked && (
              <button 
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover/header:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all print:hidden"
              >
                <Edit3 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 print:hidden relative items-center">
        {onToggle && (
          <button 
            onClick={onToggle}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              isVisible 
                ? "text-slate-400 hover:text-slate-600 hover:bg-slate-100" 
                : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
            )}
            title={isVisible ? "Hide Section" : "Show Section"}
          >
            {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        )}
        {onLock && (
          <button 
            onClick={onLock}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              isLocked 
                ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100" 
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            )}
            title={isLocked ? "Unlock Section" : "Lock Section"}
          >
            {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        )}
        {onAdd && isVisible !== false && (
          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <input 
              type="number" 
              min="1" 
              max="50"
              className="w-10 px-1 py-1 text-xs text-center focus:outline-none border-r border-slate-100 bg-transparent text-slate-900 font-black"
              value={addCount}
              onChange={(e) => setAddCount(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <button 
              onClick={() => onAdd(addCount)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        )}
        {onReset && isVisible !== false && (
        <div className="relative">
          <button 
            onClick={() => resetOptions ? setShowResetMenu(!showResetMenu) : onReset()} 
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-white text-slate-600 rounded-lg border border-slate-200 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 transition-all shadow-sm"
          >
            <RotateCcw size={14} /> Reset
            {resetOptions && <ChevronDown size={12} className={`transition-transform duration-200 ${showResetMenu ? 'rotate-180' : ''}`} />}
          </button>
          
          <AnimatePresence>
            {showResetMenu && resetOptions && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowResetMenu(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-2xl border border-slate-100 py-1.5 z-20 overflow-hidden"
                >
                  <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Reset Options</div>
                  {resetOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        opt.onClick();
                        setShowResetMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-3"
                    >
                      <RotateCcw size={12} className="opacity-50" />
                      <span className="font-black">{opt.label}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Emergency Reset: if URL has ?reset=true, clear localStorage and reload
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
      localStorage.clear();
      window.location.href = window.location.pathname;
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const [state, setState] = useState<AppState>(initialState);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Consolidated Load on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('r');
    
    if (sharedData) {
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(sharedData);
        if (decompressed) {
          const parsed = JSON.parse(decompressed);
          setState(parsed);
          showNotification("Shared report loaded");
          // Clean up URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('r');
          window.history.replaceState({}, '', newUrl.toString());
        }
      } catch (e) {
        console.error('Failed to load shared report', e);
      }
    } else {
      const draft = localStorage.getItem('cash_report_draft');
      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft);
          if (parsedDraft && typeof parsedDraft === 'object') {
            const mergedConfig = {
              ...initialState.config,
              ...(parsedDraft.config || {})
            };
            const mergedState = {
              ...initialState,
              ...parsedDraft,
              config: mergedConfig,
              date: format(new Date(), 'yyyy-MM-dd')
            };
            setState(mergedState);
          }
        } catch (e) {
          console.error('Failed to parse draft', e);
        }
      }
    }
    
    const savedReports = localStorage.getItem('cash_reports');
    if (savedReports) {
      try {
        setReports(JSON.parse(savedReports));
      } catch (e) {
        console.error('Failed to parse saved reports', e);
      }
    }
  }, []);

  const [history, setHistory] = useState<AppState[]>([]);
  const [future, setFuture] = useState<AppState[]>([]);
  const [reports, setReports] = useState<AppState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const updateState = useCallback((newState: AppState | ((prev: AppState) => AppState)) => {
    setState(current => {
      const resolved = typeof newState === 'function' ? newState(current) : newState;
      setHistory(prev => [current, ...prev].slice(0, 50));
      setFuture([]);
      return resolved;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory(prevHistory => {
      if (prevHistory.length === 0) return prevHistory;
      const previous = prevHistory[0];
      const newHistory = prevHistory.slice(1);
      setState(current => {
        setFuture(prevFuture => [current, ...prevFuture]);
        return previous;
      });
      return newHistory;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(prevFuture => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);
      setState(current => {
        setHistory(prevHistory => [current, ...prevHistory].slice(0, 50));
        return next;
      });
      return newFuture;
    });
  }, []);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if target is an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow undo/redo even in inputs if needed, but be careful
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]); // depend on stable callbacks

  // Save Reports to LocalStorage whenever they change
  useEffect(() => {
    localStorage.setItem('cash_reports', JSON.stringify(reports));
  }, [reports]);

  // Auto-save current draft
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('cash_report_draft', JSON.stringify(state));
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  const saveReport = () => {
    setIsSaving(true);
    setTimeout(() => {
      const reportData = {
        ...state,
        id: state.id || generateId(),
        updatedAt: new Date().toISOString()
      };

      // Explicitly save draft to ensure it's persisted immediately
      localStorage.setItem('cash_report_draft', JSON.stringify(reportData));

      setReports(prev => {
        const index = prev.findIndex(r => r.id === reportData.id || (r.date === reportData.date && r.headerNote === reportData.headerNote));
        if (index >= 0) {
          const newReports = [...prev];
          newReports[index] = reportData;
          return newReports;
        }
        return [reportData, ...prev];
      });

      setState(reportData);
      setIsSaving(false);
      showNotification("Report saved to device");
    }, 500);
  };

  const deleteReport = (id: string) => {
    setConfirmAction({
      title: 'Delete Report',
      message: 'Are you sure you want to delete this report? This action cannot be undone.',
      onConfirm: () => {
        setReports(prev => prev.filter(r => r.id !== id));
        if (state.id === id) {
          resetAll();
        }
        showNotification("Report deleted");
      }
    });
  };

  const loadReport = (report: AppState) => {
    setState(report);
    setShowHistory(false);
    showNotification("Report loaded");
  };

  // Calculations
  const cashTotal = useMemo(() => 
    state.cashRows.reduce((sum, row) => sum + (row.denomination * row.qty), 0)
  , [state.cashRows]);

  const extraTotal = useMemo(() => 
    state.extraRows.reduce((sum, row) => sum + row.amount, 0)
  , [state.extraRows]);

  const grandTotal = cashTotal + extraTotal;

  const outletTotal = useMemo(() => 
    state.outletRows.reduce((sum, row) => sum + row.amount, 0)
  , [state.outletRows]);

  const balance = grandTotal - outletTotal;

  // Handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (state.isLogoLocked) {
      showNotification("Logo is locked. Unlock it to change.", "error");
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateState(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addCashRow = (count: number = 1) => {
    const newRows = Array.from({ length: count }, () => ({ id: generateId(), denomination: 0, qty: 0 }));
    updateState(prev => ({
      ...prev,
      cashRows: [...prev.cashRows, ...newRows]
    }));
  };

  const addExtraRow = (count: number = 1) => {
    const newRows = Array.from({ length: count }, () => ({ id: generateId(), label: '', qty: 0, amount: 0 }));
    updateState(prev => ({
      ...prev,
      extraRows: [...prev.extraRows, ...newRows]
    }));
  };

  const addOutletRow = (count: number = 1) => {
    const newRows = Array.from({ length: count }, () => ({ id: generateId(), name: '', amount: 0 }));
    updateState(prev => ({
      ...prev,
      outletRows: [...prev.outletRows, ...newRows]
    }));
  };

  const addSignatureRow = () => {
    if (state.isSignaturesLocked) {
      showNotification("Signatures are locked", "error");
      return;
    }
    updateState(prev => ({
      ...prev,
      signatureRows: [...prev.signatureRows, { id: generateId(), name: '', designation: '' }]
    }));
  };

  const addNoteRow = () => {
    updateState(prev => ({
      ...prev,
      noteRows: [...prev.noteRows, { id: generateId(), text: '' }]
    }));
  };

  const resetSection = (section: keyof AppState) => {
    if (section === 'signatureRows' && state.isSignaturesLocked) {
      showNotification("Signatures are locked", "error");
      return;
    }
    updateState(prev => ({ ...prev, [section]: initialState[section] }));
  };

  const resetAll = () => {
    updateState(prev => ({
      ...JSON.parse(JSON.stringify(initialState)),
      logo: prev.isLogoLocked ? prev.logo : initialState.logo,
      isLogoLocked: prev.isLogoLocked,
      signatureRows: prev.isSignaturesLocked ? prev.signatureRows : initialState.signatureRows,
      isSignaturesLocked: prev.isSignaturesLocked,
      date: getBusinessDate()
    }));
  };

  const resetCashQuantities = () => {
    updateState(prev => ({
      ...prev,
      cashRows: prev.cashRows.map(row => ({ ...row, qty: 0 }))
    }));
  };

  const addStandardDenominations = () => {
    const standards = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
    updateState(prev => {
      const existing = prev.cashRows.map(r => r.denomination);
      const toAdd = standards.filter(d => !existing.includes(d));
      const newRows = toAdd.map(d => ({ id: generateId(), denomination: d, qty: 0 }));
      return {
        ...prev,
        cashRows: [...prev.cashRows, ...newRows].sort((a, b) => b.denomination - a.denomination)
      };
    });
  };

  const hideAllSections = () => {
    updateState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        showCashSection: false,
        showOutletSection: false,
        showSignaturesSection: false,
        showNotesSection: false,
        showBalanceRow: false,
        showLogo: false,
        showReportTitle: false,
        showDate: false
      }
    }));
  };

  const restoreAllSections = () => {
    updateState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        showCashSection: true,
        showOutletSection: true,
        showSignaturesSection: true,
        showNotesSection: true,
        showBalanceRow: true,
        showLogo: true,
        showReportTitle: true,
        showDate: true
      }
    }));
  };

  const resetExtraAmounts = () => {
    updateState(prev => ({
      ...prev,
      extraRows: prev.extraRows.map(row => ({ ...row, qty: 0, amount: 0 }))
    }));
  };

  const resetOutletAmounts = () => {
    updateState(prev => ({
      ...prev,
      outletRows: prev.outletRows.map(row => ({ ...row, amount: 0 }))
    }));
  };

  const resetCashNotes = () => {
    updateState(prev => ({
      ...prev,
      cashRows: prev.cashRows.map(row => ({ ...row, denomination: 0 }))
    }));
  };

  const resetOutletNames = () => {
    updateState(prev => ({
      ...prev,
      outletRows: prev.outletRows.map(row => ({ ...row, name: '' }))
    }));
  };

  const handlePrint = () => {
    if (!reportRef.current) return;
    
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        window.print(); // Fallback
        return;
      }

      const content = reportRef.current.innerHTML;
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Cash Report - ${state.date}</title>
            ${styles}
            <style>
              @import "tailwindcss";
              @page { size: auto; margin: 10mm; }
              body { background: white !important; padding: 0 !important; margin: 0 !important; }
              .print-hidden { display: none !important; }
              button { display: none !important; }
              input, textarea { border: none !important; background: transparent !important; padding: 0 !important; }
              .shadow-xl, .shadow-sm { box-shadow: none !important; }
              .rounded-2xl, .rounded-xl, .rounded-[2rem], .rounded-[2.5rem] { border-radius: 0 !important; }
              .bg-slate-50, .bg-slate-100 { background: transparent !important; }
              * { 
                color-adjust: exact !important; 
                -webkit-print-color-adjust: exact !important;
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
              }
              *::-webkit-scrollbar { display: none !important; }
              .overflow-x-auto { overflow: visible !important; }
              table { border-collapse: collapse !important; width: 100% !important; border: 1px solid #cbd5e1 !important; border-radius: 0 !important; overflow: visible !important; }
              th { border: 1px solid #cbd5e1 !important; background-color: #f8fafc !important; padding: 8pt 12pt !important; }
              td { border: 1px solid #cbd5e1 !important; padding: 6pt 12pt !important; }
              .print-total { font-size: 10.5pt !important; font-weight: 900 !important; text-transform: uppercase !important; }
              
              /* Force single page logic */
              .space-y-20 { margin-top: 2rem !important; }
              .p-12 { padding: 1.5rem !important; }
              .gap-12 { gap: 1.5rem !important; }
            </style>
          </head>
          <body>
            <div class="max-w-none m-0 p-8">
              ${content}
            </div>
            <script>
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      console.error('Print failed:', e);
      window.print(); // Final fallback
    }
  };

  const handleSaveWord = async () => {
    const children: any[] = [];

    // Logo
    if (state.logo) {
      try {
        const logoBase64 = state.logo.split(',')[1];
        const binaryString = window.atob(logoBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: bytes,
              transformation: {
                width: 180, // Increased size
                height: 75,
              },
            } as any),
          ],
        }));
        children.push(new Paragraph({ text: "" })); // Spacer
      } catch (e) {
        console.error('Failed to add logo to Word:', e);
      }
    }

    // Header
    if (state.headerNote) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: state.headerNote,
            bold: true,
            size: 32,
            allCaps: true
          })
        ]
      }));
      children.push(new Paragraph({ text: "" })); // Spacer
    }

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: state.date ? format(parse(state.date, 'yyyy-MM-dd', new Date()), 'EEEE, d MMMM yyyy') : 'N/A',
          bold: true,
          size: 24,
          allCaps: true
        })
      ]
    }));

    children.push(new Paragraph({ text: "" })); // Spacer

    // Main Content Table
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            // Left Column: Cash
            new TableCell({
              width: { size: 55, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ text: "CASH", children: [new TextRun({ bold: true, size: 18 })] }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ text: "NOTE", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true })] })] }),
                        new TableCell({ children: [new Paragraph({ text: "QTY", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true })] })] }),
                        new TableCell({ children: [new Paragraph({ text: "TOTAL", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true })] })] }),
                      ]
                    }),
                    ...state.cashRows.map(r => new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ text: r.denomination.toString(), alignment: AlignmentType.CENTER })] }),
                        new TableCell({ children: [new Paragraph({ text: r.qty?.toString() || "", alignment: AlignmentType.CENTER })] }),
                        new TableCell({ children: [new Paragraph({ text: (r.denomination * (r.qty || 0)).toString() || "0", alignment: AlignmentType.RIGHT })] }),
                      ]
                    })),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ text: "CASH TOTAL", children: [new TextRun({ bold: true, size: 24 })] })] }),
                        new TableCell({ children: [new Paragraph({ text: "" })] }),
                        new TableCell({ children: [new Paragraph({ text: cashTotal.toString(), alignment: AlignmentType.RIGHT, children: [new TextRun({ bold: true, size: 24 })] })] }),
                      ]
                    }),
                    ...state.extraRows.map(r => new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ text: r.label || "Voucher" })] }),
                        new TableCell({ children: [new Paragraph({ text: r.qty?.toString() || "", alignment: AlignmentType.CENTER })] }),
                        new TableCell({ children: [new Paragraph({ text: r.amount.toString(), alignment: AlignmentType.RIGHT })] }),
                      ]
                    })),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ text: "GRAND TOTAL", children: [new TextRun({ bold: true, size: 24 })] })] }),
                        new TableCell({ children: [new Paragraph({ text: "" })] }),
                        new TableCell({ children: [new Paragraph({ text: grandTotal.toString(), alignment: AlignmentType.RIGHT, children: [new TextRun({ bold: true, size: 24 })] })] }),
                      ]
                    }),
                  ]
                })
              ]
            }),
            // Spacer Cell
            new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [] }),
            // Right Column: Outlet
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.TOP,
              children: [
                new Paragraph({ text: "OUTLET", children: [new TextRun({ bold: true, size: 18 })] }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ text: state.config.outletColumnLabel, alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true })] })] }),
                        new TableCell({ children: [new Paragraph({ text: "AMOUNT", alignment: AlignmentType.CENTER, children: [new TextRun({ bold: true })] })] }),
                      ]
                    }),
                    ...state.outletRows.map(r => new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ text: r.name })] }),
                        new TableCell({ children: [new Paragraph({ text: r.amount.toString() || "0", alignment: AlignmentType.RIGHT })] }),
                      ]
                    })),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ text: state.config.outletTotalLabel, children: [new TextRun({ bold: true, size: 24 })] })] }),
                        new TableCell({ children: [new Paragraph({ text: outletTotal.toLocaleString('en-IN'), alignment: AlignmentType.RIGHT, children: [new TextRun({ bold: true, size: 24 })] })] }),
                      ]
                    }),
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ text: balance > 0 ? "OVER" : balance < 0 ? "LESS" : "BALANCED", children: [new TextRun({ bold: true, size: 24 })] })] }),
                        new TableCell({ children: [new Paragraph({ text: (balance > 0 ? "+" : "") + balance.toLocaleString('en-IN'), alignment: AlignmentType.RIGHT, children: [new TextRun({ bold: true, size: 24, color: balance > 0 ? "10b981" : balance < 0 ? "f43f5e" : "334155" })] })] }),
                      ]
                    }),
                  ]
                })
              ]
            })
          ]
        })
      ]
    }));

    children.push(new Paragraph({ text: "" })); // Spacer
    children.push(new Paragraph({ text: "SIGNATURES", children: [new TextRun({ bold: true, size: 24 })] }));
    children.push(new Paragraph({ text: "" }));

    // Dynamic Signatures Table
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: state.signatureRows.map(row => new TableCell({
            children: [
              new Paragraph({ text: row.name || "Name", alignment: AlignmentType.LEFT, children: [new TextRun({ bold: true })] }),
              new Paragraph({ text: row.designation || "Designation", alignment: AlignmentType.LEFT }),
              new Paragraph({ text: "" }),
              new Paragraph({ text: "____________________", alignment: AlignmentType.LEFT }),
              new Paragraph({ text: "Signature", alignment: AlignmentType.LEFT, children: [new TextRun({ size: 16, italics: true })] }),
            ]
          }))
        })
      ]
    }));

    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: "NOTES", children: [new TextRun({ bold: true, size: 24 })] }));
    state.noteRows.forEach(n => {
      if (n.text) {
        children.push(new Paragraph({ text: n.text }));
      }
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Cash_Report_${state.date}.docx`);
  };

  const handleCreateShortcut = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cash Report Shortcut</title>
        <meta http-equiv="refresh" content="0;url=${shareUrl}">
      </head>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
        <div style="text-align: center; padding: 40px; background: white; border-radius: 24px; shadow: 0 10px 25px rgba(0,0,0,0.05);">
          <h2 style="color: #4f46e5;">Redirecting...</h2>
          <p style="color: #64748b;">Opening your Cash Report App</p>
          <script>window.location.href = "${shareUrl}";</script>
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    saveAs(blob, "Cash_Report_Shortcut.html");
    showNotification("Shortcut created! Move this file to your desktop.");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const current = e.currentTarget;
      const rect = current.getBoundingClientRect();
      const section = current.closest('[data-nav-section]');
      const inputs = Array.from(section ? section.querySelectorAll('.nav-input') : document.querySelectorAll('.nav-input')) as HTMLElement[];
      
      let bestMatch: HTMLElement | null = null;
      let minDistance = Infinity;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      inputs.forEach(input => {
        if (input === current) return;
        const inputRect = input.getBoundingClientRect();
        const inputCenterX = inputRect.left + inputRect.width / 2;
        const inputCenterY = inputRect.top + inputRect.height / 2;
        
        let isCorrectDirection = false;
        let distance = 0;

        if (e.key === 'ArrowUp' && inputCenterY < centerY - 5) {
          isCorrectDirection = true;
          distance = Math.abs(inputCenterX - centerX) + Math.abs(inputCenterY - centerY) * 2;
        } else if (e.key === 'ArrowDown' && inputCenterY > centerY + 5) {
          isCorrectDirection = true;
          distance = Math.abs(inputCenterX - centerX) + Math.abs(inputCenterY - centerY) * 2;
        } else if (e.key === 'ArrowLeft' && inputCenterX < centerX - 5) {
          isCorrectDirection = true;
          distance = Math.abs(inputCenterX - centerX) * 2 + Math.abs(inputCenterY - centerY);
        } else if (e.key === 'ArrowRight' && inputCenterX > centerX + 5) {
          isCorrectDirection = true;
          distance = Math.abs(inputCenterX - centerX) * 2 + Math.abs(inputCenterY - centerY);
        }

        if (isCorrectDirection && distance < minDistance) {
          minDistance = distance;
          bestMatch = input;
        }
      });

      if (bestMatch) {
        e.preventDefault();
        bestMatch.focus();
        if (bestMatch instanceof HTMLInputElement || bestMatch instanceof HTMLTextAreaElement) {
          (bestMatch as any).select?.();
        }
      }
    }
  };

  const handleResetLayout = () => {
    updateState(prev => ({
      ...prev,
      gridRatio: 50
    }));
  };

  const shareUrl = useMemo(() => {
    try {
      // Create a copy without the logo to keep the URL size manageable
      const { logo, ...stateWithoutLogo } = state;
      const data = JSON.stringify(stateWithoutLogo);
      const compressed = LZString.compressToEncodedURIComponent(data);
      
      // Get the base URL (origin + pathname)
      let baseUrl = window.location.origin + window.location.pathname;
      // Ensure it ends with a slash if it's just the domain
      if (baseUrl.endsWith('run.app')) baseUrl += '/';
      
      const url = new URL(baseUrl);
      url.searchParams.set('r', compressed);
      return url.toString();
    } catch (e) {
      return window.location.origin + window.location.pathname;
    }
  }, [state]);

  const isQrTooLarge = shareUrl.length > 2000; // Lowered threshold for better mobile scanning

  return (
    <div className="min-h-screen bg-slate-50 transition-colors duration-500 font-sans text-slate-900 print:p-0 print:bg-white">
      <div className="max-w-7xl mx-auto pt-12 pb-12 px-4 sm:px-6 lg:px-8 print:p-0 print:max-w-none">
        
        {/* Notifications */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className={cn(
                "fixed top-12 left-1/2 z-[60] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl",
                notification.type === 'success' 
                  ? "bg-emerald-500/90 border-emerald-400 text-white" 
                  : "bg-rose-500/90 border-rose-400 text-white"
              )}
            >
              {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm font-bold tracking-wide">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 print:hidden">
          <div className="flex gap-4 items-center self-start">
            {deferredPrompt && (
              <button 
                onClick={handleInstall}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <Download size={14} /> Install App
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest">Offline Ready</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Save size={10} className="text-indigo-500" />
              <span className="text-[9px] font-black uppercase tracking-widest">Draft Saved</span>
            </div>
          </div>

          {/* History & Undo/Redo Toggle */}
          <div className="flex gap-4 self-end sm:self-auto items-center">
            <div className="flex bg-white border border-slate-100 rounded-2xl shadow-sm p-1">
            <button 
              onClick={undo}
              disabled={history.length === 0}
              className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={18} />
            </button>
            <div className="w-px h-4 bg-slate-100 self-center mx-1" />
            <button 
              onClick={redo}
              disabled={future.length === 0}
              className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-all scale-x-[-1]"
              title="Redo (Ctrl+Y)"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "p-3 rounded-2xl border transition-all shadow-sm flex items-center gap-2",
              showHistory 
                ? "bg-indigo-600 border-indigo-500 text-white" 
                : "bg-white border-slate-100 text-slate-600 hover:text-indigo-600"
            )}
            title="Toggle Saved Reports"
          >
            <FileText size={20} />
            <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">History ({reports.length})</span>
          </button>
        </div>
      </div>

        {/* View Content */}
        <div className="max-w-4xl mx-auto print:max-w-none print:m-0">
          <AnimatePresence mode="wait">
            {showHistory ? (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Saved Reports</h2>
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="relative flex-grow sm:flex-grow-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text"
                        placeholder="Search reports..."
                        className="pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all w-full sm:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => setShowHistory(false)}
                      className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 whitespace-nowrap"
                    >
                      Back to Editor
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {reports.filter(r => 
                    r.headerNote.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    r.date.includes(searchTerm)
                  ).length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-[2.5rem] border border-slate-100">
                      <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No reports found</p>
                    </div>
                  ) : (
                    reports
                      .filter(r => 
                        r.headerNote.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        r.date.includes(searchTerm)
                      )
                      .map((report) => (
                      <div 
                        key={report.id}
                        className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-6">
                          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Calendar size={24} />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 uppercase tracking-widest">{report.headerNote || 'Untitled Report'}</h4>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                              {report.date ? format(parseISO(report.date), 'd MMMM yyyy') : 'No Date'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => loadReport(report)}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all"
                          >
                            Load
                          </button>
                          <button 
                            onClick={() => report.id && deleteReport(report.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="editor"
                ref={reportRef}
                data-report-container="true"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(15,23,42,0.15)] overflow-hidden border border-slate-100"
              >
                {/* Header */}
                <div className="p-8 text-center border-b border-slate-100 bg-slate-50/30 print:p-4 print:border-none print:bg-white relative" data-nav-section="header">
                  {/* Logo Section */}
                  <AnimatePresence>
                    {state.config.showLogo && (
                      <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="mb-6 print:mb-2"
                      >
                        <div className="max-w-md mx-auto space-y-3">
                          <SectionHeader 
                            title="BRAND LOGO"
                            icon={Upload}
                            onToggle={() => updateState(prev => ({ ...prev, config: { ...prev.config, showLogo: false } }))}
                            isVisible={state.config.showLogo}
                            onReset={() => updateState(prev => ({ ...prev, logo: prev.isLogoLocked ? prev.logo : null }))}
                            onLock={() => updateState(prev => ({ ...prev, isLogoLocked: !prev.isLogoLocked }))}
                            isLocked={state.isLogoLocked}
                            hideTitleInPrint
                          />
                          <label className="cursor-pointer group relative block w-full">
                            <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
                            <div className={cn(
                              "w-full h-32 rounded-3xl flex items-center justify-center transition-all duration-500 overflow-hidden print:h-32",
                              !state.logo ? "border-2 border-dashed border-slate-200 text-slate-400 group-hover:border-indigo-400 group-hover:text-indigo-500 group-hover:bg-indigo-50/30 print:border-none" : "bg-white shadow-sm print:shadow-none print:bg-transparent"
                            )}>
                              {state.logo ? (
                                <div className="relative h-full w-full">
                                  <img src={state.logo} alt="Logo" className="h-full w-full object-contain p-2" referrerPolicy="no-referrer" />
                                  {state.isLogoLocked && (
                                    <div className="absolute top-2 left-2 p-1 bg-indigo-600/80 text-white rounded-lg backdrop-blur-sm print:hidden">
                                      <Lock size={10} />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2">
                                  <Upload size={24} className="print:hidden" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] print:hidden">Upload Brand Logo</span>
                                </div>
                              )}
                            </div>
                            {state.logo && (
                              <div className="absolute -top-3 -right-2 flex flex-col gap-2 print:hidden z-10">
                                <button 
                                  onClick={(e) => { 
                                    e.preventDefault(); 
                                    if (state.isLogoLocked) {
                                      showNotification("Logo is locked", "error");
                                      return;
                                    }
                                    updateState(prev => ({ ...prev, logo: null })); 
                                  }}
                                  className="self-end p-1.5 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-rose-500 hover:border-rose-200 shadow-lg transition-all"
                                  title="Remove Logo"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </label>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="max-w-md mx-auto space-y-6">
                    {/* Report Title Section */}
                    <AnimatePresence>
                      {state.config.showReportTitle && (
                        <motion.div 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                        >
                          <div className="space-y-3">
                            <SectionHeader 
                              title="REPORT HEADER"
                              icon={Edit3}
                              onToggle={() => updateState(prev => ({ ...prev, config: { ...prev.config, showReportTitle: false } }))}
                              isVisible={state.config.showReportTitle}
                              onReset={() => updateState(prev => ({ ...prev, headerNote: '' }))}
                              hideTitleInPrint
                            />
                            <input
                              type="text"
                              placeholder="Report Title / Header Note"
                              className={cn(
                                "nav-input w-full px-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-base font-bold focus:outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all text-center text-slate-900 placeholder:text-slate-300 shadow-sm print:bg-transparent print:border-none print:text-2xl print:font-black print:py-0",
                                !state.headerNote && 'print:hidden'
                              )}
                              value={state.headerNote}
                              onChange={(e) => updateState(prev => ({ ...prev, headerNote: e.target.value }))}
                              onKeyDown={handleKeyDown}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Date Section */}
                    <AnimatePresence>
                      {state.config.showDate && (
                        <motion.div 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                        >
                          <div className="space-y-3">
                            <SectionHeader 
                              title="REPORT DATE"
                              icon={Calendar}
                              onToggle={() => updateState(prev => ({ ...prev, config: { ...prev.config, showDate: false } }))}
                              isVisible={state.config.showDate}
                              onReset={() => updateState(prev => ({ ...prev, date: format(new Date(), 'yyyy-MM-dd') }))}
                              hideTitleInPrint
                            />
                            <div className="flex items-center justify-center gap-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] print:gap-2">
                              <div className="h-px w-8 bg-slate-100 print:hidden" />
                              <div 
                                className="relative group"
                                onClick={() => {
                                  try {
                                    dateInputRef.current?.showPicker();
                                  } catch (e) {
                                    dateInputRef.current?.click();
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3 px-6 py-2.5 bg-white border-2 border-slate-100 rounded-2xl shadow-sm group-hover:border-indigo-200 transition-all cursor-pointer print:border-none print:shadow-none print:px-0 print:py-0">
                                  <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 print:hidden">
                                    <Calendar size={16} />
                                  </div>
                                  <span className="text-sm font-black text-slate-900 tracking-tight print:text-sm whitespace-nowrap">
                                    {(() => {
                                      if (!state.date) return 'Select Date';
                                      try {
                                        const parsed = parse(state.date, 'yyyy-MM-dd', new Date());
                                        if (isNaN(parsed.getTime())) throw new Error('Invalid');
                                        return format(parsed, 'EEEE, d MMMM yyyy');
                                      } catch (e) {
                                        try {
                                          const parsed = parseISO(state.date);
                                          if (isNaN(parsed.getTime())) throw new Error('Invalid');
                                          return format(parsed, 'EEEE, d MMMM yyyy');
                                        } catch (e2) {
                                          return state.date;
                                        }
                                      }
                                    })()}
                                  </span>
                                </div>
                                <input
                                  ref={dateInputRef}
                                  type="date"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                                  value={state.date}
                                  onChange={(e) => updateState(prev => ({ ...prev, date: e.target.value }))}
                                />
                              </div>
                              <div className="h-px w-8 bg-slate-100 print:hidden" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="p-8 space-y-8 print:p-6 print:space-y-4">
                  {/* Layout Controls - Top buttons removed */}

                  {/* Main Sections Container */}
                  <div className="flex flex-wrap gap-6 print:grid print:grid-cols-2 print:gap-4">
                    
                    {/* Cash Section */}
                    <AnimatePresence>
                      {state.config.showCashSection && (
                        <motion.section 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex-1 min-w-[45%]"
                          data-nav-section="cash"
                        >
                          <div className="h-full flex flex-col space-y-6">
                            <SectionHeader 
                              icon={Banknote}
                              title={state.config.cashSectionTitle}
                              onTitleChange={(val) => updateState(prev => ({ ...prev, config: { ...prev.config, cashSectionTitle: val } }))}
                              onToggle={() => updateState(prev => ({ ...prev, config: { ...prev.config, showCashSection: false } }))}
                              isVisible={state.config.showCashSection}
                              onReset={() => resetSection('cashRows')}
                              onAdd={addCashRow}
                              resetOptions={[
                                { label: 'Reset Quantities Only', onClick: resetCashQuantities },
                                { label: 'Add Standard Denominations', onClick: addStandardDenominations },
                                { label: 'Full Section Reset', onClick: () => resetSection('cashRows') }
                              ]}
                            />

                              <div className="flex-1 rounded-[2rem] border border-slate-200 shadow-sm bg-white">
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-[0.2em] font-black border-b border-slate-200">
                                    <tr>
                                      <th className="px-4 sm:px-6 py-5 print:py-1">Note</th>
                                      <th className="px-4 sm:px-6 py-5 text-center print:py-1">Qty</th>
                                      <th className="px-4 sm:px-6 py-5 text-right print:py-1">Total</th>
                                      <th className="w-10 print:hidden"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                <AnimatePresence mode="popLayout">
                                  {state.cashRows.map((row) => (
                          <motion.tr 
                            key={row.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="group hover:bg-indigo-50/30 transition-colors"
                          >
                            <td className="px-4 sm:px-6 py-4 print:py-1">
                              <MathInput 
                                className="nav-input w-full bg-transparent focus:outline-none font-black text-slate-900 print:text-xs"
                                value={row.denomination || ''}
                                showCommas={false}
                                onChange={(val) => {
                                  updateState(prev => ({
                                    ...prev,
                                    cashRows: prev.cashRows.map(r => r.id === row.id ? { ...r, denomination: val } : r)
                                  }));
                                }}
                              />
                            </td>
                            <td className="px-4 py-4 text-center print:py-1">
                              <MathInput 
                                className="nav-input w-full mx-auto text-center bg-white border border-slate-100 rounded-xl py-1.5 focus:border-indigo-400 focus:outline-none font-mono font-black text-slate-900 shadow-sm print:bg-transparent print:border-none print:shadow-none"
                                value={row.qty || ''}
                                showCommas={false}
                                onChange={(val) => {
                                  updateState(prev => ({
                                    ...prev,
                                    cashRows: prev.cashRows.map(r => r.id === row.id ? { ...r, qty: val } : r)
                                  }));
                                }}
                              />
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-right font-mono font-black text-slate-900 print:py-1">
                              {(row.denomination * row.qty).toLocaleString('en-IN')}
                            </td>
                            <td className="px-2 print:hidden">
                              <button 
                                onClick={() => updateState(prev => ({ ...prev, cashRows: prev.cashRows.filter(r => r.id !== row.id) }))}
                                className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                          <tr className="bg-slate-50 text-slate-900 font-black border-t border-slate-200">
                            <td colSpan={2} className="px-4 sm:px-6 py-5 uppercase tracking-tight text-sm font-black print:py-1.5 print-total">CASH TOTAL</td>
                            <td className="px-4 sm:px-6 py-5 text-right uppercase text-sm font-black tracking-tight print:py-1.5 print-total">{cashTotal.toLocaleString('en-IN')}</td>
                            <td className="print:hidden"></td>
                          </tr>
                          <AnimatePresence mode="popLayout">
                            {state.extraRows.map((row) => (
                          <motion.tr 
                            key={row.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="group hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-4 sm:px-6 py-4 print:py-1 min-w-[120px]">
                              <input 
                                type="text" 
                                placeholder="Label"
                                className="nav-input w-full bg-transparent focus:outline-none font-black text-slate-800 placeholder:text-slate-400 print:text-xs"
                                value={row.label}
                                onChange={(e) => {
                                  updateState(prev => ({
                                    ...prev,
                                    extraRows: prev.extraRows.map(r => r.id === row.id ? { ...r, label: e.target.value } : r)
                                  }));
                                }}
                                onKeyDown={handleKeyDown}
                              />
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-center print:py-1">
                              <MathInput 
                                className="nav-input w-full mx-auto text-center bg-transparent focus:outline-none font-black text-slate-800 placeholder:text-slate-400 print:text-xs"
                                value={row.qty || ''}
                                showCommas={false}
                                onChange={(val) => {
                                  updateState(prev => ({
                                    ...prev,
                                    extraRows: prev.extraRows.map(r => r.id === row.id ? { ...r, qty: val } : r)
                                  }));
                                }}
                              />
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-right print:py-1">
                              <MathInput 
                                className="nav-input w-full text-right bg-transparent focus:outline-none font-black text-slate-900 placeholder:text-slate-400 print:text-xs"
                                value={row.amount || ''}
                                onChange={(val) => {
                                  updateState(prev => ({
                                    ...prev,
                                    extraRows: prev.extraRows.map(r => r.id === row.id ? { ...r, amount: val } : r)
                                  }));
                                }}
                              />
                            </td>
                            <td className="px-2 print:hidden">
                              <button 
                                onClick={() => updateState(prev => ({ ...prev, extraRows: prev.extraRows.filter(r => r.id !== row.id) }))}
                                className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                      <tr className="bg-slate-50 text-slate-900 font-black border-t border-slate-200">
                        <td colSpan={2} className="px-4 sm:px-6 py-5 uppercase tracking-tight text-sm font-black print:py-1.5 print-total">
                          <div className="flex items-center gap-4">
                            GRAND TOTAL 
                            <button onClick={() => addExtraRow(1)} className="text-[9px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 print:hidden">+ ADD ROW</button>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-5 text-right uppercase text-sm font-black tracking-tight print:py-1.5 print-total">{grandTotal.toLocaleString('en-IN')}</td>
                        <td className="print:hidden"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.section>
              )}
            </AnimatePresence>

              {/* Outlet Section */}
              <AnimatePresence>
                {state.config.showOutletSection && (
                  <motion.section 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex-1 min-w-[45%]"
                    data-nav-section="outlet"
                  >
                    <div className="h-full flex flex-col space-y-6">
                      <SectionHeader 
                        title={state.config.outletSectionTitle}
                        onTitleChange={(val) => updateState(prev => ({ ...prev, config: { ...prev.config, outletSectionTitle: val } }))}
                        icon={Store}
                        onAdd={addOutletRow}
                        onReset={() => resetSection('outletRows')}
                        onToggle={() => updateState(prev => ({ ...prev, config: { ...prev.config, showOutletSection: false } }))}
                        isVisible={state.config.showOutletSection}
                        resetOptions={[
                          { label: 'Reset Amounts Only', onClick: resetOutletAmounts },
                          { label: 'Reset Names Only', onClick: resetOutletNames },
                          { label: 'Full Section Reset', onClick: () => resetSection('outletRows') }
                        ]}
                      />

                        <div className="flex-1 rounded-[2rem] border border-slate-200 shadow-sm bg-white">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-[0.2em] font-black border-b border-slate-200">
                              <tr>
                                <th className="px-4 sm:px-6 py-5 print:py-1">
                                  <EditableTableLabel 
                                    value={state.config.outletColumnLabel}
                                    onChange={(val) => updateState(prev => ({ ...prev, config: { ...prev.config, outletColumnLabel: val } }))}
                                  />
                                </th>
                                <th className="px-4 sm:px-6 py-5 text-right print:py-1">Amount</th>
                                <th className="w-10 print:hidden"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                          <AnimatePresence mode="popLayout">
                            {state.outletRows.map((row) => (
                              <motion.tr 
                                key={row.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="group hover:bg-indigo-50/30 transition-colors"
                              >
                                <td className="px-4 sm:px-6 py-4 print:py-1 min-w-[120px]">
                                  <input 
                                    type="text" 
                                    placeholder="Outlet name"
                                    className="nav-input w-full bg-transparent focus:outline-none font-black text-slate-900 placeholder:text-slate-400 print:text-xs"
                                    value={row.name}
                                    onChange={(e) => {
                                      updateState(prev => ({
                                        ...prev,
                                        outletRows: prev.outletRows.map(r => r.id === row.id ? { ...r, name: e.target.value } : r)
                                      }));
                                    }}
                                    onKeyDown={handleKeyDown}
                                  />
                                </td>
                                <td className="px-4 sm:px-6 py-4 text-right print:py-1">
                                  <MathInput 
                                    className="nav-input w-full text-right bg-transparent focus:outline-none font-mono font-black text-slate-900 print:text-xs"
                                    value={row.amount || ''}
                                    onChange={(val) => {
                                      updateState(prev => ({
                                        ...prev,
                                        outletRows: prev.outletRows.map(r => r.id === row.id ? { ...r, amount: val } : r)
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="px-2 print:hidden">
                                  <button 
                                    onClick={() => updateState(prev => ({ ...prev, outletRows: prev.outletRows.filter(r => r.id !== row.id) }))}
                                    className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                          <tr className="bg-slate-50 text-slate-900 font-black border-t border-slate-200">
                            <td className="px-4 sm:px-6 py-5 uppercase tracking-tight text-sm font-black print:py-1.5 print-total">
                              <EditableTableLabel 
                                value={state.config.outletTotalLabel}
                                onChange={(val) => updateState(prev => ({ ...prev, config: { ...prev.config, outletTotalLabel: val } }))}
                              />
                            </td>
                            <td className="px-4 sm:px-6 py-5 text-right uppercase text-sm font-black tracking-tight print:py-1.5 print-total">{outletTotal.toLocaleString('en-IN')}</td>
                            <td></td>
                          </tr>
                          {state.config.showBalanceRow && (
                            <tr className="bg-white font-black border-t border-slate-200">
                              <td className="px-4 sm:px-6 py-5 text-slate-700 uppercase tracking-tight text-sm font-black print:py-1.5 print-total">
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-3 h-3 rounded-full shadow-sm",
                                    balance > 0 ? 'bg-emerald-500 shadow-emerald-200' : balance < 0 ? 'bg-rose-500 shadow-rose-200' : 'bg-slate-300'
                                  )} />
                                  <span>{balance > 0 ? 'OVER' : balance < 0 ? 'LESS' : 'BALANCED'}</span>
                                  <button 
                                    onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showBalanceRow: false } }))}
                                    className="print:hidden text-slate-300 hover:text-indigo-600 transition-colors"
                                  >
                                    <EyeOff size={14} />
                                  </button>
                                </div>
                              </td>
                              <td className={cn(
                                "px-4 sm:px-6 py-5 text-right uppercase text-sm font-black tracking-tight print:py-1.5 print-total",
                                balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-slate-700'
                              )}>
                                {balance > 0 ? `+${balance.toLocaleString('en-IN')}` : balance.toLocaleString('en-IN')}
                              </td>
                              <td></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.section>
                )}
              </AnimatePresence>
            </div>

            {/* Signatures Section */}
            <AnimatePresence>
              {state.config.showSignaturesSection && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="w-full pt-8 border-t border-slate-50 print:pt-4"
                  data-nav-section="signatures"
                >
                  <div className="space-y-6">
                    <SectionHeader 
                      title={state.config.signaturesSectionTitle}
                      onTitleChange={(val) => updateState(prev => ({ ...prev, config: { ...prev.config, signaturesSectionTitle: val } }))}
                      icon={PenTool}
                      onAdd={addSignatureRow}
                      onReset={() => resetSection('signatureRows')}
                      onToggle={() => updateState(prev => ({ ...prev, config: { ...prev.config, showSignaturesSection: false } }))}
                      isVisible={state.config.showSignaturesSection}
                      onLock={() => updateState(prev => ({ ...prev, isSignaturesLocked: !prev.isSignaturesLocked }))}
                      isLocked={state.isSignaturesLocked}
                    />

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
                    <AnimatePresence mode="popLayout">
                      {state.signatureRows.map((row) => (
                        <motion.div 
                          key={row.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="space-y-8 group relative p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 overflow-hidden print:p-4 print:space-y-4"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-bl-full -mr-16 -mt-16 transition-all group-hover:bg-indigo-100/50" />
                          
                          <button 
                            onClick={() => {
                              if (state.isSignaturesLocked) {
                                showNotification("Signatures are locked", "error");
                                return;
                              }
                              updateState(prev => ({ ...prev, signatureRows: prev.signatureRows.filter(r => r.id !== row.id) }));
                            }}
                            className="absolute top-6 right-6 p-2 bg-white border border-slate-200 rounded-full text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10 print:hidden"
                          >
                            <Trash2 size={14} />
                          </button>
                                              <div className="space-y-3 print:space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] print:text-[7px]">Name</label>
                            <input 
                              type="text" 
                              placeholder="Type name..."
                              className={cn(
                                "nav-input w-full bg-transparent border-b-2 border-slate-200 py-2 focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300 print:text-xs print:py-0",
                                state.isSignaturesLocked && "opacity-70 cursor-not-allowed border-slate-100"
                              )}
                              value={row.name}
                              disabled={state.isSignaturesLocked}
                              onChange={(e) => {
                                updateState(prev => ({
                                  ...prev,
                                  signatureRows: prev.signatureRows.map(r => r.id === row.id ? { ...r, name: e.target.value.toUpperCase() } : r)
                                }));
                              }}
                              onKeyDown={handleKeyDown}
                            />
                          </div>
                          <div className="space-y-3 print:space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] print:text-[7px]">Designation</label>
                            <input 
                              type="text" 
                              placeholder="Type title..."
                              className={cn(
                                "nav-input w-full bg-transparent border-b-2 border-slate-200 py-2 focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-600 placeholder:text-slate-300 print:text-xs print:py-0",
                                state.isSignaturesLocked && "opacity-70 cursor-not-allowed border-slate-100"
                              )}
                              value={row.designation}
                              disabled={state.isSignaturesLocked}
                              onChange={(e) => {
                                updateState(prev => ({
                                  ...prev,
                                  signatureRows: prev.signatureRows.map(r => r.id === row.id ? { ...r, designation: e.target.value.toUpperCase() } : r)
                                }));
                              }}
                              onKeyDown={handleKeyDown}
                            />
                          </div>
                          <div className="space-y-6 print:space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] block text-center print:text-[7px]">Signature</label>
                            <div className="relative h-24 flex items-end justify-center pb-3 print:h-12">
                              <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                                <PenTool size={64} className="text-indigo-500" />
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="font-signature text-3xl text-slate-200 opacity-50 select-none print:hidden">Sign here</span>
                              </div>
                              <div className="w-full border-b-2 border-slate-200 border-dashed relative z-10"></div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.section>
              )}
            </AnimatePresence>

            {/* Notes Section */}
            <AnimatePresence>
              {state.config.showNotesSection && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="w-full pt-8 border-t border-slate-100 print:pt-4"
                  data-nav-section="notes"
                >
                  <div className="space-y-6">
                    <SectionHeader 
                      title={state.config.notesSectionTitle}
                      onTitleChange={(val) => updateState(prev => ({ ...prev, config: { ...prev.config, notesSectionTitle: val } }))}
                      icon={FileText}
                      onAdd={addNoteRow}
                      onReset={() => resetSection('noteRows')}
                      onToggle={() => updateState(prev => ({ ...prev, config: { ...prev.config, showNotesSection: false } }))}
                      isVisible={state.config.showNotesSection}
                    />
                      <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                          {state.noteRows.map((row, index) => (
                            <motion.div 
                              key={row.id}
                              layout
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              className={cn(
                                "flex items-center gap-4 group",
                                !row.text && 'print:hidden'
                              )}
                            >
                              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 font-black text-xs print:hidden">
                                #
                              </div>
                              <input 
                                type="text"
                                placeholder="Add a note..."
                                className="nav-input flex-grow bg-transparent border-b border-slate-100 focus:border-indigo-400 focus:outline-none py-2 text-sm font-bold text-slate-700 placeholder:text-slate-300 transition-all print:text-xs print:py-0"
                                value={row.text}
                                onChange={(e) => {
                                  updateState(prev => ({
                                    ...prev,
                                    noteRows: prev.noteRows.map(n => n.id === row.id ? { ...n, text: e.target.value } : n)
                                  }));
                                }}
                                onKeyDown={(e) => {
                                  handleKeyDown(e);
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addNoteRow();
                                  } else if (e.key === 'Backspace' && row.text === '' && state.noteRows.length > 1) {
                                    e.preventDefault();
                                    updateState(prev => ({
                                      ...prev,
                                      noteRows: prev.noteRows.filter(n => n.id !== row.id)
                                    }));
                                  }
                                }}
                                autoFocus={index === state.noteRows.length - 1 && index > 0}
                              />
                              <button 
                                onClick={() => updateState(prev => ({ ...prev, noteRows: prev.noteRows.filter(n => n.id !== row.id) }))}
                                className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all print:hidden"
                              >
                                <Trash2 size={16} />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.section>
              )}
            </AnimatePresence>
          </div>

            {/* Layout Controls */}
            <div className="flex flex-wrap gap-3 print:hidden py-12 border-t border-slate-100">
              <div className="w-full mb-4 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                  <Settings2 size={14} /> Layout Controls
                </span>
                <div className="flex gap-4">
                  <button 
                    onClick={hideAllSections}
                    className="text-[10px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest flex items-center gap-2"
                  >
                    <EyeOff size={12} /> Hide All
                  </button>
                  <span className="text-slate-200">|</span>
                  <button 
                    onClick={restoreAllSections}
                    className="text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center gap-2"
                  >
                    <Eye size={12} /> Restore All
                  </button>
                </div>
              </div>
              
              {!state.config.showLogo && (
                <button 
                  onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showLogo: true } }))}
                  className="flex items-center gap-2 px-5 py-2 text-[10px] font-black bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Eye size={14} /> Show Brand Logo
                </button>
              )}
              {!state.config.showReportTitle && (
                <button 
                  onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showReportTitle: true } }))}
                  className="flex items-center gap-2 px-5 py-2 text-[10px] font-black bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Eye size={14} /> Show Report Header
                </button>
              )}
              {!state.config.showDate && (
                <button 
                  onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showDate: true } }))}
                  className="flex items-center gap-2 px-5 py-2 text-[10px] font-black bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Eye size={14} /> Show Report Date
                </button>
              )}
              {!state.config.showCashSection && (
                <button 
                  onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showCashSection: true } }))}
                  className="flex items-center gap-2 px-5 py-2 text-[10px] font-black bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Eye size={14} /> Show {state.config.cashSectionTitle}
                </button>
              )}
              {!state.config.showOutletSection && (
                <button 
                  onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showOutletSection: true } }))}
                  className="flex items-center gap-2 px-5 py-2 text-[10px] font-black bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Eye size={14} /> Show {state.config.outletSectionTitle}
                </button>
              )}
              {!state.config.showSignaturesSection && (
                <button 
                  onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showSignaturesSection: true } }))}
                  className="flex items-center gap-2 px-5 py-2 text-[10px] font-black bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Eye size={14} /> Show {state.config.signaturesSectionTitle}
                </button>
              )}
              {!state.config.showNotesSection && (
                <button 
                  onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showNotesSection: true } }))}
                  className="flex items-center gap-2 px-5 py-2 text-[10px] font-black bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Eye size={14} /> Show {state.config.notesSectionTitle}
                </button>
              )}
              {!state.config.showBalanceRow && state.config.showOutletSection && (
                <button 
                  onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showBalanceRow: true } }))}
                  className="flex items-center gap-2 px-5 py-2 text-[10px] font-black bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Eye size={14} /> Show Over/Less
                </button>
              )}
            </div>
            
            {/* Footer Actions */}
          <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex flex-wrap gap-6 justify-center print:hidden">
            <button 
              onClick={() => {
                setConfirmAction({
                  title: 'Reset All Data',
                  message: 'Are you sure you want to reset all data? This will clear all current entries and cannot be undone.',
                  onConfirm: resetAll
                });
              }}
              className="px-8 py-3 bg-white border border-rose-100 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all shadow-sm flex items-center gap-3"
            >
              <RotateCcw size={16} /> Reset All
            </button>

            <div className="h-10 w-px bg-slate-200 mx-2" />

            <div className="flex gap-3">
              <button 
                onClick={handleCreateShortcut}
                className="px-8 py-3 bg-white border border-indigo-100 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-3"
              >
                <FileDown size={16} /> Create Shortcut
              </button>
            </div>

            <div className="h-10 w-px bg-slate-200 mx-2" />

            <div className="flex gap-3">
              <button 
                onClick={saveReport}
                disabled={isSaving}
                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-3 disabled:opacity-50"
              >
                {isSaving ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />}
                {state.id ? 'Update Saved' : 'Save Locally'}
              </button>

              <button 
                onClick={() => setShowQr(true)}
                className="px-8 py-3 bg-white border border-indigo-100 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-3"
              >
                <QrCode size={16} /> QR Code
              </button>
            </div>

            <div className="h-10 w-px bg-slate-200 mx-2" />

            <div className="flex gap-3">
              <button 
                onClick={handleSaveWord}
                className="px-8 py-3 bg-white border border-blue-100 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all shadow-sm flex items-center gap-3"
              >
                <FileText size={16} /> Word
              </button>

              <button 
                onClick={handlePrint}
                className="px-8 py-3 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl flex items-center gap-3"
              >
                <Printer size={16} /> Print
              </button>

              <button 
                onClick={() => setShowInstructions(true)}
                className="px-8 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all shadow-sm flex items-center gap-3"
              >
                <HelpCircle size={16} /> Instructions
              </button>
            </div>
            <div className="mt-8 border-t border-slate-100" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>

        {/* QR Code Modal */}
        <AnimatePresence>
          {showQr && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowQr(false)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full text-center border border-slate-100"
              >
                <button 
                  onClick={() => setShowQr(false)}
                  className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="mb-8">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-2">Report QR Code</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Scan to view digital copy</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-inner inline-block mb-8 border border-slate-100 min-h-[200px] flex items-center justify-center">
                  {isQrTooLarge ? (
                    <div className="text-rose-500 p-4 max-w-[200px]">
                      <AlertCircle className="mx-auto mb-2" size={32} />
                      <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                        Report too large for QR code. Please use the Share button below.
                      </p>
                    </div>
                  ) : (
                    <QRCodeSVG 
                      value={shareUrl} 
                      size={200}
                      level="M"
                      includeMargin={false}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'Daily Finance Report',
                          text: `Check out the report for ${state.date}`,
                          url: shareUrl
                        }).catch(() => {
                          navigator.clipboard.writeText(shareUrl);
                          showNotification("Link copied to clipboard");
                        });
                      } else {
                        navigator.clipboard.writeText(shareUrl);
                        showNotification("Link copied to clipboard");
                      }
                    }}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3"
                  >
                    <Share2 size={18} /> Share Report
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      showNotification("Link copied to clipboard");
                    }}
                    className="w-full py-3 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-100 transition-all flex items-center justify-center gap-3 border border-slate-200"
                  >
                    <FileText size={16} /> Copy Link
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        <ConfirmationModal 
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAction?.onConfirm || (() => {})}
          title={confirmAction?.title || ''}
          message={confirmAction?.message || ''}
        />

        {/* Instructions Modal */}
        <AnimatePresence>
          {showInstructions && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setShowInstructions(false)}
                className="absolute inset-0 bg-slate-950/60"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative bg-white p-10 rounded-[3rem] shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50/50 rounded-bl-full -mr-20 -mt-20" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                      <HelpCircle size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-widest">How to Use</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">App Features & Instructions</p>
                    </div>
                  </div>

                  <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                    <section className="space-y-3">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" /> Data Persistence
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        The app <strong>automatically saves</strong> your work every second. Even if you close the browser or your PC shuts down, your data will be right here when you return.
                      </p>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" /> Smart Math Inputs
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        You can type math directly into any number field! For example, typing <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-bold">500*3 + 200</code> will automatically calculate the result.
                      </p>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" /> Layout Controls
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Use the <strong>Layout Controls</strong> at the bottom to hide or show sections (Logo, Header, Date, etc.). You can also rename any section title by clicking on it.
                      </p>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" /> Exporting
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Save your report as a <strong>Word</strong> document, or <strong>Print</strong> it directly. All formats are optimized to look identical to the app.
                      </p>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" /> Desktop Shortcut
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Click <strong>"Create Shortcut"</strong> to download a small file. Move this file to your Desktop. Double-clicking it will always open this app with your latest data ready.
                      </p>
                    </section>
                  </div>

                  <button 
                    onClick={() => setShowInstructions(false)}
                    className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl"
                  >
                    Got it, thanks!
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* App Footer */}
        <div className="mt-12 mb-8 flex flex-col items-center gap-4 print:hidden">
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          <div className="text-center">
            <div className="font-signature text-2xl text-slate-600 mb-1">
              E. Azad
            </div>
            <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
              Financial Reporting System v2.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
