# Codex

**Ferramenta de gestão de conhecimento legislativo** para operadores do direito
brasileiro (advogados, procuradores, professores). O Codex permite vincular
**doutrina**, **jurisprudência** e **comentários pessoais** diretamente a
dispositivos específicos de normas, com **sincronização automática** com o
Planalto.gov.br e **citações ABNT** geradas automaticamente.

---

## Arquitetura

| Camada    | Tecnologia                                         |
|-----------|----------------------------------------------------|
| Frontend  | Angular 17 (standalone components) + SCSS          |
| Backend   | Python 3.12 / FastAPI / SQLAlchemy 2.0             |
| Banco     | PostgreSQL 16                                      |
| Proxy     | Nginx (serve o Angular e faz proxy de `/api/`)     |
| Scheduler | APScheduler (sincronização diária às 03h BRT)      |
| Deploy    | Docker Compose                                     |

O frontend (Nginx) é o **único serviço com porta exposta** (padrão `4200`). O
backend permanece acessível apenas pela rede interna `lexbase-net`; o Nginx faz o
proxy de `/api/` para `http://backend:8000`.

---

## Execução rápida

```bash
cp .env.example .env      # edite as senhas e a SECRET_KEY
docker compose up -d --build
```

Acesse: **http://localhost:4200**

No primeiro startup, o backend cria automaticamente o usuário administrador
definido em `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Faça login com essas credenciais e,
em **Administração**, cadastre os demais usuários (não há auto-registro público).

---

## Variáveis de ambiente (`.env`)

| Variável         | Descrição                                                        |
|------------------|------------------------------------------------------------------|
| `APPDATA_PATH`   | Diretório base do volume do PostgreSQL                           |
| `APP_PORT`       | Porta pública do frontend (padrão 4200)                          |
| `DB_NAME`        | Nome do banco (padrão `lexbase`)                                 |
| `DB_USER`        | Usuário do banco (padrão `lexbase`)                              |
| `DB_PASSWORD`    | Senha do banco **(obrigatória)**                                 |
| `SECRET_KEY`     | Chave de assinatura JWT **(obrigatória)** — `openssl rand -hex 32` |
| `TOKEN_EXPIRE`   | Expiração do token em minutos (padrão 480)                       |
| `ADMIN_EMAIL`    | E-mail do admin inicial                                          |
| `ADMIN_PASSWORD` | Senha do admin inicial **(obrigatória)**                         |
| `ADMIN_NOME`     | Nome do admin inicial                                            |
| `TIMEZONE`       | Fuso do scheduler (padrão `America/Porto_Velho`)                 |

---

## Funcionalidades

- **Autenticação JWT** com três perfis: `admin` > `editor` > `viewer`.
  Cadastro de usuários somente pelo admin.
- **Cadastro de legislação em dois modos:**
  - *Importação via URL* do Planalto, com detecção de charset (ISO-8859-1) e
    extração automática de dispositivos.
  - *Cadastro manual em dois passos*: metadados ABNT e colagem do texto, com
    parse automático e pré-visualização dos dispositivos.
- **Versionamento**: cada sincronização com mudança gera uma nova versão; os
  dispositivos removidos são inativados (nunca excluídos) e as anotações
  permanecem vinculadas mesmo após revogação.
- **Anotações por dispositivo** (ilimitadas): doutrina (azul), jurisprudência
  (dourado) e comentário pessoal (bordô, visível apenas ao autor), com detecção
  de duplicatas e citação ABNT automática.
- **Links cruzados** entre normas, renderizados como botão que abre a norma
  referenciada com rolagem até o dispositivo.
- **Cópia com citação ABNT** (texto + citação) em um clique.
- **Sincronização diária automática** às 03h (fuso configurável) e sincronização
  manual sob demanda.

---

## Estrutura do projeto

```
codex/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py            # FastAPI + lifespan (create_all, admin, scheduler)
│       ├── config.py          # Settings (pydantic-settings)
│       ├── database.py        # engine, SessionLocal, Base
│       ├── models.py          # modelos SQLAlchemy 2.0
│       ├── schemas.py         # schemas Pydantic v2
│       ├── security.py        # hash de senha + JWT
│       ├── deps.py            # dependências de autorização por papel
│       ├── routers/           # auth, leis, dispositivos, anotacoes, misc
│       └── services/          # planalto, parser, sync, abnt, scheduler, activity
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── angular.json
    └── src/
        ├── styles.scss        # design system (variáveis CSS)
        └── app/
            ├── core/          # models, api.service, auth.service, guards
            ├── shell/         # navbar (rotas autenticadas)
            └── pages/         # login, home, lei, admin
```

---

## Observações técnicas

- **Migrações:** o projeto **não usa Alembic**. As tabelas são criadas via
  `Base.metadata.create_all()` no startup. Colunas adicionadas após o deploy
  inicial exigem migração manual via `psql`.
- **Dependências fixadas:** `bcrypt==4.0.1` é mantido fixo porque versões
  superiores quebram o `passlib` com `ValueError` no startup.
- **Importação restrita** ao domínio `planalto.gov.br`.

---

## Desenvolvimento local (sem Docker)

**Backend:**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# configure as variáveis de ambiente (DB, SECRET_KEY, ADMIN_*)
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm start   # http://localhost:4200 (faça proxy de /api para o backend)
```
