import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, ChatMessage } from "../types";

// Usa a chave definida no vite.config.ts (process.env.API_KEY ou GEMINI_API_KEY)
const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("CRÍTICO: Gemini API Key não encontrada!");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "dummy_key" });

const SYSTEM_PROMPT = `
Você é o FISCAL DE VENDA. Analise a conversa do WhatsApp e gere um diagnóstico JSON.

ESTRUTURA OBRIGATÓRIA DO JSON:
{
  "resumo_executivo": {
    "score": number (0-100),
    "classificacao": "CRÍTICO" | "REGULAR" | "BOM" | "EXCELENTE",
    "veredicto": "Resumo curto e direto do problema principal.",
    "estatisticas": {
      "total_mensagens": number,
      "tempo_medio_resposta": "string (ex: 5 min)",
      "total_erros": number,
      "chance_recuperacao": "ALTA" | "MÉDIA" | "BAIXA"
    }
  },
  "timeline": {
    "fluxo_emocional": {
      "pico_interesse": { "mensagem_numero": number, "descricao": "string" },
      "inicio_queda": { "mensagem_numero": number, "descricao": "string" },
      "ponto_ruptura": { "mensagem_numero": number, "descricao": "string" }
    },
    "mensagens": [
      {
        "numero": number,
        "timestamp": "string (hora) ou null",
        "autor": "Cliente" | "Vendedor",
        "texto": "string (max 100 chars)",
        "status": "bom" | "atencao" | "erro",
        "tempo_resposta": "string ou null",
        "analise": "string (max 1 frase)"
      }
    ]
  },
  "erros": [
    {
      "numero": number,
      "tipo": "string",
      "nome": "string",
      "gravidade": "critico" | "medio" | "leve",
      "mensagem_numero": number,
      "mensagem_original": "string",
      "por_que_erro": "string",
      "correcao": { "mensagem_corrigida": "string", "por_que_funciona": "string" },
      "tecnica_aplicada": { "nome": "string", "descricao": "string" }
    }
  ],
  "tecnicas_nao_usadas": [
    { "nome": "string", "descricao": "string", "como_aplicar": "string" }
  ],
  "metricas": {
    "rapport": { "nota": number, "significado": "Rapport", "problema": "string", "como_melhorar": "string" },
    "escuta_ativa": { "nota": number, "significado": "Escuta", "problema": "string", "como_melhorar": "string" },
    "tratamento_objecoes": { "nota": number, "significado": "Objeções", "problema": "string", "como_melhorar": "string" },
    "clareza": { "nota": number, "significado": "Clareza", "problema": "string", "como_melhorar": "string" },
    "urgencia": { "nota": number, "significado": "Urgência", "problema": "string", "como_melhorar": "string" },
    "profissionalismo": { "nota": number, "significado": "Profissionalismo", "problema": "string", "como_melhorar": "string" },
    "tempo_resposta": { "nota": number, "media": "string", "ideal": "string", "pior": "string", "problema": "string", "como_melhorar": "string" }
  },
  "plano_recuperacao": {
    "chance": "ALTA" | "MÉDIA" | "BAIXA",
    "motivo_chance": "string",
    "sequencia": [
      { "numero": number, "quando_enviar": "string", "mensagem": "string", "estrategia": "string", "aguardar": "string" }
    ]
  },
  "checklist": [
    { "categoria": "string", "itens": ["string"] }
  ]
}

REGRAS:
1. Retorne APENAS o JSON.
2. Seja conciso nos textos para evitar cortar a resposta.
3. Se a conversa for curta, faça uma análise baseada no que existe.
`;

export async function analyzeConversation(conversationText: string): Promise<AnalysisResult> {
  try {
    // Revertendo para gemini-2.0-flash-exp conforme solicitado ("IA anterior")
    const modelId = 'gemini-2.0-flash-exp';
    
    const prompt = `
${SYSTEM_PROMPT}

CONVERSA PARA ANÁLISE:
${conversationText.slice(0, 30000)} 
(Texto truncado para segurança se for muito longo)

Analise e retorne APENAS o JSON válido.
`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4
      }
    });

    const jsonStr = response.text || "{}";
    // Limpeza extra para garantir JSON válido
    const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const parsedData = JSON.parse(cleanJson) as AnalysisResult;
        return parsedData;
    } catch (parseError) {
        console.error("Erro ao fazer parse do JSON:", cleanJson);
        throw new Error("A resposta da IA foi interrompida ou é inválida. Tente uma conversa menor.");
    }

  } catch (error: any) {
    console.error("Gemini Analysis Error Completo:", error);
    if (error.message?.includes('404')) {
         throw new Error("Modelo de IA não encontrado. Verifique sua chave de API ou use gemini-1.5-flash.");
    }
    throw new Error(`Falha na análise: ${error.message || "Erro desconhecido"}`);
  }
}

export async function continueChat(
    history: ChatMessage[], 
    newMessage: string, 
    contextAnalysis: AnalysisResult | null
): Promise<string> {
    try {
        const modelId = 'gemini-2.0-flash-exp';
        
        const contextString = contextAnalysis ? `
CONTEXTO DA AUDITORIA:
Score: ${contextAnalysis.resumo_executivo.score}
Veredicto: ${contextAnalysis.resumo_executivo.veredicto}
` : "";

        const chat = ai.chats.create({
            model: modelId,
            config: {
                systemInstruction: `Você é o FISCAL DE VENDA. Seja direto e ajude o usuário. ${contextString}`
            },
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.text }]
            }))
        });

        const result = await chat.sendMessage({ message: newMessage });
        return result.text || "Sem resposta.";
    } catch (error) {
        console.error("Chat Error:", error);
        throw new Error("Erro no chat.");
    }
}