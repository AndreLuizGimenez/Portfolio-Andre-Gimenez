# Portfólio — André Gimenez

Portfólio focado em dois projetos, com prioridade para computador e adaptação para celular. A demonstração do e-commerce aparece uma única vez: começa dentro de um celular maior, pode se expandir para uma janela de computador e tem opção de tela cheia. O vídeo de desenvolvimento na Unreal Engine fica em largura total, com a explicação acima. A página usa os títulos do currículo e não apresenta os nomes próprios dos projetos.

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

As entradas de conteúdo usam opacidade, deslocamento e escala discreta. O seletor tem indicador deslizante e a moldura se expande com uma única instância do iframe. A escolha de cada formato retorna ao início pelos controles da demonstração. O estado de celular usa viewport lógico 393 × 852, e o computador usa 1440 × 900, escalados proporcionalmente à moldura. Tela cheia reutiliza a mesma demonstração. Preferência por movimento reduzido remove a expansão espacial e impede autoplay do vídeo. Loops de vídeo pausam fora da tela ou quando a aba fica oculta.

Tipografia principal: fontes de sistema da Apple via `-apple-system` e `BlinkMacSystemFont`, com fallback de sistema em outras plataformas. Não há download de fontes para a página principal.
