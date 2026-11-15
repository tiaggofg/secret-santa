import { Component, Input } from '@angular/core';

export type FestiveIconName =
  | 'gift'
  | 'gift-open'
  | 'star'
  | 'pine'
  | 'eye'
  | 'eye-off'
  | 'key'
  | 'shield-eye'
  | 'gps'
  | 'share'
  | 'switch-user'
  | 'spinner'
  | 'check'
  | 'copy';

@Component({
  selector: 'app-festive-icon',
  standalone: true,
  template: `
    @switch (name) {
      @case ('gift') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8m16 0V8a2 2 0 0 0-2-2h-3.5M4 12V8a2 2 0 0 1 2-2h3.5m10.5 6H4m8-6v16m0-16c-1.5-2.5-4.5-2.5-4.5 0S12 6 12 6zm0 0c1.5-2.5 4.5-2.5 4.5 0S12 6 12 6z"/>
        </svg>
      }
      @case ('gift-open') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 12h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8zm8 0v10M3 8.5l9-3 9 3-9 3-9-3zm9-3V3"/>
        </svg>
      }
      @case ('star') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l2.35 6.65L21 11l-6.65 2.35L12 20l-2.35-6.65L3 11l6.65-2.35L12 2z"/>
        </svg>
      }
      @case ('pine') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3l-5 6h3l-4 6h4l-3 5h10l-3-5h4l-4-6h3l-5-6zm0 17v2"/>
        </svg>
      }
      @case ('eye') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      }
      @case ('eye-off') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 1 0 2.83 2.83M9.88 5.09A9.77 9.77 0 0 1 12 4.88c6 0 9.5 7.12 9.5 7.12a16.8 16.8 0 0 1-3.32 4.46M6.61 6.61A16.5 16.5 0 0 0 2.5 12s3.5 7.12 9.5 7.12c1.73 0 3.31-.46 4.69-1.22"/>
        </svg>
      }
      @case ('key') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a4 4 0 1 1-7.46 2H2v4h3v2h3v-2h1.54A4 4 0 0 1 15 7zm1.5 0h.01"/>
        </svg>
      }
      @case ('shield-eye') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3l7 3v6c0 4.5-3 8.2-7 9.5-4-1.3-7-5-7-9.5V6l7-3z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.5 12.2l1.8 1.8 3.5-3.8"/>
        </svg>
      }
      @case ('gps') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-6-5.4-6-10.5a6 6 0 1 1 12 0C18 15.6 12 21 12 21z"/>
          <circle cx="12" cy="10.5" r="2.2"/>
        </svg>
      }
      @case ('share') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4m4-4v13"/>
        </svg>
      }
      @case ('switch-user') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10-4l2 2-2 2m-4 0l-2-2 2-2m-2 2h6"/>
        </svg>
      }
      @case ('spinner') {
        <svg [class]="svgClass + ' animate-spin'" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
          <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"></path>
        </svg>
      }
      @case ('check') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      }
      @case ('copy') {
        <svg [class]="svgClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      }
    }
  `
})
export class FestiveIconComponent {
  @Input({ required: true }) name!: FestiveIconName;
  @Input() svgClass = 'w-5 h-5 shrink-0';
}
