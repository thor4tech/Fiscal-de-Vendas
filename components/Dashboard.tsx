import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useDropzone } from 'react-dropzone';
import { Icons } from './ui/Icons';
import { extractTextFromFile } from '../services/ocr';
import { analyzeConversation, continueChat } from '../services/gemini';
import { saveAudit, deductCredit, addCredits, getUserAudits } from '../services/firestore';
import { AnalysisResult, User, AuditRecord, UserProfile, ChatMessage, MetricDetail } from '../types';
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

// Improved Rich Tooltip Component
const RichTooltip: React.FC<{ title: string, metric: MetricDetail }> = ({ title, metric }) => (
    <div className="group relative inline-block ml-2 align-middle z-10 cursor-help">
        <Icons.Info className="w-4 h-4 text-text-muted transition-colors group-hover:text-brand-primary" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-0 bg-[#111] border border-white/10 rounded-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none z-50 shadow-xl backdrop-blur-md overflow-hidden">
            <div className="bg-white/5 px-4 py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white uppercase tracking-wider">{title}</span>
            </div>
            <div className="p-4 space-y-3">
                <div>
                    <p className="text-[10px] text-text-muted uppercase font-bold mb-1">O que é</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{metric.significado || "Avaliação da competência na venda."}</p>
                </div>
                <div>
                    <p className="text-[10px] text-brand-primary uppercase font-bold mb-1">Como Melhorar</p>
                    <p className="text-xs text-white font-medium leading-relaxed">{metric.como_melhorar || "Pratique mais esta técnica."}</p>
                </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111]"></div>
        </div>
    </div>
);

// Centralized Error Modal
const ErrorModal: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative w-full max-w-md bg-[#111] border border-red-500/30 rounded-2xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.2)] flex flex-col items-center text-center animate-fade-in-up">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
                    <Icons.AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Falha na Análise</h3>
                <p className="text-text-secondary text-sm mb-8 leading-relaxed">
                    {message}
                </p>
                <button 
                    onClick={onClose}
                    className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all w-full"
                >
                    Entendi, tentar novamente
                </button>
            </div>
        </div>
    );
};

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

