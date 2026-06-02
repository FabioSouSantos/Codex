import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AtualizacaoRecente, DispositivoParsePreview, Lei } from '../../core/models';

interface MetadadosForm {
  tipo_norma: string;
  numero: string;
  ano: string;
  ementa: string;
  data_publicacao: string;
  veiculo_publicacao: string;
  orgao_emanador: string;
  url_repositorio: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <!-- Seção 1: Atualização do dia -->
    <section class="bloco">
      <h2>Atualização do dia</h2>
      @if (atualizacoes().length === 0) {
        <p class="vazio">Não temos nenhuma atualização recente.</p>
      } @else {
        <div class="lista-atualizacoes">
          @for (a of atualizacoes(); track a.tipo + a.anotacao_id) {
            <button class="card item-atualizacao" [class]="'tipo-' + a.tipo" (click)="abrirLei(a.lei_id, a.dispositivo_id)">
              <span class="badge-tipo">{{ rotuloTipo(a.tipo) }}</span>
              <strong>{{ a.lei_titulo }}</strong>
              <span class="disp">{{ a.dispositivo_identificador }}</span>
              <span class="resumo">{{ a.resumo }}</span>
              <span class="data">{{ a.criado_em | date: 'dd/MM/yyyy HH:mm' }}</span>
            </button>
          }
        </div>
      }
    </section>

    <!-- Seção 2: Lista de leis -->
    <section class="bloco">
      <div class="cabecalho-leis">
        <h2>Legislação</h2>
        @if (auth.podeEditar()) {
          <div class="acoes">
            <button class="btn-secundario" (click)="abrirImportar()">↗ Importar URL</button>
            <button class="btn" (click)="abrirManual()">+ Cadastro manual</button>
          </div>
        }
      </div>

      <input class="filtro" placeholder="Filtrar por tipo, número, ementa…" [(ngModel)]="filtro" />

      @if (leisFiltradas().length === 0) {
        <p class="vazio">Nenhuma lei cadastrada.</p>
      } @else {
        <div class="grade-leis">
          @for (lei of leisFiltradas(); track lei.id) {
            <button class="card card-lei" (click)="abrirLei(lei.id)">
              @if (temBadgeAtualizacao(lei)) {
                <span class="badge-atualizacao">Atualização</span>
              }
              <div class="tipo">{{ lei.tipo_norma }}</div>
              <div class="numero">
                @if (lei.numero) { nº {{ lei.numero }} }
                @if (lei.ano) { / {{ lei.ano }} }
              </div>
              @if (lei.ementa) {
                <p class="ementa">{{ lei.ementa }}</p>
              }
              <div class="rodape">
                @if (lei.cadastro_manual) { <span class="tag">manual</span> }
                @else { <span class="tag">Planalto</span> }
                @if (lei.data_ultima_atualizacao) {
                  <span class="quando">atualizada {{ lei.data_ultima_atualizacao | date: 'dd/MM/yy' }}</span>
                }
              </div>
            </button>
          }
        </div>
      }
    </section>

