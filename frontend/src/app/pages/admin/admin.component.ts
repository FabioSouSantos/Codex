import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Usuario } from '../../core/models';

interface NovoUsuario {
  nome: string;
  email: string;
  senha: string;
  papel: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="bloco">
      <div class="cabecalho">
        <h2>Usuários</h2>
        <button class="btn" (click)="abrirNovo()">+ Novo usuário</button>
      </div>

      @if (usuarios().length === 0) {
        <p class="vazio">Nenhum usuário cadastrado.</p>
      } @else {
        <div class="tabela card">
          <div class="linha cabec">
            <span>Nome</span><span>E-mail</span><span>Perfil</span><span>Status</span><span></span>
          </div>
          @for (u of usuarios(); track u.id) {
            <div class="linha">
              <span>{{ u.nome }}</span>
              <span class="email">{{ u.email }}</span>
              <span><span class="papel" [class]="'papel-' + u.papel">{{ u.papel }}</span></span>
              <span>
                @if (u.ativo) { <span class="status ativo">ativo</span> }
                @else { <span class="status inativo">inativo</span> }
              </span>
              <span class="acao">
                @if (u.id !== auth.usuario()?.id) {
                  <button class="btn-secundario mini" (click)="alternar(u)">
                    {{ u.ativo ? 'Desativar' : 'Ativar' }}
                  </button>
                } @else {
                  <span class="voce">(você)</span>
                }
              </span>
            </div>
          }
        </div>
      }
    </section>

    @if (modalNovo()) {
      <div class="modal-backdrop" (click)="fechar()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Novo usuário</h3>
          <div class="grid-form">
            <label class="full">Nome<input [(ngModel)]="novo.nome" /></label>
            <label class="full">E-mail<input type="email" [(ngModel)]="novo.email" /></label>
            <label>Senha<input type="password" [(ngModel)]="novo.senha" /></label>
            <label>Perfil
              <select [(ngModel)]="novo.papel">
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </div>
          @if (erro()) { <div class="erro">{{ erro() }}</div> }
          <div class="modal-acoes">
            <button class="btn-secundario" (click)="fechar()">Cancelar</button>
            <button class="btn" (click)="salvar()" [disabled]="processando()">
              {{ processando() ? 'Salvando…' : 'Criar usuário' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (toast()) { <div class="toast">{{ toast() }}</div> }
  `,
  styles: [
    `
      .bloco { max-width: 880px; }
      .cabecalho { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
      h2 { font-size: 1.25rem; margin: 0; }
      .vazio { color: var(--texto-suave); font-style: italic; }
      .tabela { padding: 0.4rem 0.6rem; }
      .linha { display: grid; grid-template-columns: 1.4fr 1.8fr 0.9fr 0.8fr 1fr; align-items: center; gap: 0.6rem; padding: 0.6rem 0.4rem; border-bottom: 1px solid var(--borda); font-size: 0.9rem; }
      .linha:last-child { border-bottom: none; }
      .linha.cabec { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--texto-suave); font-weight: 700; }
      .email { color: var(--texto-suave); word-break: break-all; }
      .papel { font-size: 0.74rem; font-weight: 700; padding: 0.12rem 0.5rem; border-radius: 999px; text-transform: uppercase; }
      .papel-admin { background: rgba(47,93,168,0.15); color: var(--azul-escuro); }
      .papel-editor { background: rgba(31,122,77,0.15); color: var(--ok); }
      .papel-viewer { background: rgba(0,0,0,0.07); color: var(--texto-suave); }
      .status { font-size: 0.78rem; font-weight: 600; }
      .status.ativo { color: var(--ok); }
      .status.inativo { color: var(--erro); }
      .acao { text-align: right; }
      .mini { padding: 0.3rem 0.6rem; font-size: 0.8rem; }
      .voce { font-size: 0.78rem; color: var(--texto-suave); }
      .grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
      .grid-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; font-weight: 500; }
      .grid-form .full { grid-column: 1 / -1; }
      .modal-acoes { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.1rem; }
      .erro { color: var(--erro); font-size: 0.85rem; margin-top: 0.5rem; }
    `,
  ],
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  usuarios = signal<Usuario[]>([]);
  modalNovo = signal(false);
  processando = signal(false);
  erro = signal('');
  toast = signal('');
  novo: NovoUsuario = this.vazio();

  ngOnInit(): void {
    this.carregar();
  }

  private vazio(): NovoUsuario {
    return { nome: '', email: '', senha: '', papel: 'viewer' };
  }

  carregar(): void {
    this.api.listarUsuarios().subscribe((u) => this.usuarios.set(u));
  }

  abrirNovo(): void {
    this.erro.set('');
    this.novo = this.vazio();
    this.modalNovo.set(true);
  }

  fechar(): void {
    this.modalNovo.set(false);
  }

  salvar(): void {
    if (!this.novo.nome.trim() || !this.novo.email.trim() || !this.novo.senha) {
      this.erro.set('Preencha nome, e-mail e senha.');
      return;
    }
    this.processando.set(true);
    this.erro.set('');
    this.api
      .criarUsuario({
        nome: this.novo.nome.trim(),
        email: this.novo.email.trim(),
        senha: this.novo.senha,
        papel: this.novo.papel,
      })
      .subscribe({
        next: () => {
          this.processando.set(false);
          this.fechar();
          this.carregar();
          this.mostrarToast('Usuário criado.');
        },
        error: (err) => {
          this.processando.set(false);
          this.erro.set(err?.error?.detail || 'Falha ao criar usuário.');
        },
      });
  }

  alternar(u: Usuario): void {
    this.api.alterarAtivo(u.id, !u.ativo).subscribe({
      next: () => {
        this.carregar();
        this.mostrarToast(u.ativo ? 'Usuário desativado.' : 'Usuário ativado.');
      },
      error: (err) => this.mostrarToast(err?.error?.detail || 'Falha ao alterar.'),
    });
  }

  private mostrarToast(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 2200);
  }
}
