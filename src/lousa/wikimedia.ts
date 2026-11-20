/**
 * TUTORIA - Integração com a API Aberta da Wikimedia Commons
 * Busca imagens reais, livres de direitos autorais e sem necessidade de chave de API.
 * Suporta timeout estrito de 4s (RNF03, CA06, CA07).
 */

import { ImagemConteudo } from './tipos';

const TIMEOUT_BUSCA_MS = 4000;

export async function buscarImagemWikimedia(
  termo: string,
  legendaSugerida?: string
): Promise<ImagemConteudo | null> {
  const termoLimpo = (termo || '').trim();
  if (!termoLimpo) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_BUSCA_MS);

  try {
    // gsrnamespace=6 busca só arquivos (File:); sem ele a busca devolve páginas de galeria,
    // que não têm imageinfo, e quase nenhuma imagem aparecia. Pede 5 para pular PDFs e vídeos.
    const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      termoLimpo
    )}&gsrlimit=5&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=640&format=json&origin=*`;

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    // Respeita a ordem de relevância da busca e fica com o primeiro arquivo que é imagem
    const paginas = Object.values(pages as Record<string, any>).sort((x, y) => (x?.index ?? 0) - (y?.index ?? 0));
    const imageInfo = paginas
      .map(p => p?.imageinfo?.[0])
      .find(info => info && typeof info.mime === 'string' && info.mime.startsWith('image/'));

    if (!imageInfo) return null;

    // Prefere thumbnail redimensionado ou a URL original; só aceita o CDN da própria Wikimedia
    const url: string | undefined = imageInfo.thumburl || imageInfo.url;
    if (!url || !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url)) return null;

    const meta = imageInfo.extmetadata || {};
    const autor = meta.Artist?.value ? stripHtmlTags(meta.Artist.value) : 'Wikimedia Commons';
    const licenca = meta.LicenseShortName?.value || meta.License?.value || 'Creative Commons';
    const descricao = meta.ObjectName?.value || meta.ImageDescription?.value
      ? stripHtmlTags(meta.ObjectName?.value || meta.ImageDescription?.value)
      : legendaSugerida || termoLimpo;

    return {
      termo: termoLimpo,
      legenda: legendaSugerida || descricao,
      urlReal: url,
      autor,
      licenca
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    // Erros de timeout ou rede são tratados silenciosamente sem quebrar a fala
    return null;
  }
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>?/gm, '').trim();
}
