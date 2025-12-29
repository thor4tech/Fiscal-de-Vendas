import Tesseract from 'tesseract.js';
import JSZip from 'jszip';

export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;

  // Verifica extensão do arquivo também, pois o file.type pode falhar em alguns sistemas para ZIPs
  const fileName = file.name.toLowerCase();

  if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    return await file.text();
  } else if (
      fileType === 'application/zip' || 
      fileType === 'application/x-zip-compressed' || 
      fileName.endsWith('.zip')
  ) {
    return await extractFromZip(file);
  } else if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|bmp|webp)$/)) {
    return await extractFromImage(file);
  } else {
    throw new Error(`Formato de arquivo não suportado: ${file.type || 'Desconhecido'}. Envie .txt, .zip ou imagens.`);
  }
}

async function extractFromZip(file: File): Promise<string> {
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);
    
    // Procura arquivos de texto dentro do ZIP
    const txtFiles = Object.keys(loadedZip.files).filter(name => 
      name.toLowerCase().endsWith('.txt') && !name.startsWith('__MACOSX')
    );
    
    if (txtFiles.length === 0) {
      throw new Error("Nenhum arquivo de texto (.txt) encontrado dentro do arquivo ZIP.");
    }

    // Tenta encontrar o arquivo padrão do WhatsApp "_chat.txt"
    let targetFile = txtFiles.find(name => name.includes('_chat.txt'));

    // Se não achar o padrão, pega o MAIOR arquivo de texto (assumindo ser a conversa principal)
    if (!targetFile) {
        // Precisamos verificar o tamanho para pegar o conteúdo principal
        let maxSize = 0;
        for (const name of txtFiles) {
            const fileData = loadedZip.files[name];
            // @ts-ignore - _data properties might be internal in some jszip versions but uncompressedSize usually exists
            const size = fileData._data ? fileData._data.uncompressedSize : 0; 
            if (size > maxSize) {
                maxSize = size;
                targetFile = name;
            }
        }
        // Fallback: pega o primeiro se a lógica de tamanho falhar
        if (!targetFile) targetFile = txtFiles[0];
    }
    
    console.log(`Extraindo conversa do arquivo: ${targetFile}`);
    const content = await loadedZip.files[targetFile].async('string');

    if (!content || content.trim().length === 0) {
        throw new Error("O arquivo de conversa extraído está vazio.");
    }

    return content;
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