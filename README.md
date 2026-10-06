# Portfólio — André Gimenez

A versão ativa do site tem três seções de viewport inteira: a apresentação inicial, o projeto de e-commerce e o jogo em desenvolvimento, que termina com o contato. O restante do código da versão anterior está preservado em [`pasta temporaria/`](pasta%20temporaria/).

## Navegação entre seções

As seções formam uma pilha. Ao avançar, a próxima sobe e cobre a atual; ao voltar, a atual desce e revela a anterior. Um gesto move exatamente uma seção e a página nunca fica parada entre duas.

A roda do mouse e o trackpad passam por um controle de inércia: depois de um passo, o restante do mesmo gesto é ignorado até a rolagem pausar ou voltar a acelerar claramente. Em telas de toque a seção acompanha o dedo e completa o movimento ao soltar. Setas, Page Up/Down, Espaço, Home e End também navegam. Sem JavaScript, a página volta a ser um documento comum com rolagem.

## Primeira seção

Apresenta o nome, a função de AI Engineer, uma descrição curta e o seletor diurno/noturno. O título em Manrope recebe a animação de construção com máscara, escala, squash/stretch e acomodação elástica; o término dela coordena a entrada dos textos de apoio e do seletor. Manrope é servido localmente com sua licença OFL e os textos de apoio usam a tipografia do sistema Apple.

O seletor mantém o rolo azul acinzentado sob uma lente sem preenchimento. Chromium recebe deslocamento do fundo por SVG; demais motores preservam transparência e reflexos, com desfoque mínimo como fallback.

## Segunda seção

Mostra o e-commerce ao lado do aparelho que o exibe. Ao entrar em cena, o celular vem da direita para a esquerda girando em profundidade, e os textos entram da esquerda para a direita, sem giro. O seletor Computador/Celular usa a mesma lente da primeira seção; ao trocar, a imagem recebe blur enquanto o celular se remodela em uma janela no estilo macOS. Em telas estreitas só existe a versão de celular.

O aparelho mostra uma imagem da primeira tela do site. A demonstração real, que é uma aplicação inteira, só é carregada quando alguém clica na tela e é removida ao sair (Esc, clique fora, troca de formato ou mudança de seção). Assim as duas seções permanecem leves e nenhuma animação do portfólio disputa o processador com a demonstração.

## Terceira seção

Apresenta a gameplay do jogo em desenvolvimento na Unreal Engine: título e descrição no alto, o vídeo no centro e, abaixo dele, o ícone do WhatsApp com o número de celular, juntos num único link `wa.me` que abre a conversa.

O vídeo toca sozinho, sem som e em loop enquanto a seção está na tela, e pausa quando ela sai ou a aba fica oculta. Um botão no canto do vídeo pausa e retoma. Com a preferência de movimento reduzido do sistema ele não inicia sozinho.

O arquivo do vídeo tem 6,9 MB e não é pedido na abertura do site: ele e seu pôster só começam a carregar quando o visitante chega à segunda seção. O ícone do WhatsApp foi gerado pelo Codex e exportado em 192 × 192.

## Blocos de texto

Os parágrafos de descrição das três seções são compostos como blocos de bordas retas: as linhas saem quase da mesma largura, a última inclusive, e a pequena diferença é repartida entre os caracteres da linha, sem abrir os espaços entre as palavras. Quando preciso, uma palavra é dividida por sílaba. As divisões possíveis estão numa lista em `typeset.js`; ao trocar um texto, acrescente ali as palavras longas novas.

## Fundo e painéis de vidro

As formas do fundo das duas primeiras seções são lâminas de vidro líquido empilhadas, em movimento lento: ondulam, deslizam umas sobre as outras e cada uma dobra, tinge e ilumina a imagem do que está atrás dela. Atrás dos blocos de texto dessas seções há um painel de vidro transparente, cuja borda larga estica o que passa por baixo, com uma franja de cor discreta.

Tudo é desenhado pela placa de vídeo (WebGL2), um canvas por seção, só enquanto a seção está na tela. As formas sólidas continuam no HTML como fallback; sem WebGL2 o painel vira uma folha translúcida simples. Com a preferência de movimento reduzido o fundo é desenhado uma vez e fica parado.

O painel acompanha o texto: `backdrop.js` mede o bloco marcado com `data-pane` e soma a folga de `--pane-pad`; os cantos vêm de `--pane-radius`. A segunda seção ganhou uma quarta forma (`dune-side`) para que o painel dela tenha o que refratar.

## Prévia local

Na pasta deste arquivo:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Abra [http://127.0.0.1:4173/#inicio](http://127.0.0.1:4173/#inicio).

## Arquivos ativos

- `dist/index.html`: as três seções.
- `dist/portfolio/style.css`: composição, tipografia, temas, Liquid Glass, pilha e aparelho.
- `dist/portfolio/site.js`: tema, seletores, animação de abertura e ligação entre os módulos.
- `dist/portfolio/stack.js`: navegação em pilha por roda, trackpad, toque e teclado.
- `dist/portfolio/wheel-gate.js`: controle de inércia, um passo por gesto.
- `dist/portfolio/showcase.js`: aparelho, troca de formato, entrada e demonstração sob demanda.
- `dist/portfolio/reel.js`: vídeo da terceira seção, carregado e tocado só quando a seção se aproxima.
- `dist/portfolio/typeset.js`: compõe os parágrafos de descrição como blocos de bordas retas.
- `dist/portfolio/glass.js`: refração geométrica das lentes.
- `dist/portfolio/backdrop.js`: lê as formas, as cores e a posição dos textos, e conduz o desenho do fundo e dos painéis de vidro.
- `dist/portfolio/backdrop-glsl.js`: o shader que desenha as lâminas e o painel, pixel a pixel.
- `dist/portfolio/nival-mobile.webp` e `nival-desktop.webp`: imagens da primeira tela, capturadas da própria demonstração em 414 × 852 e 1440 × 900.
- `dist/portfolio/roda-roda.mp4` e `roda-roda-poster.jpg`: gameplay do jogo (12,5 s, Full HD, sem áudio) e seu pôster, vindos do site anterior.
- `dist/portfolio/whatsapp-icon.jpg`: ícone do WhatsApp do link de contato.
- `dist/demos/nival/`: demonstração compilada do e-commerce.
- `pasta temporaria/dist-restante-2026-10-05/`: cópia completa da versão anterior.
- `pasta temporaria/sources-nival/`: fonte isolada e dependências da demonstração.

## Verificação

```sh
for f in site stack showcase reel typeset wheel-gate glass backdrop backdrop-glsl; do node --check dist/portfolio/$f.js; done
node --test scripts/wheel-gate.test.mjs
python3 scripts/check-assets.py
```

Os testes simulam trackpad com inércia curta e longa, roda de mouse contínua, um clique lento de mouse no macOS, inversão de direção e eventos entregues com atraso.
