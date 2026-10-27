# Contribuindo

Obrigado por ajudar. Este guia explica como preparar o ambiente, quais convenções o projeto segue e o que checar antes de abrir um PR.

## Ambiente

1. Instale o Node 20.19+ (recomendado: `fnm use 24`) e o Docker.
2. Suba um LocalStack com DynamoDB. Pode ser um que você já tenha ou o do compose:
   ```bash
   docker compose --profile localstack up -d localstack
   ```
3. Instale as dependências e rode:
   ```bash
   npm install
   npm run dev     # http://localhost:5173
   npm run seed    # tabelas de exemplo (opcional)
   ```

Se o seu LocalStack não estiver em `http://localhost:4566`, copie `.env.example` para `.env` e ajuste.

## Onde mexer

| Quero mudar… | Arquivo |
|---|---|
| criação do cliente DynamoDB e roteamento pelo proxy | `src/lib/client.ts` |
| chamadas ao DynamoDB (listar, Scan/Query, gravar, tabelas, índices, TTL) | `src/lib/api.ts` |
| montagem de `KeyCondition`, `Filter` e `Projection` | `src/lib/expressions.ts` |
| conversão entre DynamoDB JSON, JSON comum e os tipos do SDK | `src/lib/convert.ts` |
| conexões salvas e credenciais | `src/lib/connections.ts`, `src/hooks/useSettings.tsx` |
| proxy `/localstack` | `vite.config.ts` (dev) e `nginx/default.conf.template` (Docker), mantenha os dois iguais |
| painel, visão da tabela, índices e diálogos de criação | `src/components/tables/` |
| construtor de consultas | `src/components/items/QueryBuilder.tsx` |
| grid, painel e editor do item | `src/components/items/ItemsGrid.tsx`, `ItemDrawer.tsx`, `ItemEditor.tsx`, `JsonView.tsx` |
| componentes base | `src/components/ui/` (são os mesmos do S3 e do SES Explorer: mantenha em sincronia) |
| tabelas de exemplo | `scripts/seed.mjs` |

## Convenções

- **Português** na interface, nos comentários, nas mensagens de erro e nos commits.
- **Nenhum tipo se perde no caminho.** Sets, binários, números grandes e `NULL` precisam sobreviver à ida e volta entre DynamoDB JSON, JSON comum e o editor. Mudanças em `convert.ts` devem ser testadas com os itens do seed, que usam todos os tipos.
- **Atributos e valores sempre por placeholder.** As expressões usam `#n…` e `:v…` (`ExpressionAttributeNames`/`ExpressionAttributeValues`), nunca o nome ou o valor concatenado. Assim nomes reservados (`status`, `name`, `timestamp`) e caracteres especiais funcionam.
- **Somente leitura é respeitado em todo lugar.** Ações que gravam (criar, editar, excluir itens, tabelas, índices e TTL) precisam checar o modo somente leitura da conexão.
- **Credenciais não saem do navegador.** Nada de logar, enviar para outro serviço ou gravar a secret fora do que o README descreve.

## Antes de abrir o PR

```bash
npm run build                  # tsc -b (tipos estritos) + vite build
docker compose build           # a imagem continua compilando
```

Teste o fluxo afetado com dados reais: `npm run seed -- --reset` cria tabelas com chave simples e composta, GSI, LSI, TTL, stream, modo provisionado e itens com todos os tipos do DynamoDB. Se a mudança depender de um caso que o seed não cobre, inclua no seed.

## Commits e PRs

- Uma mudança por PR, com descrição do que e do porquê. O modelo do PR já traz a lista de checagem.
- Mudança visual? Anexe screenshots no claro e no escuro.
- Atualize o [CHANGELOG.md](CHANGELOG.md), na seção da próxima versão, e o README quando a mudança afetar o uso.
