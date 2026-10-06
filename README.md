# Portfólio — André Gimenez

A versão ativa do site tem duas seções de viewport inteira: a apresentação inicial e o projeto de e-commerce. O restante do código da versão anterior está preservado em [`pasta temporaria/`](pasta%20temporaria/).

## Navegação entre seções

As seções formam uma pilha. Ao avançar, a próxima sobe e cobre a atual; ao voltar, a atual desce e revela a anterior. Um gesto move exatamente uma seção e a página nunca fica parada entre duas.

A roda do mouse e o trackpad passam por um controle de inércia: depois de um passo, o restante do mesmo gesto é ignorado até a rolagem pausar ou voltar a acelerar claramente. Em telas de toque a seção acompanha o dedo e completa o movimento ao soltar. Setas, Page Up/Down, Espaço, Home e End também navegam. Sem JavaScript, a página volta a ser um documento comum com rolagem.

## Primeira seção

Apresenta o nome, a função de AI Engineer, uma descrição curta e o seletor diurno/noturno. O título em Manrope recebe a animação de construção com máscara, escala, squash/stretch e acomodação elástica; o término dela coordena a entrada dos textos de apoio e do seletor. Manrope é servido localmente com sua licença OFL e os textos de apoio usam a tipografia do sistema Apple.

O seletor mantém o rolo azul acinzentado sob uma lente sem preenchimento. Chromium recebe deslocamento do fundo por SVG; demais motores preservam transparência e reflexos, com desfoque mínimo como fallback.

## Segunda seção

Mostra o e-commerce ao lado do aparelho que o exibe. Ao entrar em cena, o celular vem da direita para a esquerda girando em profundidade, e os textos entram da esquerda para a direita, sem giro. O seletor Computador/Celular usa a mesma lente da primeira seção; ao trocar, a imagem recebe blur enquanto o celular se remodela em uma janela no estilo macOS. Em telas estreitas só existe a versão de celular.

O aparelho mostra uma imagem da primeira tela do site. A demonstração real, que é uma aplicação inteira, só é carregada quando alguém clica na tela e é removida ao sair (Esc, clique fora, troca de formato ou mudança de seção). Assim as duas seções permanecem leves e nenhuma animação do portfólio disputa o processador com a demonstração.

## Fundo

As formas do fundo das duas seções são placas de vidro translúcido empilhadas: cada uma refrata, tinge e ilumina a imagem de tudo o que está atrás dela, com a distorção concentrada numa faixa larga antes da borda. As silhuetas, posições e cores de base são as mesmas das formas sólidas, que continuam no HTML como fallback. O desenho é feito uma única vez por tamanho de janela, fora da thread principal, já nos dois temas; depois disso o fundo é só uma imagem parada.

## Prévia local

Na pasta deste arquivo:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Abra [http://127.0.0.1:4173/#inicio](http://127.0.0.1:4173/#inicio).

## Arquivos ativos

- `dist/index.html`: as duas seções.
- `dist/portfolio/style.css`: composição, tipografia, temas, Liquid Glass, pilha e aparelho.
- `dist/portfolio/site.js`: tema, seletores, animação de abertura e ligação entre os módulos.
- `dist/portfolio/stack.js`: navegação em pilha por roda, trackpad, toque e teclado.
- `dist/portfolio/wheel-gate.js`: controle de inércia, um passo por gesto.
- `dist/portfolio/showcase.js`: aparelho, troca de formato, entrada e demonstração sob demanda.
- `dist/portfolio/glass.js`: refração geométrica das lentes.
- `dist/portfolio/backdrop.js`: lê as formas e as cores do fundo e entrega o desenho a um worker.
- `dist/portfolio/backdrop-worker.js`: desenha as placas de vidro, por software, nos dois temas.
- `dist/portfolio/nival-mobile.webp` e `nival-desktop.webp`: imagens da primeira tela, capturadas da própria demonstração em 414 × 852 e 1440 × 900.
- `dist/demos/nival/`: demonstração compilada do e-commerce.
- `pasta temporaria/dist-restante-2026-10-05/`: cópia completa da versão anterior.
- `pasta temporaria/sources-nival/`: fonte isolada e dependências da demonstração.

## Verificação

```sh
for f in site stack showcase wheel-gate glass backdrop backdrop-worker; do node --check dist/portfolio/$f.js; done
node --test scripts/wheel-gate.test.mjs
python3 scripts/check-assets.py
```

Os testes simulam trackpad com inércia curta e longa, roda de mouse contínua, um clique lento de mouse no macOS, inversão de direção e eventos entregues com atraso.
