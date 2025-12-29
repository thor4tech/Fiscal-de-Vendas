import Tesseract from 'tesseract.js';
import JSZip from 'jszip';
import { recognizeMediaContent } from './gemini';

export async function extractTextFromFile(file: File, onProgress?: (status: string) => void): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    return await file.text();
  } else if (
      fileType === 'application/zip' || 
      fileType === 'application/x-zip-compressed' || 
      fileName.endsWith('.zip')
  ) {
    return await extractFromZip(file, onProgress);
  } else if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|bmp|webp)$/)) {
    return await extractFromImage(file);
  } else {
    throw new Error(`Formato de arquivo não suportado: ${file.type || 'Desconhecido'}. Envie .txt, .zip ou imagens.`);
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:audio/ogg;base64,")
      const base64 = base64String.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function extractFromZip(file: File, onProgress?: (status: string) => void): Promise<string> {
  try {
    if (onProgress) onProgress("Descompactando arquivo ZIP...");
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);
    
    let chatContent = "";
    let foundOfficialChat = false;
    
    // Armazena arquivos de mídia para processamento
    const mediaFiles: { name: string, type: 'audio' | 'image', ext: string, content: any }[] = [];

    // 1. Identificar arquivos
    for (const filename of Object.keys(loadedZip.files)) {
        const lowerName = filename.toLowerCase();
        if (lowerName.startsWith('__macosx') || lowerName.includes('.ds_store')) continue;

        // Arquivo de texto principal
        if (lowerName.endsWith('.txt')) {
            // Se encontrar o _chat.txt oficial, sobrescreve qualquer outro e marca como definitivo
            if (lowerName.includes('_chat.txt')) {
                 chatContent = await loadedZip.files[filename].async('string');
                 foundOfficialChat = true;
            } else if (!foundOfficialChat) {
                 // Se ainda não achou o oficial, pega esse como temporário (ex: info.txt, group.txt)
                 // Só sobrescreve se o chatContent estiver vazio para evitar pegar o ultimo txt aleatorio
                 if (!chatContent) {
                    chatContent = await loadedZip.files[filename].async('string');
                 }
            }
        }
        
        // Coleta Mídia
        if (lowerName.endsWith('.opus') || lowerName.endsWith('.mp3') || lowerName.endsWith('.ogg')) {
            mediaFiles.push({ name: filename, type: 'audio', ext: lowerName.split('.').pop() || 'opus', content: loadedZip.files[filename] });
        } else if (lowerName.match(/\.(jpg|jpeg|png|webp|heic)$/)) {
            mediaFiles.push({ name: filename, type: 'image', ext: lowerName.split('.').pop() || 'jpg', content: loadedZip.files[filename] });
        }
    }
    
    if (!chatContent) {
      throw new Error("Não foi possível encontrar o arquivo de texto (_chat.txt) dentro do ZIP.");
    }

    // 2. Processar Mídias (Transcrever)
    // Limitamos a quantidade para não estourar tempo/cotas, priorizando os primeiros encontrados ou menores
    const MAX_MEDIA_PROCESS = 8; // Processar no máximo 8 arquivos para performance
    const processedMedia = mediaFiles.slice(0, MAX_MEDIA_PROCESS);
    
    let transcripts = "\n\n=== TRANSCRIÇÕES AUTOMÁTICAS DE MÍDIA ===\n";
    
    for (let i = 0; i < processedMedia.length; i++) {
        const media = processedMedia[i];
        if (onProgress) onProgress(`Transcrevendo mídia ${i + 1} de ${processedMedia.length} (${media.type === 'audio' ? 'Áudio' : 'Imagem'})...`);
        
        try {
            const blob = await media.content.async('blob');
            const base64 = await blobToBase64(blob);
            
            // Determina MIME type correto para Gemini
            let mimeType = '';
            if (media.type === 'audio') {
                mimeType = media.ext === 'mp3' ? 'audio/mp3' : 'audio/ogg'; // Gemini aceita ogg/opus como ogg geralmente ou mp3
            } else {
                mimeType = media.ext === 'png' ? 'image/png' : 'image/jpeg';
            }

            const transcription = await recognizeMediaContent(base64, mimeType, media.type);
            
            transcripts += `\n[ARQUIVO TRANSCRITO: ${media.name}]\nCONTEÚDO: "${transcription}"\n-----------------------------------`;
            
        } catch (err) {
            console.error(`Falha ao processar mídia ${media.name}`, err);
            transcripts += `\n[ARQUIVO: ${media.name}] (Erro na transcrição)\n`;
        }
    }

    if (mediaFiles.length > MAX_MEDIA_PROCESS) {
        transcripts += `\n[NOTA DO SISTEMA]: Existem mais ${mediaFiles.length - MAX_MEDIA_PROCESS} arquivos de mídia que não foram processados para economizar tempo.\n`;
    }

    // Adiciona as transcrições ao final do conteúdo do chat para a IA principal ler
    return chatContent + transcripts;

  } catch (error: any) {
    console.error("Erro ao descompactar ZIP:", error);
    throw new Error(`Falha ao ler o arquivo ZIP: ${error.message}`);
  }
}

async function extractFromImage(file: File): Promise<string> {
  try {
    const { data: { text } } = await Tesseract.recognize(
        file,
        'por', 
        { logger: () => {} } // Silencia logs no console
    );
    
    if (!text || text.trim().length < 10) {
        throw new Error("Não foi possível ler texto suficiente na imagem. Tente uma imagem com melhor qualidade.");
    }
    
    return text;
  } catch (error: any) {
      throw new Error(`Erro ao processar imagem (OCR): ${error.message}`);
  }
}