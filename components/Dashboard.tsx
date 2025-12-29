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
    BarElement, 
    Title, 
    Tooltip, 
    Legend, 
    Filler, 
    RadialLinearScale 
} from 'chart.js';
import { Line, Radar, Bar, Scatter } from 'react-chartjs-2';
import { History } from './History';
import { Settings } from './Settings';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, RadialLinearScale);

interface DashboardProps {
  user: User;
  userProfile: UserProfile;
  refreshProfile: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Improved Rich Tooltip Component
const RichTooltip: React.FC<{ title: string, metric?: MetricDetail, content?: { what: string, impact: string, avoid: string } }> = ({ title, metric, content }) => (
    <div className="group relative inline-block ml-2 align-middle z-10 cursor-help print:hidden">
        <Icons.Info className="w-4 h-4 text-text-muted transition-colors group-hover:text-brand-primary" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-0 bg-[#111] border border-white/10 rounded-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none z-50 shadow-xl backdrop-blur-md overflow-hidden">
            <div className="bg-white/5 px-4 py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white uppercase tracking-wider">{title}</span>
            </div>
            <div className="p-4 space-y-3">
                {metric ? (
                    <>
                        <div>
                            <p className="text-[10px] text-text-muted uppercase font-bold mb-1">O que é</p>
                            <p className="text-xs text-text-secondary leading-relaxed">{metric.significado || "Avaliação da competência na venda."}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-brand-primary uppercase font-bold mb-1">Como Melhorar</p>
                            <p className="text-xs text-white font-medium leading-relaxed">{metric.como_melhorar || "Pratique mais esta técnica."}</p>
                        </div>
                    </>
                ) : content ? (
                    <>
                        <div>
                            <p className="text-[10px] text-text-muted uppercase font-bold mb-1">O Erro</p>
                            <p className="text-xs text-text-secondary leading-relaxed">{content.what}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-red-400 uppercase font-bold mb-1">Impacto</p>
                            <p className="text-xs text-white font-medium leading-relaxed">{content.impact}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-brand-primary uppercase font-bold mb-1">Como Evitar</p>
                            <p className="text-xs text-white font-medium leading-relaxed">{content.avoid}</p>
                        </div>
                    </>
                ) : null}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111]"></div>
        </div>
    </div>
);

// Tutorial Modal Component
const TutorialModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl animate-fade-in-up overflow-hidden max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-white">
                    <Icons.X className="w-5 h-5" />
                </button>
                
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <Icons.Upload className="w-6 h-6 text-brand-primary" /> Como exportar sua conversa
                </h3>
                <p className="text-text-secondary mb-8 text-sm md:text-base">Siga o passo a passo no seu celular para extrair o histórico do WhatsApp.</p>

