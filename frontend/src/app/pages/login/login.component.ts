import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="tela">
      <form class="card caixa" (ngSubmit)="entrar()">
        <img src="assets/logo.jpg" alt="Codex" class="logo" />
        <h1>Codex</h1>
        <p class="sub">Gestão de conhecimento legislativo</p>

        <label>
          E-mail
          <input type="email" name="email" [(ngModel)]="email" autocomplete="username" required />
        </label>
        <label>
          Senha
          <input type="password" name="senha" [(ngModel)]="senha" autocomplete="current-password" required />
        </label>

        @if (erro()) {
          <div class="erro">{{ erro() }}</div>
        }

        <button class="btn entrar" type="submit" [disabled]="carregando()">
          {{ carregando() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </div>
  `,
  styles: [
    `
      .tela {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(160deg, #eef1f6 0%, #f5f6f8 100%);
        padding: 1rem;
      }
      .caixa {
        width: 100%;
        max-width: 380px;
        padding: 2.2rem 1.8rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        text-align: center;
      }
      .logo {
        width: 80px;
        height: 80px;
        border-radius: 16px;
        object-fit: cover;
        margin: 0 auto 0.4rem;
      }
      h1 { margin: 0; font-size: 1.7rem; letter-spacing: -0.02em; }
      .sub { margin: 0 0 0.8rem; color: var(--texto-suave); font-size: 0.9rem; }
      label { display: flex; flex-direction: column; gap: 0.3rem; text-align: left; font-size: 0.85rem; font-weight: 500; }
      .erro { color: var(--erro); font-size: 0.85rem; }
      .entrar { margin-top: 0.6rem; padding: 0.7rem; }
    `,
  ],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  senha = '';
  erro = signal('');
  carregando = signal(false);

  entrar(): void {
    this.erro.set('');
    this.carregando.set(true);
    this.auth.login(this.email.trim().toLowerCase(), this.senha).subscribe({
      next: () => {
        this.carregando.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.carregando.set(false);
        this.erro.set(err?.error?.detail || 'Não foi possível entrar.');
      },
    });
  }
}
