import React, { useState } from 'react';
import { Icons } from './ui/Icons';
import { auth } from '../services/firebase';
import { createCheckoutSession } from '../services/firestore';

interface PricingModalProps {
  onClose: () => void;
  onBuy: (amount: number) => void; // Mantido para compatibilidade, mas não usado nos planos novos
  isProcessing: boolean;
  currentCredits: number;
}

// IDs dos produtos no Stripe
const PRICE_STARTER = "price_1SjnY38sPBgjqi0CfiIPc0hK";
const PRICE_PRO = "price_1SjnXY8sPBgjqi0CWl78VfDb";

export const PricingModal: React.FC<PricingModalProps> = ({ onClose, isProcessing, currentCredits }) => {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSubscribe = async (priceId: string) => {
    if (!auth.currentUser) return;
    
    setIsRedirecting(true);
    try {
      const url = await createCheckoutSession(auth.currentUser.uid, priceId);
      window.location.assign(url);
    } catch (error) {
      console.error("Erro ao criar sessão de checkout:", error);
      setIsRedirecting(false);
      alert("Ocorreu um erro ao iniciar o pagamento. Tente novamente.");
    }
  };

  const isLoading = isProcessing || isRedirecting;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-5xl bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up flex flex-col md:flex-row h-auto max-h-[95vh]">
        
        <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white/50 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10">
            <Icons.X className="w-5 h-5" />
        </button>

        {/* Left Side: Value Proposition */}
        <div className="bg-[#111] p-8 md:p-12 md:w-5/12 border-b md:border-b-0 md:border-r border-white/10 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern opacity-10 pointer-events-none"></div>
            
            <div className="relative z-10 flex-1">
                <div className="inline-flex items-center gap-2 text-brand-primary font-bold mb-8 px-3 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 w-fit">
                    <Icons.Sparkles className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase tracking-widest font-extrabold">MEMBRO PREMIUM</span>
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                    Invista em suas <br/>
                    <span className="text-gradient">vendas hoje.</span>
                </h2>
                <p className="text-text-secondary text-sm leading-relaxed mb-10">
                  Cada venda recuperada paga este investimento 10x. 
                  Nossos usuários aumentam a conversão em média <strong className="text-white bg-white/10 px-1 rounded">28%</strong> já no primeiro mês.
                </p>
                
                <div className="space-y-6 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary shrink-0">
                            <Icons.Target className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-sm">Precisão Cirúrgica</h4>
                            <p className="text-xs text-text-muted mt-1">Nossa IA identifica nuances que humanos perdem.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                         <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
                            <Icons.MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-sm">Scripts Prontos</h4>
                            <p className="text-xs text-text-muted mt-1">Copie e cole a resposta perfeita para fechar.</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-bg-glass border border-white/10 rounded-xl p-5 relative z-10 backdrop-blur-md">
                <p className="text-[10px] text-text-muted uppercase font-bold mb-2 tracking-wider">SEU SALDO ATUAL</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">{currentCredits > 9000 ? '∞' : currentCredits}</span>
                    <span className="text-sm text-text-muted">créditos</span>
                </div>
            </div>
        </div>

        {/* Right Side: Plans */}
        <div className="p-8 md:p-12 md:w-7/12 bg-bg-body overflow-y-auto">
            <h3 className="text-2xl font-bold text-white mb-8">Escolha seu plano</h3>
            
            <div className="space-y-6">
                
                {/* Vendedor Pro (Highlighted) */}
                <div className="group relative border border-brand-primary rounded-2xl p-1 bg-gradient-to-br from-brand-primary/20 to-transparent cursor-pointer shadow-glow-sm hover:shadow-glow-md transition-all transform hover:-translate-y-1" onClick={() => handleSubscribe(PRICE_PRO)}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-black text-[10px] uppercase font-extrabold px-3 py-1 rounded-full shadow-lg tracking-wide z-20">
                        RECOMENDADO
                    </div>
                    <div className="bg-[#151515] rounded-xl p-6 h-full relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-white text-lg flex items-center gap-2">Vendedor Pro <Icons.Zap className="w-4 h-4 text-yellow-400 fill-current" /></h4>
                                <p className="text-text-muted text-xs mt-1">Para quem quer dominar o mercado</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-bold text-white">R$ 97,90</div>
                                <div className="text-xs text-text-muted">/mês</div>
                            </div>
                        </div>
                        <ul className="space-y-2 mb-6">
                             <li className="flex items-center gap-2 text-xs text-white"><Icons.Check className="w-3 h-3 text-brand-primary" /> Empresas ilimitadas</li>
                             <li className="flex items-center gap-2 text-xs text-white"><Icons.Check className="w-3 h-3 text-brand-primary" /> Dashboard avançado com IA</li>
                             <li className="flex items-center gap-2 text-xs text-white"><Icons.Check className="w-3 h-3 text-brand-primary" /> Automações premium</li>
                             <li className="flex items-center gap-2 text-xs text-white"><Icons.Check className="w-3 h-3 text-brand-primary" /> Suporte prioritário</li>
                             <li className="flex items-center gap-2 text-xs text-white"><Icons.Check className="w-3 h-3 text-brand-primary" /> Análise preditiva</li>
                        </ul>
                        <button disabled={isLoading} className="w-full py-3 rounded-lg bg-brand-primary text-black font-bold text-sm hover:bg-brand-hover transition-colors shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-wait">
                            {isLoading ? 'Redirecionando para Stripe...' : 'Assinar PRO'}
                        </button>
                    </div>
                </div>

                {/* Plano Starter */}
                <div className="group relative border border-white/10 rounded-2xl p-6 hover:border-white/30 transition-all bg-white/[0.02] cursor-pointer hover:bg-white/[0.04]" onClick={() => handleSubscribe(PRICE_STARTER)}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="font-bold text-white text-lg">Plano Starter</h4>
                            <p className="text-text-muted text-xs mt-1">Para quem está começando</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-white">R$ 29,90</div>
                            <div className="text-xs text-text-muted">/mês</div>
                        </div>
                    </div>
                     <ul className="space-y-2 mb-6">
                         <li className="flex items-center gap-2 text-xs text-text-secondary"><Icons.Check className="w-3 h-3 text-white" /> Até 3 empresas</li>
                         <li className="flex items-center gap-2 text-xs text-text-secondary"><Icons.Check className="w-3 h-3 text-white" /> Dashboard básico</li>
                         <li className="flex items-center gap-2 text-xs text-text-secondary"><Icons.Check className="w-3 h-3 text-white" /> Relatórios simples</li>
                         <li className="flex items-center gap-2 text-xs text-text-secondary"><Icons.Check className="w-3 h-3 text-white" /> Suporte por email</li>
                    </ul>
                    <button disabled={isLoading} className="w-full py-3 rounded-lg border border-white/20 text-white font-semibold text-sm hover:bg-white hover:text-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait">
                        {isLoading ? 'Processando...' : 'Assinar Starter'}
                    </button>
                </div>

            </div>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-xs text-text-muted flex items-center justify-center gap-2 opacity-60">
                    <Icons.ShieldCheck className="w-3 h-3" /> 
                    Pagamento 100% seguro via Stripe • Cancele a qualquer momento
                </p>
            </div>
        </div>

      </div>
    </div>
  );
};