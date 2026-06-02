import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AtualizacaoRecente,
  Comentario,
  Dispositivo,
  DispositivoParsePreview,
  Doutrina,
  Jurisprudencia,
  Lei,
  Usuario,
} from './models';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ---- Usuários ----
  listarUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${API}/auth/usuarios`);
  }
  criarUsuario(body: { nome: string; email: string; senha: string; papel: string }): Observable<Usuario> {
    return this.http.post<Usuario>(`${API}/auth/usuarios`, body);
  }
  alterarAtivo(id: number, ativo: boolean): Observable<Usuario> {
    return this.http.patch<Usuario>(`${API}/auth/usuarios/${id}/ativo`, { ativo });
  }

  // ---- Leis ----
  listarLeis(): Observable<Lei[]> {
    return this.http.get<Lei[]>(`${API}/leis`);
  }
  obterLei(id: number): Observable<Lei> {
    return this.http.get<Lei>(`${API}/leis/${id}`);
  }
  criarLeiManual(metadados: Partial<Lei>): Observable<Lei> {
    return this.http.post<Lei>(`${API}/leis`, metadados);
  }
  criarLeiManualCompleto(metadados: Partial<Lei>, texto: string): Observable<Lei> {
    return this.http.post<Lei>(`${API}/leis/manual-completo`, { metadados, texto });
  }
  parseTexto(texto: string): Observable<DispositivoParsePreview[]> {
    return this.http.post<DispositivoParsePreview[]>(`${API}/leis/parse-texto`, { texto });
  }
  importarUrl(url: string): Observable<Lei> {
    return this.http.post<Lei>(`${API}/leis/importar-url`, { url });
  }
  editarLei(id: number, body: Partial<Lei>): Observable<Lei> {
    return this.http.patch<Lei>(`${API}/leis/${id}`, body);
  }
  excluirLei(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/leis/${id}`);
  }
  sincronizar(id: number): Observable<Lei> {
    return this.http.post<Lei>(`${API}/leis/${id}/sincronizar`, {});
  }

  // ---- Dispositivos ----
  listarDispositivos(leiId: number): Observable<Dispositivo[]> {
    return this.http.get<Dispositivo[]>(`${API}/leis/${leiId}/dispositivos`);
  }
  criarDispositivo(leiId: number, body: Partial<Dispositivo>): Observable<Dispositivo> {
    return this.http.post<Dispositivo>(`${API}/leis/${leiId}/dispositivos`, body);
  }
  editarDispositivo(leiId: number, id: number, body: Partial<Dispositivo>): Observable<Dispositivo> {
    return this.http.patch<Dispositivo>(`${API}/leis/${leiId}/dispositivos/${id}`, body);
  }

  // ---- Anotações ----
  criarDoutrina(dispId: number, body: Partial<Doutrina> & { forcar?: boolean }): Observable<Doutrina> {
    return this.http.post<Doutrina>(`${API}/dispositivos/${dispId}/doutrinas`, body);
  }
  excluirDoutrina(dispId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${API}/dispositivos/${dispId}/doutrinas/${id}`);
  }
  criarJurisprudencia(
    dispId: number,
    body: Partial<Jurisprudencia> & { forcar?: boolean },
  ): Observable<Jurisprudencia> {
    return this.http.post<Jurisprudencia>(`${API}/dispositivos/${dispId}/jurisprudencias`, body);
  }
  excluirJurisprudencia(dispId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${API}/dispositivos/${dispId}/jurisprudencias/${id}`);
  }
  criarComentario(dispId: number, texto: string): Observable<Comentario> {
    return this.http.post<Comentario>(`${API}/dispositivos/${dispId}/comentarios`, { texto });
  }
  excluirComentario(dispId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${API}/dispositivos/${dispId}/comentarios/${id}`);
  }

  // ---- Misc ----
  atualizacoesRecentes(): Observable<AtualizacaoRecente[]> {
    return this.http.get<AtualizacaoRecente[]>(`${API}/atualizacoes-recentes`);
  }
}
