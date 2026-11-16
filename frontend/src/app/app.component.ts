import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FestiveIconComponent } from './shared/components/festive-icon.component';
import { ToastContainerComponent } from './shared/toast/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FestiveIconComponent, ToastContainerComponent],
  template: `
    <app-toast-container />
    <div class="min-h-dvh w-full festive-desktop-backdrop md:py-6 md:px-4 flex flex-col items-center overflow-x-hidden">
      <div class="w-full md:max-w-lg min-h-dvh md:min-h-[calc(100dvh-3rem)] bg-festive-cream md:rounded-3xl md:border md:border-amber-400/35 md:shadow-2xl flex flex-col overflow-hidden">
        <header class="bg-gradient-to-r from-pine-900 via-pine-800 to-pine-900 text-white px-4 py-3.5 shadow-md">
          <a routerLink="/" class="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl">
            <div class="w-10 h-10 rounded-xl bg-cranberry-700 border border-amber-300/60 flex items-center justify-center shadow-sm shrink-0 relative">
              <app-festive-icon name="gift" svgClass="w-5 h-5 text-white" />
              <app-festive-icon name="star" svgClass="w-3 h-3 text-amber-300 absolute -top-1 -right-1" />
            </div>
            <div class="min-w-0">
              <span class="block font-display font-bold text-lg sm:text-xl leading-tight tracking-tight text-white">
                Amigo Secreto
              </span>
              <span class="block text-[11px] font-semibold uppercase tracking-widest text-amber-200">
                Edição de Natal
              </span>
            </div>
          </a>
        </header>

        <div class="festive-garland w-full" aria-hidden="true"></div>

        <main class="flex-1 p-4 sm:p-5 animate-fade-slide-up">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class AppComponent {}
