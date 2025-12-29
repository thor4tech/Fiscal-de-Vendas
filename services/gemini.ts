import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, ChatMessage } from "../types";

// Usa a chave definida no vite.config.ts (process.env.API_KEY ou GEMINI_API_KEY)
const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn("Gemini API Key não encontrada! Verifique as variáveis de ambiente.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "dummy_key" });

const SYSTEM_PROMPT = `
Você é o FISCAL DE VENDA, um auditor IMPLACÁVEL e DETALHISTA de conversas de vendas.

SUA MISSÃO:
Analisar conversas de vendas e entregar um diagnóstico TÃO COMPLETO que o vendedor saia sabendo EXATAMENTE o que fazer.

VOCÊ DEVE ANALISAR:
1. CADA MENSAGEM (Timestamp, Autor, Status)
2. TEMPO DE RESPOSTA (Delays críticos)
3. FLUXO EMOCIONAL (Interesse vs Ruptura)
4. ERROS (Críticos, Médios, Leves) com correção EXATA
5. TÉCNICAS (O que faltou usar)
6. MÉTRICAS (Rapport, Escuta, Objeções, Clareza, Urgência, Profissionalismo)
7. PLANO DE RECUPERAÇÃO (Script prático)

FORMATO DE RESPOSTA (JSON):
{
  "resumo_executivo": {
    "score": number,
    "classificacao": "CRÍTICO" | "REGULAR" | "BOM" | "EXCELENTE",
    "veredicto": "string",
    "estatisticas": {
      "total_mensagens": number,
      "tempo_medio_resposta": "string",
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
        "timestamp": "string | null",
        "autor": "Cliente" | "Vendedor",
        "texto": "string",
        "status": "bom" | "atencao" | "erro",
        "tempo_resposta": "string | null",
        "analise": "string"
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
    "rapport": { "nota": number, "significado": "string", "problema": "string", "como_melhorar": "string" },
    "escuta_ativa": { "nota": number, "significado": "string", "problema": "string", "como_melhorar": "string" },
    "tratamento_objecoes": { "nota": number, "significado": "string", "problema": "string", "como_melhorar": "string" },
    "clareza": { "nota": number, "significado": "string", "problema": "string", "como_melhorar": "string" },
    "urgencia": { "nota": number, "significado": "string", "problema": "string", "como_melhorar": "string" },
    "profissionalismo": { "nota": number, "significado": "string", "problema": "string", "como_melhorar": "string" },
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
`;

export async function analyzeConversation(conversationText: string): Promise<AnalysisResult> {
  try {
    // ALTERAÇÃO CRÍTICA: Mudança para gemini-2.0-flash-exp
    // O modelo 3-pro é muito lento e causa timeout no Vercel/Frontend. 
    // O Flash é otimizado para velocidade e mantém alta capacidade de seguir JSON.
    const modelId = 'gemini-2.0-flash-exp';
    
    const prompt = `
${SYSTEM_PROMPT}

CONVERSA PARA ANÁLISE:
${conversationText}

Analise e retorne APENAS o JSON válido.
`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4 // Temperatura mais baixa para garantir JSON estruturado
      }
    });

    const jsonStr = response.text || "{}";
    const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(cleanJson) as AnalysisResult;
    return parsedData;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Falha ao processar a análise. O texto pode ser muito longo ou a API está instável. Tente novamente.");
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
Erros: ${contextAnalysis.erros.map(e => e.nome).join(', ')}
` : "";

        const chat = ai.chats.create({
            model: modelId,
            config: {
                systemInstruction: `Você é o FISCAL DE VENDA. Ajude o usuário com dúvidas sobre a auditoria. Seja direto. ${contextString}`
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