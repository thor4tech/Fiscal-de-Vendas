import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useDropzone } from 'react-dropzone';
import { Icons } from './ui/Icons';
import { extractTextFromFile } from '../services/ocr';
import { analyzeConversation, continueChat } from '../services/gemini';
import { saveAudit, deductCredit, addCredits, getUserAudits } from '../services/firestore';
import { AnalysisResult, User, AuditRecord, UserProfile, ChatMessage } from '../types';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { PricingModal } from './PricingModal';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    Title, 
    Tooltip, 
    Legend, 
    Filler,
    RadialLinearScale 
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';
import { History } from './History';
import { Settings } from './Settings';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, RadialLinearScale);

interface DashboardProps {
  user: User;
  userProfile: UserProfile;
  refreshProfile: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Improved Tooltip Component with smooth animation
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-block ml-2 align-middle z-10 cursor-help">
        <Icons.Info className="w-3.5 h-3.5 text-text-muted transition-colors group-hover:text-brand-primary" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#111] border border-white/10 rounded-xl text-xs text-text-secondary text-center opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none z-50 shadow-xl backdrop-blur-md">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111]"></div>
        </div>
    </div>
);

// Lazy Load Toast with Slide Animation
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-6 right-6 px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-[100] animate-fade-in-up border backdrop-blur-md ${type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
            {type === 'success' ? <Icons.CheckCircle className="w-5 h-5" /> : <Icons.AlertTriangle className="w-5 h-5" />}
            <span className="text-sm font-medium">{message}</span>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ user, userProfile, refreshProfile, theme, toggleTheme }) => {
  // Navigation State
  const [view, setView] = useState<'dashboard' | 'history' | 'settings'>('dashboard');

  // Data State
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  // Analysis State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  
  // UI State
  const [showPricing, setShowPricing] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<{ content: string, name: string, type: string } | null>(null);

  // Fetch History (Initial summary load)
  useEffect(() => {
    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        // We grab just a few for the dashboard summary
        const data = await getUserAudits(user.uid, null, 5); 
        setAudits(data.audits);
        setIsLoadingHistory(false);
    };
    fetchHistory();
  }, [user.uid]);

  // Derived Stats
  const totalAudits = audits.length; 
  const avgScore = totalAudits > 0 
    ? Math.round(audits.reduce((acc, curr) => acc + (curr.result?.resumo_executivo?.score || curr.score || 0), 0) / totalAudits) 
    : 0;
  const criticalErrors = audits.filter(a => (a.result?.resumo_executivo?.score || a.score) < 40).length;
  const bestScore = totalAudits > 0 
    ? Math.max(...audits.map(a => (a.result?.resumo_executivo?.score || a.score || 0))) 
    : 0;

  // Chart Logic
  const chartData = React.useMemo(() => ({
    labels: audits.slice(0, 7).reverse().map(a => new Date(a.timestamp).toLocaleDateString('pt-BR', { weekday: 'short' })),
    datasets: [{
      label: 'Score',
      data: audits.slice(0, 7).reverse().map(a => (a.result?.resumo_executivo?.score || a.score || 0)),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#10b981',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
    }]
  }), [audits]);

  const radarData = React.useMemo(() => {
      // Calculate average metrics from last 3 audits to show "Current Skills"
      const recent = audits.slice(0, 3);
      if (recent.length === 0) return null;

      const metricsKeys = ['rapport', 'escuta_ativa', 'tratamento_objecoes', 'clareza', 'urgencia', 'profissionalismo'];
      const averages = metricsKeys.map(key => {
          const sum = recent.reduce((acc, curr) => acc + (curr.result?.metricas?.[key as keyof typeof curr.result.metricas]?.nota || 0), 0);
          return Math.round(sum / recent.length);
      });

      return {
          labels: ['Rapport', 'Escuta', 'Objeções', 'Clareza', 'Urgência', 'Profissional'],
          datasets: [{
              label: 'Suas Habilidades',
              data: averages,
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              borderColor: '#10b981',
              pointBackgroundColor: '#10b981',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: '#10b981'
          }]
      };
  }, [audits]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a1a',
        titleColor: '#fff',
        bodyColor: '#ccc',
        borderColor: '#333',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
      }
    },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
      },
      y: { 
        min: 0, 
        max: 100,
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { display: false } 
      }
    }
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            pointLabels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 10 } },
            ticks: { display: false, backdropColor: 'transparent' },
            min: 0,
            max: 100,
        }
    },
    plugins: {
        legend: { display: false }
    }
  };

  // --- CORE LOGIC ---

  const initiateAnalysis = (content: string, sourceName: string, sourceType: string) => {
      if (userProfile.credits <= 0 && userProfile.plan !== 'pro') {
          setShowPricing(true);
          return;
      }
      setPendingAnalysis({ content, name: sourceName, type: sourceType });
      setShowCreditConfirm(true);
  };

  const confirmAnalysis = async () => {
     if (!pendingAnalysis) return;
     setShowCreditConfirm(false);
     
     const { content, name, type } = pendingAnalysis;
     setIsProcessing(true);
     setError(null);
     
     try {
         setProcessStatus('🔍 Analisando padrões de conversa...');
         await new Promise(r => setTimeout(r, 800)); 
         
         const analysis = await analyzeConversation(content);

         setProcessStatus('📝 Gerando diagnóstico detalhado...');
         // Ensure we save properly
         await saveAudit(user.uid, name, type, analysis);
         
         if (userProfile.plan !== 'pro') {
            await deductCredit(user.uid);
         }
         refreshProfile();
         
         // Refresh local history immediately
         const { audits: updatedAudits } = await getUserAudits(user.uid, null, 5);
         setAudits(updatedAudits);

         setResult(analysis);
         setToast({ message: "Análise concluída com sucesso!", type: 'success' });
     } catch (err: any) {
         console.error(err);
         setError(err.message || "Erro ao processar.");
         setToast({ message: "Erro na análise: " + err.message, type: 'error' });
     } finally {
         setIsProcessing(false);
         setProcessStatus('');
         setPendingAnalysis(null);
     }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    
    setProcessStatus(`📂 Processando ${file.name}...`);
    setIsProcessing(true); 

    try {
      const text = await extractTextFromFile(file);
      setIsProcessing(false); 
      initiateAnalysis(text, file.name, file.type.includes('image') ? 'Imagem' : file.name.endsWith('.zip') ? 'ZIP' : 'TXT');
    } catch (err: any) {
        setError(err.message);
        setIsProcessing(false);
        setToast({ message: "Erro ao ler arquivo.", type: 'error' });
    }
  }, [userProfile.credits]);

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({ 
    onDrop,
    accept: {
        'text/plain': ['.txt'],
        'application/zip': ['.zip'],
        'image/*': ['.png', '.jpg', '.jpeg']
    },
    multiple: false,
    noClick: true, 
    disabled: isProcessing
  });

  const handlePasteAnalysis = () => {
      if (!pastedText.trim()) {
          setToast({ message: "Cole a conversa primeiro.", type: 'error' });
          return;
      }
      if (pastedText.length < 50) {
          setToast({ message: "Texto muito curto para análise.", type: 'error' });
          return;
      }
      initiateAnalysis(pastedText, "Texto Colado", "Texto");
  };

  const handleBuyCredits = async (amount: number) => {
      setIsProcessing(true);
      setProcessStatus('Processando pagamento seguro...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      await addCredits(user.uid, amount === 999 ? 10000 : amount);
      await refreshProfile();
      setIsProcessing(false);
      setShowPricing(false);
      setToast({ message: amount === 999 ? "Bem-vindo ao PRO!" : "Créditos adicionados!", type: 'success' });
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  // --- RENDER ---

  // 1. Result View
  if (result) {
      return (
        <ResultView 
            result={result} 
            onReset={() => setResult(null)} 
            user={user} 
            userProfile={userProfile}
            onDeductCredit={() => {
                if(userProfile.plan !== 'pro') {
                    deductCredit(user.uid);
                    refreshProfile();
                }
            }}
            refreshProfile={refreshProfile}
        />
      );
  }

  // 2. Settings View
  if (view === 'settings') {
      return (
          <div className="min-h-screen bg-bg-body text-text-primary p-6">
              <Settings 
                user={user}
                userProfile={userProfile}
                theme={theme}
                toggleTheme={toggleTheme}
                onBack={() => setView('dashboard')}
                onSignOut={handleSignOut}
                onBuyCredits={() => setShowPricing(true)}
              />
          </div>
      );
  }

  // 3. History View
  if (view === 'history') {
      return (
          <div className="min-h-screen bg-bg-body text-text-primary p-6">
              <div className="max-w-6xl mx-auto">
                 <History 
                    userId={user.uid} 
                    onBack={() => setView('dashboard')} 
                    onSelectAudit={(audit) => setResult(audit.result)} 
                 />
              </div>
          </div>
      );
  }

  // 4. Main Dashboard
  return (
    <div className="min-h-screen bg-bg-body text-text-primary font-sans relative selection:bg-brand-primary selection:text-black">
      <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>

      {/* Sticky Premium Header */}
      <header className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('dashboard')}>
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20 group-hover:bg-brand-primary/20 transition-all">
              <Icons.ShieldCheck className="h-5 w-5 text-brand-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight">Fiscal<span className="text-brand-primary">DeVenda</span></span>
        </div>

        <div className="flex items-center gap-3">
             {/* Bell Icon Removed as requested */}

             <button onClick={() => setShowPricing(true)} className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-full hover:border-brand-primary/50 hover:bg-white/10 active:scale-95 transition-all group">
                <Icons.Zap className="w-3.5 h-3.5 text-brand-primary group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-white">{userProfile.plan === 'pro' ? '∞' : userProfile.credits}</span>
                {userProfile.plan !== 'pro' && <span className="text-xs text-text-muted mr-1">créditos</span>}
                <div className="w-6 h-6 rounded-full bg-brand-primary text-black flex items-center justify-center">
                    <Icons.Plus className="w-3.5 h-3.5" />
                </div>
            </button>

             <div className="relative">
                 <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-white/5 active:bg-white/10 transition-all border border-transparent hover:border-white/5">
                     <div className="w-9 h-9 rounded-full border-2 border-white/10 overflow-hidden">
                         {user.photoURL ? (
                             <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                         ) : (
                             <div className="w-full h-full bg-brand-primary text-black flex items-center justify-center font-bold">
                                 {user.displayName?.[0] || 'U'}
                             </div>
                         )}
                     </div>
                     <Icons.ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                 </button>

                 {showUserMenu && (
                     <div className="absolute top-full right-0 mt-2 w-64 bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-2 animate-fade-in z-50">
                         <div className="px-3 py-3 border-b border-white/5 mb-1">
                             <strong className="block text-sm text-white">{user.displayName}</strong>
                             <span className="text-xs text-text-muted">{user.email}</span>
                         </div>
                         <button onClick={() => setView('settings')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                             <Icons.Settings className="w-4 h-4" /> Configurações
                         </button>
                         <div className="h-px bg-white/5 my-1"></div>
                         <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                             <Icons.LogOut className="w-4 h-4" /> Sair
                         </button>
                     </div>
                 )}
             </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
         {/* Free Plan Banner with Pulse Animation */}
         {userProfile.plan !== 'pro' && (
             <div className="bg-gradient-to-r from-brand-primary/20 to-transparent border border-brand-primary/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between animate-fade-in shadow-glow-sm relative overflow-hidden group">
                 <div className="absolute inset-0 bg-brand-primary/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
                 <div className="flex items-center gap-4 mb-4 md:mb-0 relative z-10">
                     <div className="p-3 bg-brand-primary/20 rounded-xl text-brand-primary shadow-inner">
                         <Icons.Sparkles className="w-6 h-6" />
                     </div>
                     <div>
                         <h3 className="font-bold text-white text-lg">Desbloqueie o Poder Total ⚡</h3>
                         <p className="text-sm text-text-secondary">Usuários PRO têm auditorias ilimitadas, relatórios de evolução e prioridade na fila.</p>
                     </div>
                 </div>
                 <button onClick={() => setShowPricing(true)} className="relative z-10 px-6 py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-hover active:scale-95 transition-all shadow-lg hover:shadow-glow-md">
                     Fazer Upgrade Agora
                 </button>
             </div>
         )}

         {/* Hero */}
         <section className="flex justify-between items-end">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Olá, {user.displayName?.split(' ')[0] || 'Vendedor'} 👋</h1>
                <p className="text-text-secondary">Vamos recuperar mais uma venda hoje?</p>
             </div>
         </section>

         {/* Upload / Paste Zone with enhanced interactions */}
         <section className="bg-bg-glass border border-white/10 rounded-3xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-glow-sm">
             <div className="flex border-b border-white/10">
                 <button 
                    onClick={() => setUploadMode('file')}
                    className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${uploadMode === 'file' ? 'bg-white/5 text-brand-primary border-b-2 border-brand-primary' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                 >
                     <Icons.Upload className="w-4 h-4" /> Upload de Arquivo
                 </button>
                 <button 
                    onClick={() => setUploadMode('paste')}
                    className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${uploadMode === 'paste' ? 'bg-white/5 text-brand-primary border-b-2 border-brand-primary' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                 >
                     <Icons.FileText className="w-4 h-4" /> Colar Conversa
                 </button>
             </div>

             <div className="p-8">
                 {uploadMode === 'file' ? (
                     <div 
                        {...getRootProps()} 
                        onClick={openFileDialog}
                        className={`
                            border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer relative group
                            ${isDragActive ? 'border-brand-primary bg-brand-primary/5 scale-[1.01]' : 'border-white/10 hover:border-brand-primary hover:bg-white/5'}
                            ${isProcessing ? 'pointer-events-none opacity-50' : ''}
                        `}
                    >
                        <input {...getInputProps()} />
                        
                        {/* Tooltip for prints */}
                        <div className="absolute top-4 right-4 z-20">
                            <Icons.HelpCircle className="w-5 h-5 text-text-muted hover:text-white transition-colors" />
                            <div className="absolute right-0 top-8 w-64 bg-[#111] border border-white/20 p-3 rounded-xl text-xs text-left z-30 hidden group-hover:block shadow-xl animate-fade-in">
                                <p className="font-bold text-white mb-1">Dica para Prints:</p>
                                <p className="text-text-muted">Certifique-se de que as imagens tenham alta qualidade e que haja sobreposição de texto entre um print e outro para a IA conectar o contexto.</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${isDragActive ? 'bg-brand-primary text-black' : 'bg-brand-primary/10 text-brand-primary group-hover:scale-110 duration-300'}`}>
                                {isProcessing ? (
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-current"></div>
                                ) : (
                                    <Icons.Upload className="w-8 h-8" />
                                )}
                            </div>
                            
                            {isProcessing ? (
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-white">{processStatus}</h3>
                                    <p className="text-sm text-text-muted animate-pulse">A IA está lendo cada detalhe...</p>
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-xl font-bold text-white mb-2">Arraste ou clique para enviar</h3>
                                    <p className="text-text-secondary mb-4 text-sm">Suporta .txt (WhatsApp), .zip ou Prints</p>
                                    
                                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex items-start gap-3 text-left max-w-md mx-auto">
                                        <Icons.Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-blue-200">
                                            <strong>Dica:</strong> Para conversas longas, prefira exportar o histórico do WhatsApp em .txt para maior precisão.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                 ) : (
                     <div className="flex flex-col gap-4">
                         <textarea 
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            placeholder="Cole aqui a conversa completa...&#10;Exemplo:&#10;[10:00] Cliente: Oi, qual o preço?&#10;[10:05] Vendedor: Custa R$ 100."
                            className="w-full h-64 bg-black/30 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/50 transition-all resize-none placeholder:text-white/20 font-mono"
                         />
                         <div className="flex justify-end">
                             <button 
                                onClick={handlePasteAnalysis}
                                disabled={isProcessing}
                                className="px-6 py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-hover active:scale-95 transition-all shadow-glow-sm disabled:opacity-50 flex items-center gap-2"
                             >
                                 {isProcessing ? 'Processando...' : <>Analisar Texto <Icons.ArrowRight className="w-4 h-4" /></>}
                             </button>
                         </div>
                     </div>
                 )}
             </div>
         </section>

         {/* Stats Cards with Hover Effect */}
         <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             {[
                 { icon: Icons.BarChart, color: 'blue', label: 'Nota Média', value: avgScore, sub: '/100' },
                 { icon: Icons.Target, color: 'brand-primary', label: 'Auditorias', value: totalAudits, sub: 'Total' },
                 { icon: Icons.AlertTriangle, color: 'red', label: 'Erros Críticos', value: criticalErrors, sub: 'Atenção' },
                 { icon: Icons.Trophy, color: 'yellow', label: 'Melhor Score', value: bestScore, sub: 'Recorde' }
             ].map((stat, i) => (
                 <div key={i} className="glass-card p-5 rounded-2xl flex items-start gap-4 hover:-translate-y-1 transition-transform group">
                     <div className={`w-12 h-12 rounded-xl bg-${stat.color}-500/15 text-${stat.color === 'brand-primary' ? 'brand-primary' : stat.color + '-500'} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                         <stat.icon className="w-6 h-6" />
                     </div>
                     <div>
                         <span className="text-xs text-text-muted block mb-1">{stat.label}</span>
                         <div className="flex items-baseline gap-2">
                             <span className="text-2xl font-bold text-white">{stat.value}</span>
                             {stat.sub && <span className={`text-[10px] ${stat.sub === 'Atenção' ? 'text-red-400' : 'text-text-muted'}`}>{stat.sub}</span>}
                         </div>
                     </div>
                 </div>
             ))}
         </section>

         {/* Charts & Graphs (Radar + Line) */}
         <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="glass-card border border-white/5 rounded-3xl p-6">
                 <div className="flex items-center justify-between mb-6">
                     <h3 className="font-bold text-white flex items-center gap-2">
                         <Icons.TrendingUp className="w-5 h-5 text-brand-primary" /> Evolução de Score
                     </h3>
                 </div>
                 <div className="h-[250px]">
                     {audits.length > 0 ? (
                         <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-text-muted animate-pulse">Carregando...</div>}>
                             <Line data={chartData} options={chartOptions} />
                         </Suspense>
                     ) : (
                         <div className="h-full flex items-center justify-center text-text-muted text-sm border-2 border-dashed border-white/5 rounded-xl">
                             Faça sua primeira auditoria para ver o gráfico
                         </div>
                     )}
                 </div>
             </div>

             <div className="glass-card border border-white/5 rounded-3xl p-6">
                 <div className="flex items-center justify-between mb-6">
                     <h3 className="font-bold text-white flex items-center gap-2">
                         <Icons.Target className="w-5 h-5 text-blue-500" /> Competências (Radar)
                     </h3>
                 </div>
                 <div className="h-[250px] flex items-center justify-center">
                    {radarData ? (
                        <Suspense fallback={<div className="animate-pulse w-full h-full bg-white/5 rounded-full"></div>}>
                            <Radar data={radarData} options={radarOptions} />
                        </Suspense>
                    ) : (
                        <div className="text-sm text-text-muted border-2 border-dashed border-white/5 rounded-xl p-6">
                            Necessário ao menos 3 auditorias para gerar o radar de competências.
                        </div>
                    )}
                 </div>
             </div>
         </section>

         {/* Recent History Preview */}
         <section>
             <div className="flex items-center justify-between mb-4">
                 <h2 className="text-xl font-bold text-white">Últimas Análises</h2>
                 <button onClick={() => setView('history')} className="text-sm text-brand-primary hover:underline flex items-center gap-1 group">
                     Ver histórico completo <Icons.ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                 </button>
             </div>
             
             {audits.length === 0 ? (
                 <div className="text-center py-10 glass-card rounded-2xl border-dashed border-2 border-white/10">
                    <p className="text-text-muted">Seu histórico aparecerá aqui.</p>
                </div>
             ) : (
                 <div className="space-y-3">
                     {audits.slice(0, 3).map((audit) => {
                         const score = audit.result?.resumo_executivo?.score || audit.score || 0;
                         return (
                             <div key={audit.id} className="glass-card p-4 rounded-xl flex items-center gap-6 hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setResult(audit.result)}>
                                 <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center border font-bold text-lg ${
                                     score >= 80 ? 'border-brand-primary text-brand-primary' : score >= 50 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'
                                 }`}>
                                     {score}
                                 </div>
                                 <div className="flex-1">
                                     <h4 className="font-bold text-white group-hover:text-brand-primary transition-colors">{audit.fileName}</h4>
                                     <p className="text-xs text-text-muted">{new Date(audit.timestamp).toLocaleDateString()}</p>
                                 </div>
                                 <Icons.ArrowRight className="text-text-muted w-4 h-4 group-hover:text-white group-hover:translate-x-1 transition-all" />
                             </div>
                         )
                     })}
                 </div>
             )}
         </section>
      </main>

      {/* Credit Confirmation Modal */}
      {showCreditConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCreditConfirm(false)}></div>
              <div className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in-up">
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-primary">
                          <Icons.Zap className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Usar 1 Crédito?</h3>
                      <p className="text-text-muted text-sm mb-4">
                          Você tem <strong>{userProfile.credits} créditos</strong> restantes. Esta auditoria completa irá consumir 1 crédito.
                      </p>
                      {userProfile.credits < 3 && userProfile.plan !== 'pro' && (
                          <div className="bg-yellow-500/10 text-yellow-500 p-2 rounded-lg text-xs mb-4 flex items-center justify-center gap-2">
                              <Icons.AlertTriangle className="w-3 h-3" /> Seus créditos estão acabando.
                          </div>
                      )}
                  </div>
                  <div className="space-y-3">
                      <button onClick={confirmAnalysis} className="w-full py-3 rounded-xl bg-brand-primary text-black text-sm font-bold hover:bg-brand-hover transition-colors shadow-glow-sm flex items-center justify-center gap-2 active:scale-95">
                          Confirmar Auditoria <Icons.ArrowRight className="w-4 h-4" />
                      </button>
                      <button onClick={() => setShowCreditConfirm(false)} className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 text-white text-sm font-medium transition-colors">
                          Cancelar
                      </button>
                  </div>
                  {userProfile.plan !== 'pro' && (
                      <div className="mt-4 pt-4 border-t border-white/10 text-center">
                          <button onClick={() => { setShowCreditConfirm(false); setShowPricing(true); }} className="text-xs text-brand-primary hover:underline font-bold">
                              Quero créditos ilimitados (Plano Pro)
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Pricing Modal */}
      {showPricing && (
          <PricingModal 
            onClose={() => setShowPricing(false)} 
            onBuy={handleBuyCredits} 
            isProcessing={isProcessing}
            currentCredits={userProfile.credits}
          />
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

    </div>
  );
};

// ==========================================
// RESULT VIEW (Enhanced)
// ==========================================

const ResultView: React.FC<{ 
    result: AnalysisResult; 
    onReset: () => void; 
    user: User;
    userProfile: UserProfile;
    onDeductCredit: () => void;
    refreshProfile: () => void;
}> = ({ result, onReset, user, userProfile, onDeductCredit, refreshProfile }) => {
    
    const [showChat, setShowChat] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Standard Print for PDF
    const handleExportPDF = () => {
        window.print();
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-brand-primary border-brand-primary';
        if (score >= 50) return 'text-yellow-500 border-yellow-500';
        return 'text-red-500 border-red-500';
    };

    return (
        <div className="min-h-screen bg-bg-body text-text-primary font-sans pb-20 print:bg-white print:text-black">
             {/* Navbar - Hidden on Print */}
             <nav className="border-b border-white/5 bg-bg-elevated/80 backdrop-blur-md sticky top-0 z-50 print:hidden transition-all">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={onReset} className="flex items-center gap-2 text-text-muted hover:text-white transition-colors group">
                        <Icons.ArrowRight className="rotate-180 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Voltar
                    </button>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleExportPDF}
                            className="text-xs font-medium border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                            <Icons.Download className="w-3 h-3" />
                            PDF
                        </button>
                        <button 
                            onClick={() => setShowChat(true)}
                            className="text-xs font-bold bg-brand-primary text-black px-4 py-1.5 rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-2 shadow-glow-sm"
                        >
                            <Icons.MessageCircle className="w-3.5 h-3.5" />
                            Chat IA
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fade-in-up print:space-y-6 print:p-0 print:m-0">
                
                {/* Print Header */}
                <div className="hidden print:block mb-8 text-center border-b pb-4">
                    <div className="text-2xl font-bold text-black mb-1">Fiscal de Venda - Relatório de Auditoria</div>
                    <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString()}</p>
                </div>

                {/* 1. EXECUTIVE SUMMARY */}
                <section className="glass-card p-0 rounded-3xl overflow-hidden print:border print:border-gray-200 print:bg-white print:shadow-none">
                    <div className="p-8 border-b border-white/5 print:border-gray-200">
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            {/* Score Circle with Animation */}
                            <div className={`relative w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center shrink-0 ${getScoreColor(result.resumo_executivo.score)}`}>
                                <div className="absolute inset-0 rounded-full animate-pulse opacity-20 bg-current print:hidden"></div>
                                <span className={`text-4xl font-bold ${getScoreColor(result.resumo_executivo.score).split(' ')[0]}`}>{result.resumo_executivo.score}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Score</span>
                            </div>
                            
                            <div className="flex-1 text-center md:text-left">
                                <div className="inline-block px-3 py-1 rounded-full bg-white/5 text-xs font-bold uppercase mb-3 print:border print:border-gray-300">
                                    {result.resumo_executivo.classificacao}
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2 print:text-black">"{result.resumo_executivo.veredicto}"</h2>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                    <div className="bg-white/5 rounded-xl p-3 text-center print:bg-gray-100">
                                        <div className="text-xs text-text-muted mb-1">Total Msgs</div>
                                        <div className="font-bold text-white print:text-black">{result.resumo_executivo.estatisticas.total_mensagens}</div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 text-center print:bg-gray-100">
                                        <div className="text-xs text-text-muted mb-1">Tempo Médio</div>
                                        <div className="font-bold text-white print:text-black">{result.resumo_executivo.estatisticas.tempo_medio_resposta || "N/A"}</div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 text-center print:bg-gray-100">
                                        <div className="text-xs text-text-muted mb-1">Erros</div>
                                        <div className="font-bold text-red-400">{result.resumo_executivo.estatisticas.total_erros}</div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 text-center print:bg-gray-100">
                                        <div className="text-xs text-text-muted mb-1">Recuperação</div>
                                        <div className="font-bold text-brand-primary">{result.resumo_executivo.estatisticas.chance_recuperacao}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. METRICS WITH TOOLTIPS */}
                <section className="glass-card p-8 rounded-3xl bg-bg-elevated print:border print:border-gray-200 print:bg-white print:break-inside-avoid">
                     <h3 className="text-lg font-bold text-white mb-6 print:text-black">Métricas Detalhadas</h3>
                     <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
                         {Object.entries(result.metricas).map(([key, metric]: [string, any]) => {
                             if (key === 'tempo_resposta') return null; 
                             return (
                                <div key={key}>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center">
                                            <span className="capitalize text-sm font-bold text-white print:text-black">{key.replace('_', ' ')}</span>
                                            {/* Tooltip added here */}
                                            <div className="print:hidden">
                                                <InfoTooltip text={metric.significado || "Análise detalhada desta competência."} />
                                            </div>
                                        </div>
                                        <span className={`font-mono text-sm font-bold ${metric.nota >= 70 ? 'text-brand-primary' : metric.nota >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{metric.nota}/100</span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2 print:bg-gray-200">
                                        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${metric.nota >= 70 ? 'bg-brand-primary' : metric.nota >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${metric.nota}%`}}></div>
                                    </div>
                                    <p className="text-xs text-text-muted print:text-gray-600 leading-snug">{metric.problema}</p>
                                </div>
                             )
                         })}
                     </div>
                </section>

                {/* 3. TIMELINE & COPY BUTTONS */}
                <section className="glass-card p-8 rounded-3xl bg-bg-elevated print:border print:border-gray-200 print:bg-white print:break-inside-avoid">
                    <div className="flex items-center gap-2 mb-8">
                        <Icons.Clock className="text-brand-primary w-5 h-5" />
                        <h3 className="text-lg font-bold text-white print:text-black">Timeline da Conversa</h3>
                    </div>

                    <div className="relative border-l-2 border-white/10 ml-3 space-y-8 print:border-gray-300">
                        {result.timeline.mensagens.map((msg, idx) => (
                            <div key={idx} className="relative pl-8">
                                {/* Dot */}
                                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-bg-elevated ${
                                    msg.status === 'bom' ? 'bg-brand-primary' : 
                                    msg.status === 'atencao' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></div>
                                
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex-1 group">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-white text-sm print:text-black">{msg.timestamp || `Msg #${msg.numero}`}</span>
                                            <span className="text-xs text-text-muted">• {msg.autor}</span>
                                            {msg.tempo_resposta && <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-text-secondary">⏱️ {msg.tempo_resposta}</span>}
                                        </div>
                                        <div className={`relative p-3 rounded-lg text-sm border ${
                                            msg.autor === 'Vendedor' ? 'bg-white/5 border-white/10 rounded-tl-none' : 'bg-brand-primary/10 border-brand-primary/20 rounded-tr-none'
                                        } print:bg-gray-50 print:border-gray-200 print:text-black hover:bg-white/10 transition-colors`}>
                                            "{msg.texto}"
                                            {/* Copy Button for each message */}
                                            <button 
                                                onClick={() => handleCopy(msg.texto, `msg-${idx}`)}
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/50 rounded text-white print:hidden hover:bg-black/80"
                                                title="Copiar texto"
                                            >
                                                {copiedId === `msg-${idx}` ? <Icons.Check className="w-3 h-3 text-brand-primary" /> : <Icons.Copy className="w-3 h-3" />}
                                            </button>
                                        </div>
                                        {msg.analise && (
                                            <p className={`mt-2 text-xs ${
                                                msg.status === 'erro' ? 'text-red-400' : 'text-text-muted'
                                            } print:text-gray-600`}>
                                                {msg.status === 'erro' ? '❌ ' : 'ℹ️ '} {msg.analise}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. RECOVERY PLAN */}
                <section className="glass-card p-8 rounded-3xl bg-bg-elevated border-2 border-blue-500/20 print:border-blue-200 print:bg-white print:break-inside-avoid">
                     <div className="flex items-center justify-between mb-8">
                         <div className="flex items-center gap-2">
                             <Icons.TrendingUp className="text-blue-500 w-5 h-5" />
                             <h3 className="text-lg font-bold text-white print:text-black">Plano de Recuperação</h3>
                         </div>
                         <div className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/20 print:bg-blue-50 print:text-blue-800">
                             Chance: {result.plano_recuperacao.chance}
                         </div>
                     </div>
                     
                     <div className="space-y-8">
                         {result.plano_recuperacao.sequencia.map((step, idx) => (
                             <div key={idx} className="relative pl-8 border-l-2 border-blue-500/20 print:border-blue-200">
                                 <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-bg-body border-2 border-blue-500 flex items-center justify-center text-[8px] font-bold text-blue-500">
                                     {idx + 1}
                                 </div>
                                 <div className="mb-2">
                                     <span className="text-blue-400 font-bold text-sm uppercase mr-2 print:text-blue-600">{step.quando_enviar}</span>
                                     <span className="text-xs text-text-muted print:text-gray-500">({step.aguardar})</span>
                                 </div>
                                 <div className="relative group bg-bg-body p-4 rounded-xl border border-white/10 mb-2 print:bg-gray-50 print:border-gray-200 hover:border-blue-500/30 transition-colors">
                                     <p className="text-white whitespace-pre-line print:text-black">"{step.mensagem}"</p>
                                     <button 
                                        onClick={() => handleCopy(step.mensagem, `rec-${idx}`)}
                                        className="absolute top-2 right-2 p-1.5 bg-white/5 rounded hover:bg-white/10 text-white transition-colors print:hidden"
                                     >
                                        {copiedId === `rec-${idx}` ? <Icons.Check className="w-4 h-4 text-brand-primary" /> : <Icons.Copy className="w-4 h-4" />}
                                     </button>
                                 </div>
                                 <p className="text-xs text-text-muted italic print:text-gray-600">Estratégia: {step.estrategia}</p>
                             </div>
                         ))}
                     </div>
                </section>

                {/* 5. ACTIONS (Hidden on print) */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                    <button onClick={handleExportPDF} className="p-6 rounded-2xl bg-bg-elevated border border-white/10 hover:border-white/30 transition-all text-left group">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-brand-primary group-hover:text-black transition-colors">
                            <Icons.Download className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-white">Baixar PDF</h4>
                        <p className="text-xs text-text-muted mt-1">Salvar relatório</p>
                    </button>
                    
                    <button onClick={() => setShowChat(true)} className="p-6 rounded-2xl bg-bg-elevated border border-brand-primary/30 hover:bg-brand-primary/5 transition-all text-left group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-1 bg-brand-primary text-black text-[10px] font-bold rounded-bl-lg">PRO</div>
                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-4 group-hover:bg-brand-primary group-hover:text-black transition-colors">
                            <Icons.MessageCircle className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-white">Continuar com IA</h4>
                        <p className="text-xs text-text-muted mt-1">Tire dúvidas sobre a análise</p>
                    </button>
                    
                    <button onClick={onReset} className="p-6 rounded-2xl bg-bg-elevated border border-white/10 hover:border-white/30 transition-all text-left group">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white group-hover:text-black transition-colors">
                            <Icons.Upload className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-white">Nova Auditoria</h4>
                        <p className="text-xs text-text-muted mt-1">Analise outra conversa</p>
                    </button>
                </section>

            </main>

            {/* CHAT MODAL */}
            {showChat && (
                <ChatModal 
                    onClose={() => setShowChat(false)} 
                    contextAnalysis={result}
                    userProfile={userProfile}
                    onDeductCredit={onDeductCredit}
                    refreshProfile={refreshProfile}
                />
            )}
        </div>
    );
};

// Chat Modal Component
const ChatModal: React.FC<{ 
    onClose: () => void; 
    contextAnalysis: AnalysisResult; 
    userProfile: UserProfile;
    onDeductCredit: () => void;
    refreshProfile: () => void;
}> = ({ onClose, contextAnalysis, userProfile, onDeductCredit, refreshProfile }) => {
    
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', text: `Oi! Analisei sua conversa. Posso te ajudar a explicar melhor um erro, criar mais variações de resposta ou simular cenários. O que você precisa?`, timestamp: Date.now() }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        
        if (userProfile.credits <= 0 && userProfile.plan !== 'pro') {
            alert("Você precisa de créditos para usar o chat. Faça um upgrade!");
            return;
        }

        const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            if (userProfile.plan !== 'pro') {
                onDeductCredit();
            }

            const responseText = await continueChat(messages, userMsg.text, contextAnalysis);
            
            setMessages(prev => [...prev, { role: 'model', text: responseText, timestamp: Date.now() }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'model', text: "Desculpe, ocorreu um erro. Tente novamente.", timestamp: Date.now() }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col h-[600px] animate-fade-in-up">
                
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#111] rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
                        <span className="font-bold text-white">Chat com Fiscal de Venda</span>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-white"><Icons.X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                                msg.role === 'user' 
                                    ? 'bg-brand-primary text-black rounded-tr-sm' 
                                    : 'bg-white/10 text-white rounded-tl-sm'
                            }`}>
                                <p className="whitespace-pre-line">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white/10 text-white rounded-2xl rounded-tl-sm p-3 flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                                <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-white/10 bg-[#111] rounded-b-2xl">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-text-muted">Créditos: {userProfile.credits}</span>
                        {userProfile.plan === 'pro' && <span className="text-[10px] bg-brand-primary text-black px-1.5 rounded font-bold">PRO</span>}
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Digite sua dúvida..." 
                            className="flex-1 bg-black border border-white/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand-primary"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={isTyping}
                            className="p-2 bg-brand-primary rounded-xl text-black hover:bg-brand-hover transition-colors disabled:opacity-50"
                        >
                            <Icons.ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};