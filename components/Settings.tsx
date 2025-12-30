import React, { useState, useRef } from 'react';
import { Icons } from './ui/Icons';
import { User, UserProfile } from '../types';
import { updateProfile } from 'firebase/auth';
import { auth, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { createCheckoutSession } from '../services/firestore';

interface SettingsProps {
  user: User;
  userProfile: UserProfile;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onBack: () => void;
  onSignOut: () => void;
  onBuyCredits: (amount: number) => void;
}

type SettingsTab = 'profile' | 'subscription' | 'preferences';

// Stripe Price IDs (CORRIGIDOS)
const PRICE_STARTER = "price_1SjnY38sPBgjqi0CfiIPc0hK";
const PRICE_PRO = "price_1SjnXY8sPBgjqi0CWl78VfDb";

export const Settings: React.FC<SettingsProps> = ({ user, userProfile, theme, toggleTheme, onBack, onSignOut, onBuyCredits }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const isPro = userProfile.plan === 'pro';

  // Profile Edit State
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // Subscription State
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  
  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && auth.currentUser) {
        const file = files[0];
        
        if (file.size > 5 * 1024 * 1024) {
            setSaveMessage("Arquivo muito grande. Máximo 5MB.");
            return;
        }

        setIsSaving(true);
        setSaveMessage("Enviando imagem...");

        try {
            const storageRef = ref(storage, `avatars/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            
            setPhotoURL(downloadURL);
            setSaveMessage("Imagem carregada! Clique em Salvar Alterações.");
        } catch (error: any) {
            console.error("Upload Error:", error);
            setSaveMessage(`Erro no upload: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    }
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
        await updateProfile(auth.currentUser, {
            displayName: displayName,
            photoURL: photoURL
        });
        setSaveMessage("Perfil atualizado com sucesso!");
    } catch (error) {
        console.error(error);
        setSaveMessage("Erro ao atualizar perfil.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleSubscribe = async (priceId: string, mode: 'subscription' | 'payment') => {
    if (!auth.currentUser) return;
    
    setIsSubscribing(true);
    setSubscriptionError(null);
    try {
        // Mode will be handled/forced by firestore service if necessary based on ID
        const url = await createCheckoutSession(auth.currentUser.uid, priceId, mode);
        window.location.assign(url);
    } catch (error: any) {
        console.error("Erro no checkout:", error);
        setSubscriptionError(`Erro ao iniciar pagamento: ${error.message}`);
        setIsSubscribing(false);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  return (
    <div className="animate-fade-in-up max-w-6xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 pt-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 text-text-muted hover:text-white transition-colors group">
            <Icons.ArrowRight className="w-5 h-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
        </button>
        <h1 className="text-3xl font-bold text-text-primary">Configurações</h1>
      </div>

      <div className="grid md:grid-cols-4 gap-8">
        
        {/* Sidebar Nav */}
        <div className="md:col-span-1 space-y-2">
            <button 
                onClick={() => setActiveTab('profile')}
                className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'profile' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
            >
                <Icons.User className="w-4 h-4" /> Minha Conta
            </button>
            <button 
                onClick={() => setActiveTab('subscription')}
                className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'subscription' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
            >
                <Icons.CreditCard className="w-4 h-4" /> Assinatura {isPro && <span className="text-[10px] bg-brand-primary text-black px-1.5 rounded font-bold ml-auto">PRO</span>}
            </button>
            <button 
                onClick={() => setActiveTab('preferences')}
                className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'preferences' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
            >
                <Icons.Settings className="w-4 h-4" /> Preferências
            </button>
            
            <div className="pt-4 mt-4 border-t border-white/5">
                <button onClick={onSignOut} className="w-full text-left px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-3">
                    <Icons.LogOut className="w-4 h-4" /> Sair
                </button>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3">
            
            {/* TAB: PROFILE */}
            {activeTab === 'profile' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="glass-card p-8 rounded-2xl">
                        <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
                            <Icons.Sparkles className="w-5 h-5 text-brand-primary" /> Editar Perfil
                        </h2>
                        
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex flex-col items-center gap-4">
                                {/* Clickable Avatar Area */}
                                <div 
                                    onClick={triggerFileInput}
                                    className="w-32 h-32 rounded-full border-4 border-white/10 overflow-hidden relative group cursor-pointer shadow-xl hover:border-brand-primary transition-colors"
                                >
                                    {photoURL ? (
                                        <img src={photoURL} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-40 transition-opacity" />
                                    ) : (
                                        <div className="w-full h-full bg-brand-primary text-black flex items-center justify-center font-bold text-4xl group-hover:opacity-40 transition-opacity">
                                            {displayName?.[0] || 'U'}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Icons.Upload className="w-8 h-8 text-white mb-1" />
                                        <span className="text-xs text-white font-bold">Alterar</span>
                                    </div>
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                    accept="image/*"
                                />
                                <button 
                                    onClick={triggerFileInput}
                                    className="text-sm text-brand-primary hover:text-white transition-colors font-medium"
                                >
                                    Trocar foto
                                </button>
                            </div>
                            
                            <div className="flex-1 space-y-4 pt-2">
                                <div>
                                    <label className="block text-xs text-text-muted uppercase font-bold mb-2">Nome de Exibição</label>
                                    <input 
                                        type="text" 
                                        value={displayName} 
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full bg-bg-body border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-brand-primary transition-colors"
                                        placeholder="Seu nome"
                                    />
                                </div>
                                
                                <div>
                                     <label className="block text-xs text-text-muted uppercase font-bold mb-2">Email</label>
                                     <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 opacity-60 cursor-not-allowed">
                                         <span className="text-text-primary flex-1">{user.email}</span>
                                         <Icons.CheckCircle className="w-4 h-4 text-brand-primary" />
                                     </div>
                                </div>

                                {saveMessage && (
                                    <div className={`p-3 rounded-lg border text-sm ${saveMessage.includes('sucesso') || saveMessage.includes('carregada') ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                        {saveMessage}
                                    </div>
                                )}

                                <div className="pt-4">
                                    <button 
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        className="px-8 py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-hover transition-colors shadow-glow-sm disabled:opacity-50"
                                    >
                                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: SUBSCRIPTION (Exclusive Section) */}
            {activeTab === 'subscription' && (
                <div className="space-y-8 animate-fade-in">
                    
                    {/* Error Display */}
                    {subscriptionError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
                            <Icons.AlertTriangle className="w-5 h-5 shrink-0" />
                            <span className="text-sm font-medium">{subscriptionError}</span>
                        </div>
                    )}

                    {/* Header Status */}
                    <div className="glass-card p-6 rounded-2xl flex items-center justify-between border border-white/10 bg-[#0a0a0a]">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${isPro ? 'bg-brand-primary/20 text-brand-primary' : 'bg-white/5 text-text-muted'}`}>
                                {isPro ? <Icons.Zap className="w-6 h-6 fill-current" /> : <Icons.User className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {isPro ? 'Assinatura Vendedor Pro Ativa' : 'Plano Gratuito'}
                                </h3>
                                <p className="text-sm text-text-secondary">
                                    {isPro ? 'Você tem acesso ilimitado a todas as ferramentas.' : 'Você está usando a versão limitada.'}
                                </p>
                            </div>
                        </div>
                        {isPro && (
                             <div className="px-4 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-full uppercase tracking-wider">
                                Ativo
                             </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 items-stretch">
                        
                        {/* STARTER PACK */}
                        <div className={`relative p-8 rounded-3xl border transition-all duration-300 flex flex-col ${isPro ? 'opacity-50 grayscale border-white/5 bg-[#0a0a0a]' : 'bg-[#0a0a0a] border-white/10 hover:border-white/20 hover:bg-[#111]'}`}>
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white mb-2">Starter Pack</h3>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-3xl font-bold text-white">R$ 29,90</span>
                                    <span className="text-xs text-text-muted uppercase font-bold tracking-wider">Pagamento único</span>
                                </div>
                                <p className="text-sm text-text-secondary mt-3 leading-relaxed">
                                    Ideal para quem quer testar e ver resultados imediatos.
                                </p>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-sm text-text-secondary">
                                    <Icons.Check className="w-4 h-4 text-white shrink-0" /> 10 auditorias
                                </li>
                                <li className="flex items-center gap-3 text-sm text-text-secondary">
                                    <Icons.Check className="w-4 h-4 text-white shrink-0" /> Acesso total aos recursos
                                </li>
                                <li className="flex items-center gap-3 text-sm text-text-secondary">
                                    <Icons.Check className="w-4 h-4 text-white shrink-0" /> Sem validade
                                </li>
                            </ul>

                            <button 
                                onClick={() => !isPro && handleSubscribe(PRICE_STARTER, 'subscription')}
                                disabled={isSubscribing || isPro}
                                className="w-full py-4 rounded-xl border border-white/20 text-white font-bold text-sm hover:bg-white hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPro ? 'Incluso no Pro' : isSubscribing ? 'Processando...' : 'Comprar Pack'}
                            </button>
                        </div>

                        {/* PRO PLAN (NEON EFFECT) */}
                        <div className={`relative group p-[1px] rounded-3xl ${isPro ? '' : 'shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_-10px_rgba(16,185,129,0.5)] transition-shadow duration-500'}`}>
                            {/* Neon Border Gradient */}
                            <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-primary via-emerald-500 to-brand-primary opacity-50 ${isPro ? 'opacity-20' : 'animate-border-beam opacity-100'}`}></div>
                            
                            <div className="relative h-full bg-[#080f0c] rounded-[23px] p-8 flex flex-col overflow-hidden">
                                {!isPro && (
                                    <div className="absolute top-4 right-4 bg-brand-primary/20 text-brand-primary border border-brand-primary/30 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                        Recomendado
                                    </div>
                                )}
                                
                                <div className="mb-6 relative z-10">
                                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                        Vendedor Pro <Icons.Zap className="w-5 h-5 text-yellow-400 fill-current" />
                                    </h3>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">R$ 97,90</span>
                                        <span className="text-xs text-text-muted uppercase font-bold tracking-wider">por mês</span>
                                    </div>
                                    <p className="text-sm text-brand-primary/80 mt-3 leading-relaxed font-medium">
                                        A ferramenta definitiva para times de alta performance.
                                    </p>
                                </div>

                                <ul className="space-y-4 mb-8 flex-1 relative z-10">
                                    <li className="flex items-center gap-3 text-sm text-white font-medium">
                                        <div className="p-1 rounded bg-brand-primary/20"><Icons.Check className="w-3 h-3 text-brand-primary" /></div>
                                        Auditorias ILIMITADAS
                                    </li>
                                    <li className="flex items-center gap-3 text-sm text-white font-medium">
                                        <div className="p-1 rounded bg-brand-primary/20"><Icons.Check className="w-3 h-3 text-brand-primary" /></div>
                                        Histórico vitalício
                                    </li>
                                    <li className="flex items-center gap-3 text-sm text-white font-medium">
                                        <div className="p-1 rounded bg-brand-primary/20"><Icons.Check className="w-3 h-3 text-brand-primary" /></div>
                                        Scripts de Copywriting
                                    </li>
                                    <li className="flex items-center gap-3 text-sm text-white font-medium">
                                        <div className="p-1 rounded bg-brand-primary/20"><Icons.Check className="w-3 h-3 text-brand-primary" /></div>
                                        Análise de Tom de Voz
                                    </li>
                                </ul>

                                <button 
                                    onClick={() => !isPro && handleSubscribe(PRICE_PRO, 'subscription')}
                                    disabled={isSubscribing || isPro}
                                    className={`w-full py-4 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${isPro ? 'bg-brand-primary/20 text-brand-primary cursor-default' : 'bg-brand-primary hover:bg-brand-hover text-black hover:scale-[1.02] shadow-brand-primary/20'}`}
                                >
                                    {isPro ? (
                                        <><Icons.CheckCircle className="w-4 h-4" /> Plano Ativo</>
                                    ) : isSubscribing ? (
                                        'Redirecionando...'
                                    ) : (
                                        'Quero vender mais'
                                    )}
                                </button>
                                
                                <p className="text-center text-[10px] text-text-muted mt-3 relative z-10">Garantia de 7 dias ou seu dinheiro de volta.</p>
                                
                                {/* Background Glow */}
                                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px] pointer-events-none"></div>
                            </div>
                        </div>

                    </div>
                    
                    <div className="mt-8 text-center">
                        <p className="text-xs text-text-muted flex items-center justify-center gap-2">
                            <Icons.ShieldCheck className="w-3 h-3" /> Pagamento seguro via Stripe. Cancele a qualquer momento.
                        </p>
                    </div>
                </div>
            )}

            {/* TAB: PREFERENCES */}
            {activeTab === 'preferences' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="glass-card p-8 rounded-2xl">
                         <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
                            <Icons.Settings className="w-5 h-5 text-brand-primary" /> Preferências do App
                        </h2>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-bg-body rounded-xl border border-white/5">
                                <div>
                                    <p className="text-text-primary font-medium">Modo Escuro / Claro</p>
                                    <p className="text-xs text-text-muted">Altera a aparência de toda a aplicação</p>
                                </div>
                                <button 
                                    onClick={toggleTheme}
                                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center ${theme === 'dark' ? 'bg-brand-primary justify-end' : 'bg-gray-600 justify-start'}`}
                                >
                                    <div className="w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                                        {theme === 'dark' ? <Icons.Moon className="w-3 h-3 text-black" /> : <Icons.Sun className="w-3 h-3 text-yellow-500" />}
                                    </div>
                                </button>
                            </div>

                             <div className="p-4 bg-bg-body rounded-xl border border-white/5 opacity-50">
                                <div className="flex items-center gap-2 text-text-muted mb-2">
                                    <Icons.Info className="w-4 h-4" />
                                    <span className="text-sm font-bold">Mais opções em breve</span>
                                </div>
                                <p className="text-xs text-text-secondary">
                                    Estamos desenvolvendo integrações com CRM e exportação automática.
                                </p>
                             </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};