# DynamoDB Explorer · LocalStack

Interface web para navegar e gerenciar as tabelas DynamoDB do LocalStack, no estilo do AWS Console, com melhorias de visualização.

**Stack:** Vite · React 19 · TypeScript · Tailwind CSS v4 · lucide-react · AWS SDK v3

## Como rodar

### Docker (recomendado)

```bash
docker compose up -d --build   # http://localhost:8080
```

A imagem compila o app e serve com nginx. O nginx também faz o proxy de `/localstack` para o LocalStack do host (`http://host.docker.internal:4566`), então não há problema de CORS. Para apontar para outro endereço, defina `DOCKER_LOCALSTACK_URL` antes do `up`.

Se você ainda não tiver um LocalStack, suba também o do compose. A imagem `localstack/localstack:latest` exige um token de licença:

```bash
# PowerShell: $env:LOCALSTACK_AUTH_TOKEN = "<seu token>"; $env:DOCKER_LOCALSTACK_URL = "http://localstack:4566"
docker compose --profile localstack up -d --build
```

### Desenvolvimento

Requisitos: Node 20.19+ (com fnm: `fnm use 24`).

```bash
npm install
npm run dev          # http://localhost:5173
```

O proxy do Vite (`/localstack` → `LOCALSTACK_URL`, padrão `http://localhost:4566`) cumpre o mesmo papel do nginx. Para mudar o endereço, crie um `.env` a partir do `.env.example`.

> Os dois proxies removem o cabeçalho `Origin`. Sem isso, o LocalStack aplica a política de CORS dele e responde **403** para origens como `localhost:8080`.

## Conexões (LocalStack e AWS)

O seletor no topo da barra lateral troca de conexão. O **LocalStack** padrão (`/localstack`, `us-east-1`, credenciais `test`) sempre existe e não pode ser excluído, só editado ou restaurado.

- **Adicionar conta AWS**: informe a região e as credenciais. O botão **Colar credenciais** aceita a saída de `aws configure export-credentials --profile <perfil>` e de `aws sts assume-role`, ou variáveis `AWS_*`.
  - As chamadas vão direto do navegador para `dynamodb.<região>.amazonaws.com`.
  - Conexões AWS começam em **somente leitura**, que bloqueia criar, editar e excluir itens, tabelas, índices e TTL. Dá para desligar na própria conexão.
  - A Secret Key e o Session Token ficam só na sessão do navegador (`sessionStorage`), a menos que você marque **Lembrar a secret**. Nesse caso são salvos em texto puro no `localStorage`.
  - Prefira credenciais temporárias (SSO/STS) ou um usuário IAM com permissões mínimas.
- **Outro LocalStack / DynamoDB Local**: informe o endpoint. URLs diretas precisam aceitar CORS. O caminho `/localstack` usa o proxy do app.
- **Testar conexão** faz um `ListTables` com os dados do formulário antes de salvar.

### Dados de exemplo (opcional)

```bash
npm run seed            # cria Users, Orders, Products e DeviceEvents com dados variados
npm run seed -- --reset # exclui e recria essas tabelas
```

> O seed escreve no LocalStack configurado em `LOCALSTACK_URL`. Ele não toca em tabelas com outros nomes.

## Funcionalidades

**Como no AWS Console**
- Lista de tabelas com status, chaves, índices, contagem de itens, tamanho e modo de capacidade
- Explorar itens com **Scan** ou **Query** na tabela ou em qualquer GSI/LSI
  - condições da chave de classificação (`=`, `<`, `<=`, `>`, `>=`, `between`, `begins_with`) e ordem decrescente
  - filtros múltiplos (`=`, `<>`, comparações, `between`, `begins_with`, `contains`, `not contains`, `exists`, `not exists`) para String, Number, Boolean, Null e Binary
  - projeção de atributos e paginação (próxima/anterior)
- Criar, editar, duplicar e excluir itens (inclusive exclusão em lote)
- Criar e excluir tabelas (com GSIs, sob demanda ou provisionada), criar e excluir GSIs, ativar/desativar TTL
- Detalhes da tabela: ARN, datas, streams, classe, atributos definidos

**Melhorias**
- Grid com colunas dinâmicas, chaves fixadas à esquerda, cabeçalho fixo, colunas redimensionáveis, mostrar/ocultar colunas (salvo por tabela), ordenação local e densidade compacta/confortável
- Células por tipo: badges de tipo, booleanos coloridos, `null` esmaecido, prévia de mapas e listas e detecção de datas (ISO e epoch) com dica de data legível
- Painel lateral do item com **árvore** navegável, **JSON** e **DynamoDB JSON**, navegação entre itens e cópia
- Editor com numeração de linhas, validação em tempo real e alternância JSON ↔ DynamoDB JSON. No JSON comum, os tipos que JSON não representa (sets, binários, números grandes) são preservados a partir do item original
- Scans com filtro continuam lendo automaticamente até preencher a página, em vez de devolver páginas vazias
- **Esquema inferido**: tipos e % de presença de cada atributo a partir de uma amostra
- Estatísticas de cada consulta: itens retornados, itens lidos, tempo, RCU consumida e número de requisições
- Visualização das expressões geradas (`KeyCondition`, `Filter` e `Projection`)
- Busca rápida na página, com destaque do termo
- Exportação em CSV, JSON ou DynamoDB JSON (da página ou só dos itens selecionados)
- Tema claro/escuro/sistema e paleta de comandos com **Ctrl+K** para trocar de tabela
- Menu lateral redimensionável: arraste a borda direita (200–520 px), dê duplo clique para restaurar a largura padrão e arraste até o fim para recolher. **Ctrl+B** ou o botão no topo alternam entre o menu completo e o modo só ícones (com dicas ao passar o mouse). A largura e o estado ficam salvos no navegador.
- Atualização automática do status enquanto tabelas ou índices estão em `CREATING`/`UPDATING`

## Estrutura

```
src/
  lib/          cliente AWS, chamadas de API, montagem de expressões, conversões de tipos e formatação
  hooks/        configurações, lista de tabelas, rota por hash e toasts
  components/
    layout/     barra lateral, barra superior, configurações e paleta de comandos
    tables/     painel, visão da tabela, visão geral, índices e diálogos de criação
    items/      explorador, construtor de consultas, grid, painel do item, editor e JSON
    ui/         componentes base (botões, formulários, diálogos etc.)
scripts/seed.mjs
```
