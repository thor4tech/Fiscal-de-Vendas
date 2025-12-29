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
}

// Updated Comprehensive Analysis Result
export interface AnalysisResult {
  resumo_executivo: {
    score: number;
    classificacao: "CRÍTICO" | "REGULAR" | "BOM" | "EXCELENTE";
    veredicto: string;
    estatisticas: {
      total_mensagens: number;
      tempo_medio_resposta: string;
      total_erros: number;
      chance_recuperacao: "ALTA" | "MÉDIA" | "BAIXA";
    };
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
    correcao: {
      mensagem_corrigida: string;
      por_que_funciona: string;
    };
    tecnica_aplicada: {
      nome: string;
      descricao: string;
    };
  }>;
  
  tecnicas_nao_usadas: Array<{
    nome: string;
    descricao: string;
    como_aplicar: string;
  }>;
  
  metricas: {
    rapport: MetricDetail;
    escuta_ativa: MetricDetail;
    tratamento_objecoes: MetricDetail;
    clareza: MetricDetail;
    urgencia: MetricDetail;
    profissionalismo: MetricDetail;
    tempo_resposta: {
      nota: number;
      media: string;
      ideal: string;
      pior: string;
      problema: string;
      como_melhorar: string;
    };
  };
  
  plano_recuperacao: {
    chance: "ALTA" | "MÉDIA" | "BAIXA";
    motivo_chance: string;
    sequencia: Array<{
      numero: number;
      quando_enviar: string;
      mensagem: string;
      estrategia: string;
      aguardar: string;
    }>;
  };
  
  checklist: Array<{
    categoria: string;
    itens: string[];
  }>;
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