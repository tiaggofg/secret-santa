import { Injectable } from '@angular/core';

export interface ShareResult {
  method: 'web-share' | 'clipboard';
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class ShareLinkService {
  async shareLink(options: { title: string; text?: string; pathOrUrl: string }): Promise<ShareResult> {
    const fullUrl = this.toAbsoluteUrl(options.pathOrUrl);
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
