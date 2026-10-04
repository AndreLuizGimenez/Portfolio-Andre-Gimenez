# Portfólio — André Gimenez

Primeira versão do portfólio profissional, com prioridade para computador e adaptação para celular. O Nival aparece uma única vez como demonstração interativa: começa dentro de um celular, pode mudar para uma janela de computador e tem opção de tela cheia. O Roda Roda apresenta o vídeo fornecido pelo usuário.

## Prévia local

Na pasta deste arquivo:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Abra `http://127.0.0.1:4173/`. O site principal é HTML/CSS/JavaScript estático, sem instalação de dependências nem etapa de build. Validação de referências locais e sintaxe:

```sh
python3 scripts/check-assets.py
node --check dist/portfolio/site.js
```

## Arquivos principais

- `dist/index.html`: conteúdo e estrutura do portfólio.
- `dist/portfolio/style.css`: composição desktop, adaptações mobile, molduras e estados de interação.
- `dist/portfolio/site.js`: alternância de formato, escala real do iframe, tela cheia e reprodução do vídeo.
- `dist/portfolio/roda-roda.mp4`: cópia do vídeo final fornecido pelo usuário.
- `dist/demos/nival/`: exportação estática da experiência original, com componentes reais e recursos locais.
- `sources/nival/`: fonte isolada e reproduzível da exportação; veja seu README antes de atualizar a demonstração.
- `.openai/hosting.json`: identidade e configuração de hospedagem. O site começa com acesso privado.

## Conteúdo e edição

A descrição dos projetos destaca planejamento, desenvolvimento com IA, UI/UX, testes e refinamento. O texto público não cita empresa nem vaga. Não foram inventados resultados comerciais, datas de experiência, clientes ou competências sem base no material fornecido.

O Nival é um conceito em desenvolvimento: nome “XXXX”, preço provisório e compra indisponível. O vídeo Roda Roda contém participantes simulados e uma waveform ilustrativa; não é evidência de multiplayer em rede nem de captura real de microfone.

O currículo e o contexto da vaga foram usados apenas neste projeto. Nenhum arquivo de memória global foi criado.

## Movimento

A principal transição é a expansão da moldura do Nival, com uma única instância do iframe. O estado de celular usa viewport lógico 393 × 852, e o computador usa 1440 × 900, escalados proporcionalmente à moldura. Tela cheia reutiliza a mesma demonstração. Preferência por movimento reduzido remove a expansão espacial e impede autoplay do vídeo. Loops de vídeo pausam fora da tela ou quando a aba fica oculta.

Fonte Manrope reutilizada com licença OFL em `dist/portfolio/manrope-OFL.txt`.
