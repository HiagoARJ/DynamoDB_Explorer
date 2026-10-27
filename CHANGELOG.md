# Changelog

As mudanças relevantes de cada versão ficam registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [1.0.0] - 2026-09-25

Primeira versão: Vite, React 19, TypeScript e Tailwind CSS v4. É a base visual que o S3 Explorer e o SES Explorer passaram a usar.

### Adicionado
- **Conexões**: LocalStack padrão, contas AWS (com colagem de credenciais e modo somente leitura), outro LocalStack e DynamoDB Local.
- Proxy `/localstack` no Vite e no nginx, que remove o cabeçalho `Origin` para o LocalStack não responder 403 por CORS.
- **Tabelas**: painel com status, chaves, índices, contagem de itens, tamanho e modo de capacidade; criação (com GSIs, sob demanda ou provisionada) e exclusão; criação e exclusão de GSIs; ativar e desativar TTL; detalhes com ARN, datas, streams, classe e atributos definidos.
- **Itens**: Scan e Query na tabela ou em qualquer GSI/LSI, com condições da chave de classificação, ordem decrescente, filtros múltiplos, projeção e paginação. Scans com filtro continuam lendo até preencher a página.
- Criar, editar, duplicar e excluir itens, inclusive em lote.
- Grid com colunas dinâmicas, chaves fixadas, colunas redimensionáveis e ocultáveis (salvas por tabela), ordenação local, densidade e células por tipo, com detecção de datas ISO e epoch.
- Painel do item com árvore, JSON e DynamoDB JSON. Editor com validação em tempo real e alternância JSON ↔ DynamoDB JSON, que preserva sets, binários e números grandes.
- Esquema inferido a partir de uma amostra, estatísticas de cada consulta (itens, tempo, RCU, requisições) e visualização das expressões geradas.
- Exportação em CSV, JSON ou DynamoDB JSON, busca rápida na página, paleta de comandos (Ctrl K), menu lateral redimensionável e recolhível (Ctrl B) e tema claro/escuro/sistema.
- Imagem Docker com nginx e script `npm run seed` com tabelas de exemplo.

[1.0.0]: ../../releases/tag/v1.0.0
