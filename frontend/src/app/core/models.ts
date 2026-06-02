export type Papel = 'admin' | 'editor' | 'viewer';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  criado_em: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}

export interface Lei {
  id: number;
  tipo_norma: string;
  numero?: string | null;
  ano?: number | null;
  ementa?: string | null;
  data_publicacao?: string | null;
  veiculo_publicacao?: string | null;
  edicao_dou?: string | null;
  orgao_emanador?: string | null;
  url_sincronizacao?: string | null;
  url_repositorio?: string | null;
  cadastro_manual: boolean;
  data_ultima_sincronizacao?: string | null;
  data_ultima_atualizacao?: string | null;
  criado_em: string;
}

export interface Doutrina {
  id: number;
  dispositivo_id: number;
  usuario_id: number;
  texto_generico?: string | null;
  comentario_usuario?: string | null;
  autor?: string | null;
  titulo_obra?: string | null;
  edicao?: string | null;
  editora?: string | null;
  cidade?: string | null;
  ano_publicacao?: string | null;
  paginas?: string | null;
  citacao_abnt_gerada?: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Jurisprudencia {
  id: number;
  dispositivo_id: number;
  usuario_id: number;
  texto_generico?: string | null;
  tribunal?: string | null;
  tipo_decisao?: string | null;
  numero_processo?: string | null;
  relator?: string | null;
  orgao_julgador?: string | null;
  data_julgamento?: string | null;
  veiculo_publicacao?: string | null;
  citacao_abnt_gerada?: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Comentario {
  id: number;
  dispositivo_id: number;
  usuario_id: number;
  texto: string;
  criado_em: string;
  atualizado_em: string;
}

export type StatusDispositivo = 'original' | 'alterado' | 'revogado';
export type TipoDispositivo = 'artigo' | 'paragrafo' | 'inciso' | 'alinea' | 'caput' | 'outro';

export interface Dispositivo {
  id: number;
  lei_id: number;
  versao_id?: number | null;
  tipo: TipoDispositivo;
  identificador: string;
  texto_conteudo: string;
  ordem: number;
  ativo: boolean;
  status: StatusDispositivo;
  data_inativacao?: string | null;
  doutrinas: Doutrina[];
  jurisprudencias: Jurisprudencia[];
  comentarios: Comentario[];
}

export interface DispositivoParsePreview {
  tipo: string;
  identificador: string;
  texto_conteudo: string;
  ordem: number;
}

export interface AtualizacaoRecente {
  tipo: 'doutrina' | 'jurisprudencia' | 'comentario';
  anotacao_id: number;
  dispositivo_id: number;
  lei_id: number;
  lei_titulo: string;
  dispositivo_identificador: string;
  resumo: string;
  criado_em: string;
}
