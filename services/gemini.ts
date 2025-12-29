import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    "rapport": { "nota": number, "significado": "Definição curta do conceito", "problema": "O que foi feito errado", "como_melhorar": "Dica prática" },
    "escuta_ativa": { "nota": number, "significado": "Definição curta do conceito", "problema": "O que foi feito errado", "como_melhorar": "Dica prática" },
    "tratamento_objecoes": { "nota": number, "significado": "Definição curta do conceito", "problema": "O que foi feito errado", "como_melhorar": "Dica prática" },
    "clareza": { "nota": number, "significado": "Definição curta do conceito", "problema": "O que foi feito errado", "como_melhorar": "Dica prática" },
    "urgencia": { "nota": number, "significado": "Definição curta do conceito", "problema": "O que foi feito errado", "como_melhorar": "Dica prática" },
    "profissionalismo": { "nota": number, "significado": "Definição curta do conceito", "problema": "O que foi feito errado", "como_melhorar": "Dica prática" },
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
    const modelId = 'gemini-3-flash-preview';
    
    // Aumentado para 500.000 caracteres. Gemini 1.5/3 Flash suporta janelas enormes (1M tokens).
    // 30.000 era muito pouco para conversas inteiras de WhatsApp em ZIP.
    const truncatedText = conversationText.slice(0, 500000);

    const prompt = `
${SYSTEM_PROMPT}

CONVERSA PARA ANÁLISE:
${truncatedText} 

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
    const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const parsedData = JSON.parse(cleanJson) as AnalysisResult;
        return parsedData;
    } catch (parseError) {
        console.error("Erro ao fazer parse do JSON:", cleanJson);
        throw new Error("A IA processou o arquivo, mas gerou uma resposta inválida. Isso acontece com arquivos muito grandes ou complexos. Tente dividir o arquivo.");
    }

  } catch (error: any) {
    console.error("Gemini Analysis Error Completo:", error);
    
    let userMessage = "Erro desconhecido na análise.";
    
    if (error.message?.includes('404')) {
         userMessage = "Modelo de IA não encontrado ou API Key inválida. Verifique suas configurações.";
    } else if (error.message?.includes('429')) {
         userMessage = "Muitas requisições ao mesmo tempo. A IA está sobrecarregada. Aguarde 1 minuto e tente novamente.";
    } else if (error.message?.includes('500') || error.message?.includes('overloaded')) {
         userMessage = "O servidor da IA instável no momento. Tente novamente em instantes.";
    } else {
        userMessage = error.message;
    }

    throw new Error(userMessage);
  }
}

export async function continueChat(
    history: ChatMessage[], 
    newMessage: string, 
    contextAnalysis: AnalysisResult | null
): Promise<string> {
    try {
        const modelId = 'gemini-3-flash-preview';
        
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