                <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                    {/* Android */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 relative group hover:border-brand-primary/30 transition-colors">
                        <div className="absolute -top-3 left-6 bg-[#222] px-3 py-1 rounded-full border border-white/10 text-xs font-bold text-green-400 uppercase tracking-wider">
                            Android
                        </div>
                        <ol className="space-y-4 text-sm text-gray-300 mt-2 list-decimal pl-4 marker:text-green-500 marker:font-bold">
                            <li>Abra a conversa no WhatsApp.</li>
                            <li>Toque nos <strong>3 pontos (⋮)</strong> no canto superior direito.</li>
                            <li>Selecione <strong>Mais</strong> &gt; <strong>Exportar conversa</strong>.</li>
                            <li>Escolha <strong>"Anexar mídia"</strong> (para analisarmos áudios).</li>
                            <li>Envie o arquivo ZIP para você mesmo ou salve no celular.</li>
                        </ol>
                    </div>

                    {/* iPhone */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 relative group hover:border-brand-primary/30 transition-colors">
                        <div className="absolute -top-3 left-6 bg-[#222] px-3 py-1 rounded-full border border-white/10 text-xs font-bold text-blue-400 uppercase tracking-wider">
                            iPhone (iOS)
                        </div>
                        <ol className="space-y-4 text-sm text-gray-300 mt-2 list-decimal pl-4 marker:text-blue-500 marker:font-bold">
                            <li>Abra a conversa no WhatsApp.</li>
                            <li>Toque no <strong>Nome do contato</strong> no topo da tela.</li>
                            <li>Role até o final e toque em <strong>Exportar conversa</strong>.</li>
                            <li>Selecione <strong>"Anexar Mídia"</strong> (para áudios e imagens).</li>
                            <li>Salve em "Arquivos" ou envie para seu computador.</li>
                        </ol>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                    <button onClick={onClose} className="px-8 py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-hover transition-colors shadow-glow-sm w-full md:w-auto">
                        Entendi, vou fazer o upload
                    </button>
                </div>
            </div>
        </div>
    );
};

// Centralized Error Modal
const ErrorModal: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative w-full max-w-md bg-[#111] border border-red-500/30 rounded-2xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.2)] flex flex-col items-center text-center animate-fade-in-up">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
                    <Icons.AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Ops! Algo deu errado</h3>
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
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 z-[100] animate-fade-in-up border backdrop-blur-md ${type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
            {type === 'success' ? <Icons.CheckCircle className="w-6 h-6" /> : <Icons.AlertTriangle className="w-6 h-6" />}
            <span className="text-sm font-bold">{message}</span>
            <button onClick={onClose} className="hover:text-white transition-colors ml-2">
                <Icons.X className="w-4 h-4" />
            </button>
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
    const [activeTab, setActiveTab] = useState<'overview' | 'strategy' | 'timeline' | 'action_plan'>('overview');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false); // Modal state for chat
    const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
    
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, isChatLoading, showChatModal, currentSuggestions]);

    // Initial Suggestions
    useEffect(() => {
        if (showChatModal && chatHistory.length === 0) {
            const initialSuggestions = [
                "Como posso melhorar meu Rapport?",
                "Me dê um script para recuperar essa venda",
                `Explique o erro "${result.erros[0]?.nome || 'identificado'}"`
            ];
            setCurrentSuggestions(initialSuggestions);
        }
    }, [showChatModal, result]);

    const handleSendMessage = async (text?: string) => {
        const messageText = text || chatInput;
        if (!messageText.trim()) return;

        const newMsg: ChatMessage = { role: 'user', text: messageText, timestamp: Date.now() };
        const updatedHistory = [...chatHistory, newMsg];

        setChatHistory(updatedHistory);
        setChatInput('');
        setCurrentSuggestions([]); 
        setIsChatLoading(true);

        try {
            const response = await continueChat(updatedHistory, newMsg.text, result);
            setChatHistory([...updatedHistory, { role: 'model', text: response.text, timestamp: Date.now() }]);
            
            if (response.suggestions && response.suggestions.length > 0) {
                setCurrentSuggestions(response.suggestions);
            }
        } catch (error) {
            console.error(error);
            setChatHistory([...updatedHistory, { role: 'model', text: "Erro ao processar mensagem. Tente novamente.", timestamp: Date.now() }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-body text-text-primary p-4 md:p-6 print:bg-white print:text-black print:p-0">
            {/* Header / Nav - Hidden on Print */}
            <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <button onClick={onReset} className="flex items-center gap-2 text-text-muted hover:text-white transition-colors group">
                    <Icons.ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" /> Voltar ao Dashboard
                </button>
                <div className="flex gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => window.print()}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                    >
                        <Icons.Download className="w-4 h-4" /> Exportar PDF
                    </button>
                    <button 
                        onClick={() => setShowChatModal(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-black rounded-lg hover:bg-brand-hover transition-colors text-sm font-bold shadow-glow-sm"
                    >
                        <Icons.MessageCircle className="w-4 h-4" /> Chat com IA
                    </button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block text-center mb-8 border-b border-gray-200 pb-4">
                <h1 className="text-3xl font-bold text-black">Relatório de Auditoria de Vendas</h1>
                <p className="text-gray-500 text-sm mt-1">Gerado por FiscalDeVenda.com.br para {user.displayName}</p>
                <p className="text-gray-400 text-xs mt-1">{new Date().toLocaleDateString()} • IA Gemini 2.0 Flash</p>
            </div>

            <div className="max-w-6xl mx-auto flex flex-col lg:grid lg:grid-cols-12 gap-8">
                
                {/* --- Left Column: High Level Summary --- */}
                <div className="lg:col-span-4 space-y-6 print:col-span-12 print:grid print:grid-cols-2 print:gap-6 order-1">
                    {/* Score Card */}
                    <div className="glass-card p-6 md:p-8 rounded-2xl text-center relative overflow-hidden bg-[#111] border border-white/10 print:border-gray-300 print:bg-white print:shadow-none">
                        <div className={`w-28 h-28 md:w-36 md:h-36 mx-auto rounded-full flex flex-col items-center justify-center border-4 text-4xl md:text-5xl font-bold mb-4 shadow-2xl relative ${
                            result.resumo_executivo.score >= 80 ? 'border-brand-primary text-brand-primary' :
                            result.resumo_executivo.score >= 50 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'
                        }`}>
                            {result.resumo_executivo.score}
                            <span className="text-[10px] md:text-xs font-medium text-text-muted mt-1 print:text-gray-500">SCORE</span>
                        </div>
                        <h2 className={`text-2xl font-bold mb-2 tracking-tight ${
                            result.resumo_executivo.classificacao === 'CRÍTICO' ? 'text-red-500' : 
                            result.resumo_executivo.classificacao === 'EXCELENTE' ? 'text-brand-primary' : 'text-white print:text-black'
                        }`}>{result.resumo_executivo.classificacao}</h2>
                        <p className="text-text-secondary text-sm leading-relaxed print:text-gray-700">{result.resumo_executivo.veredicto}</p>
                    </div>

                    {/* Quick Stats (Mobile optimized grid) */}
                     <div className="grid grid-cols-2 gap-3 print:hidden">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <span className="text-xs text-text-muted block">Erros</span>
                            <span className="text-xl font-bold text-red-400">{result.resumo_executivo.estatisticas.total_erros}</span>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <span className="text-xs text-text-muted block">Recuperação</span>
                            <span className="text-xl font-bold text-brand-primary">{result.resumo_executivo.estatisticas.chance_recuperacao}</span>
                        </div>
                     </div>

                    {/* Vibe Check (New) */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10 print:border-gray-300 print:bg-white print:shadow-none">
                        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 print:text-gray-500">Análise de Tom</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-white print:text-black">Vendedor</span>
                                    <span className="text-brand-primary font-medium">{result.resumo_executivo.tom_de_voz_vendedor}</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden print:bg-gray-200">
                                    <div className="h-full bg-brand-primary w-3/4"></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-white print:text-black">Cliente</span>
                                    <span className="text-blue-400 font-medium">{result.resumo_executivo.tom_de_voz_cliente}</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden print:bg-gray-200">
                                    <div className="h-full bg-blue-400 w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs - Hidden on Print - Mobile Optimized Scroll */}
                    <div className="flex lg:flex-col gap-2 print:hidden overflow-x-auto pb-2 lg:pb-0 scrollbar-hide snap-x relative">
                        <button onClick={() => setActiveTab('overview')} className={`p-4 rounded-xl text-left font-medium transition-colors border flex items-center gap-3 min-w-[200px] lg:min-w-0 snap-center whitespace-nowrap ${activeTab === 'overview' ? 'bg-white/10 border-brand-primary text-white shadow-glow-sm' : 'bg-transparent border-transparent text-text-muted hover:bg-white/5'}`}>
                            <Icons.BarChart className="w-5 h-5 flex-shrink-0" /> Visão Geral & Erros
                        </button>
                        <button onClick={() => setActiveTab('strategy')} className={`p-4 rounded-xl text-left font-medium transition-colors border flex items-center gap-3 min-w-[200px] lg:min-w-0 snap-center whitespace-nowrap ${activeTab === 'strategy' ? 'bg-white/10 border-brand-primary text-white shadow-glow-sm' : 'bg-transparent border-transparent text-text-muted hover:bg-white/5'}`}>
                            <Icons.Target className="w-5 h-5 flex-shrink-0" /> Estratégia & Follow-up
                        </button>
                        <button onClick={() => setActiveTab('action_plan')} className={`p-4 rounded-xl text-left font-medium transition-colors border flex items-center gap-3 min-w-[200px] lg:min-w-0 snap-center whitespace-nowrap ${activeTab === 'action_plan' ? 'bg-white/10 border-brand-primary text-white shadow-glow-sm' : 'bg-transparent border-transparent text-text-muted hover:bg-white/5'}`}>
                            <Icons.TrendingUp className="w-5 h-5 flex-shrink-0" /> Plano de Ação Tático
                        </button>
                        <button onClick={() => setActiveTab('timeline')} className={`p-4 rounded-xl text-left font-medium transition-colors border flex items-center gap-3 min-w-[200px] lg:min-w-0 snap-center whitespace-nowrap ${activeTab === 'timeline' ? 'bg-white/10 border-brand-primary text-white shadow-glow-sm' : 'bg-transparent border-transparent text-text-muted hover:bg-white/5'}`}>
                            <Icons.Clock className="w-5 h-5 flex-shrink-0" /> Linha do Tempo
                        </button>
                        {/* Fade overlay for scroll indication on mobile */}
                        <div className="lg:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-body to-transparent pointer-events-none"></div>
                    </div>
                </div>

                {/* --- Right Column: Content --- */}
                <div className="lg:col-span-8 print:col-span-12 order-2">
                    
                    {/* SECTION: VISÃO GERAL (Errors & Metrics) */}
                    {(activeTab === 'overview' || typeof window !== 'undefined') && ( 
                        <div className={`space-y-8 animate-fade-in ${activeTab !== 'overview' ? 'hidden print:block' : ''}`}>
                            
                            {/* Critical Errors */}
                            {result.erros.length > 0 && (
                                <div className="glass-card p-6 md:p-8 rounded-2xl border-l-4 border-l-red-500 bg-[#1a0505] border border-red-500/20 print:border-gray-300 print:bg-white print:text-black">
                                    <h3 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-3 print:text-black">
                                        <Icons.AlertTriangle className="w-6 h-6 text-red-500" /> Diagnóstico de Erros
                                    </h3>
                                    <div className="space-y-6">
                                        {result.erros.map((erro, idx) => (
                                            <div key={idx} className="bg-red-500/5 p-4 md:p-6 rounded-xl border border-red-500/10 print:bg-gray-50 print:border-gray-200">
                                                <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-3 gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider border border-red-500/30 px-2 py-1 rounded-full print:text-red-600 print:border-red-200">{erro.tipo}</span>
                                                        <RichTooltip 
                                                            title={erro.nome} 
                                                            content={{
                                                                what: erro.por_que_erro,
                                                                impact: erro.impacto_na_venda,
                                                                avoid: "Use perguntas abertas antes de apresentar soluções." // Genérico como fallback, mas ideal vir da IA
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-text-muted print:text-gray-500">Msg #{erro.mensagem_numero}</span>
                                                </div>
                                                <p className="text-white font-medium mb-4 italic pl-4 border-l-2 border-red-500/30 print:text-gray-800">"{erro.mensagem_original}"</p>
                                                
                                                <div className="grid md:grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <p className="text-xs font-bold text-red-400 mb-1 uppercase">O Problema (Psicologia)</p>
                                                        <p className="text-sm text-text-secondary leading-relaxed print:text-gray-700">{erro.por_que_erro}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-orange-400 mb-1 uppercase">Impacto na Venda</p>
                                                        <p className="text-sm text-text-secondary leading-relaxed print:text-gray-700">{erro.impacto_na_venda}</p>
                                                    </div>
                                                </div>

                                                <div className="bg-[#111] p-5 rounded-xl border border-white/10 print:bg-white print:border-brand-primary">
                                                    <p className="text-xs text-brand-primary font-bold mb-2 flex items-center gap-2 uppercase tracking-wide">
                                                        <Icons.CheckCircle className="w-4 h-4" /> Como você deveria ter escrito
                                                    </p>
                                                    <p className="text-base text-white leading-relaxed font-medium print:text-black">"{erro.correcao.mensagem_corrigida}"</p>
                                                    <p className="text-xs text-text-muted mt-2 italic print:text-gray-500">Por que funciona: {erro.correcao.por_que_funciona}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Metrics Breakdown */}
                            <div className="glass-card p-6 md:p-8 rounded-2xl border border-white/10 print:border-gray-300 print:bg-white">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
                                    <Icons.Target className="w-5 h-5 text-blue-500" /> Scorecard de Competências
                                </h3>
                                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                                    {Object.entries(result.metricas).map(([key, value]: [string, any]) => {
                                        if (key === 'tempo_resposta') return null;
                                        return (
                                            <div key={key} className="print:break-inside-avoid">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold capitalize text-white print:text-black">{key.replace('_', ' ')}</span>
                                                        <RichTooltip title={key.replace('_', ' ')} metric={value} />
                                                    </div>
                                                    <span className={`text-sm font-bold ${value.nota >= 80 ? 'text-brand-primary' : value.nota >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                        {value.nota}/100
                                                    </span>
                                                </div>
                                                <div className="w-full bg-white/10 rounded-full h-2 mb-2 print:bg-gray-200">
                                                    <div className={`h-2 rounded-full ${value.nota >= 80 ? 'bg-brand-primary' : value.nota >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${value.nota}%` }}></div>
                                                </div>
                                                <p className="text-xs text-text-muted print:text-gray-600 leading-snug">{value.problema || value.significado}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION: STRATEGY & FOLLOW-UP (New) */}
                    {(activeTab === 'strategy' || typeof window !== 'undefined') && (
                        <div className={`space-y-8 animate-fade-in ${activeTab !== 'strategy' ? 'hidden print:block print:mt-8' : ''}`}>
                            
                            {/* Macro Strategy Analysis */}
                            <div className="glass-card p-6 md:p-8 rounded-2xl border border-white/10 bg-bg-elevated print:bg-white print:border-gray-300 print:text-black">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
                                    <Icons.Settings className="w-5 h-5 text-purple-500" /> Análise Estratégica (Macro)
                                </h3>
                                
                                <div className="grid md:grid-cols-2 gap-8">
                                    {/* Methodologies */}
                                    <div className="space-y-4">
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/5 print:bg-gray-50 print:border-gray-200">
                                            <p className="text-xs text-text-muted uppercase font-bold mb-1">Metodologia Identificada</p>
                                            <p className="text-lg font-bold text-white print:text-black">{result.analise_estrategica?.metodologia_identificada || "Não identificada"}</p>
                                        </div>
                                        <div className="p-4 bg-brand-primary/10 rounded-xl border border-brand-primary/20 print:bg-green-50 print:border-green-200">
                                            <p className="text-xs text-brand-primary uppercase font-bold mb-1">Metodologia Sugerida</p>
                                            <p className="text-lg font-bold text-white print:text-black">{result.analise_estrategica?.metodologia_sugerida || "Venda Consultiva"}</p>
                                        </div>
                                    </div>

                                    {/* Triggers & Barriers */}
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs text-red-400 uppercase font-bold mb-2">Barreiras Principais</p>
                                            <div className="flex flex-wrap gap-2">
                                                {result.analise_estrategica?.principais_barieriras?.map((b, i) => (
                                                    <span key={i} className="text-xs bg-red-500/10 text-red-300 px-3 py-1 rounded-full border border-red-500/20 print:bg-red-50 print:text-red-700">{b}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-text-muted uppercase font-bold mb-2">Gatilhos Negligenciados</p>
                                            <div className="flex flex-wrap gap-2">
                                                {result.analise_estrategica?.gatilhos_mentais_negligenciados?.map((g, i) => (
                                                    <span key={i} className="text-xs bg-white/5 text-text-secondary px-3 py-1 rounded-full border border-white/10 print:bg-gray-100 print:text-gray-600">{g}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Follow-up Audit */}
                            <div className="glass-card p-6 md:p-8 rounded-2xl border border-white/10 print:bg-white print:border-gray-300">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 print:text-black">
                                    <Icons.Clock className="w-5 h-5 text-orange-500" /> Auditoria de Follow-up (Cadência)
                                </h3>
                                
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6">
                                    <div className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wide border w-fit ${
                                        result.auditoria_followup?.status === 'ADEQUADO' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                        'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                    }`}>
                                        Status: {result.auditoria_followup?.status}
                                    </div>
                                    <div className="text-sm text-text-muted print:text-gray-600">
                                        <strong className="text-white print:text-black">{result.auditoria_followup?.oportunidades_perdidas_de_retomada}</strong> oportunidades de retomada perdidas
                                    </div>
                                </div>
                                <p className="text-sm text-text-secondary leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 print:bg-gray-50 print:text-gray-700 print:border-gray-200">
                                    {result.auditoria_followup?.analise}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* SECTION: ACTION PLAN (New & Improved) */}
                    {(activeTab === 'action_plan' || typeof window !== 'undefined') && (
                        <div className={`space-y-8 animate-fade-in ${activeTab !== 'action_plan' ? 'hidden print:block print:mt-8' : ''}`}>
                            <div className="glass-card p-6 md:p-8 rounded-2xl border-l-4 border-l-brand-primary bg-[#051a10] border border-brand-primary/20 print:bg-white print:border-gray-300 print:text-black">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2 print:text-black">
                                        <Icons.TrendingUp className="w-6 h-6 text-brand-primary" /> Plano de Ação Tático
                                    </h3>
                                    <span className="text-xs bg-brand-primary/20 text-brand-primary px-3 py-1 rounded-full font-bold border border-brand-primary/30 print:bg-green-50 print:text-green-700 hidden sm:block">PARA EXECUTAR AGORA</span>
                                </div>

                                {/* Immediate Action */}
                                <div className="mb-10">
                                    <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Icons.Zap className="w-4 h-4 text-yellow-400" /> Ação Imediata (Salvar esta venda)
                                    </h4>
                                    <div className="bg-black/30 p-6 rounded-xl border border-brand-primary/20 relative overflow-hidden group print:bg-gray-50 print:border-gray-200">
                                        <div className="relative z-10">
                                            <p className="text-lg text-white font-bold mb-2 print:text-black">{result.plano_de_acao?.imediato?.acao}</p>
                                            <p className="text-sm text-text-secondary mb-4 print:text-gray-600">{result.plano_de_acao?.imediato?.motivo}</p>
                                            
                                            {result.plano_de_acao?.imediato?.script && (
                                                <div className="bg-[#111] p-4 rounded-lg border border-white/10 print:bg-white print:border-gray-300">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className="text-xs text-brand-primary font-bold uppercase">Script de Resgate</p>
                                                        <button 
                                                            onClick={() => navigator.clipboard.writeText(result.plano_de_acao.imediato.script)}
                                                            className="text-xs text-text-muted hover:text-white flex items-center gap-1 transition-colors"
                                                        >
                                                            <Icons.Clipboard className="w-3 h-3" /> Copiar
                                                        </button>
                                                    </div>
                                                    <p className="text-white font-mono text-sm print:text-black break-words whitespace-pre-wrap">"{result.plano_de_acao.imediato.script}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Multi-Day Follow-up Routine (Vertical Timeline) */}
                                {result.plano_de_acao?.rotina_followup && result.plano_de_acao.rotina_followup.length > 0 && (
                                    <div className="mb-10">
                                        <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-6 flex items-center gap-2">
                                            <Icons.Clock className="w-4 h-4 text-orange-400" /> Rotina de Follow-up (Cadência Próxima)
                                        </h4>
                                        <div className="relative pl-2">
                                            {result.plano_de_acao.rotina_followup.map((step, idx) => (
                                                <div key={idx} className="relative pl-8 pb-8 last:pb-0">
                                                    {/* Vertical Line */}
                                                    {idx !== result.plano_de_acao.rotina_followup.length - 1 && (
                                                        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-gradient-to-b from-white/20 to-transparent"></div>
                                                    )}
                                                    
                                                    {/* Timeline Dot */}
                                                    <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-[#111] border-2 border-brand-primary shadow-[0_0_10px_rgba(16,185,129,0.3)] z-10 flex items-center justify-center">
                                                        <div className="w-2 h-2 bg-brand-primary rounded-full"></div>
                                                    </div>

                                                    <div className="bg-white/5 p-5 rounded-xl border border-white/5 hover:border-brand-primary/30 transition-all hover:translate-x-1 duration-300 group">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="text-brand-primary font-bold text-sm uppercase tracking-wide bg-brand-primary/10 px-2 py-0.5 rounded-md border border-brand-primary/20">{step.dia}</span>
                                                        </div>
                                                        <p className="text-sm text-white font-medium mb-3">{step.acao}</p>
                                                        
                                                        {step.script && (
                                                            <div className="bg-[#050505] p-3 rounded-lg border border-white/10 text-sm font-mono text-text-secondary break-words relative">
                                                                <Icons.MessageCircle className="w-3 h-3 absolute top-3 right-3 text-white/20" />
                                                                "{step.script}"
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Long Term Habits */}
                                <div>
                                    <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Icons.Target className="w-4 h-4 text-blue-400" /> Para as próximas vendas (Longo Prazo)
                                    </h4>
                                    <div className="space-y-4">
                                        {result.plano_de_acao?.longo_prazo?.map((item, idx) => (
                                            <div key={idx} className="flex gap-4 items-start p-4 bg-white/5 rounded-xl border border-white/5 print:bg-gray-50 print:border-gray-200 hover:bg-white/10 transition-colors">
                                                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 print:bg-gray-300 print:text-black">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold mb-1 print:text-black">{item.habito}</p>
                                                    <p className="text-sm text-text-secondary print:text-gray-600">{item.como_implementar}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION: TIMELINE (Basic) */}
                    {(activeTab === 'timeline' || typeof window !== 'undefined') && (
                        <div className={`space-y-6 animate-fade-in pb-10 ${activeTab !== 'timeline' ? 'hidden print:block print:mt-8' : ''}`}>
                            <h3 className="text-xl font-bold text-white mb-6 print:text-black">Fluxo da Conversa</h3>
                            {result.timeline.mensagens.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.autor === 'Vendedor' ? 'justify-end' : 'justify-start'} print:break-inside-avoid`}>
                                    <div className={`max-w-[85%] relative group ${msg.autor === 'Vendedor' ? 'items-end flex flex-col' : 'items-start flex flex-col'}`}>
                                        <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-md ${
                                            msg.autor === 'Vendedor' 
                                                ? 'bg-brand-primary/10 border border-brand-primary/20 text-white rounded-tr-none print:bg-green-50 print:border-green-200 print:text-black' 
                                                : 'bg-[#222] border border-white/10 text-gray-200 rounded-tl-none print:bg-gray-100 print:border-gray-200 print:text-black'
                                        }`}>
                                            {msg.texto}
                                        </div>
                                        
                                        <div className="flex items-center gap-2 mt-1 px-1">
                                            <span className="text-[10px] text-text-muted print:text-gray-500">{msg.timestamp || `#${msg.numero}`}</span>
                                            {msg.analise && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                                    msg.status === 'erro' ? 'bg-red-500/20 text-red-400 print:text-red-600 print:bg-red-100' :
                                                    msg.status === 'bom' ? 'bg-green-500/20 text-green-400 print:text-green-600 print:bg-green-100' :
                                                    'bg-yellow-500/20 text-yellow-500 print:text-yellow-600 print:bg-yellow-100'
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
                </div>
            </div>

            {/* Chat Modal - Only visible when state is true */}
            {showChatModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowChatModal(false)}></div>
                    <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col h-[90vh] md:h-[650px] animate-fade-in-up overflow-hidden">
                        
                        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#111] rounded-t-2xl z-10 relative overflow-hidden">
                            {isChatLoading && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10">
                                    <div className="h-full bg-brand-primary animate-[shimmer_2s_linear_infinite] bg-[length:50%_100%]"></div>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                                    <Icons.MessageCircle className="w-4 h-4 text-brand-primary" />
                                </div>
                                <div>
                                    <span className="font-bold text-white block text-sm">Fiscal de Venda IA</span>
                                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${isChatLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
                                        {isChatLoading ? 'Digitando...' : 'Online'}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setShowChatModal(false)} className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors">
                                <Icons.X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-body">
                            {chatHistory.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                                    <Icons.Sparkles className="w-12 h-12 mb-4 text-brand-primary" />
                                    <p className="text-text-muted text-sm">"Analisei toda sua conversa. Use as sugestões abaixo ou pergunte algo específico."</p>
                                </div>
                            )}
                            {chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                    <div className={`max-w-[90%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm markdown-content ${
                                        msg.role === 'user' 
                                            ? 'bg-brand-primary text-black rounded-tr-sm' 
                                            : 'bg-[#1a1a1a] border border-white/5 text-white rounded-tl-sm'
                                    }`}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isChatLoading && (
                                <div className="flex justify-start animate-fade-in">
                                     <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center w-fit">
                                        <span className="w-1.5 h-1.5 bg-text-muted/50 rounded-full animate-[bounce_1s_infinite_0ms]"></span>
                                        <span className="w-1.5 h-1.5 bg-text-muted/50 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                                        <span className="w-1.5 h-1.5 bg-text-muted/50 rounded-full animate-[bounce_1s_infinite_400ms]"></span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Suggestions / Icebreakers Area */}
                        {!isChatLoading && currentSuggestions.length > 0 && (
                            <div className="px-4 pb-2 bg-bg-body flex flex-wrap gap-2">
                                {currentSuggestions.map((suggestion, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleSendMessage(suggestion)}
                                        className="text-xs bg-white/5 border border-white/10 hover:border-brand-primary/50 hover:bg-white/10 text-text-secondary hover:text-white px-3 py-2 rounded-full transition-all animate-fade-in"
                                        style={{ animationDelay: `${idx * 100}ms` }}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-4 border-t border-white/10 bg-[#111] rounded-b-2xl">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Digite sua mensagem..." 
                                    className="flex-1 bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all placeholder:text-text-muted text-sm"
                                    autoFocus
                                />
                                <button 
                                    onClick={() => handleSendMessage()}
                                    disabled={isChatLoading || !chatInput.trim()}
                                    className="p-3 bg-brand-primary rounded-xl text-black hover:bg-brand-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-sm active:scale-95 focus:scale-95 focus:blur-[1px] active:blur-[1px]"
                                >
                                    <Icons.ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
  const [showTutorial, setShowTutorial] = useState(false); // New tutorial state

  // Handle Payment Success from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
        const plan = params.get('plan');
        const hasProcessed = sessionStorage.getItem('processed_payment'); // Prevent double processing

        if (!hasProcessed) {
            const processActivation = async () => {
                try {
                    if (plan === 'pro') {
                        // Ativa PRO e dá créditos infinitos (simbólico)
                        await addCredits(user.uid, 10000); 
                        setToast({ message: "Assinatura Vendedor Pro ativada com sucesso! 🚀", type: 'success' });
                    } else {
                        // Ativa Starter Pack
                        await addCredits(user.uid, 10);
                        setToast({ message: "Starter Pack ativado! 10 créditos adicionados.", type: 'success' });
                    }
                    sessionStorage.setItem('processed_payment', 'true');
                    refreshProfile(); // Atualiza a UI imediatamente
                } catch (error) {
                    console.error("Erro ao ativar plano:", error);
                    setToast({ message: "Erro ao ativar plano automaticamente. Contate o suporte.", type: 'error' });
                }
            };
            processActivation();
        } else {
             // Se já processou, apenas limpa a URL silenciosamente
        }
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Clear flag after a bit so user can buy again later if needed
        setTimeout(() => sessionStorage.removeItem('processed_payment'), 5000);
    }
  }, [refreshProfile, user.uid]);

  // Fetch History (Initial summary load)
  useEffect(() => {
    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        // We grab just a few for the dashboard summary
        const data = await getUserAudits(user.uid, null, 15); 
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

  // ERROR DISTRIBUTION CHART (New)
  const errorData = React.useMemo(() => {
      const errorCounts: Record<string, number> = {};
      audits.forEach(audit => {
          audit.result?.erros?.forEach(err => {
              errorCounts[err.nome] = (errorCounts[err.nome] || 0) + 1;
          });
      });

      const sortedErrors = Object.entries(errorCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

      return {
          labels: sortedErrors.map(([name]) => name),
          datasets: [{
              label: 'Frequência',
              data: sortedErrors.map(([, count]) => count),
              backgroundColor: 'rgba(239, 68, 68, 0.5)', // Red 500
              borderColor: '#ef4444',
              borderWidth: 1,
              borderRadius: 4
          }]
      };
  }, [audits]);

  // SCATTER PLOT: SCORE vs RESPONSE TIME (New)
  const scatterData = React.useMemo(() => {
      const dataPoints = audits
          .map(audit => {
              const score = audit.result?.resumo_executivo?.score || audit.score || 0;
              const timeStr = audit.result?.resumo_executivo?.estatisticas?.tempo_medio_resposta || "";
              
              // Simple parsing for minutes (e.g., "5 min", "2 horas", "30 seg")
              let minutes = 0;
              if (timeStr.includes('hora')) {
                  const match = timeStr.match(/(\d+)/);
                  if (match) minutes = parseInt(match[1]) * 60;
              } else if (timeStr.includes('min')) {
                  const match = timeStr.match(/(\d+)/);
                  if (match) minutes = parseInt(match[1]);
              } else if (timeStr.includes('seg')) {
                  minutes = 0.5; // Treat seconds as minimal
              } else {
                  return null; // Skip invalid
              }

              // Filter out extreme outliers for cleaner chart
              if (minutes > 300) return null; 

              return { x: minutes, y: score };
          })
          .filter(Boolean) as { x: number, y: number }[];

      return {
          datasets: [{
              label: 'Score vs Tempo (min)',
              data: dataPoints,
              backgroundColor: '#10b981',
              pointRadius: 6,
              pointHoverRadius: 8
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
         
         const { audits: updatedAudits } = await getUserAudits(user.uid, null, 15);
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
    setProcessStatus(`📂 Preparando leitura...`);
    setIsProcessing(true);
    setErrorDetails(null); 

    try {
      const text = await extractTextFromFile(file, (status) => setProcessStatus(status));
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
        'application/zip': ['.zip'],
        'application/x-zip-compressed': ['.zip'], // Windows
        'application/x-zip': ['.zip'], 
        'application/octet-stream': ['.zip'], // Generic
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/webp': ['.webp']
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
          <div className="min-h-screen bg-bg-body text-text-primary p-4 md:p-6">
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
          <div className="min-h-screen bg-bg-body text-text-primary p-4 md:p-6">
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
    <div className="min-h-screen bg-bg-body text-text-primary font-sans relative selection:bg-brand-primary selection:text-black pb-20">
      <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>

      {/* Sticky Premium Header */}
      <header className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 px-4 md:px-6 py-4 flex items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('dashboard')}>
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20 group-hover:bg-brand-primary/20 transition-all">
              <Icons.ShieldCheck className="h-5 w-5 text-brand-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden md:inline">Fiscal<span className="text-brand-primary">DeVenda</span></span>
            <span className="font-bold text-lg tracking-tight md:hidden">FD<span className="text-brand-primary">V</span></span>
        </div>

        <div className="flex items-center gap-3">
             <button onClick={() => setShowPricing(true)} className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-full hover:border-brand-primary/50 hover:bg-white/10 active:scale-95 transition-all group">
                <Icons.Zap className="w-3.5 h-3.5 text-brand-primary group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-white">{userProfile.plan === 'pro' ? '∞' : userProfile.credits}</span>
                {userProfile.plan !== 'pro' && <span className="text-xs text-text-muted mr-1 hidden sm:inline">créditos</span>}
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

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8 md:space-y-10">
         {/* Free Plan Banner with Pulse Animation */}
         {userProfile.plan !== 'pro' && (
             <div className="bg-gradient-to-r from-brand-primary/20 to-transparent border border-brand-primary/30 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between animate-fade-in shadow-glow-sm relative overflow-hidden group">
                 <div className="absolute inset-0 bg-brand-primary/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
                 <div className="flex items-center gap-4 mb-4 md:mb-0 relative z-10 w-full md:w-auto">
                     <div className="p-3 bg-brand-primary/20 rounded-xl text-brand-primary shadow-inner shrink-0">
                         <Icons.Sparkles className="w-6 h-6" />
                     </div>
                     <div>
                         <h3 className="font-bold text-white text-lg">Desbloqueie o Poder Total ⚡</h3>
                         <p className="text-sm text-text-secondary hidden md:block">Usuários PRO têm auditorias ilimitadas, relatórios de evolução e prioridade na fila.</p>
                         <p className="text-sm text-text-secondary md:hidden">Auditorias ilimitadas e mais.</p>
                     </div>
                 </div>
                 <button onClick={() => setShowPricing(true)} className="relative z-10 px-6 py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-hover active:scale-95 transition-all shadow-lg hover:shadow-glow-md w-full md:w-auto">
                     Fazer Upgrade
                 </button>
             </div>
         )}

         {/* Hero */}
         <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
             <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">Olá, {user.displayName?.split(' ')[0] || 'Vendedor'} 👋</h1>
                <p className="text-text-secondary text-sm md:text-base">Vamos recuperar mais uma venda hoje?</p>
             </div>
         </section>

         {/* Upload / Paste Zone with enhanced interactions */}
         <section className="bg-bg-glass border border-white/10 rounded-3xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-glow-sm relative">
             
             <div className="flex border-b border-white/10">
                 <button 
                    onClick={() => setUploadMode('file')}
                    className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${uploadMode === 'file' ? 'bg-white/5 text-brand-primary border-b-2 border-brand-primary' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                 >
                     <Icons.Upload className="w-4 h-4" /> Upload
                 </button>
                 <button 
                    onClick={() => setUploadMode('paste')}
                    className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${uploadMode === 'paste' ? 'bg-white/5 text-brand-primary border-b-2 border-brand-primary' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                 >
                     <Icons.FileText className="w-4 h-4" /> Colar
                 </button>
             </div>

             <div className="p-6 md:p-8 relative">
                 {/* Tutorial Trigger Positioned Contextually */}
                 {uploadMode === 'file' && !isProcessing && (
                     <div className="absolute top-4 right-4 z-20">
                         <button onClick={() => setShowTutorial(true)} className="text-xs text-brand-primary/80 hover:text-brand-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-primary/5 border border-brand-primary/10 hover:bg-brand-primary/10 hover:border-brand-primary/30">
                             <Icons.HelpCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Como exportar?</span><span className="sm:hidden">Ajuda</span>
                         </button>
                     </div>
                 )}

                 {uploadMode === 'file' ? (
                     <div 
                        {...getRootProps()} 
                        onClick={openFileDialog}
                        className={`
                            border-2 border-dashed rounded-2xl p-6 md:p-12 text-center transition-all cursor-pointer relative group
                            ${isDragActive ? 'border-brand-primary bg-brand-primary/5 scale-[1.01]' : 'border-white/10 hover:border-brand-primary hover:bg-white/5'}
                            ${isProcessing ? 'pointer-events-none border-brand-primary/50' : ''}
                        `}
                    >
                        <input {...getInputProps()} />
                        
                        <div className="flex flex-col items-center justify-center min-h-[160px]">
                            {isProcessing ? (
                                <div className="w-full max-w-md space-y-6">
                                    <div className="flex flex-col items-center">
                                        {/* Improved Loading Pulse */}
                                        <div className="relative mb-4">
                                            <div className="w-20 h-20 rounded-full bg-brand-primary/10 flex items-center justify-center animate-pulse">
                                                <Icons.FileText className="w-10 h-10 text-brand-primary" />
                                            </div>
                                            <div className="absolute inset-0 rounded-full border-2 border-brand-primary/50 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                                            <div className="absolute inset-0 rounded-full border border-brand-primary/30 animate-[spin_3s_linear_infinite]"></div>
                                        </div>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                                            {processStatus}
                                        </h3>
                                        <p className="text-sm text-text-muted font-mono bg-white/5 px-3 py-1.5 rounded-full inline-block border border-white/10 max-w-full truncate">
                                            {processingFileName}
                                        </p>
                                    </div>
                                    {/* Enhanced Gradient Progress Bar */}
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mt-4 relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-1/2 -translate-x-full animate-[shimmer_1s_infinite_linear]"></div>
                                        <div className="h-full bg-gradient-to-r from-brand-primary to-blue-500 rounded-full animate-[shimmer_1.5s_infinite_linear] bg-[length:200%_100%] w-full origin-left"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${isDragActive ? 'bg-brand-primary text-black' : 'bg-brand-primary/10 text-brand-primary group-hover:scale-110 duration-300'}`}>
                                        <Icons.Upload className="w-8 h-8" />
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-white mb-2">Arraste ou clique para enviar</h3>
                                    <p className="text-text-secondary mb-4 text-sm">Suporta .txt, .zip ou Prints</p>
                                    
                                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex items-start gap-3 text-left max-w-md mx-auto">
                                        <Icons.Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-blue-200">
                                            <strong>Dica:</strong> Para conversas longas ou com áudios, exporte o ZIP do WhatsApp. Identificamos se houve troca de áudios automaticamente.
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
                                className="px-6 py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-hover active:scale-95 transition-all shadow-glow-sm disabled:opacity-50 flex items-center gap-2 w-full md:w-auto justify-center"
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

         {/* Charts & Graphs (Line, Radar, Bar, Scatter) */}
         <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Evolution (Line) */}
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

             {/* Competencies (Radar) */}
             <div className="glass-card border border-white/5 rounded-3xl p-6">
                 <div className="flex items-center justify-between mb-6">
                     <h3 className="font-bold text-white flex items-center gap-2">
                         <Icons.Target className="w-5 h-5 text-blue-500" /> Competências
                     </h3>
                 </div>
                 <div className="h-[250px] flex items-center justify-center">
                    {radarData ? (
                        <Suspense fallback={<div className="animate-pulse w-full h-full bg-white/5 rounded-full"></div>}>
                            <Radar data={radarData} options={radarOptions} />
                        </Suspense>
                    ) : (
                        <div className="text-sm text-text-muted border-2 border-dashed border-white/5 rounded-xl p-6">
                            Necessário ao menos 3 auditorias para gerar o radar.
                        </div>
                    )}
                 </div>
             </div>

             {/* Top Errors (Bar) - NEW */}
             <div className="glass-card border border-white/5 rounded-3xl p-6">
                 <div className="flex items-center justify-between mb-6">
                     <h3 className="font-bold text-white flex items-center gap-2">
                         <Icons.AlertTriangle className="w-5 h-5 text-red-500" /> Erros Mais Comuns
                     </h3>
                 </div>
                 <div className="h-[250px]">
                     {audits.length > 0 ? (
                         <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-text-muted animate-pulse">Carregando...</div>}>
                             <Bar 
                                data={errorData} 
                                options={{
                                    ...chartOptions,
                                    indexAxis: 'y' as const, // Horizontal bars
                                    scales: {
                                        x: { display: false, grid: { display: false } },
                                        y: { ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } }, grid: { display: false } }
                                    }
                                }} 
                             />
                         </Suspense>
                     ) : (
                         <div className="h-full flex items-center justify-center text-text-muted text-sm border-2 border-dashed border-white/5 rounded-xl">
                             Sem dados suficientes
                         </div>
                     )}
                 </div>
             </div>

             {/* Score vs Response Time (Scatter) - NEW */}
             <div className="glass-card border border-white/5 rounded-3xl p-6">
                 <div className="flex items-center justify-between mb-6">
                     <h3 className="font-bold text-white flex items-center gap-2">
                         <Icons.Clock className="w-5 h-5 text-orange-500" /> Score x Tempo de Resposta
                     </h3>
                 </div>
                 <div className="h-[250px]">
                     {scatterData.datasets[0].data.length > 0 ? (
                         <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-text-muted animate-pulse">Carregando...</div>}>
                             <Scatter 
                                data={scatterData} 
                                options={{
                                    ...chartOptions,
                                    scales: {
                                        x: { 
                                            title: { display: true, text: 'Tempo Médio (minutos)', color: '#666' },
                                            grid: { color: 'rgba(255,255,255,0.05)' },
                                            ticks: { color: '#888' }
                                        },
                                        y: { 
                                            min: 0, max: 100,
                                            title: { display: true, text: 'Score', color: '#666' },
                                            grid: { color: 'rgba(255,255,255,0.05)' }
                                        }
                                    }
                                }} 
                             />
                         </Suspense>
                     ) : (
                         <div className="h-full flex items-center justify-center text-text-muted text-sm border-2 border-dashed border-white/5 rounded-xl">
                             Sem dados de tempo
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
                      <button 
                        onClick={confirmAnalysis} 
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-primary to-emerald-400 text-black text-sm font-bold hover:shadow-glow-md transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 group relative overflow-hidden"
                      >
                          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                          <span className="relative z-10 flex items-center gap-2">Confirmar Auditoria <Icons.ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
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

      {/* Tutorial Modal */}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

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