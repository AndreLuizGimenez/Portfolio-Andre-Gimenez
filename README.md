# Portfólio — André Gimenez

A versão ativa do site contém somente a primeira seção de apresentação, ocupando uma viewport inteira. Ela apresenta o nome, a função de AI Engineer, uma descrição curta e o seletor diurno/noturno. O restante do código da versão anterior está preservado em [`pasta temporaria/`](pasta%20temporaria/).

A composição usa Manrope no título e tipografia do sistema Apple nos textos de apoio, sem redistribuir arquivos proprietários de fonte. Manrope é servido localmente com sua licença OFL. O título recebe a animação de construção com máscara, escala, squash/stretch e acomodação elástica. Eventos de término da animação coordenam a entrada sequencial dos textos de apoio e do seletor; nenhuma máscara permanece sobre o vidro.

A paleta combina fundo claro ou azul-marinho, azul escuro para o título e azul médio/claro nos detalhes. O fundo usa curvas contínuas em tons sólidos suaves, sem degradês. O seletor mantém o rolo azul acinzentado sob uma lente sem preenchimento: a refração cresce linearmente em uma faixa ampla das bordas e a luz é calculada segundo a curvatura. Chromium recebe deslocamento do fundo por SVG; demais motores preservam transparência e reflexos, com desfoque mínimo como fallback.

## Prévia local

Na pasta deste arquivo:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Abra [http://127.0.0.1:4173/#inicio](http://127.0.0.1:4173/#inicio).

## Arquivos ativos

- `dist/index.html`: única seção ativa do site.
- `dist/portfolio/style.css`: composição, tipografia, temas e Liquid Glass.
- `dist/portfolio/site.js`: animação de entrada, seletor e persistência do tema.
- `dist/portfolio/glass.js`: refração geométrica da lente selecionada.
- `pasta temporaria/dist-restante-2026-10-05/`: cópia completa da versão anterior.
- `pasta temporaria/sources-nival/`: fonte isolada e dependências do projeto anterior.

## Verificação

```sh
node --check dist/portfolio/site.js
node --check dist/portfolio/glass.js
python3 scripts/check-assets.py
```
