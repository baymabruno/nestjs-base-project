# Dota Metrics: site

Site do Dota Metrics em [Next.js](https://nextjs.org) 16, com as páginas de estatísticas. Ele lê a API do projeto (`API_URL`) no servidor e guarda as respostas em cache por 15 minutos, o mesmo intervalo do recálculo das estatísticas.

Testes (lógica sem navegador, como a ordenação da tabela): `docker exec dota-metrics-web npm test`.

Roda em Docker junto com o resto do sistema: veja o [guia de desenvolvimento](../docs/DESENVOLVIMENTO.md#site) e o [README](../README.md#site) do projeto.

| Página | Descrição |
|---|---|
| `/meta` | Top heróis por função (dados do STRATZ, com nota e tier) e todos os heróis do patch atual na mesma tabela, com ou sem função escolhida: nota e tier, win rate, pick rate e win rate por duração (públicas das últimas 24 horas e profissionais do patch atual), com filtros de fonte, rank, amostra mínima e função |
| `/heroes/<nome>` | Um herói, com os filtros de fonte, rank e amostra mínima: funções clicáveis (win rate, partidas e nota em cada posição; ao escolher uma, resumo, talentos e itens passam a ser da função), resumo, habilidades e talentos, itens iniciais e finais, tempo de compra × win rate e matchups (bom contra, fraco contra e melhores aliados) |
