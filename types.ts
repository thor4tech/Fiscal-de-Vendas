export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface UserProfile {
  uid: string;
  credits: number;
  plan: 'free' | 'pro' | 'enterprise';
  subscriptionStatus: 'active' | 'inactive';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  suggestions?: string[]; // Opções rápidas para o usuário responder
}

// Updated Comprehensive Analysis Result
export interface AnalysisResult {
  resumo_executivo: {
    score: number;
    classificacao: "CRÍTICO" | "REGULAR" | "BOM" | "EXCELENTE";
    veredicto: string;
    tom_de_voz_cliente: string; 
    tom_de_voz_vendedor: string;
    estatisticas: {
      total_mensagens: number;
      tempo_medio_resposta: string;
      total_erros: number;
      chance_recuperacao: "ALTA" | "MÉDIA" | "BAIXA";
    };
  };
  
  analise_estrategica: { 
    metodologia_identificada: string; 
    metodologia_sugerida: string; 
    gatilhos_mentais_usados: string[];
    gatilhos_mentais_negligenciados: string[];
    principais_barieriras: string[];
  };

  auditoria_followup: { 
    status: "EXCESSIVO" | "ADEQUADO" | "INEXISTENTE" | "LENTO";
    analise: string;
    oportunidades_perdidas_de_retomada: number;
  };

  timeline: {
    fluxo_emocional: {
      pico_interesse: { mensagem_numero: number; descricao: string };
      inicio_queda: { mensagem_numero: number; descricao: string };
      ponto_ruptura: { mensagem_numero: number; descricao: string };
    };
    mensagens: Array<{
      numero: number;
      timestamp: string | null;
      autor: "Cliente" | "Vendedor";
      texto: string;
      status: "bom" | "atencao" | "erro";
      tempo_resposta: string | null;
      analise: string;
    }>;
  };
  
  erros: Array<{
    numero: number;
    tipo: string;
    nome: string;
    gravidade: "critico" | "medio" | "leve";
    mensagem_numero: number;
    mensagem_original: string;
    por_que_erro: string; 
    impacto_na_venda: string; 
    correcao: {
      mensagem_corrigida: string;
      por_que_funciona: string;
    };
  }>;
  
  metricas: {
    rapport: MetricDetail;
    escuta_ativa: MetricDetail;
    tratamento_objecoes: MetricDetail;
    clareza: MetricDetail;
    urgencia: MetricDetail;
    profissionalismo: MetricDetail;
    autoridade: MetricDetail; 
  };
  
  plano_de_acao: { 
    imediato: {
      acao: string;
      script: string;
      motivo: string;
    };
    longo_prazo: Array<{
      habito: string;
      como_implementar: string;
    }>;
  };
}

export interface MetricDetail {
  nota: number;
  significado: string;
  problema: string;
  como_melhorar: string;
}

export interface AuditRecord {
  id: string;
  fileName: string;
  fileType: string;
  timestamp: number;
  result: AnalysisResult;
  score: number;
}