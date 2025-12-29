import React, { useState, useEffect } from 'react';
import { Icons } from './ui/Icons';
import { 
  signInWithPopup, 
  googleProvider, 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from '../services/firebase';

interface LandingPageProps {
  onLoginSuccess: () => void;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess, theme = 'dark', toggleTheme }) => {
  const [scrolled, setScrolled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setAuthError(null);
    setAuthSuccess(null);
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      setIsLoading(true);
      await signInWithPopup(auth, googleProvider);
      // Sucesso é tratado pelo onAuthStateChanged no App.tsx
      setShowModal(false);
    } catch (error: any) {
      console.error("Google Auth Error:", error);
      let msg = "Erro ao conectar com Google.";
      if (error.code === 'auth/popup-closed-by-user') msg = "Login cancelado.";
      setAuthError(msg);
    } finally {
        setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setIsLoading(true);

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        setShowModal(false);
      } else if (authMode === 'signup') {
        if (!name) throw new Error("Por favor, informe seu nome.");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        setShowModal(false);
      } else if (authMode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setAuthSuccess("Email enviado! Verifique sua caixa de entrada.");
        setIsLoading(false);
        return; 
      }
    } catch (error: any) {
      let msg = "Ocorreu um erro.";
      if (error.code?.includes('wrong-password') || error.code?.includes('not-found') || error.code?.includes('invalid-credential')) msg = "Email ou senha incorretos.";
      else if (error.code?.includes('email-already-in-use')) msg = "Email já cadastrado.";
      setAuthError(msg);
    } finally {
      if (authMode !== 'forgot') setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-body text-text-primary font-sans selection:bg-brand-primary selection:text-white overflow-hidden relative">
      
      {/* Background Grid & Glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-glow-radial opacity-40"></div>
      </div>

      {/* Navbar */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-bg-body/90 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20 group-hover:border-brand-primary/50 transition-colors">
              <Icons.ShieldCheck className="h-5 w-5 text-brand-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight">Fiscal<span className="text-brand-primary">DeVenda</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-text-secondary">
            <a href="#funciona" className="hover:text-white transition-colors">Como Funciona</a>
            <a href="#demo" className="hover:text-white transition-colors">Demonstração</a>
            <a href="#precos" className="hover:text-white transition-colors">Preços</a>
          </div>

          <div className="flex items-center gap-4">
             {toggleTheme && (
                <button onClick={toggleTheme} className="text-text-secondary hover:text-white transition-colors">
                    {theme === 'dark' ? <Icons.Sun className="w-5 h-5" /> : <Icons.Moon className="w-5 h-5" />}
                </button>
            )}
            <button 
              onClick={() => { setAuthMode('login'); resetForm(); setShowModal(true); }}
              className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm font-medium"
            >
              Entrar
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-40 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in backdrop-blur-sm hover:border-brand-primary/30 transition-colors cursor-default">
            <span className="flex h-2 w-2 rounded-full bg-brand-primary animate-pulse"></span>
            <span className="text-xs font-medium text-brand-primary uppercase tracking-wide">IA 2.0 Disponível</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 tracking-tight animate-fade-in-up" style={{animationDelay: '0.1s'}}>
            Descubra onde você <br/>
            <span className="text-gradient">perdeu aquela venda.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{animationDelay: '0.2s'}}>
            Suba a conversa do WhatsApp e nossa inteligência artificial audita cada mensagem, identifica o momento exato da ruptura e diz como recuperar.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
            <button 
                onClick={() => { setAuthMode('signup'); resetForm(); setShowModal(true); }}
                className="group relative px-8 py-4 bg-brand-primary text-bg-body rounded-xl font-bold text-lg shadow-glow-sm hover:shadow-glow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Começar Grátis <Icons.ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </button>
            
            <a href="#demo" className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-lg transition-all flex items-center gap-2">
              <Icons.Play className="w-4 h-4 fill-current" /> Ver demonstração
            </a>
          </div>
          
          <div className="mt-12 flex items-center justify-center gap-6 text-sm text-text-muted animate-fade-in" style={{animationDelay: '0.5s'}}>
             <span className="flex items-center gap-2"><Icons.Check className="w-4 h-4 text-brand-primary" /> Aceita .txt e .zip</span>
             <span className="flex items-center gap-2"><Icons.Check className="w-4 h-4 text-brand-primary" /> OCR para Prints</span>
          </div>

        </div>
      </section>

      {/* Problem Section - Cards */}
      <section className="py-24 border-t border-white/5 relative bg-bg-elevated">
        <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Você perde vendas todo dia <br/> <span className="text-text-muted">e nem sabe por quê.</span></h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
                {[
                    { emoji: "😶", title: '"Vou pensar"', desc: "Cliente pediu tempo e nunca mais respondeu suas mensagens." },
                    { emoji: "📵", title: "Visualizou e sumiu", desc: "Você mandou o orçamento, ele viu, e simplesmente desapareceu." },
                    { emoji: "💸", title: '"Tá caro"', desc: "Objeção de preço que você não soube quebrar e perdeu a venda." }
                ].map((card, i) => (
                    <div key={i} className="glass-card p-8 rounded-2xl group hover:border-brand-primary/30">
                        <span className="text-4xl mb-6 block grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-300">{card.emoji}</span>
                        <h3 className="text-xl font-bold mb-3 text-white">{card.title}</h3>
                        <p className="text-text-secondary leading-relaxed">{card.desc}</p>
                    </div>
                ))}
            </div>
             <p className="text-center mt-16 text-lg text-text-muted">
                "O problema não está no cliente. <span className="text-white font-medium">Está em alguma mensagem que você mandou.</span>"
            </p>
        </div>
      </section>

      {/* Demo Section - Complex UI */}
      <section id="demo" className="py-32 border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
                 <h2 className="text-3xl md:text-4xl font-bold">Auditoria em tempo real</h2>
                 <p className="text-text-secondary mt-4">Veja como transformamos uma conversa perdida em aprendizado.</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-start">
                
                {/* Left: Chat UI */}
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="bg-[#111] border-b border-white/5 p-4 flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="ml-2 text-xs text-text-muted font-mono">WhatsApp_Export.txt</span>
                    </div>
                    <div className="p-6 space-y-4 font-sans text-sm">
                        <div className="flex flex-col items-end">
                            <div className="bg-brand-muted text-brand-primary px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
                                <p className="text-xs opacity-70 mb-1">Vendedor</p>
                                <p className="text-white">Olá! Vi que se interessou pelo nosso serviço 😊</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-start">
                            <div className="bg-white/5 text-gray-200 px-4 py-2 rounded-2xl rounded-tl-sm max-w-[85%]">
                                <p className="text-xs opacity-50 mb-1">Cliente</p>
                                <p>Oi, quanto custa?</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end relative group">
                            <div className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Icons.AlertTriangle className="text-red-500 w-4 h-4 animate-bounce" />
                            </div>
                            <div className="bg-red-500/10 border border-red-500/30 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
                                <p className="text-xs text-red-400 mb-1">Vendedor (Erro Identificado)</p>
                                <p>O plano completo sai por R$ 497</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-start">
                            <div className="bg-white/5 text-gray-200 px-4 py-2 rounded-2xl rounded-tl-sm max-w-[85%]">
                                <p className="text-xs opacity-50 mb-1">Cliente</p>
                                <p>Hmm vou pensar</p>
                            </div>
                        </div>
                        <div className="flex justify-center py-4">
                            <span className="text-xs bg-white/5 px-3 py-1 rounded-full text-text-muted">Cliente parou de responder</span>
                        </div>
                    </div>
                </div>

                {/* Right: Analysis Result */}
                <div className="space-y-6">
                    <div className="glass-card p-6 rounded-2xl flex items-center justify-between border-l-4 border-l-red-500">
                        <div>
                            <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Diagnóstico</div>
                            <h3 className="text-xl font-bold text-white">Preço Prematuro</h3>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-bold text-red-500">32</span>
                            <span className="text-xs text-text-muted">/100</span>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl">
                         <div className="flex items-center gap-2 mb-4">
                             <Icons.AlertTriangle className="text-yellow-500 w-5 h-5" />
                             <h4 className="font-bold">Onde você errou</h4>
                         </div>
                         <p className="text-text-secondary text-sm leading-relaxed">
                             Você jogou o preço antes de gerar valor. O cliente ainda não sabia o que estava comprando, então o preço pareceu caro.
                         </p>
                    </div>

                    <div className="glass-card p-6 rounded-2xl border-l-4 border-l-brand-primary bg-brand-primary/5">
                         <div className="flex items-center gap-2 mb-4">
                             <Icons.CheckCircle className="text-brand-primary w-5 h-5" />
                             <h4 className="font-bold text-white">O que deveria ter dito</h4>
                         </div>
                         <p className="text-brand-primary font-medium text-lg italic leading-relaxed">
                             "Claro! Antes de falar de valores, me conta: qual problema você quer resolver com isso hoje?"
                         </p>
                    </div>
                </div>

            </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-24 bg-bg-elevated border-t border-white/5">
         <div className="max-w-6xl mx-auto px-6">
             <h2 className="text-3xl font-bold text-center mb-16">Investimento que se paga <br/> <span className="text-text-muted">na primeira venda recuperada.</span></h2>
             
             <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                 {/* Free */}
                 <div className="glass p-8 rounded-3xl border border-white/5 flex flex-col">
                     <h3 className="text-xl font-bold mb-2">Grátis</h3>
                     <div className="text-3xl font-bold mb-1">R$ 0</div>
                     <p className="text-text-muted text-sm mb-6">Para testar a ferramenta.</p>
                     <ul className="space-y-4 mb-8 flex-1">
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> 1 auditoria completa</li>
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> Diagnóstico básico</li>
                     </ul>
                     <button onClick={() => { setAuthMode('signup'); setShowModal(true); }} className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors font-medium">Começar Grátis</button>
                 </div>

                 {/* Pro - Featured */}
                 <div className="relative p-8 rounded-3xl bg-white/5 border border-brand-primary/50 flex flex-col transform md:-translate-y-4 shadow-glow-sm">
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-primary text-black text-xs font-bold px-3 py-1 rounded-full">MAIS POPULAR</div>
                     <h3 className="text-xl font-bold mb-2 text-white">Starter</h3>
                     <div className="text-3xl font-bold mb-1 text-white">R$ 29,90</div>
                     <p className="text-brand-primary text-sm mb-6">Pagamento único</p>
                     <ul className="space-y-4 mb-8 flex-1">
                         <li className="flex items-center gap-3 text-sm text-white"><Icons.Check className="w-4 h-4 text-brand-primary" /> 10 auditorias</li>
                         <li className="flex items-center gap-3 text-sm text-white"><Icons.Check className="w-4 h-4 text-brand-primary" /> Histórico vitalício</li>
                         <li className="flex items-center gap-3 text-sm text-white"><Icons.Check className="w-4 h-4 text-brand-primary" /> Scripts de follow-up</li>
                     </ul>
                     <button onClick={() => { setAuthMode('signup'); setShowModal(true); }} className="w-full py-3 rounded-xl bg-brand-primary text-black font-bold hover:bg-brand-hover transition-colors shadow-lg">Comprar Agora</button>
                 </div>

                 {/* Enterprise */}
                 <div className="glass p-8 rounded-3xl border border-white/5 flex flex-col">
                     <h3 className="text-xl font-bold mb-2">Pro</h3>
                     <div className="text-3xl font-bold mb-1">R$ 49,90</div>
                     <p className="text-text-muted text-sm mb-6">Mensal / Ilimitado</p>
                     <ul className="space-y-4 mb-8 flex-1">
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> Auditorias ilimitadas</li>
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> Relatórios de evolução</li>
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> Suporte prioritário</li>
                     </ul>
                     <button onClick={() => { setAuthMode('signup'); setShowModal(true); }} className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors font-medium">Assinar Pro</button>
                 </div>
             </div>
         </div>
      </section>

      {/* CTA Final */}
      <section className="py-32 relative text-center px-6 overflow-hidden">
        <div className="absolute inset-0 bg-glow-radial opacity-30 pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">Sua próxima venda <br/> <span className="text-gradient">não precisa ser perdida.</span></h2>
            <button 
                onClick={() => { setAuthMode('signup'); setShowModal(true); }}
                className="px-10 py-5 bg-brand-primary text-bg-body rounded-2xl font-bold text-xl hover:scale-105 transition-transform shadow-glow-md"
            >
                Fazer minha primeira auditoria grátis
            </button>
            <p className="mt-6 text-sm text-text-muted">Não precisa de cartão • Leva 30 segundos</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-bg-elevated text-text-muted text-sm">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="flex items-center gap-2">
                <Icons.ShieldCheck className="h-5 w-5 text-brand-primary" />
                <span className="font-bold text-white">FiscalDeVenda</span>
             </div>
             <div className="flex gap-6">
                 <a href="#" className="hover:text-white transition-colors">Termos</a>
                 <a href="#" className="hover:text-white transition-colors">Privacidade</a>
                 <a href="#" className="hover:text-white transition-colors">Contato</a>
             </div>
             <p>© 2025 FiscalDeVenda.</p>
          </div>
      </footer>

      {/* Auth Overlay Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
            <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl animate-fade-in-up">
                
                <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 text-text-muted hover:text-white transition-colors">
                    <Icons.X className="w-5 h-5" />
                </button>

                <div className="text-center mb-8">
                    <div className="inline-flex p-3 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 mb-4">
                        <Icons.ShieldCheck className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {authMode === 'login' && 'Bem-vindo de volta'}
                        {authMode === 'signup' && 'Crie sua conta'}
                        {authMode === 'forgot' && 'Recuperar senha'}
                    </h2>
                    <p className="text-text-muted text-sm">
                        {authMode === 'login' && 'Acesse suas auditorias salvas'}
                        {authMode === 'signup' && 'Comece a auditar suas vendas hoje'}
                        {authMode === 'forgot' && 'Insira seu email para receber o link'}
                    </p>
                </div>

                <div className="space-y-4">
                    {authMode !== 'forgot' && (
                        <>
                            <button 
                                onClick={handleGoogleLogin}
                                className="w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-3"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                Continuar com Google
                            </button>
                            
                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-white/10"></span>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-[#0a0a0a] px-2 text-text-muted">ou email</span>
                                </div>
                            </div>
                        </>
                    )}

                    <form onSubmit={handleEmailAuth} className="space-y-4">
                         {authMode === 'signup' && (
                             <div className="relative">
                                <Icons.User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                 <input 
                                    type="text" 
                                    placeholder="Nome completo" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/50 transition-all placeholder:text-text-muted" 
                                    required
                                />
                             </div>
                         )}
                         <div className="relative">
                             <Icons.User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                             <input 
                                type="email" 
                                placeholder="seu@email.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/50 transition-all placeholder:text-text-muted" 
                                required
                            />
                         </div>
                         {authMode !== 'forgot' && (
                             <div className="relative">
                                <Icons.ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                 <input 
                                    type="password" 
                                    placeholder="Sua senha" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/50 transition-all placeholder:text-text-muted" 
                                    required
                                    minLength={6}
                                />
                             </div>
                         )}

                         {authError && <p className="text-red-500 text-xs text-center">{authError}</p>}
                         {authSuccess && <p className="text-emerald-500 text-xs text-center">{authSuccess}</p>}

                         <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-3 bg-brand-primary hover:bg-brand-hover text-black font-bold rounded-xl transition-all shadow-glow-sm flex justify-center items-center"
                        >
                             {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-black"></div> : (
                                 authMode === 'login' ? 'Entrar' : 
                                 authMode === 'signup' ? 'Criar Conta' : 'Enviar Link'
                             )}
                         </button>
                    </form>
                    
                    <div className="text-center text-sm text-text-muted mt-6 space-y-2">
                        {authMode === 'login' && (
                            <>
                                <button onClick={() => { setAuthMode('forgot'); setAuthError(null); }} className="block w-full text-center hover:text-white text-xs mb-3 transition-colors">Esqueceu a senha?</button>
                                <div>Não tem conta? <button onClick={() => { setAuthMode('signup'); resetForm(); }} className="text-brand-primary hover:text-brand-hover font-medium ml-1 transition-colors">Criar agora</button></div>
                            </>
                        )}
                        {authMode === 'signup' && (
                            <div>Já tem conta? <button onClick={() => { setAuthMode('login'); resetForm(); }} className="text-brand-primary hover:text-brand-hover font-medium ml-1 transition-colors">Fazer login</button></div>
                        )}
                        {authMode === 'forgot' && (
                             <button onClick={() => { setAuthMode('login'); resetForm(); }} className="text-brand-primary hover:text-brand-hover font-medium transition-colors">Voltar para o login</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};