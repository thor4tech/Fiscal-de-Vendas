import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_PROMPT = `
ATUE COMO: VP de Vendas Sênior e Especialista em Neurovendas.
SUA MISSÃO: Realizar uma auditoria implacável, detalhada e estratégica de uma conversa de vendas (WhatsApp/Email).
OBJETIVO: Não apenas apontar erros, mas fornecer um diagnóstico completo de metodologia, psicologia e um plano de ação tático.

OBSERVAÇÃO IMPORTANTE SOBRE MÍDIA:
O texto fornecido pode conter transcrições automáticas de ÁUDIOS e descrições de IMAGENS no formato:
"[ARQUIVO TRANSCRITO: nome_do_arquivo] Conteúdo: ..."
Considere esses conteúdos como parte integrante e fluida da conversa. Se o vendedor mandou um áudio, analise o texto transcrito desse áudio como se fosse a fala dele.

SAÍDA: JSON ESTRITO seguindo a interface abaixo.

--- ESTRUTURA DO JSON ---
{
  "resumo_executivo": {
    "score": number (0-100),
    "classificacao": "CRÍTICO" | "REGULAR" | "BOM" | "EXCELENTE",
    "veredicto": "Resumo executivo de 3-4 linhas. Seja direto. Ex: 'O vendedor tem boa técnica, mas falhou no fechamento por ansiedade.'",
    "tom_de_voz_cliente": "ex: Cético, Interessado, Apressado, Confuso",
    "tom_de_voz_vendedor": "ex: Ansioso, Consultivo, Robótico, Agressivo",
    "estatisticas": {
      "total_mensagens": number,
      "tempo_medio_resposta": "string (estimado)",
      "total_erros": number,
      "chance_recuperacao": "ALTA" | "MÉDIA" | "BAIXA"
    }
  },
  "analise_estrategica": {
    "metodologia_identificada": "Qual técnica o vendedor tentou? (ex: Nenhuma, Venda Consultiva, Hard Sell, Rapport Excessivo)",
    "metodologia_sugerida": "Qual metodologia salvaria essa venda? (ex: SPIN Selling, Challenger Sale, Sandler)",
    "gatilhos_mentais_usados": ["Lista de gatilhos que o vendedor tentou usar"],
    "gatilhos_mentais_negligenciados": ["Lista de gatilhos que deveriam ter sido usados (ex: Escassez, Prova Social)"],
    "principais_barieriras": ["O que impediu a venda? (ex: Preço, Confiança, Timing, Decisor)"]
  },
  "auditoria_followup": {
    "status": "EXCESSIVO" | "ADEQUADO" | "INEXISTENTE" | "LENTO",
    "analise": "Análise crítica do tempo de resposta e cadência. O vendedor desistiu cedo demais? Foi chato? Demorou e esfriou o lead?",
    "oportunidades_perdidas_de_retomada": number
  },
  "timeline": {
    "fluxo_emocional": {
      "pico_interesse": { "mensagem_numero": number, "descricao": "Momento de maior engajamento do cliente" },
      "inicio_queda": { "mensagem_numero": number, "descricao": "Onde a conversa começou a desandar" },
      "ponto_ruptura": { "mensagem_numero": number, "descricao": "O momento exato da perda (ghosting ou negativa)" }
    },
    "mensagens": [
      {
        "numero": number,
        "timestamp": "Hora aproximada ou sequencia",
        "autor": "Cliente" | "Vendedor",
        "texto": "Texto (truncado se longo)",
        "status": "bom" | "atencao" | "erro",
        "tempo_resposta": "Estimativa se disponível ou null",
        "analise": "Comentário micro sobre esta mensagem específica"
      }
    ]
  },
  "erros": [
    {
      "numero": number,
      "tipo": "Código do erro (ex: PRECO_PREMATURO, MONOLOGO)",
      "nome": "Nome amigável do erro",
      "gravidade": "critico" | "medio" | "leve",
      "mensagem_numero": number,
      "mensagem_original": "Texto exato do erro",
      "por_que_erro": "Explicação profunda baseada em psicologia de vendas. Por que isso afasta o cliente?",
      "impacto_na_venda": "Consequência prática (ex: Cliente parou de ver valor, Cliente se sentiu pressionado)",
      "correcao": { 
        "mensagem_corrigida": "Script exato do que deveria ter sido dito", 
        "por_que_funciona": "A lógica por trás da correção" 
      }
    }
  ],
  "metricas": {
    "rapport": { "nota": number, "significado": "Conexão e Empatia", "problema": "Onde falhou", "como_melhorar": "Dica prática" },
    "escuta_ativa": { "nota": number, "significado": "Entendimento da Dor", "problema": "Onde falhou", "como_melhorar": "Dica prática" },
    "tratamento_objecoes": { "nota": number, "significado": "Contorno de Barreiras", "problema": "Onde falhou", "como_melhorar": "Dica prática" },
    "clareza": { "nota": number, "significado": "Comunicação Clara", "problema": "Onde falhou", "como_melhorar": "Dica prática" },
    "urgencia": { "nota": number, "significado": "Criação de Motivo para Agir", "problema": "Onde falhou", "como_melhorar": "Dica prática" },
    "profissionalismo": { "nota": number, "significado": "Postura e Linguagem", "problema": "Onde falhou", "como_melhorar": "Dica prática" },
    "autoridade": { "nota": number, "significado": "Domínio e Confiança", "problema": "Onde falhou", "como_melhorar": "Dica prática" }
  },
  "plano_de_acao": {
    "imediato": {
      "acao": "A única ação para tentar salvar ESTA venda agora. Se a venda já foi perdida, dê um script de reativação.",
      "script": "Script exato para enviar agora (se houver chance) ou para reativar.",
      "motivo": "Por que essa abordagem funciona?"
    },
    "rotina_followup": [
      { "dia": "Dia 1 (Amanhã)", "acao": "Objetivo do toque (ex: Gerar valor, Lembrar sem cobrar)", "script": "Script exato para WhatsApp" },
      { "dia": "Dia 3 (Daqui a 72h)", "acao": "Objetivo do toque (ex: Prova social, Case de sucesso)", "script": "Script exato para WhatsApp" },
      { "dia": "Dia 7 (Ultima tentativa)", "acao": "Objetivo do toque (ex: Break-up message, Retirada da oferta)", "script": "Script exato para WhatsApp" }
    ],
    "longo_prazo": [
      { "habito": "Hábito estratégico (ex: Definir próximo passo)", "como_implementar": "Exercício prático" },
      { "habito": "Hábito tático (ex: Parar de mandar áudio longo)", "como_implementar": "Exercício prático" }
    ]
  }
}

DIRETRIZES DE ANÁLISE:
1. SEJA SEVERO. Notas acima de 80 apenas para vendas perfeitas.
2. Identifique "Bafo de Comissão" (Vendedor desesperado para vender).
3. Identifique "Monólogo" (Vendedor manda áudios/textos enormes sem perguntas).
4. Identifique "Preço Nu" (Dar preço sem ancoragem de valor).
5. Se houver menção de "arquivos de áudio" no texto, considere que o vendedor pode ter falhado ao não escrever o resumo.
6. **FOLLOW-UP CRÍTICO**: No 'plano_de_acao', GERE OBRIGATORIAMENTE uma 'rotina_followup' com EXATAMENTE 3 toques futuros: 
   - Dia 1: Foco em AJUDAR, não cobrar.
   - Dia 3: Foco em PROVA SOCIAL ou NOVIDADE.
   - Dia 7: "Break-up" (Desapego profissional).
   Dê os scripts prontos para copiar e colar.
7. O "plano_de_acao" deve ser TÁTICO. O usuário quer copiar e colar a solução.
`;

