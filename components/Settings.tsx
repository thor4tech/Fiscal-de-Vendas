import React, { useState } from 'react';
import { Icons } from './ui/Icons';
import { User, UserProfile } from '../types';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';

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

export const Settings: React.FC<SettingsProps> = ({ user, userProfile, theme, toggleTheme, onBack, onSignOut, onBuyCredits }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const isPro = userProfile.plan === 'pro';

  // Profile Edit State
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
        await updateProfile(auth.currentUser, {
            displayName: displayName,
            photoURL: photoURL
        });
        setSaveMessage("Perfil atualizado com sucesso! (Recarregue para ver a foto)");
        // Force reload usually needed to see Auth changes immediately across app if not using a listener that updates deeply
    } catch (error) {
        console.error(error);
        setSaveMessage("Erro ao atualizar perfil.");
    } finally {
        setIsSaving(false);
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
                                <div className="w-24 h-24 rounded-full border-2 border-white/10 overflow-hidden relative">
                                    {photoURL ? (
                                        <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-brand-primary text-black flex items-center justify-center font-bold text-3xl">
                                            {displayName?.[0] || 'U'}
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-text-muted text-center max-w-[150px]">
                                    Para mudar a foto, cole uma URL de imagem pública abaixo.
                                </div>
                            </div>
                            
                            <div className="flex-1 space-y-4">
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
                                    <label className="block text-xs text-text-muted uppercase font-bold mb-2">URL da Foto de Perfil</label>
                                    <input 
                                        type="text" 
                                        value={photoURL} 
                                        onChange={(e) => setPhotoURL(e.target.value)}
                                        className="w-full bg-bg-body border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-brand-primary transition-colors"
                                        placeholder="https://exemplo.com/sua-foto.jpg"
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
                                    <p className={`text-sm ${saveMessage.includes('sucesso') ? 'text-green-400' : 'text-red-400'}`}>
                                        {saveMessage}
                                    </p>
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
                <div className="space-y-6 animate-fade-in">
                    
                    {/* Current Status */}
                    <div className="glass-card p-8 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        
                        <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2 relative z-10">
                            <Icons.CreditCard className="w-5 h-5 text-brand-primary" /> Seu Plano Atual
                        </h2>

                        <div className="grid md:grid-cols-2 gap-6 relative z-10">
                            <div className={`p-6 rounded-2xl border ${isPro ? 'bg-brand-primary/10 border-brand-primary/30' : 'bg-bg-body border-white/10'}`}>
                                <p className="text-text-muted text-xs uppercase font-bold mb-2">Status</p>
                                <h3 className="text-2xl font-bold text-text-primary capitalize flex items-center gap-2 mb-1">
                                    {isPro ? (
                                        <>Vendedor Pro <Icons.Zap className="w-5 h-5 text-yellow-400 fill-current" /></>
                                    ) : (
                                        'Plano Grátis'
                                    )}
                                </h3>
                                <p className="text-sm text-text-secondary">
                                    {isPro ? 'Assinatura ativa e renovável.' : 'Funcionalidades limitadas.'}
                                </p>
                            </div>

                            <div className="p-6 rounded-2xl border border-white/10 bg-bg-body">
                                <p className="text-text-muted text-xs uppercase font-bold mb-2">Saldo de Créditos</p>
                                <div className="flex items-baseline gap-2 mb-1">
                                    <h3 className="text-3xl font-bold text-brand-primary">{userProfile.credits > 9000 ? '∞' : userProfile.credits}</h3>
                                    <span className="text-sm text-text-muted">disponíveis</span>
                                </div>
                                <p className="text-xs text-text-secondary">Use para novas auditorias.</p>
                            </div>
                        </div>
                    </div>

                    {/* Store Section */}
                    <div className="mt-8">
                        <h3 className="text-lg font-bold text-text-primary mb-6">Comprar Créditos ou Upgrade</h3>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Pro Plan Card */}
                            <div 
                                onClick={() => onBuyCredits(999)}
                                className={`group relative border rounded-2xl p-6 cursor-pointer transition-all ${isPro ? 'border-brand-primary/50 bg-brand-primary/5 opacity-50 cursor-default' : 'border-brand-primary bg-gradient-to-br from-brand-primary/10 to-transparent hover:shadow-glow-md hover:-translate-y-1'}`}
                            >
                                {!isPro && (
                                    <div className="absolute -top-3 left-6 bg-brand-primary text-black text-[10px] uppercase font-extrabold px-3 py-1 rounded-full shadow-lg">
                                        Recomendado
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-bold text-white text-lg flex items-center gap-2">Vendedor Pro <Icons.Zap className="w-4 h-4 text-yellow-400 fill-current" /></h4>
                                        <p className="text-text-muted text-sm mt-1">Tudo ilimitado</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-white">R$ 97,90</div>
                                        <div className="text-xs text-text-muted">/mês</div>
                                    </div>
                                </div>
                                <ul className="space-y-3 mb-6">
                                     <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-brand-primary" /> Auditorias Ilimitadas</li>
                                     <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-brand-primary" /> Relatórios de Evolução</li>
                                </ul>
                                <button disabled={isPro} className="w-full py-3 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-hover transition-colors shadow-lg">
                                    {isPro ? 'Plano Ativo' : 'Assinar Agora'}
                                </button>
                            </div>

                            {/* Credit Pack */}
                            <div 
                                onClick={() => onBuyCredits(10)}
                                className="border border-white/10 bg-bg-elevated rounded-2xl p-6 hover:border-white/30 transition-all cursor-pointer hover:-translate-y-1"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-bold text-white text-lg">Pack Avulso</h4>
                                        <p className="text-text-muted text-sm mt-1">10 Créditos</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-white">R$ 29,90</div>
                                        <div className="text-xs text-text-muted">Pagamento único</div>
                                    </div>
                                </div>
                                <ul className="space-y-3 mb-6">
                                     <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> Sem validade</li>
                                     <li className="flex items-center gap-3 text-sm text-text-secondary"><Icons.Check className="w-4 h-4 text-white" /> Acesso total aos recursos</li>
                                </ul>
                                <button className="w-full py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white hover:text-black transition-colors">
                                    Comprar Pacote
                                </button>
                            </div>
                        </div>
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

                             {/* Removed Notification Options as requested */}
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