    <!-- Modal: Importar URL -->
    @if (modalImportar()) {
      <div class="modal-backdrop" (click)="fecharModais()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Importar do Planalto</h3>
          <p class="ajuda">Cole a URL completa de uma norma em planalto.gov.br.</p>
          <input [(ngModel)]="urlImportar" placeholder="https://www.planalto.gov.br/ccivil_03/..." />
          @if (erroModal()) { <div class="erro">{{ erroModal() }}</div> }
          <div class="modal-acoes">
            <button class="btn-secundario" (click)="fecharModais()">Cancelar</button>
            <button class="btn" (click)="importar()" [disabled]="processando()">
              {{ processando() ? 'Importando…' : 'Importar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: Cadastro manual (2 passos) -->
    @if (modalManual()) {
      <div class="modal-backdrop" (click)="fecharModais()">
        <div class="modal manual" (click)="$event.stopPropagation()">
          <h3>Cadastro manual — passo {{ passoManual() }} de 2</h3>

          @if (passoManual() === 1) {
            <p class="ajuda">Metadados ABNT da norma.</p>
            <div class="grid-form">
              <label>Tipo da norma*<input [(ngModel)]="meta.tipo_norma" placeholder="Lei Ordinária" /></label>
              <label>Número<input [(ngModel)]="meta.numero" placeholder="14.133" /></label>
              <label>Ano<input [(ngModel)]="meta.ano" placeholder="2021" /></label>
              <label>Data de publicação<input type="date" [(ngModel)]="meta.data_publicacao" /></label>
              <label class="full">Ementa<textarea rows="2" [(ngModel)]="meta.ementa"></textarea></label>
              <label>Veículo de publicação<input [(ngModel)]="meta.veiculo_publicacao" placeholder="DOU" /></label>
              <label>Órgão emanador<input [(ngModel)]="meta.orgao_emanador" placeholder="Congresso Nacional" /></label>
              <label class="full">URL do repositório<input [(ngModel)]="meta.url_repositorio" /></label>
            </div>
            @if (erroModal()) { <div class="erro">{{ erroModal() }}</div> }
            <div class="modal-acoes">
              <button class="btn-secundario" (click)="fecharModais()">Cancelar</button>
              <button class="btn" (click)="irPasso2()">Próximo</button>
            </div>
          } @else {
            <p class="ajuda">Cole o texto completo da norma. O sistema separa artigos, parágrafos, incisos e alíneas.</p>
            <textarea rows="8" [(ngModel)]="textoManual" placeholder="Art. 1º ..."></textarea>
            <div class="previa-acao">
              <button class="btn-secundario" (click)="previsualizar()" [disabled]="processando()">
                Pré-visualizar dispositivos
              </button>
            </div>
            @if (previa().length > 0) {
              <div class="previa">
                <strong>{{ previa().length }} dispositivos detectados:</strong>
                @for (d of previa(); track d.ordem) {
                  <div class="previa-item">
                    <span class="tag">{{ d.tipo }}</span> <b>{{ d.identificador }}</b>
                    <span class="trecho">{{ d.texto_conteudo }}</span>
                  </div>
                }
              </div>
            }
            @if (erroModal()) { <div class="erro">{{ erroModal() }}</div> }
            <div class="modal-acoes">
              <button class="btn-secundario" (click)="passoManual.set(1)">Voltar</button>
              <button class="btn" (click)="salvarManual()" [disabled]="processando()">
                {{ processando() ? 'Salvando…' : 'Salvar norma' }}
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .bloco { margin-bottom: 2.4rem; }
      h2 { font-size: 1.25rem; margin: 0 0 0.9rem; }
      .vazio { color: var(--texto-suave); font-style: italic; }
      .lista-atualizacoes { display: grid; gap: 0.7rem; }
      .item-atualizacao {
        text-align: left;
        padding: 0.85rem 1rem;
        display: grid;
        gap: 0.25rem;
        background: var(--branco);
        border-left: 4px solid var(--borda);
      }
      .item-atualizacao.tipo-doutrina { background: var(--doutrina-bg); border-left-color: var(--doutrina-borda); }
      .item-atualizacao.tipo-jurisprudencia { background: var(--juris-bg); border-left-color: var(--juris-borda); }
      .item-atualizacao.tipo-comentario { background: var(--comentario-bg); border-left-color: var(--comentario-borda); }
      .badge-tipo { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--texto-suave); }
      .item-atualizacao .disp { font-size: 0.82rem; color: var(--texto-suave); }
      .item-atualizacao .resumo { font-size: 0.9rem; }
      .item-atualizacao .data { font-size: 0.75rem; color: var(--texto-suave); }

      .cabecalho-leis { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
      .acoes { display: flex; gap: 0.6rem; }
      .filtro { margin: 0.8rem 0 1.1rem; }
      .grade-leis { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.9rem; }
      .card-lei {
        text-align: left;
        position: relative;
        padding: 1rem;
        background: var(--lei-bg);
        backdrop-filter: blur(6px);
        display: grid;
        gap: 0.25rem;
        align-content: start;
      }
      .card-lei:hover { box-shadow: 0 4px 14px rgba(16,24,40,0.12); }
      .badge-atualizacao {
        position: absolute; top: 0.6rem; right: 0.6rem;
        background: var(--ok); color: #fff; font-size: 0.68rem; font-weight: 700;
        padding: 0.15rem 0.5rem; border-radius: 999px;
      }
      .card-lei .tipo { font-weight: 700; }
      .card-lei .numero { font-size: 0.85rem; color: var(--texto-suave); }
      .card-lei .ementa { font-size: 0.82rem; color: var(--texto); margin: 0.3rem 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .rodape { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.3rem; }
      .tag { background: rgba(0,0,0,0.06); font-size: 0.7rem; padding: 0.1rem 0.45rem; border-radius: 6px; color: var(--texto-suave); }
      .quando { font-size: 0.72rem; color: var(--texto-suave); }

      .ajuda { color: var(--texto-suave); font-size: 0.88rem; }
      .modal-acoes { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.1rem; }
      .erro { color: var(--erro); font-size: 0.85rem; margin-top: 0.5rem; }
      .grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
      .grid-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; font-weight: 500; }
      .grid-form .full { grid-column: 1 / -1; }
      .manual { max-width: 720px; }
      .previa-acao { margin: 0.7rem 0; }
      .previa { max-height: 230px; overflow-y: auto; border: 1px solid var(--borda); border-radius: 8px; padding: 0.7rem; display: grid; gap: 0.4rem; }
      .previa-item { font-size: 0.8rem; }
      .previa-item .trecho { display: block; color: var(--texto-suave); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  auth = inject(AuthService);

  leis = signal<Lei[]>([]);
  atualizacoes = signal<AtualizacaoRecente[]>([]);
  filtro = '';

  modalImportar = signal(false);
  modalManual = signal(false);
  passoManual = signal(1);
  processando = signal(false);
  erroModal = signal('');

  urlImportar = '';
  textoManual = '';
  previa = signal<DispositivoParsePreview[]>([]);
  meta: MetadadosForm = this.metaVazio();

  leisFiltradas = computed(() => {
    const termo = this.filtro.trim().toLowerCase();
    if (!termo) return this.leis();
    return this.leis().filter((l) =>
      [l.tipo_norma, l.numero, l.ano, l.ementa, l.orgao_emanador]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termo),
    );
  });

  ngOnInit(): void {
    this.carregar();
  }

  private metaVazio(): MetadadosForm {
    return {
      tipo_norma: '', numero: '', ano: '', ementa: '', data_publicacao: '',
      veiculo_publicacao: '', orgao_emanador: '', url_repositorio: '',
    };
  }

  carregar(): void {
    this.api.listarLeis().subscribe((l) => this.leis.set(l));
    this.api.atualizacoesRecentes().subscribe((a) => this.atualizacoes.set(a));
  }

  rotuloTipo(t: string): string {
    return { doutrina: 'Doutrina', jurisprudencia: 'Jurisprudência', comentario: 'Comentário' }[t] ?? t;
  }

  temBadgeAtualizacao(lei: Lei): boolean {
    if (!lei.data_ultima_atualizacao) return false;
    const dias = (Date.now() - new Date(lei.data_ultima_atualizacao).getTime()) / 86400000;
    return dias <= 30;
  }

  abrirLei(id: number, dispositivoId?: number): void {
    this.router.navigate(['/lei', id], dispositivoId ? { queryParams: { disp: dispositivoId } } : {});
  }

  // ---- Modais ----
  abrirImportar(): void {
    this.erroModal.set('');
    this.urlImportar = '';
    this.modalImportar.set(true);
  }
  abrirManual(): void {
    this.erroModal.set('');
    this.meta = this.metaVazio();
    this.textoManual = '';
    this.previa.set([]);
    this.passoManual.set(1);
    this.modalManual.set(true);
  }
  fecharModais(): void {
    this.modalImportar.set(false);
    this.modalManual.set(false);
  }

  importar(): void {
    this.erroModal.set('');
    this.processando.set(true);
    this.api.importarUrl(this.urlImportar.trim()).subscribe({
      next: (lei) => {
        this.processando.set(false);
        this.fecharModais();
        this.router.navigate(['/lei', lei.id]);
      },
      error: (err) => {
        this.processando.set(false);
        this.erroModal.set(err?.error?.detail || 'Falha ao importar.');
      },
    });
  }

  irPasso2(): void {
    if (!this.meta.tipo_norma.trim()) {
      this.erroModal.set('Informe ao menos o tipo da norma.');
      return;
    }
    this.erroModal.set('');
    this.passoManual.set(2);
  }

  previsualizar(): void {
    this.erroModal.set('');
    this.processando.set(true);
    this.api.parseTexto(this.textoManual).subscribe({
      next: (p) => {
        this.processando.set(false);
        this.previa.set(p);
        if (p.length === 0) this.erroModal.set('Nenhum dispositivo detectado no texto.');
      },
      error: () => {
        this.processando.set(false);
        this.erroModal.set('Falha ao processar o texto.');
      },
    });
  }

  private metaParaPayload(): Partial<Lei> {
    return {
      tipo_norma: this.meta.tipo_norma.trim(),
      numero: this.meta.numero.trim() || null,
      ano: this.meta.ano ? Number(this.meta.ano) : null,
      ementa: this.meta.ementa.trim() || null,
      data_publicacao: this.meta.data_publicacao || null,
      veiculo_publicacao: this.meta.veiculo_publicacao.trim() || null,
      orgao_emanador: this.meta.orgao_emanador.trim() || null,
      url_repositorio: this.meta.url_repositorio.trim() || null,
    };
  }

  salvarManual(): void {
    this.erroModal.set('');
    this.processando.set(true);
    this.api.criarLeiManualCompleto(this.metaParaPayload(), this.textoManual).subscribe({
      next: (lei) => {
        this.processando.set(false);
        this.fecharModais();
        this.router.navigate(['/lei', lei.id]);
      },
      error: (err) => {
        this.processando.set(false);
        this.erroModal.set(err?.error?.detail || 'Falha ao salvar.');
      },
    });
  }
}
