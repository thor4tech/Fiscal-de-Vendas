import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Icons } from './ui/Icons';
import { getUserAudits } from '../services/firestore';
import { AuditRecord } from '../types';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface HistoryProps {
  userId: string;
  onSelectAudit: (audit: AuditRecord) => void;
  onBack: () => void;
}

export const History: React.FC<HistoryProps> = ({ userId, onSelectAudit, onBack }) => {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterScore, setFilterScore] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  // Pagination State
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  const observer = useRef<IntersectionObserver | null>(null);

  // Initial Fetch
  useEffect(() => {
    const initFetch = async () => {
        setLoading(true);
        const { audits: initialAudits, lastVisible } = await getUserAudits(userId, null, 15);
        setAudits(initialAudits);
        setLastDoc(lastVisible);
        setHasMore(initialAudits.length === 15);
        setLoading(false);
    };
    initFetch();
  }, [userId]);

  // Fetch More
  const loadMore = async () => {
      if (isFetchingMore || !hasMore || !lastDoc) return;
      
      setIsFetchingMore(true);
      const { audits: newAudits, lastVisible } = await getUserAudits(userId, lastDoc, 10);
      
      if (newAudits.length > 0) {
          setAudits(prev => [...prev, ...newAudits]);
          setLastDoc(lastVisible);
          if (newAudits.length < 10) setHasMore(false);
      } else {
          setHasMore(false);
      }
      setIsFetchingMore(false);
  };

  // Infinite Scroll Observer
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loading || isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasMore) {
            loadMore();
        }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, isFetchingMore, hasMore, lastDoc]);


  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-brand-primary border-brand-primary/20 bg-brand-primary/10';
    if (score >= 50) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
    return 'text-red-500 border-red-500/20 bg-red-500/10';
  };

  // Client-side filtering/sorting acts on the *loaded* data
  // For a true app with search over millions of records, you'd need Algolia or server-side search.
  const filteredAudits = audits
    .filter(audit => {
      const matchesSearch = (audit.fileName || "Sem nome").toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesFilter = true;
      if (filterScore === 'high') matchesFilter = audit.score >= 80;
      if (filterScore === 'medium') matchesFilter = audit.score >= 50 && audit.score < 80;
      if (filterScore === 'low') matchesFilter = audit.score < 50;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return b.timestamp - a.timestamp;
      return a.timestamp - b.timestamp;
    });

  if (loading && audits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-primary mb-4"></div>
        <p className="text-text-muted">Carregando histórico...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <button onClick={onBack} className="flex items-center gap-2 text-text-muted hover:text-white transition-colors mb-2 text-sm group">
             <Icons.ArrowRight className="rotate-180 h-3 w-3 group-hover:-translate-x-1 transition-transform" /> Voltar ao Dashboard
           </button>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <Icons.History className="w-6 h-6 text-brand-primary" /> Histórico de Auditorias
           </h2>
        </div>
        
        <div className="flex flex-wrap gap-2 text-white">
            <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Buscar arquivo..." 
                  className="pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-brand-primary/50 text-white placeholder:text-text-muted"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="relative group">
                <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <Icons.Filter className="h-5 w-5 text-text-muted" />
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-[#111] border border-white/10 rounded-lg shadow-xl p-2 z-20 hidden group-hover:block">
                    <div className="text-xs font-bold text-text-muted px-2 py-1 uppercase">Nota</div>
                    <button onClick={() => setFilterScore('all')} className={`w-full text-left px-2 py-1.5 rounded text-sm ${filterScore === 'all' ? 'bg-brand-primary/20 text-brand-primary' : 'text-white hover:bg-white/5'}`}>Todas</button>
                    <button onClick={() => setFilterScore('high')} className={`w-full text-left px-2 py-1.5 rounded text-sm ${filterScore === 'high' ? 'bg-brand-primary/20 text-brand-primary' : 'text-white hover:bg-white/5'}`}>Alta (80+)</button>
                    <button onClick={() => setFilterScore('medium')} className={`w-full text-left px-2 py-1.5 rounded text-sm ${filterScore === 'medium' ? 'bg-brand-primary/20 text-brand-primary' : 'text-white hover:bg-white/5'}`}>Média (50-79)</button>
                    <button onClick={() => setFilterScore('low')} className={`w-full text-left px-2 py-1.5 rounded text-sm ${filterScore === 'low' ? 'bg-brand-primary/20 text-brand-primary' : 'text-white hover:bg-white/5'}`}>Baixa (&lt;50)</button>
                </div>
            </div>

            <button 
                onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                title="Ordenar por data"
            >
                {sortOrder === 'newest' ? <Icons.Clock className="h-5 w-5 text-text-muted" /> : <Icons.ArrowUp className="h-5 w-5 text-text-muted" />}
            </button>
        </div>
      </div>

      {filteredAudits.length === 0 ? (
        <div className="text-center py-16 bg-white/5 rounded-2xl border-dashed border-2 border-white/10">
            <Icons.History className="h-12 w-12 text-text-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white">Nenhuma auditoria encontrada</h3>
            <p className="text-text-muted">Tente ajustar os filtros ou faça um novo upload.</p>
        </div>
      ) : (
        <div className="grid gap-4">
            {filteredAudits.map((audit, index) => {
                const isLastElement = index === filteredAudits.length - 1;
                // Safely access nested properties
                const resultExec = audit.result?.resumo_executivo;
                const score = resultExec?.score || audit.score || 0;
                const classification = resultExec?.classificacao || 'Processado';

                return (
                    <div 
                        key={audit.id}
                        ref={isLastElement ? lastElementRef : null}
                        onClick={() => onSelectAudit(audit)}
                        className="glass-card p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:border-brand-primary/50 hover:bg-white/5 transition-all group animate-fade-in"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border font-bold text-lg ${getScoreColor(score)}`}>
                                {score}
                            </div>
                            <div>
                                <h4 className="font-bold text-white group-hover:text-brand-primary transition-colors">{audit.fileName || "Conversa WhatsApp"}</h4>
                                <p className="text-xs text-text-muted flex items-center gap-2">
                                    {new Date(audit.timestamp).toLocaleDateString('pt-BR')} às {new Date(audit.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    <span className="w-1 h-1 rounded-full bg-text-muted"></span>
                                    {audit.fileType}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                            <div className="flex flex-col items-end hidden md:flex">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${
                                    classification === 'CRÍTICO' ? 'bg-red-500/20 text-red-500' :
                                    classification === 'EXCELENTE' ? 'bg-brand-primary/20 text-brand-primary' :
                                    'bg-yellow-500/20 text-yellow-500'
                                }`}>
                                    {classification}
                                </span>
                            </div>
                            <Icons.ArrowRight className="h-5 w-5 text-text-muted group-hover:text-white group-hover:translate-x-1 transition-all" />
                        </div>
                    </div>
                )
            })}
            
            {isFetchingMore && (
                 <div className="flex justify-center py-4">
                     <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-brand-primary"></div>
                 </div>
            )}
            
            {!hasMore && filteredAudits.length > 5 && (
                <p className="text-center text-xs text-text-muted mt-4 pb-8">Você chegou ao fim do histórico.</p>
            )}
        </div>
      )}
    </div>
  );
};