export async function recognizeMediaContent(base64Data: string, mimeType: string, type: 'audio' | 'image'): Promise<string> {
    try {
        // 'gemini-2.0-flash-exp' é robusto para multimodalidade (áudio/imagem)
        const modelId = 'gemini-2.0-flash-exp'; 
        
        const prompt = type === 'audio' 
            ? "Transcreva este áudio de uma conversa de vendas do WhatsApp. Se for apenas ruído ou silêncio, diga '[Sem conteúdo]'. Se for música ou inaudível, avise. Retorne APENAS a transcrição."
            : "Descreva o conteúdo desta imagem enviada em uma conversa de vendas. Se for um print de conversa, transcreva o texto. Se for produto, descreva. Retorne APENAS a descrição/transcrição.";

        const response = await ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    },
                    { text: prompt }
                ]
            }
        });

        return response.text || "[Não foi possível transcrever]";
    } catch (error) {
        console.error("Erro na transcrição de mídia:", error);
        return "[Erro ao processar mídia]";
    }
}

export async function analyzeConversation(conversationText: string): Promise<AnalysisResult> {
  try {
    const modelId = 'gemini-2.0-flash-exp'; // Usando 2.0 Flash para análise de texto complexa e rápida
    
    // Aumentado para 500.000 caracteres.
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
        temperature: 0.3, // Temperatura baixa para análise técnica
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
): Promise<{ text: string, suggestions: string[] }> {
    try {
        const modelId = 'gemini-3-flash-preview';
        
        // Injeta o contexto rico da análise na conversa
        const contextString = contextAnalysis ? `
CONTEXTO DA AUDITORIA REALIZADA:
Score: ${contextAnalysis.resumo_executivo.score}
Veredicto: ${contextAnalysis.resumo_executivo.veredicto}
Metodologia Identificada: ${contextAnalysis.analise_estrategica?.metodologia_identificada}
Metodologia Sugerida: ${contextAnalysis.analise_estrategica?.metodologia_sugerida}
Erros Críticos: ${contextAnalysis.erros.map(e => e.nome).join(', ')}
Plano Imediato: ${contextAnalysis.plano_de_acao?.imediato?.acao}
Script Sugerido: ${contextAnalysis.plano_de_acao?.imediato?.script}
` : "";

        const chat = ai.chats.create({
            model: modelId,
            config: {
                systemInstruction: `Você é o FISCAL DE VENDA (Senior Sales Coach). 
                Seu objetivo é ajudar o usuário a entender profundamente a auditoria que você acabou de fazer.
                
                REGRAS DE FORMATAÇÃO (VISUALMENTE ATRAENTE):
                1. Use **Negrito** para ênfase em conceitos chave.
                2. Use Listas ( - item) para organizar ideias.
                3. Use > Citações para destacar scripts ou frases.
                4. Seja conciso mas PROFUNDO. Nada de respostas vagas.
                5. Use Markdown rico.

                REGRAS DE SUGESTÃO:
                No FINAL da sua resposta, você DEVE fornecer estritamente 3 opções curtas (máx 5 palavras) para o usuário continuar a conversa.
                Formato OBRIGATÓRIO no final (invisível ao usuário):
                :::SUGGESTIONS ["Opção 1", "Opção 2", "Opção 3"] :::

                ${contextString}`
            },
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.text }]
            }))
        });

        const result = await chat.sendMessage({ message: newMessage });
        const rawText = result.text || "Sem resposta.";

        // Parse Suggestions logic
        const suggestionRegex = /:::SUGGESTIONS\s*(\[.*?\])\s*:::/s;
        const match = rawText.match(suggestionRegex);
        
        let suggestions: string[] = [];
        let finalText = rawText;

        if (match && match[1]) {
            try {
                suggestions = JSON.parse(match[1]);
                // Remove the suggestion block from the display text
                finalText = rawText.replace(match[0], '').trim();
            } catch (e) {
                console.error("Failed to parse suggestions", e);
            }
        }

        return { text: finalText, suggestions };

    } catch (error) {
        console.error("Chat Error:", error);
        throw new Error("Erro no chat.");
    }
}