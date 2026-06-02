import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="navbar">
      <a routerLink="/" class="marca">
        <img src="assets/logo.jpg" alt="Codex" class="logo" />
        <span class="nome">Codex</span>
      </a>
      <nav class="links">
        <a routerLink="/" routerLinkActive="ativo" [routerLinkActiveOptions]="{ exact: true }">Início</a>
        @if (auth.ehAdmin()) {
          <a routerLink="/admin" routerLinkActive="ativo">Administração</a>
        }
      </nav>
      <div class="usuario">
        <span class="info">
          {{ auth.usuario()?.nome }}
          <small>{{ auth.usuario()?.papel }}</small>
        </span>
        <button class="btn-secundario sair" (click)="auth.logout()">Sair</button>
      </div>
    </header>

    <main class="conteudo">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      .navbar {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 0.6rem 1.5rem;
        background: var(--branco);
        border-bottom: 1px solid var(--borda);
        box-shadow: var(--sombra);
        position: sticky;
        top: 0;
        z-index: 50;
      }
      .marca {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        text-decoration: none;
        color: var(--texto);
      }
      .logo {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
      }
      .nome { font-weight: 800; font-size: 1.2rem; letter-spacing: -0.02em; }
      .links { display: flex; gap: 1rem; flex: 1; }
      .links a {
        color: var(--texto-suave);
        font-weight: 500;
        padding: 0.3rem 0.2rem;
        border-bottom: 2px solid transparent;
      }
      .links a.ativo { color: var(--azul); border-bottom-color: var(--azul); }
      .usuario { display: flex; align-items: center; gap: 0.8rem; }
      .info { display: flex; flex-direction: column; line-height: 1.1; text-align: right; }
      .info small { color: var(--texto-suave); text-transform: capitalize; font-size: 0.72rem; }
      .sair { padding: 0.4rem 0.8rem; }
      .conteudo { max-width: 980px; margin: 0 auto; padding: 1.8rem 1.2rem 4rem; }
    `,
  ],
})
export class ShellComponent {
  auth = inject(AuthService);
}
