import Tesseract from 'tesseract.js';
import JSZip from 'jszip';

export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;

  if (fileType === 'text/plain') {
    return await file.text();
  } else if (fileType === 'application/zip' || fileType === 'application/x-zip-compressed') {
    return await extractFromZip(file);
  } else if (fileType.startsWith('image/')) {
    return await extractFromImage(file);
  } else {
    throw new Error("Formato de arquivo não suportado.");
  }
}

async function extractFromZip(file: File): Promise<string> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  // Find the first .txt file which is usually the chat export
  const txtFileName = Object.keys(loadedZip.files).find(name => name.endsWith('.txt'));
  
  if (txtFileName) {
    return await loadedZip.files[txtFileName].async('string');
  } else {
    throw new Error("Nenhum arquivo de conversa (.txt) encontrado no ZIP.");
  }
}

async function extractFromImage(file: File): Promise<string> {
  // Simple OCR implementation
  // Ideally, this should handle multiple images and stitch them, 
  // but for MVP we process single image
  const { data: { text } } = await Tesseract.recognize(
    file,
    'por', // Portuguese
    { logger: m => console.log(m) }
  );
  return text;
}