interface ResultViewProps {
  result: AnalysisResult;
  onReset: () => void;
  user: User;
  userProfile: UserProfile;
  onDeductCredit: () => void;
  refreshProfile: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ result, onReset, user, userProfile, onDeductCredit, refreshProfile }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'chat'>('overview');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, isChatLoading]);

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const newMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
        const updatedHistory = [...chatHistory, newMsg];

        setChatHistory(updatedHistory);
        setChatInput('');
        setIsChatLoading(true);

        try {
            const responseText = await continueChat(updatedHistory, newMsg.text, result);
            setChatHistory([...updatedHistory, { role: 'model', text: responseText, timestamp: Date.now() }]);
        } catch (error) {
            console.error(error);
            setChatHistory([...updatedHistory, { role: 'model', text: "Erro ao processar mensagem. Tente novamente.", timestamp: Date.now() }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-body text-text-primary p-6">
            <div className="max-w-6xl mx-auto">
                <button onClick={onReset} className="mb-6 flex items-center gap-2 text-text-muted hover:text-white transition-colors group">
                    <Icons.ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" /> Voltar ao Dashboard
                </button>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Column: Summary & Navigation */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="glass-card p-6 rounded-2xl text-center relative overflow-hidden bg-[#111] border border-white/10">
                            <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center border-4 text-4xl font-bold mb-4 shadow-xl ${
                                result.resumo_executivo.score >= 80 ? 'border-brand-primary text-brand-primary' :
                                result.resumo_executivo.score >= 50 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'
                            }`}>
                                {result.resumo_executivo.score}
                            </div>
                            <h2 className={`text-2xl font-bold mb-2 ${
                                result.resumo_executivo.classificacao === 'CRÍTICO' ? 'text-red-500' : 
                                result.resumo_executivo.classificacao === 'EXCELENTE' ? 'text-brand-primary' : 'text-white'
                            }`}>{result.resumo_executivo.classificacao}</h2>
                            <p className="text-text-secondary text-sm leading-relaxed">{result.resumo_executivo.veredicto}</p>
                        </div>

                        {/* Stats Grid */}
                         <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="text-xs text-text-muted block">Erros</span>
                                <span className="text-lg font-bold text-red-400">{result.resumo_executivo.estatisticas.total_erros}</span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="text-xs text-text-muted block">Recuperação</span>
                                <span className="text-lg font-bold text-brand-primary">{result.resumo_executivo.estatisticas.chance_recuperacao}</span>
                            </div>
                         </div>

                        {/* Tabs */}
                        <div className="flex flex-col gap-2">
                            <button onClick={() => setActiveTab('overview')} className={`p-4 rounded-xl text-left font-medium transition-colors border flex items-center gap-3 ${activeTab === 'overview' ? 'bg-white/10 border-brand-primary text-white shadow-glow-sm' : 'bg-transparent border-transparent text-text-muted hover:bg-white/5'}`}>
                                <Icons.BarChart className="w-5 h-5" /> Visão Geral
                            </button>
                            <button onClick={() => setActiveTab('timeline')} className={`p-4 rounded-xl text-left font-medium transition-colors border flex items-center gap-3 ${activeTab === 'timeline' ? 'bg-white/10 border-brand-primary text-white shadow-glow-sm' : 'bg-transparent border-transparent text-text-muted hover:bg-white/5'}`}>
                                <Icons.Clock className="w-5 h-5" /> Linha do Tempo
                            </button>
                            <button onClick={() => setActiveTab('chat')} className={`p-4 rounded-xl text-left font-medium transition-colors border flex items-center gap-3 ${activeTab === 'chat' ? 'bg-white/10 border-brand-primary text-white shadow-glow-sm' : 'bg-transparent border-transparent text-text-muted hover:bg-white/5'}`}>
                                <Icons.MessageCircle className="w-5 h-5" /> Chat com Fiscal
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Content */}
                    <div className="lg:col-span-2">
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-fade-in">
                                {/* Errors Section */}
                                {result.erros.length > 0 && (
                                    <div className="glass-card p-6 rounded-2xl border-l-4 border-l-red-500 bg-[#1a0505] border border-red-500/20">
                                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                            <Icons.AlertTriangle className="w-5 h-5 text-red-500" /> Erros Identificados
                                        </h3>
                                        <div className="space-y-4">
                                            {result.erros.map((erro, idx) => (
                                                <div key={idx} className="bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider border border-red-500/30 px-2 py-0.5 rounded-full">{erro.gravidade}</span>
                                                        <span className="text-xs text-text-muted">Mensagem #{erro.mensagem_numero}</span>
                                                    </div>
                                                    <p className="text-white font-medium mb-3 italic">"{erro.mensagem_original}"</p>
                                                    <p className="text-sm text-red-200 mb-4 bg-red-500/10 p-2 rounded-lg"><strong className="text-red-400">Problema:</strong> {erro.por_que_erro}</p>
                                                    <div className="bg-[#111] p-4 rounded-lg border border-white/10">
                                                        <p className="text-xs text-green-400 font-bold mb-1 flex items-center gap-1"><Icons.CheckCircle className="w-3 h-3" /> Sugestão de Correção</p>
                                                        <p className="text-sm text-white leading-relaxed">{erro.correcao.mensagem_corrigida}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Metrics Breakdown */}
                                <div className="glass-card p-6 rounded-2xl border border-white/10">
                                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                        <Icons.Target className="w-5 h-5 text-blue-500" /> Métricas Detalhadas
                                    </h3>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {Object.entries(result.metricas).map(([key, value]: [string, any]) => {
                                            if (key === 'tempo_resposta') return null; // Handle separately if needed
                                            return (
                                                <div key={key} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-brand-primary/30 transition-colors">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm font-medium capitalize text-text-secondary">{key.replace('_', ' ')}</span>
                                                        <span className={`text-sm font-bold ${value.nota >= 80 ? 'text-brand-primary' : value.nota >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                            {value.nota}/100
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                                                        <div className={`h-1.5 rounded-full ${value.nota >= 80 ? 'bg-brand-primary' : value.nota >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${value.nota}%` }}></div>
                                                    </div>
                                                    <p className="text-xs text-text-muted">{value.problema || value.significado}</p>
                                                    <div className="mt-2">
                                                         <RichTooltip title={key.replace('_', ' ')} metric={value} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Recovery Plan */}
                                <div className="glass-card p-6 rounded-2xl border-l-4 border-l-brand-primary bg-[#051a10] border border-brand-primary/20">
                                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                        <Icons.TrendingUp className="w-5 h-5 text-brand-primary" /> Plano de Recuperação
                                    </h3>
                                    <div className="space-y-6">
                                        {result.plano_recuperacao.sequencia.map((step, idx) => (
                                            <div key={idx} className="flex gap-4 relative">
                                                {idx !== result.plano_recuperacao.sequencia.length - 1 && (
                                                    <div className="absolute left-[15px] top-8 bottom-[-24px] w-0.5 bg-white/10"></div>
                                                )}
                                                <div className="w-8 h-8 rounded-full bg-brand-primary text-black flex items-center justify-center font-bold shrink-0 z-10 shadow-glow-sm">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <p className="text-sm text-white font-bold">{step.estrategia}</p>
                                                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-text-muted whitespace-nowrap">Aguardar: {step.aguardar || 'Imediato'}</span>
                                                    </div>
                                                    <div className="bg-black/40 p-4 rounded-xl border border-brand-primary/10 mt-2">
                                                        <p className="text-sm text-brand-primary font-medium italic mb-2">"{step.mensagem}"</p>
                                                        <p className="text-xs text-text-muted">Enviar: {step.quando_enviar}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'timeline' && (
                            <div className="space-y-6 animate-fade-in pb-10">
                                <h3 className="text-xl font-bold text-white mb-6">Fluxo da Conversa</h3>
                                {result.timeline.mensagens.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.autor === 'Vendedor' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] relative group ${msg.autor === 'Vendedor' ? 'items-end flex flex-col' : 'items-start flex flex-col'}`}>
                                            <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-md ${
                                                msg.autor === 'Vendedor' 
                                                  ? 'bg-brand-primary/10 border border-brand-primary/20 text-white rounded-tr-none' 
                                                  : 'bg-[#222] border border-white/10 text-gray-200 rounded-tl-none'
                                            }`}>
                                                {msg.texto}
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-1 px-1">
                                                <span className="text-[10px] text-text-muted">{msg.timestamp || `#${msg.numero}`}</span>
                                                {msg.analise && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                                        msg.status === 'erro' ? 'bg-red-500/20 text-red-400' :
                                                        msg.status === 'bom' ? 'bg-green-500/20 text-green-400' :
                                                        'bg-yellow-500/20 text-yellow-500'
                                                    }`}>
                                                        {msg.status === 'erro' ? <Icons.AlertTriangle className="w-3 h-3" /> : 
                                                         msg.status === 'bom' ? <Icons.CheckCircle className="w-3 h-3" /> : <Icons.Info className="w-3 h-3" />}
                                                        {msg.analise}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <div className="glass-card flex flex-col h-[600px] rounded-2xl overflow-hidden animate-fade-in border border-white/10">
                                <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center">
                                        <Icons.ShieldCheck className="w-6 h-6 text-brand-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">Fiscal de Venda AI</h3>
                                        <p className="text-xs text-text-muted">Tire dúvidas sobre esta análise</p>
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0a]">
                                    {chatHistory.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                                            <Icons.MessageCircle className="w-16 h-16 mb-4 text-text-muted" />
                                            <p className="text-text-muted max-w-xs">Pergunte como melhorar sua abordagem ou peça para reescrever uma mensagem específica.</p>
                                        </div>
                                    )}
                                    {chatHistory.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                                                msg.role === 'user' ? 'bg-brand-primary text-black font-medium' : 'bg-[#222] text-gray-200 border border-white/10'
                                            }`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                    {isChatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-[#222] p-4 rounded-xl flex gap-1.5 border border-white/10">
                                                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-75"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>
                                
                                <div className="p-4 bg-[#111] border-t border-white/10">
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                            placeholder="Digite sua mensagem..."
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all placeholder:text-text-muted"
                                        />
                                        <button 
                                            onClick={handleSendMessage}
                                            disabled={isChatLoading || !chatInput.trim()}
                                            className="p-3 bg-brand-primary text-black rounded-xl hover:bg-brand-hover disabled:opacity-50 transition-colors shadow-glow-sm"
                                        >
                                            <Icons.ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
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
  const [processingFileName, setProcessingFileName] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null); // Centralized error state
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
     setProcessingFileName(name);
     setErrorDetails(null); // Clear previous errors
     
     try {
         setProcessStatus('🔍 Analisando padrões de conversa...');
         await new Promise(r => setTimeout(r, 800)); 
         
         const analysis = await analyzeConversation(content);

         setProcessStatus('📝 Gerando diagnóstico detalhado...');
         await saveAudit(user.uid, name, type, analysis);
         
         if (userProfile.plan !== 'pro') {
            await deductCredit(user.uid);
         }
         refreshProfile();
         
         const { audits: updatedAudits } = await getUserAudits(user.uid, null, 5);
         setAudits(updatedAudits);

         setResult(analysis);
         setToast({ message: "Análise concluída com sucesso!", type: 'success' });
     } catch (err: any) {
         console.error(err);
         // SHOW CENTRALIZED ERROR MODAL
         setErrorDetails(err.message || "Erro desconhecido ao processar.");
     } finally {
         setIsProcessing(false);
         setProcessStatus('');
         setProcessingFileName('');
         setPendingAnalysis(null);
     }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    
    setProcessingFileName(file.name);
    setProcessStatus(`📂 Lendo arquivo...`);
    setIsProcessing(true);
    setErrorDetails(null); 

    try {
      const text = await extractTextFromFile(file);
      setIsProcessing(false); 
      initiateAnalysis(text, file.name, file.type.includes('image') ? 'Imagem' : (file.name.endsWith('.zip') || file.type.includes('zip')) ? 'ZIP' : 'TXT');
    } catch (err: any) {
        setIsProcessing(false);
        setProcessingFileName('');
        setErrorDetails(err.message || "Falha ao ler o arquivo. Verifique se ele não está corrompido.");
    }
  }, [userProfile.credits]);

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({ 
    onDrop,
    accept: {
        'text/plain': ['.txt'],
        'application/zip': ['.zip', '.x-zip-compressed'],
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
                            ${isProcessing ? 'pointer-events-none border-brand-primary/50' : ''}
                        `}
                    >
                        <input {...getInputProps()} />
                        
                        {/* Tooltip for prints */}
                        {!isProcessing && (
                            <div className="absolute top-4 right-4 z-20">
                                <Icons.HelpCircle className="w-5 h-5 text-text-muted hover:text-white transition-colors" />
                                <div className="absolute right-0 top-8 w-64 bg-[#111] border border-white/20 p-3 rounded-xl text-xs text-left z-30 hidden group-hover:block shadow-xl animate-fade-in">
                                    <p className="font-bold text-white mb-1">Dica para Prints:</p>
                                    <p className="text-text-muted">Certifique-se de que as imagens tenham alta qualidade e que haja sobreposição de texto entre um print e outro para a IA conectar o contexto.</p>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-center min-h-[160px]">
                            {isProcessing ? (
                                <div className="w-full max-w-md space-y-6">
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 relative">
                                            <div className="absolute inset-0 rounded-full border-4 border-white/10"></div>
                                            <div className="absolute inset-0 rounded-full border-4 border-brand-primary border-t-transparent animate-spin"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Icons.Sparkles className="w-6 h-6 text-brand-primary animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h3 className="text-lg font-bold text-white">{processStatus}</h3>
                                        <p className="text-sm text-text-muted font-mono bg-white/5 px-2 py-1 rounded inline-block">
                                            {processingFileName}
                                        </p>
                                    </div>
                                    {/* Simulated Progress Bar */}
                                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-primary rounded-full animate-[shimmer_2s_linear_infinite] bg-[length:200%_100%] w-2/3 mx-auto"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${isDragActive ? 'bg-brand-primary text-black' : 'bg-brand-primary/10 text-brand-primary group-hover:scale-110 duration-300'}`}>
                                        <Icons.Upload className="w-8 h-8" />
                                    </div>
                                    
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

      {/* ERROR MODAL */}
      {errorDetails && (
          <ErrorModal 
            message={errorDetails} 
            onClose={() => setErrorDetails(null)} 
          />
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

    </div>
  );
};