import React, { useState } from 'react';
import { Icons } from './ui/Icons';
import { User, UserProfile } from '../types';

interface SettingsProps {
  user: User;
  userProfile: UserProfile;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onBack: () => void;
  onSignOut: () => void;
  onBuyCredits: () => void; // Trigger the sales modal
}

export const Settings: React.FC<SettingsProps> = ({ user, userProfile, theme, toggleTheme, onBack, onSignOut, onBuyCredits }) => {
  const isPro = userProfile.plan === 'pro';
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [marketingNotifs, setMarketingNotifs] = useState(false);

  return (
    <div className="animate-fade-in-up space-y-8 max-w-4xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 text-text-muted hover:text-white transition-colors group">
            <Icons.ArrowRight className="w-5 h-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
        </button>
        <h1 className="text-3xl font-bold text-white">Configurações</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Sidebar Nav */}
        <div className="md:col-span-1 space-y-2">
            <button className="w-full text-left px-4 py-3 rounded-xl bg-brand-primary/10 text-brand-primary font-medium border border-brand-primary/20 flex items-center gap-3">
                <Icons.User className="w-4 h-4" /> Minha Conta
            </button>
            <button 
                onClick={() => !isPro && onBuyCredits()}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 text-text-secondary hover:text-white transition-colors flex items-center gap-3 group"
            >
                <Icons.CreditCard className="w-4 h-4 group-hover:text-brand-primary transition-colors" /> Assinatura {isPro && <span className="text-[10px] bg-brand-primary text-black px-1.5 rounded font-bold ml-auto">PRO</span>}
            </button>
            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 text-text-secondary hover:text-white transition-colors flex items-center gap-3">
                <Icons.Bell className="w-4 h-4" /> Notificações
            </button>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
            
            {/* Profile Card */}
            <div className="glass-card p-6 rounded-2xl">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Icons.Sparkles className="w-4 h-4 text-brand-primary" /> Perfil
                </h2>
                
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full border-2 border-white/10 overflow-hidden relative group">
                        {user.photoURL ? (
                             <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                         ) : (
                             <div className="w-full h-full bg-brand-primary text-black flex items-center justify-center font-bold text-2xl">
                                 {user.displayName?.[0] || 'U'}
                             </div>
                         )}
                         <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                             <Icons.Upload className="w-6 h-6 text-white" />
                         </div>
                    </div>
                    
                    <div className="flex-1">
                        <label className="block text-xs text-text-muted uppercase mb-1">Nome de Exibição</label>
                        <input 
                            type="text" 
                            value={user.displayName || ''} 
                            disabled 
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white opacity-70 cursor-not-allowed"
                        />
                        <p className="text-xs text-text-muted mt-2">Gerenciado pelo provedor de login.</p>
                    </div>
                </div>
                
                <div className="mt-6">
                     <label className="block text-xs text-text-muted uppercase mb-1">Email</label>
                     <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                         <span className="text-white flex-1">{user.email}</span>
                         <Icons.CheckCircle className="w-4 h-4 text-brand-primary" />
                     </div>
                </div>
            </div>

            {/* Plan & Credits */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                    <Icons.CreditCard className="w-4 h-4 text-brand-primary" /> Plano e Créditos
                </h2>

                <div className={`flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-xl border relative z-10 ${isPro ? 'bg-brand-primary/10 border-brand-primary/30' : 'bg-black/20 border-white/5'}`}>
                    <div>
                        <p className="text-text-muted text-xs uppercase font-bold mb-1">Plano Atual</p>
                        <h3 className="text-xl font-bold text-white capitalize flex items-center gap-2">
                            {isPro ? (
                                <>Vendedor Pro <Icons.Zap className="w-4 h-4 text-yellow-400 fill-current" /></>
                            ) : (
                                'Básico Grátis'
                            )}
                        </h3>
                        {isPro && <p className="text-xs text-brand-primary mt-1">Sua assinatura está ativa.</p>}
                    </div>
                    {!isPro && (
                        <button onClick={onBuyCredits} className="px-6 py-2.5 bg-brand-primary text-black font-bold rounded-lg text-sm hover:bg-brand-hover transition-colors shadow-glow-sm active:scale-95">
                            Fazer Upgrade ⚡
                        </button>
                    )}
                </div>

                <div className="mt-4 flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                            <Icons.Zap className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-white font-bold">{userProfile.credits > 9000 ? 'Ilimitado' : `${userProfile.credits} Créditos Restantes`}</p>
                            <p className="text-xs text-text-muted">Use para auditorias ou chat IA.</p>
                        </div>
                    </div>
                    {/* Only show buy button if not pro or logic dictates */}
                    <button onClick={onBuyCredits} className="p-2 hover:bg-white/10 rounded-lg text-brand-primary transition-colors active:scale-95">
                        <Icons.Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* App Preferences */}
            <div className="glass-card p-6 rounded-2xl">
                 <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Icons.Settings className="w-4 h-4 text-brand-primary" /> Preferências
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">Tema Escuro</p>
                            <p className="text-xs text-text-muted">Alternar entre modo claro e escuro</p>
                        </div>
                        <button 
                            onClick={toggleTheme}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${theme === 'dark' ? 'bg-brand-primary justify-end' : 'bg-white/10 justify-start'}`}
                        >
                            <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                        </button>
                    </div>

                     <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">Resumo Semanal</p>
                            <p className="text-xs text-text-muted">Receber relatórios de performance por email</p>
                        </div>
                        <button 
                            onClick={() => setEmailNotifs(!emailNotifs)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${emailNotifs ? 'bg-brand-primary justify-end' : 'bg-white/10 justify-start'}`}
                        >
                             <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium">Alertas de Crédito</p>
                            <p className="text-xs text-text-muted">Avisar quando créditos estiverem baixos</p>
                        </div>
                        <button 
                            onClick={() => setMarketingNotifs(!marketingNotifs)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${marketingNotifs ? 'bg-brand-primary justify-end' : 'bg-white/10 justify-start'}`}
                        >
                             <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Danger Zone */}
            <div className="border border-red-500/20 rounded-2xl p-6 bg-red-500/5">
                <h2 className="text-red-500 font-bold mb-2">Zona de Perigo</h2>
                <div className="flex items-center justify-between">
                    <p className="text-text-muted text-sm">Sair da sua conta atual</p>
                    <button onClick={onSignOut} className="px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors active:scale-95">
                        Sair da Conta
                    </button>
                </div>
            </div>

        </div>

      </div>
    </div>
  );
};