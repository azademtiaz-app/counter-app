/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Upload, 
  Plus, 
  RotateCcw, 
  Trash2, 
  Banknote, 
  Store, 
  FileText,
  Calendar,
  Printer,
  FileSpreadsheet,
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
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { format, parseISO, parse } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  };
  userId?: string;
  createdAt?: any;
  updatedAt?: any;
}

const initialState: AppState = {
  headerNote: '',
  date: format(new Date(), 'yyyy-MM-dd'),
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
  ],
  noteRows: [
    { id: '1', text: '' },
  ],
  logo: null,
  config: {
    cashSectionTitle: 'CASH',
    outletSectionTitle: 'OUTLET',
    signaturesSectionTitle: 'SIGNATURES',
    notesSectionTitle: 'NOTES',
    outletColumnLabel: 'OUTLET',
    outletTotalLabel: 'OUTLET TOTAL',
    showCashSection: true,
    showOutletSection: true,
    showSignaturesSection: true,
    showNotesSection: true,
    showBalanceRow: true,
  }
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
          className={cn("bg-white border-b border-indigo-500 focus:outline-none px-1 py-0.5 w-full", className)}
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
      <span className={cn("truncate", className)}>{value}</span>
      <button 
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover/label:opacity-100 p-1 text-slate-300 hover:text-indigo-600 transition-all print:hidden"
      >
        <Edit3 size={12} />
      </button>
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
  const [history, setHistory] = useState<AppState[]>([]);
  const [future, setFuture] = useState<AppState[]>([]);
  const [reports, setReports] = useState<AppState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, future, state]);

  // Load Reports from LocalStorage
  useEffect(() => {
    const savedReports = localStorage.getItem('cash_reports');
    if (savedReports) {
      try {
        setReports(JSON.parse(savedReports));
      } catch (e) {
        console.error("Failed to parse saved reports", e);
      }
    }
  }, []);

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

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('cash_report_draft');
    if (draft) {
      try {
        const parsedDraft = JSON.parse(draft);
        if (parsedDraft.cashRows) {
          // Always update date to today on mount to satisfy "auto change with local time"
          const today = format(new Date(), 'yyyy-MM-dd');
          setState({ ...parsedDraft, date: today });
        }
      } catch (e) {}
    }
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const saveReport = () => {
    setIsSaving(true);
    setTimeout(() => {
      const reportData = {
        ...state,
        id: state.id || crypto.randomUUID(),
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
    if (!window.confirm("Are you sure you want to delete this report?")) return;
    setReports(prev => prev.filter(r => r.id !== id));
    if (state.id === id) {
      resetAll();
    }
    showNotification("Report deleted");
  };

  const loadReport = (report: AppState) => {
    setState(report);
    setShowHistory(false);
    showNotification("Report loaded");
  };

  const updateState = (newState: AppState | ((prev: AppState) => AppState)) => {
    setHistory(prev => [state, ...prev].slice(0, 50)); // Limit history to 50 steps
    setFuture([]); // Clear future on new action
    setState(newState);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[0];
    const newHistory = history.slice(1);
    setFuture(prev => [state, ...prev]);
    setHistory(newHistory);
    setState(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setHistory(prev => [state, ...prev]);
    setFuture(newFuture);
    setState(next);
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
    const newRows = Array.from({ length: count }, () => ({ id: crypto.randomUUID(), denomination: 0, qty: 0 }));
    updateState(prev => ({
      ...prev,
      cashRows: [...prev.cashRows, ...newRows]
    }));
  };

  const addExtraRow = (count: number = 1) => {
    const newRows = Array.from({ length: count }, () => ({ id: crypto.randomUUID(), label: '', qty: 0, amount: 0 }));
    updateState(prev => ({
      ...prev,
      extraRows: [...prev.extraRows, ...newRows]
    }));
  };

  const addOutletRow = (count: number = 1) => {
    const newRows = Array.from({ length: count }, () => ({ id: crypto.randomUUID(), name: '', amount: 0 }));
    updateState(prev => ({
      ...prev,
      outletRows: [...prev.outletRows, ...newRows]
    }));
  };

  const addSignatureRow = () => {
    updateState(prev => ({
      ...prev,
      signatureRows: [...prev.signatureRows, { id: crypto.randomUUID(), name: '', designation: '' }]
    }));
  };

  const addNoteRow = () => {
    updateState(prev => ({
      ...prev,
      noteRows: [...prev.noteRows, { id: crypto.randomUUID(), text: '' }]
    }));
  };

  const resetSection = (section: keyof AppState) => {
    updateState(prev => ({ ...prev, [section]: initialState[section] }));
  };

  const resetAll = () => {
    updateState({
      ...initialState,
      date: new Date().toISOString().split('T')[0]
    });
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
      const newRows = toAdd.map(d => ({ id: crypto.randomUUID(), denomination: d, qty: 0 }));
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
        showBalanceRow: false
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
        showBalanceRow: true
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
              body { background: white !important; padding: 0 !important; margin: 0 !important; }
              .print-hidden { display: none !important; }
              button { display: none !important; }
              input, textarea { border: none !important; background: transparent !important; padding: 0 !important; }
              .shadow-xl, .shadow-sm { shadow: none !important; }
              .rounded-2xl, .rounded-xl { border-radius: 0 !important; }
              .bg-slate-50, .bg-slate-100 { background: transparent !important; }
              * { color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
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

  const handleSavePdf = async () => {
    if (!reportRef.current) {
      console.error('Report ref not found');
      return;
    }
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Cash_Report_${state.date}.pdf`);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('PDF generation failed. Please try again or use the Print button.');
    }
  };

  const handleSaveExcel = () => {
    const cashData = state.cashRows.map(row => ({
      'Type': 'Note',
      'Label/Value': row.denomination,
      'Quantity': row.qty,
      'Total': row.denomination * row.qty
    }));

    const extraData = state.extraRows.map(row => ({
      'Type': 'Extra Row',
      'Label/Value': row.label,
      'Quantity': row.qty,
      'Total': row.amount
    }));

    const outletData = state.outletRows.map(row => ({
      [state.config.outletColumnLabel || 'Outlet Name']: row.name,
      'Amount': row.amount
    }));

    const wb = XLSX.utils.book_new();
    
    const wsCash = XLSX.utils.json_to_sheet([...cashData, ...extraData]);
    XLSX.utils.book_append_sheet(wb, wsCash, 'Cash Section');
    
    const wsOutlet = XLSX.utils.json_to_sheet(outletData);
    XLSX.utils.book_append_sheet(wb, wsOutlet, 'Outlet Section');
    
    // Summary Data
    const summaryData = [
      ['Date', state.date],
      ['Header Note', state.headerNote],
      ['Cash Total', cashTotal],
      ['Extra Rows Total', extraTotal],
      ['Grand Total', grandTotal],
      [state.config.outletTotalLabel || 'Outlet Total', outletTotal],
      ['Balance', balance],
      ['Notes', state.noteRows.map(n => n.text).join('\n')]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    XLSX.writeFile(wb, `Cash_Report_${state.date}.xlsx`);
  };

  const handleSaveData = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cash_Report_Data_${state.date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const loadedState = JSON.parse(event.target?.result as string);
          // Simple validation: check if it has a config or cashRows
          if (loadedState.cashRows || loadedState.config) {
            updateState(loadedState);
          } else {
            alert('Invalid data file format.');
          }
        } catch (err) {
          console.error('Failed to parse JSON:', err);
          alert('Failed to load data. File might be corrupted.');
        }
      };
      reader.readAsText(file);
    }
  };

  const evaluateMath = (input: string): number => {
    try {
      // Remove commas first
      const noCommas = input.replace(/,/g, '');
      // Basic sanitization: only allow numbers and + - * / . ( )
      const sanitized = noCommas.replace(/[^-+*/.()0-9]/g, '');
      if (!sanitized) return 0;
      // Use Function constructor for simple math evaluation (safer than eval if sanitized)
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${sanitized}`)();
      return typeof result === 'number' && isFinite(result) ? result : 0;
    } catch (e) {
      return 0;
    }
  };

  const MathInput = ({ 
    value, 
    onChange, 
    placeholder, 
    className,
    showCommas = true 
  }: { 
    value: number | string, 
    onChange: (val: number) => void, 
    placeholder?: string, 
    className?: string,
    type?: "number" | "text",
    showCommas?: boolean
  }) => {
    const [localValue, setLocalValue] = useState(value.toString());
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (!isFocused) {
        setLocalValue(typeof value === 'number' ? (showCommas ? value.toLocaleString('en-IN') : value.toString()) : value.toString());
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Let global handler handle Enter for navigation
    };

    return (
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      />
    );
  };

  const SectionHeader = ({ 
    title, 
    onTitleChange, 
    onToggle, 
    isVisible, 
    icon: Icon,
    onReset,
    onAdd,
    resetOptions
  }: { 
    title: string, 
    onTitleChange: (val: string) => void, 
    onToggle?: () => void, 
    isVisible?: boolean, 
    icon: any,
    onReset?: () => void,
    onAdd?: (count: number) => void,
    resetOptions?: { label: string, onClick: () => void }[]
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showResetMenu, setShowResetMenu] = useState(false);
    const [addCount, setAddCount] = useState(1);

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
                className="bg-white border-b-2 border-indigo-500 focus:outline-none font-bold uppercase tracking-widest text-slate-900 px-1 py-0.5 text-sm"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
              />
              <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X size={14} className="text-slate-400" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-black uppercase tracking-widest text-sm print:text-[10px]">{title}</span>
              <button 
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover/header:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all print:hidden"
              >
                <Edit3 size={14} />
              </button>
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
          {onAdd && isVisible !== false && (
            <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <input 
                type="number" 
                min="1" 
                max="50"
                className="w-10 px-1 py-1 text-xs text-center focus:outline-none border-r border-slate-100 bg-transparent text-slate-900 font-bold"
                value={addCount}
                onChange={(e) => setAddCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button 
                onClick={() => onAdd(addCount)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          )}
          {onReset && isVisible !== false && (
          <div className="relative">
            <button 
              onClick={() => resetOptions ? setShowResetMenu(!showResetMenu) : onReset()} 
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white text-slate-600 rounded-lg border border-slate-200 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 transition-all shadow-sm"
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
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Reset Options</div>
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
                        <span className="font-medium">{opt.label}</span>
                      </button>
                    ))}
                    <div className="border-t border-slate-50 my-1.5" />
                    <button
                      onClick={() => {
                        onReset();
                        setShowResetMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3 font-bold"
                    >
                      <Trash2 size={12} />
                      <span>Reset Everything</span>
                    </button>
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

  return (
    <div className="min-h-screen bg-slate-50 transition-colors duration-300 font-sans text-slate-900 print:p-0 print:bg-white">
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
          <div className="flex gap-4 self-end sm:self-auto">
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(15,23,42,0.15)] overflow-hidden border border-slate-100"
              >
                {/* Header */}
                <div className="p-12 text-center border-b border-slate-100 bg-slate-50/30 print:p-4 print:border-none">
                  <div className="mb-10 flex justify-center print:mb-2">
                    <label className="cursor-pointer group relative">
                      <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
                      <div className="w-48 h-20 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center gap-3 text-slate-400 group-hover:border-indigo-400 group-hover:text-indigo-500 group-hover:bg-indigo-50/30 transition-all duration-500 overflow-hidden print:border-none print:h-12">
                        {state.logo ? (
                          <img src={state.logo} alt="Logo" className="h-full w-full object-contain p-3 print:p-0" referrerPolicy="no-referrer" />
                        ) : (
                          <>
                            <Upload size={24} className="print:hidden" />
                            <span className="text-xs font-black uppercase tracking-[0.2em] print:hidden">Brand Logo</span>
                          </>
                        )}
                      </div>
                      {state.logo && (
                        <button 
                          onClick={(e) => { e.preventDefault(); updateState(prev => ({ ...prev, logo: null })); }}
                          className="absolute -top-2 -right-2 p-1.5 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shadow-lg print:hidden"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </label>
                  </div>

                  <div className="max-w-md mx-auto space-y-8 print:space-y-2">
                    <input
                      type="text"
                      placeholder="Report Title / Header Note"
                      className={cn(
                        "nav-input w-full px-8 py-4 bg-white border border-slate-200 rounded-2xl text-base font-bold focus:outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all text-center text-slate-900 placeholder:text-slate-300 shadow-sm print:bg-transparent print:border-none print:text-2xl print:font-black print:py-0",
                        !state.headerNote && 'print:hidden'
                      )}
                      value={state.headerNote}
                      onChange={(e) => updateState(prev => ({ ...prev, headerNote: e.target.value }))}
                    />
                    
                    <div className="flex items-center justify-center gap-6 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] print:gap-2">
                      <div className="h-px w-12 bg-slate-100 print:hidden" />
                      <div className="relative group">
                        {/* The "Pretty" UI (Underneath) */}
                        <div 
                          onClick={() => {
                            try {
                              dateInputRef.current?.showPicker();
                            } catch (e) {
                              // Fallback for browsers that don't support showPicker()
                              dateInputRef.current?.click();
                            }
                          }}
                          className="flex items-center gap-4 px-8 py-4 bg-white border-2 border-slate-100 rounded-3xl shadow-sm group-hover:border-indigo-200 transition-all cursor-pointer print:border-none print:shadow-none print:px-0 print:py-0"
                        >
                          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 print:hidden">
                            <Calendar size={20} />
                          </div>
                          <span className="text-base font-black text-slate-900 tracking-tight print:text-sm whitespace-nowrap">
                            {state.date ? format(parse(state.date, 'yyyy-MM-dd', new Date()), 'EEEE, d MMMM yyyy') : 'Select Date'}
                          </span>
                        </div>
                        
                        {/* The actual native input (Invisible but clickable on top) */}
                        <input
                          ref={dateInputRef}
                          type="date"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                          value={state.date}
                          onChange={(e) => updateState(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      
                      <button 
                        onClick={() => updateState(prev => ({ ...prev, date: format(new Date(), 'yyyy-MM-dd') }))}
                        className="p-2.5 bg-white border-2 border-slate-100 rounded-2xl text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm print:hidden"
                        title="Set to Today"
                      >
                        <RotateCcw size={18} />
                      </button>

                      <div className="h-px w-12 bg-slate-100 print:hidden" />
                    </div>
                  </div>
                </div>
                <div className="p-12 space-y-20 print:p-6 print:space-y-8">
                  {/* Main Sections Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 print:grid-cols-2 print:gap-6">
                    
                    {/* Cash Section */}
                    <AnimatePresence>
                      {state.config.showCashSection && (
                        <motion.section 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-6"
                        >
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
                              { label: 'Add Standard Denominations', onClick: addStandardDenominations }
                            ]}
                          />

                          <div className="overflow-hidden rounded-[2rem] print:rounded-none border border-slate-200 shadow-sm bg-white">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-[0.2em] font-black border-b border-slate-100">
                                <tr>
                                  <th className="px-6 py-5 print:py-1 w-[30%]">Note</th>
                                  <th className="px-6 py-5 text-center print:py-1 w-[25%]">Qty</th>
                                  <th className="px-6 py-5 text-right print:py-1 w-[45%]">Total</th>
                                  <th className="w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
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
                            <td className="px-6 py-4 print:py-1">
                              <MathInput 
                                className="nav-input w-full bg-transparent focus:outline-none font-bold text-slate-900 print:text-xs"
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
                                className="nav-input w-full max-w-[140px] mx-auto text-center bg-white border border-slate-100 rounded-xl py-1.5 focus:border-indigo-400 focus:outline-none font-mono font-bold text-slate-900 shadow-sm print:bg-transparent print:border-none print:shadow-none"
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
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 print:py-1">
                              {(row.denomination * row.qty).toLocaleString('en-IN')}
                            </td>
                            <td className="px-2">
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
                            <td colSpan={2} className="px-6 py-4 uppercase tracking-[0.2em] text-[13px] print:py-1.5">Cash Total</td>
                            <td className="px-6 py-4 text-right font-mono text-[17px] print:py-1.5 print:text-xs">{cashTotal.toLocaleString('en-IN')}</td>
                            <td></td>
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
                            <td className="px-6 py-4 print:py-1 min-w-[120px]">
                              <input 
                                type="text" 
                                placeholder="Label"
                                className="nav-input w-full bg-transparent focus:outline-none font-bold text-slate-800 placeholder:text-slate-400 print:text-xs"
                                value={row.label}
                                onChange={(e) => {
                                  updateState(prev => ({
                                    ...prev,
                                    extraRows: prev.extraRows.map(r => r.id === row.id ? { ...r, label: e.target.value } : r)
                                  }));
                                }}
                              />
                            </td>
                            <td className="px-6 py-4 text-center print:py-1">
                              <MathInput 
                                className="nav-input w-full max-w-[80px] mx-auto text-center bg-transparent focus:outline-none font-bold text-slate-800 placeholder:text-slate-400 print:text-xs"
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
                            <td className="px-6 py-4 text-right print:py-1">
                              <MathInput 
                                className="nav-input w-full text-right bg-transparent focus:outline-none font-bold text-slate-900 placeholder:text-slate-400 print:text-xs"
                                value={row.amount || ''}
                                onChange={(val) => {
                                  updateState(prev => ({
                                    ...prev,
                                    extraRows: prev.extraRows.map(r => r.id === row.id ? { ...r, amount: val } : r)
                                  }));
                                }}
                              />
                            </td>
                            <td className="px-2">
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
                        <td colSpan={2} className="px-6 py-4 uppercase tracking-[0.2em] text-[13px] print:py-1.5">
                          <div className="flex items-center gap-4">
                            Grand Total 
                            <button onClick={addExtraRow} className="text-[9px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 print:hidden">+ ADD ROW</button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-[17px] print:py-1.5 print:text-xs">{grandTotal.toLocaleString('en-IN')}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
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
                    className="space-y-6"
                  >
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
                        { label: 'Reset Names Only', onClick: resetOutletNames }
                      ]}
                    />

                    <div className="overflow-hidden rounded-[2rem] print:rounded-none border border-slate-200 shadow-sm bg-white">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-[0.2em] font-black border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-5 print:py-1 w-[75%]">
                              <EditableTableLabel 
                                value={state.config.outletColumnLabel}
                                onChange={(val) => updateState(prev => ({ ...prev, config: { ...prev.config, outletColumnLabel: val } }))}
                              />
                            </th>
                            <th className="px-6 py-5 text-right print:py-1 w-[25%]">Amount</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
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
                                <td className="px-6 py-4 print:py-1 min-w-[120px]">
                                  <input 
                                    type="text" 
                                    placeholder="Outlet name"
                                    className="nav-input w-full bg-transparent focus:outline-none font-bold text-slate-900 placeholder:text-slate-400 print:text-xs"
                                    value={row.name}
                                    onChange={(e) => {
                                      updateState(prev => ({
                                        ...prev,
                                        outletRows: prev.outletRows.map(r => r.id === row.id ? { ...r, name: e.target.value } : r)
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="px-6 py-4 text-right print:py-1">
                                  <MathInput 
                                    className="nav-input w-full text-right bg-transparent focus:outline-none font-mono font-bold text-slate-900 print:text-xs"
                                    value={row.amount || ''}
                                    onChange={(val) => {
                                      updateState(prev => ({
                                        ...prev,
                                        outletRows: prev.outletRows.map(r => r.id === row.id ? { ...r, amount: val } : r)
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="px-2">
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
                            <td className="px-6 py-4 uppercase tracking-[0.2em] text-[13px] print:py-1.5">
                              <EditableTableLabel 
                                value={state.config.outletTotalLabel}
                                onChange={(val) => updateState(prev => ({ ...prev, config: { ...prev.config, outletTotalLabel: val } }))}
                              />
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-[17px] print:py-1.5 print:text-xs">{outletTotal.toLocaleString('en-IN')}</td>
                            <td></td>
                          </tr>
                          {state.config.showBalanceRow && (
                            <tr className="bg-white font-black border-t border-slate-200">
                              <td className="px-6 py-4 text-slate-700 uppercase tracking-[0.2em] text-[13px] print:py-1.5">
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-2.5 h-2.5 rounded-full shadow-sm",
                                    balance > 0 ? 'bg-emerald-500 shadow-emerald-200' : balance < 0 ? 'bg-rose-500 shadow-rose-200' : 'bg-slate-300'
                                  )} />
                                  <span>{balance > 0 ? 'Over' : balance < 0 ? 'Less' : 'Balanced'}</span>
                                  <button 
                                    onClick={() => updateState(prev => ({ ...prev, config: { ...prev.config, showBalanceRow: false } }))}
                                    className="print:hidden text-slate-300 hover:text-indigo-600 transition-colors"
                                  >
                                    <EyeOff size={14} />
                                  </button>
                                </div>
                              </td>
                              <td className={cn(
                                "px-6 py-4 text-right font-mono text-[17px] print:py-1.5 print:text-xs",
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
                  className="space-y-8 pt-12 border-t border-slate-100"
                >
                  <SectionHeader 
                    title={state.config.signaturesSectionTitle}
                    onTitleChange={(val) => updateState(prev => ({ ...prev, config: { ...prev.config, signaturesSectionTitle: val } }))}
                    icon={PenTool}
                    onAdd={addSignatureRow}
                    onReset={() => resetSection('signatureRows')}
                    onToggle={() => updateState(prev => ({ ...prev, config: { ...prev.config, showSignaturesSection: false } }))}
                    isVisible={state.config.showSignaturesSection}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 print:grid-cols-3 print:gap-4">
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
                            onClick={() => updateState(prev => ({ ...prev, signatureRows: prev.signatureRows.filter(r => r.id !== row.id) }))}
                            className="absolute top-6 right-6 p-2 bg-white border border-slate-200 rounded-full text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10 print:hidden"
                          >
                            <Trash2 size={14} />
                          </button>
                                              <div className="space-y-3 print:space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] print:text-[7px]">Name</label>
                            <input 
                              type="text" 
                              placeholder="Type name..."
                              className="nav-input w-full bg-transparent border-b-2 border-slate-200 py-2 focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300 print:text-xs print:py-0"
                              value={row.name}
                              onChange={(e) => {
                                updateState(prev => ({
                                  ...prev,
                                  signatureRows: prev.signatureRows.map(r => r.id === row.id ? { ...r, name: e.target.value } : r)
                                }));
                              }}
                            />
                          </div>
                          <div className="space-y-3 print:space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] print:text-[7px]">Designation</label>
                            <input 
                              type="text" 
                              placeholder="Type title..."
                              className="nav-input w-full bg-transparent border-b-2 border-slate-200 py-2 focus:outline-none focus:border-indigo-500 transition-all text-sm font-bold text-slate-600 placeholder:text-slate-300 print:text-xs print:py-0"
                              value={row.designation}
                              onChange={(e) => {
                                updateState(prev => ({
                                  ...prev,
                                  signatureRows: prev.signatureRows.map(r => r.id === row.id ? { ...r, designation: e.target.value } : r)
                                }));
                              }}
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
                  className="space-y-6 pt-12 border-t border-slate-100 print:pt-4"
                >
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
                </motion.section>
              )}
            </AnimatePresence>

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
          </div>
          
          {/* Footer Actions */}
          <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex flex-wrap gap-6 justify-center print:hidden">
            <button 
              onClick={resetAll}
              className="px-8 py-3 bg-white border border-rose-100 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all shadow-sm flex items-center gap-3"
            >
              <RotateCcw size={16} /> Reset All
            </button>

            <div className="h-10 w-px bg-slate-200 mx-2" />

            <div className="flex gap-3">
              <button 
                onClick={handleSaveData}
                className="px-8 py-3 bg-white border border-indigo-100 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-3"
              >
                <FileDown size={16} /> Save to Device
              </button>

              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleLoadData} accept=".json" />
                <div className="px-8 py-3 bg-white border border-indigo-100 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-3">
                  <FileUp size={16} /> Load from Device
                </div>
              </label>
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
                onClick={handleSaveExcel}
                className="px-8 py-3 bg-white border border-emerald-100 text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-sm flex items-center gap-3"
              >
                <FileSpreadsheet size={16} /> Excel
              </button>

              <button 
                onClick={handleSavePdf}
                className="px-8 py-3 bg-white border border-rose-100 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all shadow-sm flex items-center gap-3"
              >
                <Download size={16} /> PDF
              </button>

              <button 
                onClick={handlePrint}
                className="px-8 py-3 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl flex items-center gap-3"
              >
                <Printer size={16} /> Print
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
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scan to view digital copy</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-inner inline-block mb-8 border border-slate-100">
                  <QRCodeSVG 
                    value={window.location.href} 
                    size={200}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <button 
                  onClick={() => {
                    navigator.share?.({
                      title: 'Daily Finance Report',
                      text: `Check out the report for ${state.date}`,
                      url: window.location.href
                    }).catch(() => {
                      navigator.clipboard.writeText(window.location.href);
                      showNotification("Link copied to clipboard");
                    });
                  }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3"
                >
                  <Share2 size={18} /> Share Report
                </button>
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
