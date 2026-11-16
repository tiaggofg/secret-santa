import { Injectable } from '@angular/core';

export interface ShareResult {
  method: 'web-share' | 'clipboard';
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class ShareLinkService {
  async shareLink(options: {
    title: string;
    text?: string;
    pathOrUrl: string;
    openWhatsAppFallback?: boolean;
  }): Promise<ShareResult> {
    const fullUrl = this.toAbsoluteUrl(options.pathOrUrl);
    const fullMessage = options.text ? `${options.text}\n\n${fullUrl}` : fullUrl;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;

    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({
          title: options.title,
          text: options.text ?? options.title,
          url: fullUrl
        });
        return { method: 'web-share', url: fullUrl };
      } catch {
        // Fallback to clipboard when native share is dismissed or fails
      }
    }

    if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
      await nav.clipboard.writeText(fullMessage);
    }

    if (
      options.openWhatsAppFallback &&
      typeof window !== 'undefined' &&
      typeof window.open === 'function'
    ) {
      try {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(fullMessage)}`,
          '_blank',
          'noopener,noreferrer'
        );
      } catch {
        // Ignore popup blocker or test environment limitations
      }
    }

    return { method: 'clipboard', url: fullUrl };
  }

  async copyUrl(pathOrUrl: string): Promise<ShareResult> {
    const fullUrl = this.toAbsoluteUrl(pathOrUrl);
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
      await nav.clipboard.writeText(fullUrl);
    }
    return { method: 'clipboard', url: fullUrl };
  }

  toAbsoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:4200';
    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${origin}${normalizedPath}`;
  }
}
