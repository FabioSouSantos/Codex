import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Comentario, Dispositivo, Doutrina, Jurisprudencia, Lei } from '../../core/models';

type TipoAnotacao = 'doutrina' | 'jurisprudencia' | 'comentario' | 'link';

interface LinkParseado {
  comentarioId: number;
  label: string;
  leiId: number | null;
  dispId: number | null;
}

interface FormDoutrina {
  texto_generico: string;
  comentario_usuario: string;
  autor: string;
  titulo_obra: string;
  edicao: string;
  editora: string;
  cidade: string;
  ano_publicacao: string;
  paginas: string;
}

interface FormJuris {
  texto_generico: string;
  tribunal: string;
  tipo_decisao: string;
  numero_processo: string;
  relator: string;
  orgao_julgador: string;
  data_julgamento: string;
  veiculo_publicacao: string;
}

interface MetaLeiForm {
  tipo_norma: string;
  numero: string;
  ano: string;
  ementa: string;
  data_publicacao: string;
  veiculo_publicacao: string;
  orgao_emanador: string;
  url_repositorio: string;
  url_sincronizacao: string;
}

@Component({
  selector: 'app-lei',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    @if (carregando()) {
      <p class="vazio">Carregando…</p>
    } @else if (!lei()) {
      <p class="vazio">Norma não encontrada.</p>
    } @else {
      <!-- Cabeçalho da lei -->
      <header class="cabecalho-lei card">
        <div class="ident">
          <span class="tipo">{{ lei()!.tipo_norma }}</span>
          <h1>
            @if (lei()!.numero) { nº {{ lei()!.numero }} }
            @if (lei()!.ano) { / {{ lei()!.ano }} }
          </h1>
          @if (lei()!.ementa) { <p class="ementa">{{ lei()!.ementa }}</p> }
          <div class="meta-linha">
            @if (lei()!.orgao_emanador) { <span>{{ lei()!.orgao_emanador }}</span> }
            @if (lei()!.data_publicacao) { <span>Publicada em {{ lei()!.data_publicacao | date: 'dd/MM/yyyy' }}</span> }
            @if (lei()!.data_ultima_sincronizacao) {
              <span>Sincronizada {{ lei()!.data_ultima_sincronizacao | date: 'dd/MM/yyyy HH:mm' }}</span>
            }
          </div>
        </div>
        <div class="acoes-lei">
          @if (auth.podeEditar()) {
            <button class="btn-secundario" (click)="abrirEditarLei()">✏ Editar dados</button>
          }
          @if (lei()!.url_sincronizacao && auth.podeEditar()) {
            <button class="btn-secundario" (click)="sincronizar()" [disabled]="sincronizando()">
              {{ sincronizando() ? 'Sincronizando…' : '🔄 Sincronizar' }}
            </button>
          }
          @if (lei()!.url_repositorio) {
            <a class="btn-secundario link-rep" [href]="lei()!.url_repositorio" target="_blank" rel="noopener">
              ↗ Repositório externo
            </a>
          }
        </div>
      </header>

      <!-- Controles -->
      <div class="controles">
        <input class="filtro" placeholder="Filtrar dispositivos…" [(ngModel)]="filtro" />
        <label class="check">
          <input type="checkbox" [(ngModel)]="mostrarInativos" />
          Mostrar revogados/alterados
        </label>
      </div>

      <!-- Lista de dispositivos -->
      @if (dispositivosFiltrados().length === 0) {
        <p class="vazio">Nenhum dispositivo para exibir.</p>
      } @else {
        <div class="lista-disp">
          @for (d of dispositivosFiltrados(); track d.id) {
            <article class="disp" [id]="'disp-' + d.id" [class.flash]="flashId() === d.id">
              <!-- Botão + e dropdown (canto superior esquerdo, absoluto) -->
              @if (auth.podeEditar()) {
                <div class="add-wrap">
                  <button class="btn-add" (click)="alternarDropdown(d.id)" aria-label="Adicionar anotação">+</button>
                  @if (dropdownAberto() === d.id) {
                    <div class="dropdown" (click)="$event.stopPropagation()">
                      <button class="dd-item dd-doutrina" (click)="abrirAnotacao('doutrina', d)">Doutrina</button>
                      <button class="dd-item dd-juris" (click)="abrirAnotacao('jurisprudencia', d)">Jurisprudência</button>
                      <button class="dd-item dd-coment" (click)="abrirAnotacao('comentario', d)">Comentário pessoal</button>
                      <button class="dd-item dd-link" (click)="abrirAnotacao('link', d)">Link para outra norma</button>
                    </div>
                  }
                </div>
              }

              <!-- Caixa do dispositivo -->
              <div class="disp-box" [class.revogado]="d.status === 'revogado' || !d.ativo" [class.alterado]="d.status === 'alterado'">
                <div class="disp-cabec">
                  <span class="disp-id">{{ d.identificador }}</span>
                  @if (d.status === 'revogado' || !d.ativo) { <span class="badge badge-revogado">Revogado</span> }
                  @else if (d.status === 'alterado') { <span class="badge badge-alterado">Alterado</span> }
                  @if (auth.podeEditar()) {
                    <button class="mini" (click)="abrirEditarDispositivo(d)" title="Editar dispositivo">✏</button>
                  }
                  <button class="mini copiar" (click)="copiar(d.texto_conteudo, '')" title="Copiar texto">📋</button>
                </div>
                <p class="disp-texto" [class.tachado]="d.status === 'revogado' || !d.ativo">{{ textoSemId(d) }}</p>
              </div>

              <!-- Anotações -->
              <div class="anotacoes">
                @for (dt of d.doutrinas; track dt.id) {
                  <div class="anot anot-doutrina" [id]="'doutrina-' + dt.id" [class.flash]="flashAnot() === 'doutrina-' + dt.id">
                    <div class="anot-cabec">
                      <span class="anot-tag">Doutrina</span>
                      <div class="anot-acoes">
                        <button class="mini copiar" (click)="copiar(dt.texto_generico || '', dt.citacao_abnt_gerada || '')" title="Copiar com citação ABNT">📋</button>
                        @if (podeExcluir(dt.usuario_id)) {
                          <button class="mini" (click)="excluir('doutrina', d, dt.id)" title="Excluir">✕</button>
                        }
                      </div>
                    </div>
                    @if (dt.texto_generico) { <p class="anot-texto">{{ dt.texto_generico }}</p> }
                    @if (dt.comentario_usuario) { <p class="anot-coment">{{ dt.comentario_usuario }}</p> }
                    @if (dt.citacao_abnt_gerada) { <p class="anot-cit">{{ dt.citacao_abnt_gerada }}</p> }
                  </div>
                }

                @for (j of d.jurisprudencias; track j.id) {
                  <div class="anot anot-juris" [id]="'juris-' + j.id" [class.flash]="flashAnot() === 'juris-' + j.id">
                    <div class="anot-cabec">
                      <span class="anot-tag">Jurisprudência</span>
                      <div class="anot-acoes">
                        <button class="mini copiar" (click)="copiar(j.texto_generico || '', j.citacao_abnt_gerada || '')" title="Copiar com citação ABNT">📋</button>
                        @if (podeExcluir(j.usuario_id)) {
                          <button class="mini" (click)="excluir('jurisprudencia', d, j.id)" title="Excluir">✕</button>
                        }
                      </div>
                    </div>
                    @if (j.texto_generico) { <p class="anot-texto">{{ j.texto_generico }}</p> }
                    @if (j.citacao_abnt_gerada) { <p class="anot-cit">{{ j.citacao_abnt_gerada }}</p> }
                  </div>
                }

                <!-- Links cruzados (comentários com prefixo) -->
                @for (lk of linksDe(d); track lk.comentarioId) {
                  <button class="link-cruzado" (click)="abrirReferencia(lk)">🔗 {{ lk.label }}</button>
                }

                <!-- Comentários pessoais reais -->
                @for (c of comentariosReais(d); track c.id) {
                  <div class="anot anot-coment-box">
                    <div class="anot-cabec">
                      <span class="anot-tag">Comentário pessoal</span>
                      <div class="anot-acoes">
                        <button class="mini copiar" (click)="copiar(c.texto, '')" title="Copiar">📋</button>
                        <button class="mini" (click)="excluir('comentario', d, c.id)" title="Excluir">✕</button>
                      </div>
                    </div>
                    <p class="anot-texto">{{ c.texto }}</p>
                  </div>
                }
              </div>
            </article>
          }
        </div>
      }
    }

    <!-- Modal: anotação (doutrina / jurisprudência / comentário) -->
    @if (modalAnotacao()) {
      <div class="modal-backdrop" (click)="fecharModais()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>
            @switch (tipoAtual()) {
              @case ('doutrina') { Nova doutrina }
              @case ('jurisprudencia') { Nova jurisprudência }
              @default { Novo comentário pessoal }
            }
            — {{ dispAtual()?.identificador }}
          </h3>

          @if (tipoAtual() === 'doutrina') {
            <label class="full">Trecho/citação<textarea rows="3" [(ngModel)]="fd.texto_generico"></textarea></label>
            <label class="full">Comentário pessoal sobre a doutrina<textarea rows="2" [(ngModel)]="fd.comentario_usuario"></textarea></label>
            <div class="grid-form">
              <label>Autor (SOBRENOME, Nome)<input [(ngModel)]="fd.autor" /></label>
              <label>Título da obra<input [(ngModel)]="fd.titulo_obra" /></label>
              <label>Edição<input [(ngModel)]="fd.edicao" placeholder="2" /></label>
              <label>Editora<input [(ngModel)]="fd.editora" /></label>
              <label>Cidade<input [(ngModel)]="fd.cidade" /></label>
              <label>Ano<input [(ngModel)]="fd.ano_publicacao" /></label>
              <label>Páginas<input [(ngModel)]="fd.paginas" placeholder="120-135" /></label>
            </div>
          } @else if (tipoAtual() === 'jurisprudencia') {
            <label class="full">Trecho/ementa<textarea rows="3" [(ngModel)]="fj.texto_generico"></textarea></label>
            <div class="grid-form">
              <label>Tribunal<input [(ngModel)]="fj.tribunal" placeholder="STF" /></label>
              <label>Tipo de decisão<input [(ngModel)]="fj.tipo_decisao" placeholder="ADI" /></label>
              <label>Nº do processo<input [(ngModel)]="fj.numero_processo" /></label>
              <label>Relator<input [(ngModel)]="fj.relator" /></label>
              <label>Órgão julgador<input [(ngModel)]="fj.orgao_julgador" placeholder="Tribunal Pleno" /></label>
              <label>Data de julgamento<input type="date" [(ngModel)]="fj.data_julgamento" /></label>
              <label>Veículo de publicação<input [(ngModel)]="fj.veiculo_publicacao" placeholder="DJe" /></label>
            </div>
          } @else {
            <label class="full">Comentário (visível somente para você)<textarea rows="4" [(ngModel)]="textoComentario"></textarea></label>
          }

          @if (alertaDuplicata()) {
            <div class="dup">
              <p>Já existe uma anotação equivalente neste dispositivo.</p>
              <div class="dup-acoes">
                <button class="btn-secundario" (click)="verExistente()">Ver cadastro existente</button>
                <button class="btn" (click)="salvarAnotacao(true)">Salvar mesmo assim</button>
              </div>
            </div>
          }
          @if (erroModal()) { <div class="erro">{{ erroModal() }}</div> }

          <div class="modal-acoes">
            <button class="btn-secundario" (click)="fecharModais()">Cancelar</button>
            @if (!alertaDuplicata()) {
              <button class="btn" (click)="salvarAnotacao(false)" [disabled]="processando()">
                {{ processando() ? 'Salvando…' : 'Salvar' }}
              </button>
            }
          </div>
        </div>
      </div>
    }

    <!-- Modal: link para outra norma -->
    @if (modalLink()) {
      <div class="modal-backdrop" (click)="fecharModais()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Link para outra norma — {{ dispAtual()?.identificador }}</h3>
          <label class="full">Norma de destino
            <select [(ngModel)]="linkLeiId" (ngModelChange)="aoSelecionarLeiDestino()">
              <option [ngValue]="null">— selecione —</option>
              @for (l of outrasLeis(); track l.id) {
                <option [ngValue]="l.id">{{ rotuloLei(l) }}</option>
              }
            </select>
          </label>
          @if (dispDestino().length > 0) {
            <label class="full">Dispositivo específico (opcional)
              <select [(ngModel)]="linkDispId" (ngModelChange)="atualizarLabelLink()">
                <option [ngValue]="null">— a norma inteira —</option>
                @for (d of dispDestino(); track d.id) {
                  <option [ngValue]="d.id">{{ d.identificador }}</option>
                }
              </select>
            </label>
          }
          <label class="full">Rótulo do link<input [(ngModel)]="linkLabel" /></label>
          @if (erroModal()) { <div class="erro">{{ erroModal() }}</div> }
          <div class="modal-acoes">
            <button class="btn-secundario" (click)="fecharModais()">Cancelar</button>
            <button class="btn" (click)="salvarLink()" [disabled]="processando() || !linkLeiId">
              {{ processando() ? 'Salvando…' : 'Salvar link' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: referência (abrir link cruzado) -->
    @if (modalRef()) {
      <div class="modal-backdrop" (click)="fecharModais()">
        <div class="modal modal-ref" (click)="$event.stopPropagation()">
          <div class="ref-cabec">
            <h3>{{ refLei() ? rotuloLei(refLei()!) : 'Referência' }}</h3>
            <button class="btn-secundario" (click)="abrirRefNovaAba()">Abrir em nova aba</button>
          </div>
          @if (refLei()?.ementa) { <p class="ementa">{{ refLei()!.ementa }}</p> }
          <div class="ref-disp">
            @for (d of refDispositivos(); track d.id) {
              <div class="disp-box" [id]="'ref-disp-' + d.id" [class.flash]="refFlashId() === d.id">
                <span class="disp-id">{{ d.identificador }}</span>
                <p class="disp-texto">{{ textoSemId(d) }}</p>
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Modal: editar dados da lei -->
    @if (modalEditarLei()) {
      <div class="modal-backdrop" (click)="fecharModais()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Editar dados da norma</h3>
          <div class="grid-form">
            <label>Tipo da norma<input [(ngModel)]="ml.tipo_norma" /></label>
            <label>Número<input [(ngModel)]="ml.numero" /></label>
            <label>Ano<input [(ngModel)]="ml.ano" /></label>
            <label>Data de publicação<input type="date" [(ngModel)]="ml.data_publicacao" /></label>
            <label class="full">Ementa<textarea rows="2" [(ngModel)]="ml.ementa"></textarea></label>
            <label>Veículo de publicação<input [(ngModel)]="ml.veiculo_publicacao" /></label>
            <label>Órgão emanador<input [(ngModel)]="ml.orgao_emanador" /></label>
            <label class="full">URL do repositório<input [(ngModel)]="ml.url_repositorio" /></label>
            <label class="full">URL de sincronização (Planalto)<input [(ngModel)]="ml.url_sincronizacao" /></label>
          </div>
          @if (erroModal()) { <div class="erro">{{ erroModal() }}</div> }
          <div class="modal-acoes">
            <button class="btn-secundario" (click)="fecharModais()">Cancelar</button>
            <button class="btn" (click)="salvarEditarLei()" [disabled]="processando()">
              {{ processando() ? 'Salvando…' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: editar dispositivo -->
    @if (modalDisp()) {
      <div class="modal-backdrop" (click)="fecharModais()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Editar dispositivo</h3>
          <div class="grid-form">
            <label>Tipo
              <select [(ngModel)]="edTipo">
                <option value="artigo">Artigo</option>
                <option value="paragrafo">Parágrafo</option>
                <option value="inciso">Inciso</option>
                <option value="alinea">Alínea</option>
                <option value="caput">Caput</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>Identificador<input [(ngModel)]="edIdentificador" /></label>
            <label>Status
              <select [(ngModel)]="edStatus">
                <option value="original">Original</option>
                <option value="alterado">Alterado</option>
                <option value="revogado">Revogado</option>
              </select>
            </label>
            <label class="full">Texto<textarea rows="4" [(ngModel)]="edTexto"></textarea></label>
          </div>
          @if (erroModal()) { <div class="erro">{{ erroModal() }}</div> }
          <div class="modal-acoes">
            <button class="btn-secundario" (click)="fecharModais()">Cancelar</button>
            <button class="btn" (click)="salvarDispositivo()" [disabled]="processando()">
              {{ processando() ? 'Salvando…' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (toast()) { <div class="toast">{{ toast() }}</div> }
  `,
  styles: [
    `
      .vazio { color: var(--texto-suave); font-style: italic; }
      .cabecalho-lei { display: flex; justify-content: space-between; gap: 1.2rem; padding: 1.3rem 1.5rem; margin-bottom: 1.2rem; }
      .ident .tipo { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--texto-suave); }
      .ident h1 { font-size: 1.5rem; margin: 0.2rem 0 0.4rem; }
      .ident .ementa { margin: 0 0 0.6rem; color: var(--texto); max-width: 60ch; }
      .meta-linha { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; font-size: 0.8rem; color: var(--texto-suave); }
      .acoes-lei { display: flex; flex-direction: column; gap: 0.5rem; align-items: stretch; min-width: 190px; }
      .acoes-lei .btn-secundario { text-align: center; padding: 0.5rem 0.9rem; }
      .link-rep { display: inline-block; }
      a.link-rep:hover { text-decoration: none; }

      .controles { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
      .filtro { flex: 1; }
      .check { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; white-space: nowrap; }
      .check input { width: auto; }

      .lista-disp { display: grid; gap: 1.1rem; }
      .disp { position: relative; padding-left: 1.6rem; }
      .disp.flash .disp-box { animation: flash 1.6s ease; }

      .add-wrap { position: absolute; top: 0; left: 0; z-index: 5; }
      .btn-add {
        width: 28px; height: 28px; border-radius: 50%;
        background: var(--azul); color: #fff; font-size: 1.1rem; line-height: 1;
        display: flex; align-items: center; justify-content: center;
      }
      .btn-add:hover { background: var(--azul-escuro); }
      .dropdown {
        position: absolute; top: 32px; left: 0; z-index: 50;
        background: var(--branco); border: 1px solid var(--borda); border-radius: 10px;
        box-shadow: 0 12px 32px rgba(16,24,40,0.18); padding: 0.35rem; display: grid; gap: 0.25rem; min-width: 220px;
      }
      .dd-item { text-align: left; padding: 0.5rem 0.7rem; font-size: 0.95rem; font-weight: 500; border-radius: 7px; border-left: 4px solid transparent; }
      .dd-doutrina { background: var(--doutrina-bg); border-left-color: var(--doutrina-borda); }
      .dd-juris { background: var(--juris-bg); border-left-color: var(--juris-borda); }
      .dd-coment { background: var(--comentario-bg); border-left-color: var(--comentario-borda); }
      .dd-link { background: rgba(58,90,120,0.10); border-left-color: var(--link-azul-ardosia); }

      .disp-box {
        background: var(--lei-bg); backdrop-filter: blur(6px);
        border-radius: var(--radius); padding: 0.9rem 1rem; position: relative;
      }
      .disp-box.revogado { opacity: 0.78; }
      .disp-cabec { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
      .disp-id { font-weight: 700; font-size: 0.92rem; }
      .disp-texto { margin: 0; line-height: 1.55; white-space: pre-wrap; }
      .disp-texto.tachado { text-decoration: line-through; }
      .badge { font-size: 0.68rem; font-weight: 700; padding: 0.12rem 0.5rem; border-radius: 999px; text-transform: uppercase; }
      .badge-revogado { background: rgba(179,38,30,0.14); color: var(--erro); }
      .badge-alterado { background: rgba(186,117,23,0.16); color: var(--juris-borda); }
      .mini { background: transparent; padding: 0.1rem 0.35rem; font-size: 0.85rem; opacity: 0.5; }
      .disp-box:hover .mini.copiar, .anot:hover .mini.copiar { opacity: 0.9; }
      .mini:hover { opacity: 1; }
      .disp-cabec .mini { margin-left: auto; }
      .disp-cabec .mini + .mini { margin-left: 0; }

      .anotacoes { display: grid; gap: 0.55rem; margin: 0.6rem 0 0; }
      .anot { border-radius: 10px; padding: 0.65rem 0.8rem; border-left: 4px solid transparent; }
      .anot.flash { animation: flash 1.6s ease; }
      .anot-doutrina { background: var(--doutrina-bg); border-left-color: var(--doutrina-borda); }
      .anot-juris { background: var(--juris-bg); border-left-color: var(--juris-borda); }
      .anot-coment-box { background: var(--comentario-bg); border-left-color: var(--comentario-borda); }
      .anot-cabec { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem; }
      .anot-tag { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--texto-suave); }
      .anot-acoes { display: flex; gap: 0.2rem; }
      .anot-texto { margin: 0.15rem 0; line-height: 1.5; }
      .anot-coment { margin: 0.15rem 0; font-style: italic; color: var(--texto-suave); }
      .anot-cit { margin: 0.3rem 0 0; font-size: 0.82rem; color: var(--texto-suave); border-top: 1px dashed var(--borda); padding-top: 0.3rem; }

      .link-cruzado {
        text-align: left; background: rgba(58,90,120,0.10); color: var(--link-azul-ardosia);
        border: 1px solid rgba(58,90,120,0.25); border-radius: 10px; padding: 0.55rem 0.8rem; font-weight: 600; font-size: 0.9rem;
      }
      .link-cruzado:hover { background: rgba(58,90,120,0.18); }

      .grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
      .grid-form label, label.full { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; font-weight: 500; }
      .grid-form .full, label.full { grid-column: 1 / -1; }
      .modal-acoes { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.1rem; }
      .erro { color: var(--erro); font-size: 0.85rem; margin-top: 0.5rem; }
      .dup { background: rgba(186,117,23,0.12); border: 1px solid var(--juris-borda); border-radius: 10px; padding: 0.7rem 0.8rem; margin-top: 0.8rem; }
      .dup p { margin: 0 0 0.5rem; font-size: 0.88rem; }
      .dup-acoes { display: flex; gap: 0.5rem; }

      .modal-ref { max-width: 760px; }
      .ref-cabec { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
      .ref-disp { display: grid; gap: 0.6rem; margin-top: 0.8rem; max-height: 60vh; overflow-y: auto; }
      .ref-disp .disp-box { background: var(--lei-bg); }
    `,
  ],
})
export class LeiComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  auth = inject(AuthService);

  leiId = 0;
  lei = signal<Lei | null>(null);
  dispositivos = signal<Dispositivo[]>([]);
  carregando = signal(true);
  sincronizando = signal(false);

  filtro = '';
  mostrarInativos = false;

  dropdownAberto = signal<number | null>(null);
  flashId = signal<number | null>(null);
  flashAnot = signal<string | null>(null);
  toast = signal('');

  // Modais
  modalAnotacao = signal(false);
  modalLink = signal(false);
  modalRef = signal(false);
  modalEditarLei = signal(false);
  modalDisp = signal(false);
  processando = signal(false);
  erroModal = signal('');

  tipoAtual = signal<TipoAnotacao>('doutrina');
  dispAtual = signal<Dispositivo | null>(null);
  alertaDuplicata = signal(false);
  duplicataId = signal<number | null>(null);

  fd: FormDoutrina = this.fdVazio();
  fj: FormJuris = this.fjVazio();
  textoComentario = '';

  // Link
  outrasLeis = signal<Lei[]>([]);
  dispDestino = signal<Dispositivo[]>([]);
  linkLeiId: number | null = null;
  linkDispId: number | null = null;
  linkLabel = '';

  // Referência
  refLei = signal<Lei | null>(null);
  refDispositivos = signal<Dispositivo[]>([]);
  refFlashId = signal<number | null>(null);

  // Editar lei
  ml: MetaLeiForm = this.mlVazio();

  // Editar dispositivo
  dispEdId = 0;
  edTipo = 'artigo';
  edIdentificador = '';
  edTexto = '';
  edStatus = 'original';

  dispositivosFiltrados = computed(() => {
    const termo = this.filtro.trim().toLowerCase();
    return this.dispositivos().filter((d) => {
      const inativo = d.status === 'revogado' || !d.ativo;
      if (inativo && !this.mostrarInativos) return false;
      if (!termo) return true;
      return (d.identificador + ' ' + d.texto_conteudo).toLowerCase().includes(termo);
    });
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      this.leiId = Number(p.get('id'));
      this.carregar();
    });
  }

  private fdVazio(): FormDoutrina {
    return { texto_generico: '', comentario_usuario: '', autor: '', titulo_obra: '', edicao: '', editora: '', cidade: '', ano_publicacao: '', paginas: '' };
  }
  private fjVazio(): FormJuris {
    return { texto_generico: '', tribunal: '', tipo_decisao: '', numero_processo: '', relator: '', orgao_julgador: '', data_julgamento: '', veiculo_publicacao: '' };
  }
  private mlVazio(): MetaLeiForm {
    return { tipo_norma: '', numero: '', ano: '', ementa: '', data_publicacao: '', veiculo_publicacao: '', orgao_emanador: '', url_repositorio: '', url_sincronizacao: '' };
  }

  carregar(): void {
    this.carregando.set(true);
    this.api.obterLei(this.leiId).subscribe({
      next: (l) => {
        this.lei.set(l);
        this.api.listarDispositivos(this.leiId).subscribe((ds) => {
          this.dispositivos.set(ds);
          this.carregando.set(false);
          this.tratarQueryDisp();
        });
      },
      error: () => {
        this.lei.set(null);
        this.carregando.set(false);
      },
    });
  }

  private tratarQueryDisp(): void {
    const disp = Number(this.route.snapshot.queryParamMap.get('disp'));
    if (disp) {
      setTimeout(() => this.scrollFlash(disp), 150);
    }
  }

  private scrollFlash(dispId: number): void {
    const el = document.getElementById('disp-' + dispId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.flashId.set(dispId);
      setTimeout(() => this.flashId.set(null), 1700);
    }
  }

  rotuloLei(l: Lei): string {
    const partes = [l.tipo_norma];
    if (l.numero) partes.push('nº ' + l.numero);
    if (l.ano) partes.push('/' + l.ano);
    return partes.join(' ');
  }

  podeExcluir(usuarioId: number): boolean {
    return this.auth.ehAdmin() || this.auth.usuario()?.id === usuarioId;
  }

  // ---------------------------------------------------------------------------
  // textoSemId — remove o identificador do início do texto_conteudo
  // ---------------------------------------------------------------------------
  textoSemId(d: Dispositivo): string {
    let texto = (d.texto_conteudo || '').trim();
    const id = (d.identificador || '').trim();
    if (!id) return texto;

    // Escapa o identificador para regex e tolera variações de pontuação/espaço.
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    const re = new RegExp('^' + esc + '\\s*[\\.\\-–—:)º°ª]*\\s*', 'i');
    texto = texto.replace(re, '');

    // Fallback: padrões clássicos do Planalto no início (Art. 1º, § 2º, I -, a)).
    texto = texto.replace(
      /^(art(igo)?\.?\s*\d+[ºo]?(-[A-Z])?|§\s*\d+[ºo]?|par[áa]grafo\s+([uú]nico|\d+[ºo]?)|[IVXLCDM]+\s*[-–.)]|[a-z]\))\s*[\.\-–—:)]*\s*/i,
      '',
    );
    return texto.trim();
  }

  // ---------------------------------------------------------------------------
  // Links cruzados (comentários com prefixo "🔗 [LINK] {label} | lei:{id}|disp:{id}")
  // ---------------------------------------------------------------------------
  private ehLink(c: Comentario): boolean {
    return (c.texto || '').startsWith('🔗 [LINK]');
  }

  linksDe(d: Dispositivo): LinkParseado[] {
    return d.comentarios.filter((c) => this.ehLink(c)).map((c) => this.parseLink(c));
  }

  comentariosReais(d: Dispositivo): Comentario[] {
    return d.comentarios.filter((c) => !this.ehLink(c));
  }

  private parseLink(c: Comentario): LinkParseado {
    // formato: 🔗 [LINK] {label} | lei:{id}|disp:{id}
    const corpo = c.texto.replace(/^🔗 \[LINK\]\s*/, '');
    const sep = corpo.lastIndexOf('|');
    let label = corpo;
    let leiId: number | null = null;
    let dispId: number | null = null;
    const mLei = corpo.match(/lei:(\d+)/);
    const mDisp = corpo.match(/disp:(\d+)/);
    if (mLei) leiId = Number(mLei[1]);
    if (mDisp) dispId = Number(mDisp[1]);
    const corte = corpo.indexOf(' | lei:');
    if (corte >= 0) label = corpo.slice(0, corte).trim();
    else if (sep >= 0) label = corpo.slice(0, sep).trim();
    return { comentarioId: c.id, label, leiId, dispId };
  }

  // ---------------------------------------------------------------------------
  // Dropdown / abrir modais de anotação
  // ---------------------------------------------------------------------------
  alternarDropdown(dispId: number): void {
    this.dropdownAberto.set(this.dropdownAberto() === dispId ? null : dispId);
  }

  abrirAnotacao(tipo: TipoAnotacao, d: Dispositivo): void {
    this.dropdownAberto.set(null);
    this.dispAtual.set(d);
    this.tipoAtual.set(tipo);
    this.erroModal.set('');
    this.alertaDuplicata.set(false);
    this.duplicataId.set(null);
    if (tipo === 'link') {
      this.abrirLinkModal(d);
      return;
    }
    this.fd = this.fdVazio();
    this.fj = this.fjVazio();
    this.textoComentario = '';
    this.modalAnotacao.set(true);
  }

  fecharModais(): void {
    this.modalAnotacao.set(false);
    this.modalLink.set(false);
    this.modalRef.set(false);
    this.modalEditarLei.set(false);
    this.modalDisp.set(false);
    this.alertaDuplicata.set(false);
  }

  salvarAnotacao(forcar: boolean): void {
    const d = this.dispAtual();
    if (!d) return;
    this.erroModal.set('');
    this.processando.set(true);

    const tipo = this.tipoAtual();
    if (tipo === 'doutrina') {
      this.api.criarDoutrina(d.id, { ...this.fd, forcar }).subscribe({
        next: () => this.aposSalvarAnotacao(d),
        error: (err) => this.tratarErroAnotacao(err),
      });
    } else if (tipo === 'jurisprudencia') {
      this.api.criarJurisprudencia(d.id, { ...this.fj, forcar }).subscribe({
        next: () => this.aposSalvarAnotacao(d),
        error: (err) => this.tratarErroAnotacao(err),
      });
    } else {
      this.api.criarComentario(d.id, this.textoComentario).subscribe({
        next: () => this.aposSalvarAnotacao(d),
        error: (err) => this.tratarErroAnotacao(err),
      });
    }
  }

  private aposSalvarAnotacao(d: Dispositivo): void {
    this.processando.set(false);
    this.fecharModais();
    this.recarregarDispositivos();
    this.mostrarToast('Anotação salva.');
  }

  private tratarErroAnotacao(err: any): void {
    this.processando.set(false);
    const detail: string = err?.error?.detail || '';
    if (err?.status === 409 && detail.startsWith('DUPLICATA:')) {
      this.duplicataId.set(Number(detail.split(':')[1]));
      this.alertaDuplicata.set(true);
    } else {
      this.erroModal.set(detail || 'Falha ao salvar a anotação.');
    }
  }

  verExistente(): void {
    const id = this.duplicataId();
    const tipo = this.tipoAtual();
    this.fecharModais();
    if (!id) return;
    const alvo = tipo === 'doutrina' ? 'doutrina-' + id : 'juris-' + id;
    setTimeout(() => {
      const el = document.getElementById(alvo);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.flashAnot.set(alvo);
        setTimeout(() => this.flashAnot.set(null), 1700);
      }
    }, 120);
  }

  excluir(tipo: 'doutrina' | 'jurisprudencia' | 'comentario', d: Dispositivo, id: number): void {
    const obs =
      tipo === 'doutrina'
        ? this.api.excluirDoutrina(d.id, id)
        : tipo === 'jurisprudencia'
          ? this.api.excluirJurisprudencia(d.id, id)
          : this.api.excluirComentario(d.id, id);
    obs.subscribe({
      next: () => {
        this.recarregarDispositivos();
        this.mostrarToast('Anotação excluída.');
      },
      error: (err) => this.mostrarToast(err?.error?.detail || 'Falha ao excluir.'),
    });
  }

  private recarregarDispositivos(): void {
    this.api.listarDispositivos(this.leiId).subscribe((ds) => this.dispositivos.set(ds));
  }

  // ---------------------------------------------------------------------------
  // Cópia com citação ABNT
  // ---------------------------------------------------------------------------
  copiar(texto: string, citacao: string): void {
    const conteudo = citacao ? `${texto}\n\n${citacao}` : texto;
    navigator.clipboard?.writeText(conteudo).then(
      () => this.mostrarToast('Copiado para a área de transferência.'),
      () => this.mostrarToast('Não foi possível copiar.'),
    );
  }

  private mostrarToast(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 2200);
  }

  // ---------------------------------------------------------------------------
  // Link para outra norma
  // ---------------------------------------------------------------------------
  private abrirLinkModal(d: Dispositivo): void {
    this.linkLeiId = null;
    this.linkDispId = null;
    this.linkLabel = '';
    this.dispDestino.set([]);
    this.api.listarLeis().subscribe((ls) => this.outrasLeis.set(ls.filter((l) => l.id !== this.leiId)));
    this.modalLink.set(true);
  }

  aoSelecionarLeiDestino(): void {
    this.linkDispId = null;
    this.dispDestino.set([]);
    if (!this.linkLeiId) {
      this.atualizarLabelLink();
      return;
    }
    this.api.listarDispositivos(this.linkLeiId).subscribe((ds) => {
      this.dispDestino.set(ds);
      this.atualizarLabelLink();
    });
  }

  atualizarLabelLink(): void {
    const lei = this.outrasLeis().find((l) => l.id === this.linkLeiId);
    if (!lei) {
      this.linkLabel = '';
      return;
    }
    const disp = this.dispDestino().find((d) => d.id === this.linkDispId);
    this.linkLabel = disp
      ? `Veja também o ${disp.identificador} da ${this.rotuloLei(lei)}`
      : `Veja também a ${this.rotuloLei(lei)}`;
  }

  salvarLink(): void {
    const d = this.dispAtual();
    if (!d || !this.linkLeiId) return;
    this.processando.set(true);
    const dispParte = this.linkDispId ? `disp:${this.linkDispId}` : 'disp:';
    const texto = `🔗 [LINK] ${this.linkLabel} | lei:${this.linkLeiId}|${dispParte}`;
    this.api.criarComentario(d.id, texto).subscribe({
      next: () => {
        this.processando.set(false);
        this.fecharModais();
        this.recarregarDispositivos();
        this.mostrarToast('Link criado.');
      },
      error: (err) => {
        this.processando.set(false);
        this.erroModal.set(err?.error?.detail || 'Falha ao criar o link.');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Abrir referência (modal com a norma vinculada)
  // ---------------------------------------------------------------------------
  abrirReferencia(lk: LinkParseado): void {
    if (!lk.leiId) return;
    this.refLei.set(null);
    this.refDispositivos.set([]);
    this.refFlashId.set(null);
    this.modalRef.set(true);
    this.api.obterLei(lk.leiId).subscribe((l) => this.refLei.set(l));
    this.api.listarDispositivos(lk.leiId).subscribe((ds) => {
      this.refDispositivos.set(ds);
      if (lk.dispId) {
        setTimeout(() => {
          const el = document.getElementById('ref-disp-' + lk.dispId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.refFlashId.set(lk.dispId);
            setTimeout(() => this.refFlashId.set(null), 1700);
          }
        }, 150);
      }
    });
  }

  abrirRefNovaAba(): void {
    const l = this.refLei();
    if (!l) return;
    window.open('/lei/' + l.id, '_blank');
  }

  // ---------------------------------------------------------------------------
  // Editar dados da lei
  // ---------------------------------------------------------------------------
  abrirEditarLei(): void {
    const l = this.lei();
    if (!l) return;
    this.erroModal.set('');
    this.ml = {
      tipo_norma: l.tipo_norma || '',
      numero: l.numero || '',
      ano: l.ano ? String(l.ano) : '',
      ementa: l.ementa || '',
      data_publicacao: l.data_publicacao || '',
      veiculo_publicacao: l.veiculo_publicacao || '',
      orgao_emanador: l.orgao_emanador || '',
      url_repositorio: l.url_repositorio || '',
      url_sincronizacao: l.url_sincronizacao || '',
    };
    this.modalEditarLei.set(true);
  }

  salvarEditarLei(): void {
    this.processando.set(true);
    this.erroModal.set('');
    const body: Partial<Lei> = {
      tipo_norma: this.ml.tipo_norma.trim(),
      numero: this.ml.numero.trim() || null,
      ano: this.ml.ano ? Number(this.ml.ano) : null,
      ementa: this.ml.ementa.trim() || null,
      data_publicacao: this.ml.data_publicacao || null,
      veiculo_publicacao: this.ml.veiculo_publicacao.trim() || null,
      orgao_emanador: this.ml.orgao_emanador.trim() || null,
      url_repositorio: this.ml.url_repositorio.trim() || null,
      url_sincronizacao: this.ml.url_sincronizacao.trim() || null,
    };
    this.api.editarLei(this.leiId, body).subscribe({
      next: (l) => {
        this.lei.set(l);
        this.processando.set(false);
        this.fecharModais();
        this.mostrarToast('Dados atualizados.');
      },
      error: (err) => {
        this.processando.set(false);
        this.erroModal.set(err?.error?.detail || 'Falha ao salvar.');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Sincronizar
  // ---------------------------------------------------------------------------
  sincronizar(): void {
    this.sincronizando.set(true);
    this.api.sincronizar(this.leiId).subscribe({
      next: (l) => {
        this.lei.set(l);
        this.sincronizando.set(false);
        this.recarregarDispositivos();
        this.mostrarToast('Sincronização concluída.');
      },
      error: (err) => {
        this.sincronizando.set(false);
        this.mostrarToast(err?.error?.detail || 'Falha na sincronização.');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Editar dispositivo
  // ---------------------------------------------------------------------------
  abrirEditarDispositivo(d: Dispositivo): void {
    this.erroModal.set('');
    this.dispEdId = d.id;
    this.edTipo = d.tipo;
    this.edIdentificador = d.identificador;
    this.edTexto = d.texto_conteudo;
    this.edStatus = d.status;
    this.modalDisp.set(true);
  }

  salvarDispositivo(): void {
    this.processando.set(true);
    this.erroModal.set('');
    const body: Partial<Dispositivo> = {
      tipo: this.edTipo as Dispositivo['tipo'],
      identificador: this.edIdentificador.trim(),
      texto_conteudo: this.edTexto,
      status: this.edStatus as Dispositivo['status'],
    };
    this.api.editarDispositivo(this.leiId, this.dispEdId, body).subscribe({
      next: () => {
        this.processando.set(false);
        this.fecharModais();
        this.recarregarDispositivos();
        this.mostrarToast('Dispositivo atualizado.');
      },
      error: (err) => {
        this.processando.set(false);
        this.erroModal.set(err?.error?.detail || 'Falha ao salvar o dispositivo.');
      },
    });
  }
}
