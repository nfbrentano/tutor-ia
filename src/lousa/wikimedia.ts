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
    const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      termoLimpo
    )}&gsrlimit=1&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*`;

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

    const firstPageKey = Object.keys(pages)[0];
    const page = pages[firstPageKey];
    const imageInfo = page?.imageinfo?.[0];

    if (!imageInfo) return null;

    // Prefere thumbnail redimensionado ou a URL original
    const url = imageInfo.thumburl || imageInfo.url;
    if (!url || !url.startsWith('http')) return null;

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
