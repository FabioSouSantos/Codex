import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { TokenResponse, Usuario } from './models';

const TOKEN_KEY = 'codex_token';
const USER_KEY = 'codex_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  usuario = signal<Usuario | null>(this.carregarUsuario());
  autenticado = computed(() => this.usuario() !== null && this.token !== null);

  podeEditar = computed(() => {
    const u = this.usuario();
    return u?.papel === 'admin' || u?.papel === 'editor';
  });
  ehAdmin = computed(() => this.usuario()?.papel === 'admin');

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private carregarUsuario(): Usuario | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as Usuario) : null;
  }

  login(email: string, senha: string): Observable<TokenResponse> {
    const form = new URLSearchParams();
    form.set('username', email);
    form.set('password', senha);
    return this.http
      .post<TokenResponse>('/api/auth/token', form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.access_token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.usuario));
          this.usuario.set(res.usuario);
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.usuario.set(null);
    this.router.navigate(['/login']);
  }
}
