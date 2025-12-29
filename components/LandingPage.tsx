import React, { useState, useEffect, useRef } from 'react';
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

// --- VISUAL COMPONENTS ---

// 1. Mouse Spotlight Card
const SpotlightCard = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => {
    const divRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return;
        const rect = divRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        divRef.current.style.setProperty('--mouse-x', `${x}px`);
        divRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    return (
        <div 
            ref={divRef}
            onMouseMove={handleMouseMove}
            className={`spotlight-card rounded-3xl p-8 transition-transform duration-300 hover:scale-[1.01] ${className}`}
        >
            <div className="relative z-10">{children}</div>
        </div>
    );
};

// 2. FAQ Item
const FaqItem = ({ question, answer }: { question: string, answer: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-white/5 last:border-0 group">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full py-5 flex justify-between items-center text-left hover:text-brand-primary transition-colors focus:outline-none"
            >
                <span className="font-medium text-lg text-white/90 group-hover:text-brand-primary transition-colors">{question}</span>
                <Icons.ChevronDown className={`w-5 h-5 text-text-muted transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-primary' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                <p className="text-text-secondary leading-relaxed max-w-2xl">{answer}</p>
            </div>
        </div>
    );
};

// 3. Scroll Progress Bar
const ScrollProgress = () => {
    const [progress, setProgress] = useState(0);
    useEffect(() => {
        const updateProgress = () => {
            const currentProgress = window.scrollY;
            const scrollHeight = document.body.scrollHeight - window.innerHeight;
            if (scrollHeight) {
                setProgress(Number((currentProgress / scrollHeight).toFixed(2)) * 100);
            }
        };
        window.addEventListener('scroll', updateProgress);
        return () => window.removeEventListener('scroll', updateProgress);
    }, []);

    return (
        <div className="fixed top-0 left-0 w-full h-[2px] z-[60] bg-white/5">
            <div 
                className="h-full bg-gradient-to-r from-brand-primary via-blue-500 to-purple-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]" 
                style={{ width: `${progress}%` }}
            />
        </div>
    );
};

// --- MAIN LANDING PAGE ---

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

  // ROI Calculator State
  const [ticketMedio, setTicketMedio] = useState(500);
  const [vendasPerdidas, setVendasPerdidas] = useState(5);
  
  const perdaMensal = ticketMedio * vendasPerdidas;
  const perdaAnual = perdaMensal * 12;

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
    <div className="min-h-screen bg-bg-body text-text-primary font-sans selection:bg-brand-primary selection:text-black overflow-hidden relative">
      <ScrollProgress />
      
      {/* --- HERO BACKGROUND EFFECTS --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Deep Background Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />
        
        {/* Animated Moving Blobs - Slower and darker */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-primary/5 rounded-full blur-[120px] animate-blob mix-blend-screen" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] animate-blob animation-delay-2000 mix-blend-screen" />
        <div className="absolute bottom-[-20%] left-[20%] w-[800px] h-[800px] bg-purple-600/5 rounded-full blur-[120px] animate-blob animation-delay-4000 mix-blend-screen" />
      </div>

      {/* --- NAVBAR --- */}
      <nav className={`fixed w-full z-50 transition-all duration-500 border-b ${scrolled ? 'bg-bg-body/80 backdrop-blur-xl border-white/5 py-4 shadow-2xl shadow-brand-primary/5' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
                <div className="absolute -inset-1 bg-brand-primary/50 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#1a1a1a] to-black border border-white/10 flex items-center justify-center">
                    <Icons.ShieldCheck className="h-5 w-5 text-brand-primary" />
                </div>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Fiscal<span className="text-brand-primary">DeVenda</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-text-secondary">
            <a href="#funciona" className="hover:text-white transition-colors relative group">
                Como Funciona
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-primary transition-all group-hover:w-full"></span>
            </a>
            <a href="#roi" className="hover:text-white transition-colors relative group">
                Calculadora
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-primary transition-all group-hover:w-full"></span>
            </a>
            <a href="#precos" className="hover:text-white transition-colors relative group">
                Preços
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-primary transition-all group-hover:w-full"></span>
            </a>
          </div>

          <div className="flex items-center gap-4">
             {toggleTheme && (
                <button onClick={toggleTheme} className="text-text-secondary hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
                    {theme === 'dark' ? <Icons.Sun className="w-5 h-5" /> : <Icons.Moon className="w-5 h-5" />}
                </button>
            )}
            <button 
              onClick={() => { setAuthMode('login'); resetForm(); setShowModal(true); }}
              className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-brand-primary/50 transition-all text-sm font-semibold text-white shadow-lg hover:shadow-brand-primary/10"
            >
              Entrar
            </button>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION (Enhanced) --- */}
      <section className="relative z-10 pt-48 pb-32 px-6 overflow-hidden">
        {/* Cinematic Beams */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none opacity-40">
            <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-white/20 to-transparent"></div>
            <div className="absolute top-0 right-1/4 w-[1px] h-full bg-gradient-to-b from-white/20 to-transparent"></div>
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-primary/20 blur-[100px] rounded-full mix-blend-screen"></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-20">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 mb-8 animate-fade-in hover:bg-brand-primary/20 transition-colors cursor-default shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <span className="flex h-2 w-2 rounded-full bg-brand-primary animate-pulse"></span>
            <span className="text-xs font-bold text-brand-primary uppercase tracking-widest">Nova IA 2.0 Disponível</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[1.05] mb-8 tracking-tighter animate-fade-in-up bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/50 drop-shadow-sm">
            Pare de queimar <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-emerald-300 relative">
                vendas no WhatsApp.
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-brand-primary opacity-60" viewBox="0 0 200 9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.00025 6.99997C25.7617 5.2326 124.962 -3.3769 197.989 2.00021" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up font-light" style={{animationDelay: '0.2s'}}>
            A primeira IA que audita suas conversas, <span className="text-white font-medium">encontra o erro exato</span> e escreve o script para você recuperar o cliente.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
            <button 
                onClick={() => { setAuthMode('signup'); resetForm(); setShowModal(true); }}
                className="group relative px-10 py-5 bg-brand-primary text-black rounded-full font-bold text-lg shadow-[0_0_40px_-10px_rgba(16,185,129,0.6)] hover:shadow-[0_0_60px_-10px_rgba(16,185,129,0.8)] hover:-translate-y-1 transition-all duration-300 overflow-hidden w-full sm:w-auto"
            >
              <div className="absolute inset-0 bg-white/40 group-hover:translate-x-full transition-transform duration-500 -skew-x-12 -translate-x-full"></div>
              <span className="relative z-10 flex items-center justify-center gap-2">
                Começar Grátis Agora <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            
            <a href="#demo" className="px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-full font-semibold text-lg transition-all flex items-center justify-center gap-2 w-full sm:w-auto backdrop-blur-sm group text-white">
              <Icons.Play className="w-5 h-5 fill-current group-hover:text-brand-primary transition-colors" /> Ver demonstração
            </a>
          </div>
          
          {/* Trust Badge Strip */}
          <div className="mt-20 pt-10 border-t border-white/5 flex flex-col items-center gap-6 animate-fade-in opacity-70 hover:opacity-100 transition-opacity duration-500" style={{animationDelay: '0.5s'}}>
             <span className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Usado por times de alta performance</span>
             <div className="flex flex-wrap justify-center gap-12 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                <div className="flex items-center gap-2 text-xl font-bold text-white"><Icons.Hexagon className="w-6 h-6 text-white" /> NEXUS</div>
                <div className="flex items-center gap-2 text-xl font-bold text-white"><Icons.Triangle className="w-6 h-6 text-white" /> VORTEX</div>
                <div className="flex items-center gap-2 text-xl font-bold text-white"><Icons.Circle className="w-6 h-6 text-white" /> SPHERE</div>
                <div className="flex items-center gap-2 text-xl font-bold text-white"><Icons.Box className="w-6 h-6 text-white" /> CUBE</div>
                <div className="flex items-center gap-2 text-xl font-bold text-white"><Icons.Zap className="w-6 h-6 text-white" /> BOLT</div>
             </div>
          </div>

        </div>
      </section>

      {/* --- BENTO GRID PROBLEM SECTION --- */}
      <section className="py-32 relative bg-[#050505]">
        <div className="absolute inset-0 bg-grid-white bg-[size:60px_60px] opacity-[0.03]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303] via-transparent to-[#030303]"></div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="text-center mb-20">
                <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">O "Cemitério de Leads" <br/> <span className="text-text-muted">tem um padrão claro.</span></h2>
                <p className="text-text-secondary text-lg max-w-2xl mx-auto">Analisamos 50.000+ conversas. 80% das vendas morrem aqui:</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
                {/* Card 1 */}
                <SpotlightCard className="bg-[#0a0a0a] border-white/5 md:col-span-2 group">
                    <div className="flex flex-col md:flex-row gap-8 items-center h-full">
                        <div className="flex-1">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl mb-6 text-blue-400 border border-blue-500/20">😶</div>
                            <h3 className="text-2xl font-bold mb-3 text-white">O Vácuo Eterno</h3>
                            <p className="text-text-secondary leading-relaxed">
                                Cliente diz "vou ver com minha esposa" e nunca mais volta. Você aceitou a desculpa esfarrapada em vez de criar urgência real.
                            </p>
                        </div>
                        {/* Visual for Card 1 */}
                        <div className="w-full md:w-1/2 bg-[#111] rounded-xl border border-white/10 p-4 relative overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent z-10"></div>
                            <div className="space-y-3 font-mono text-xs">
                                <div className="bg-white/5 p-2 rounded w-3/4">Vou pensar e te aviso...</div>
                                <div className="text-right text-brand-primary">Ok, fico no aguardo!</div>
                                <div className="text-center text-text-muted text-[10px] mt-4">2 dias depois...</div>
                                <div className="text-right text-brand-primary opacity-50">Oi? E aí?</div>
                            </div>
                        </div>
                    </div>
                </SpotlightCard>

                {/* Card 2 */}
                <SpotlightCard className="bg-[#0a0a0a] border-white/5 md:col-span-1">
                    <div className="h-full flex flex-col">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-2xl mb-6 text-red-400 border border-red-500/20">😰</div>
                        <h3 className="text-xl font-bold mb-3 text-white">Preço Prematuro</h3>
                        <p className="text-text-secondary leading-relaxed flex-1">
                            Você passou o preço antes de gerar valor. O cliente achou caro, comparou com o concorrente e sumiu.
                        </p>
                    </div>
                </SpotlightCard>

                {/* Card 3 */}
                <SpotlightCard className="bg-[#0a0a0a] border-white/5 md:col-span-1">
                    <div className="h-full flex flex-col">
                        <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-2xl mb-6 text-yellow-400 border border-yellow-500/20">🤖</div>
                        <h3 className="text-xl font-bold mb-3 text-white">Vendedor Robô</h3>
                        <p className="text-text-secondary leading-relaxed flex-1">
                            Textões enormes, áudios de 2 minutos e zero conexão humana. O cliente compra de quem se importa.
                        </p>
                    </div>
                </SpotlightCard>

                {/* Card 4 - The Solution */}
                <SpotlightCard className="bg-gradient-to-br from-brand-primary/10 to-[#0a0a0a] border-brand-primary/20 md:col-span-2 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent)]"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-brand-primary/20 flex items-center justify-center text-2xl mb-6 text-brand-primary border border-brand-primary/30"><Icons.Sparkles className="w-6 h-6" /></div>
                            <h3 className="text-2xl font-bold mb-3 text-white">A Auditoria com IA</h3>
                            <p className="text-text-secondary leading-relaxed max-w-md">
                                O Fiscal analisa a psicologia da conversa e te diz exatamente o que dizer para reverter a situação.
                            </p>
                        </div>
                        <button onClick={() => { setAuthMode('signup'); setShowModal(true); }} className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg whitespace-nowrap">
                            Resolver Agora
                        </button>
                    </div>
                </SpotlightCard>
            </div>
        </div>
      </section>

      {/* --- ROI CALCULATOR (Deep Dark) --- */}
      <section id="roi" className="py-32 relative overflow-hidden bg-[#020202]">
          <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-brand-primary/5 to-transparent opacity-30 pointer-events-none"></div>
          
          <div className="max-w-5xl mx-auto px-6 relative z-10">
              <div className="text-center mb-16">
                  <span className="text-brand-primary font-bold tracking-widest text-xs uppercase mb-2 block animate-pulse">Calculadora de Prejuízo</span>
                  <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">Quanto dinheiro você deixa na mesa?</h2>
                  <p className="text-text-secondary text-lg">Faça as contas. O custo de não usar o Fiscal de Venda é maior do que você imagina.</p>
              </div>

              <div className="bg-[#0a0a0a] p-1 rounded-3xl border border-white/10 shadow-2xl relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-transparent to-brand-primary/20 opacity-20 blur-3xl pointer-events-none"></div>
                  
                  <div className="bg-[#0f0f0f] rounded-[22px] p-8 md:p-12 grid md:grid-cols-2 gap-12 relative z-10">
                      <div className="space-y-10">
                          <div>
                              <div className="flex justify-between mb-4">
                                <label className="text-sm font-bold text-text-muted uppercase">Ticket Médio (R$)</label>
                                <span className="text-brand-primary font-mono font-bold">R$ {ticketMedio}</span>
                              </div>
                              <input 
                                type="range" 
                                min="50" max="5000" step="50"
                                value={ticketMedio}
                                onChange={(e) => setTicketMedio(Number(e.target.value))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-primary hover:accent-brand-hover"
                              />
                          </div>

                          <div>
                              <div className="flex justify-between mb-4">
                                <label className="text-sm font-bold text-text-muted uppercase">Vendas Perdidas / Mês</label>
                                <span className="text-brand-primary font-mono font-bold">{vendasPerdidas}</span>
                              </div>
                              <input 
                                type="range" 
                                min="1" max="50" step="1"
                                value={vendasPerdidas}
                                onChange={(e) => setVendasPerdidas(Number(e.target.value))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-primary hover:accent-brand-hover"
                              />
                          </div>
                          
                          <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                              <p className="text-xs text-text-secondary">
                                  <Icons.Info className="inline w-3 h-3 mr-1" />
                                  Consideramos apenas as vendas que <strong>poderiam</strong> ter sido fechadas com melhor técnica.
                              </p>
                          </div>
                      </div>

                      <div className="flex flex-col justify-center items-center text-center p-8 rounded-2xl bg-gradient-to-b from-[#151515] to-[#0a0a0a] border border-white/5 relative overflow-hidden">
                          <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>
                          
                          <p className="text-red-400 font-medium mb-4 text-sm uppercase tracking-wider">Prejuízo Mensal Estimado</p>
                          <p className="text-6xl md:text-7xl font-extrabold text-white mb-2 tracking-tighter">
                              R$ {perdaMensal.toLocaleString('pt-BR')}
                          </p>
                          <p className="text-text-muted text-sm mb-8">Isso são <span className="text-white font-bold border-b border-white/20">R$ {perdaAnual.toLocaleString('pt-BR')}</span> por ano.</p>
                          
                          <button onClick={() => { setAuthMode('signup'); setShowModal(true); }} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                              Parar de Perder Dinheiro
                          </button>
                          <p className="text-[10px] text-text-muted mt-3">O Plano Pro custa apenas R$ 97,90.</p>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* --- PRICING (Neon Borders) --- */}
      <section id="precos" className="py-32 relative overflow-hidden bg-bg-body">
         <div className="max-w-6xl mx-auto px-6 relative z-10">
             <div className="text-center mb-20">
                 <h2 className="text-4xl font-bold mb-4 text-white">Planos simples.</h2>
                 <p className="text-text-secondary">Cancele quando quiser. Sem letras miúdas.</p>
             </div>
             
             <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
                 
                 {/* Free */}
                 <div className="p-8 rounded-3xl border border-white/10 bg-[#0a0a0a] flex flex-col transition-all hover:border-white/20 hover:bg-[#111]">
                     <h3 className="text-xl font-bold mb-2 text-white">Curioso</h3>
                     <div className="text-4xl font-bold mb-1 text-white">R$ 0</div>
                     <p className="text-text-muted text-sm mb-8">Para testar a ferramenta.</p>
                     
                     <div className="flex-1 space-y-4 mb-8">
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> 1 auditoria completa</li>
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> Diagnóstico básico</li>
                     </div>
                     <button onClick={() => { setAuthMode('signup'); setShowModal(true); }} className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/10 text-white transition-colors font-medium text-sm">Criar conta grátis</button>
                 </div>

                 {/* Pro - Featured with Moving Border */}
                 <div className="relative group rounded-3xl">
                     <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-brand-primary via-blue-500 to-brand-primary opacity-75 blur-sm group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-border-beam"></div>
                     <div className="relative p-8 rounded-3xl bg-[#151515] h-full flex flex-col shadow-2xl">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-primary text-black text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg tracking-wide whitespace-nowrap z-20">
                             ESCOLHA DOS PROFISSIONAIS
                        </div>
                        <h3 className="text-2xl font-bold mb-2 text-white">Vendedor Pro</h3>
                        <div className="text-5xl font-extrabold mb-1 text-white tracking-tight">R$ 97<span className="text-2xl text-text-muted">,90</span></div>
                        <p className="text-text-muted text-xs mb-8 uppercase tracking-widest">por mês</p>
                        
                        <div className="flex-1 space-y-4 mb-8">
                            <li className="flex items-center gap-3 text-sm text-white font-medium"><div className="p-1 rounded bg-brand-primary/20"><Icons.Check className="w-3 h-3 text-brand-primary" /></div> Auditorias ILIMITADAS</li>
                            <li className="flex items-center gap-3 text-sm text-white font-medium"><div className="p-1 rounded bg-brand-primary/20"><Icons.Check className="w-3 h-3 text-brand-primary" /></div> Histórico vitalício</li>
                            <li className="flex items-center gap-3 text-sm text-white font-medium"><div className="p-1 rounded bg-brand-primary/20"><Icons.Check className="w-3 h-3 text-brand-primary" /></div> Scripts de Copywriting</li>
                            <li className="flex items-center gap-3 text-sm text-white font-medium"><div className="p-1 rounded bg-brand-primary/20"><Icons.Check className="w-3 h-3 text-brand-primary" /></div> Análise de Tom de Voz</li>
                        </div>
                        
                        <button onClick={() => { setAuthMode('signup'); setShowModal(true); }} className="w-full py-4 rounded-xl bg-brand-primary text-black font-bold text-lg hover:bg-brand-hover transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] active:scale-95">
                            Quero vender mais
                        </button>
                        <p className="text-center text-[10px] text-text-muted mt-3">Garantia de 7 dias ou seu dinheiro de volta.</p>
                     </div>
                 </div>

                 {/* Pack */}
                 <div className="p-8 rounded-3xl border border-white/10 bg-[#0a0a0a] flex flex-col transition-all hover:border-white/20 hover:bg-[#111]">
                     <h3 className="text-xl font-bold mb-2 text-white">Starter Pack</h3>
                     <div className="text-4xl font-bold mb-1 text-white">R$ 29,90</div>
                     <p className="text-text-muted text-sm mb-8">Pagamento único</p>
                     
                     <div className="flex-1 space-y-4 mb-8">
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> 10 auditorias</li>
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> Acesso total aos recursos</li>
                         <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> Sem validade</li>
                     </div>
                     <button onClick={() => { setAuthMode('signup'); setShowModal(true); }} className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/10 text-white transition-colors font-medium text-sm">Comprar Pack</button>
                 </div>
             </div>
         </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section className="py-32 bg-bg-elevated border-t border-white/5 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent"></div>
          <div className="max-w-3xl mx-auto px-6">
              <h2 className="text-3xl font-bold text-center mb-16 text-white">Perguntas Frequentes</h2>
              <div className="space-y-4">
                  <FaqItem question="Funciona para qualquer nicho?" answer="Sim. A IA foi treinada em milhares de conversas de B2B, B2C, Imóveis, Carros, Info e Serviços. Ela entende o contexto da venda e adapta a análise." />
                  <FaqItem question="É seguro enviar meus dados?" answer="Absolutamente. Seus dados são processados de forma criptografada e nós não utilizamos suas conversas para treinar a IA pública. Você tem total privacidade." />
                  <FaqItem question="E se eu não gostar?" answer="Você tem 7 dias de garantia incondicional no plano Pro. Se achar que não valeu a pena, devolvemos 100% do seu dinheiro. Sem perguntas." />
                  <FaqItem question="Preciso instalar algum app?" answer="Não. O Fiscal de Venda roda direto no seu navegador, seja no celular ou no computador. É só acessar, fazer login e usar." />
              </div>
          </div>
      </section>

      {/* --- FINAL CTA --- */}
      <section className="py-40 relative text-center px-6 overflow-hidden">
        <div className="absolute inset-0 bg-glow-radial opacity-20 pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-bold mb-10 tracking-tight text-white">
                Sua próxima venda <br/> não precisa ser perdida.
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <button 
                    onClick={() => { setAuthMode('signup'); setShowModal(true); }}
                    className="px-12 py-6 bg-white text-black rounded-full font-bold text-xl hover:scale-105 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.3)] w-full sm:w-auto"
                >
                    Começar Auditoria Grátis
                </button>
            </div>
            <p className="mt-8 text-sm text-text-muted flex items-center justify-center gap-2">
                <Icons.ShieldCheck className="w-4 h-4" /> Não precisa de cartão de crédito para testar.
            </p>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 py-12 bg-[#020202] text-text-muted text-sm relative z-20">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-brand-primary/20 flex items-center justify-center text-brand-primary">
                    <Icons.ShieldCheck className="h-4 w-4" />
                </div>
                <span className="font-bold text-white">FiscalDeVenda</span>
             </div>
             <div className="flex gap-8">
                 <a href="#" className="hover:text-white transition-colors">Termos</a>
                 <a href="#" className="hover:text-white transition-colors">Privacidade</a>
                 <a href="#" className="hover:text-white transition-colors">Contato</a>
             </div>
             <p>© 2025 FiscalDeVenda Inc.</p>
          </div>
      </footer>

      {/* Auth Overlay Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowModal(false)}></div>
            <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl animate-fade-in-up">
                
                <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 text-text-muted hover:text-white transition-colors bg-white/5 p-2 rounded-full">
                    <Icons.X className="w-5 h-5" />
                </button>

                <div className="text-center mb-8">
                    <div className="inline-flex p-4 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 mb-4 shadow-glow-sm">
                        <Icons.ShieldCheck className="w-10 h-10 text-brand-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {authMode === 'login' && 'Bem-vindo de volta'}
                        {authMode === 'signup' && 'Crie sua conta grátis'}
                        {authMode === 'forgot' && 'Recuperar senha'}
                    </h2>
                    <p className="text-text-muted text-sm">
                        {authMode === 'login' && 'Acesse suas auditorias salvas'}
                        {authMode === 'signup' && 'Comece a recuperar vendas em 30 segundos'}
                        {authMode === 'forgot' && 'Insira seu email para receber o link'}
                    </p>
                </div>

                <div className="space-y-4">
                    {authMode !== 'forgot' && (
                        <>
                            <button 
                                onClick={handleGoogleLogin}
                                className="w-full py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-3"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                Continuar com Google
                            </button>
                            
                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-white/10"></span>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase font-bold tracking-wider">
                                    <span className="bg-[#0a0a0a] px-2 text-text-muted">ou use seu email</span>
                                </div>
                            </div>
                        </>
                    )}

                    <form onSubmit={handleEmailAuth} className="space-y-4">
                         {authMode === 'signup' && (
                             <div className="relative group">
                                <Icons.User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-brand-primary transition-colors" />
                                 <input 
                                    type="text" 
                                    placeholder="Nome completo" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-brand-primary focus:bg-white/10 transition-all placeholder:text-text-muted font-medium" 
                                    required
                                />
                             </div>
                         )}
                         <div className="relative group">
                             <Icons.Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-brand-primary transition-colors" />
                             <input 
                                type="email" 
                                placeholder="seu@email.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-brand-primary focus:bg-white/10 transition-all placeholder:text-text-muted font-medium" 
                                required
                            />
                         </div>
                         {authMode !== 'forgot' && (
                             <div className="relative group">
                                <Icons.Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-brand-primary transition-colors" />
                                 <input 
                                    type="password" 
                                    placeholder="Sua senha" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-brand-primary focus:bg-white/10 transition-all placeholder:text-text-muted font-medium" 
                                    required
                                    minLength={6}
                                />
                             </div>
                         )}

                         {authError && <p className="text-red-500 text-xs text-center font-bold bg-red-500/10 py-2 rounded-lg border border-red-500/20">{authError}</p>}
                         {authSuccess && <p className="text-emerald-500 text-xs text-center font-bold bg-emerald-500/10 py-2 rounded-lg border border-emerald-500/20">{authSuccess}</p>}

                         <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-3.5 bg-brand-primary hover:bg-brand-hover text-black font-bold rounded-xl transition-all shadow-glow-sm flex justify-center items-center hover:-translate-y-0.5"
                        >
                             {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-black"></div> : (
                                 authMode === 'login' ? 'Acessar Conta' : 
                                 authMode === 'signup' ? 'Criar Conta Grátis' : 'Enviar Link de Recuperação'
                             )}
                         </button>
                    </form>
                    
                    <div className="text-center text-sm text-text-muted mt-6 space-y-3">
                        {authMode === 'login' && (
                            <>
                                <button onClick={() => { setAuthMode('forgot'); setAuthError(null); }} className="block w-full text-center hover:text-white text-xs transition-colors">Esqueceu a senha?</button>
                                <div>Não tem conta? <button onClick={() => { setAuthMode('signup'); resetForm(); }} className="text-brand-primary hover:text-brand-hover font-bold ml-1 transition-colors underline decoration-brand-primary/30 underline-offset-4">Criar agora</button></div>
                            </>
                        )}
                        {authMode === 'signup' && (
                            <div>Já tem conta? <button onClick={() => { setAuthMode('login'); resetForm(); }} className="text-brand-primary hover:text-brand-hover font-bold ml-1 transition-colors underline decoration-brand-primary/30 underline-offset-4">Fazer login</button></div>
                        )}
                        {authMode === 'forgot' && (
                             <button onClick={() => { setAuthMode('login'); resetForm(); }} className="text-brand-primary hover:text-brand-hover font-bold transition-colors">Voltar para o login</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};