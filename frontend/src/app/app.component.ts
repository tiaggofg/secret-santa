import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="max-w-md mx-auto min-h-dvh bg-white shadow-sm flex flex-col">
      <header class="bg-emerald-700 text-white px-4 py-3 flex items-center gap-2 shadow">
        <svg class="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8m16 0V8a2 2 0 0 0-2-2h-3.5M4 12V8a2 2 0 0 1 2-2h3.5m10.5 6H4m8-6v16m0-16c-1.5-2.5-4.5-2.5-4.5 0S12 6 12 6zm0 0c1.5-2.5 4.5-2.5 4.5 0S12 6 12 6z"/>
        </svg>
        <span class="font-bold text-lg tracking-tight">Amigo Secreto Familiar</span>
      </header>
      <main class="flex-1 p-4">
        <router-outlet />
      </main>
    </div>
  `
})
export class AppComponent {}
