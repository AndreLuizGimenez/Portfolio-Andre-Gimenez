# Portfólio — André Gimenez

A versão ativa do site tem três seções de viewport inteira: a apresentação inicial, o projeto de e-commerce e o jogo em desenvolvimento, que termina com o contato. O restante do código da versão anterior está preservado em [`pasta temporaria/`](pasta%20temporaria/).

## Navegação entre seções

As seções formam uma pilha. Ao avançar, a próxima sobe e cobre a atual; ao voltar, a atual desce e revela a anterior. Um gesto move exatamente uma seção e a página nunca fica parada entre duas.

A roda do mouse e o trackpad passam por um controle de inércia: depois de um passo, o restante do mesmo gesto é ignorado até a rolagem pausar ou um gesto novo empurrar com clareza. O navegador não entrega a rolagem como ela acontece: quando um quadro demora, junta vários eventos num só, ou os entrega atrasados depois do que parece uma pausa. Por isso o controle mede a inércia em velocidade (distância pelo tempo que cada pedaço cobre) e só aceita uma pausa que os quadros desenhados durante ela confirmem. Ler esses pedaços como gesto novo era o que às vezes levava da primeira ou da segunda seção direto à terceira.

Um gesto no mesmo sentido que começa durante a troca faz parte dela; no sentido contrário, conta assim que a troca termina. Em telas de toque a seção acompanha o dedo e completa o movimento ao soltar. Setas, Page Up/Down, Espaço, Home e End também navegam, uma seção por toque: a tecla mantida pressionada não continua. Sem JavaScript, a página volta a ser um documento comum com rolagem.

## Primeira seção

Apresenta o nome, a função de AI Engineer, uma descrição curta e o seletor diurno/noturno. O título em Manrope recebe a animação de construção com máscara, escala, squash/stretch e acomodação elástica; o término dela coordena a entrada dos textos de apoio e do seletor. Manrope é servido localmente, recortado aos caracteres latinos, com sua licença OFL; os textos de apoio usam a tipografia do sistema Apple.

O seletor mantém o rolo azul acinzentado sob uma lente sem preenchimento. Chromium recebe deslocamento do fundo por SVG; demais motores preservam transparência e reflexos, com desfoque mínimo como fallback.

## Segunda seção

Mostra o e-commerce ao lado do aparelho que o exibe. Ao entrar em cena, o celular vem da direita para a esquerda girando em profundidade, e os textos entram da esquerda para a direita, sem giro. O seletor Computador/Celular usa a mesma lente da primeira seção; ao trocar, a imagem recebe blur enquanto o celular se remodela em uma janela no estilo macOS. Em telas estreitas só existe a versão de celular.

O aparelho mostra uma imagem da primeira tela do site. A demonstração real, que é uma aplicação inteira, só é carregada quando alguém clica na tela e é removida ao sair (Esc, clique fora, troca de formato ou mudança de seção). Assim as duas seções permanecem leves e nenhuma animação do portfólio disputa o processador com a demonstração.

No formato Celular, o clique traz o aparelho para a frente: ele sai suavemente do lugar, vai ao centro da tela e cresce até o maior tamanho que cabe nela por inteiro, botões laterais incluídos, enquanto o resto da seção fica desfocado atrás dele. Ao sair, ele volta ao lugar pelo mesmo caminho. A moldura responde ao clique tanto quanto a tela. No formato Computador a demonstração abre no próprio lugar, como antes.

## Terceira seção

Apresenta a gameplay do jogo em desenvolvimento na Unreal Engine. Ela espelha a segunda seção, para que os projetos alternem de lado: o texto fica num painel de vidro à esquerda, com o contato logo abaixo (o ícone do WhatsApp e o número de celular, juntos num único link `wa.me` que abre a conversa), e o vídeo ocupa o resto, no maior quadro 16:9 que cabe. No celular e no tablet em pé a ordem é texto, vídeo e contato, com o vídeo da largura do painel (em celulares baixos o texto aperta e, se preciso, o vídeo estreita, sem nunca cobrir o contato); no celular deitado o texto se compacta ao lado do vídeo.

Na entrada, o vídeo vem da esquerda, por cima do lugar do texto, girando de leve até ficar de frente, enquanto o texto vem da direita e o contato chega por último. O vídeo só começa quando a moldura para.

O vídeo toca sozinho, sem som e em loop enquanto a seção está na tela, e pausa quando ela sai ou a aba fica oculta. Um botão no canto do vídeo pausa e retoma. Com a preferência de movimento reduzido do sistema ele não inicia sozinho.

O loop começa no início da cena da roda, e o pôster é exatamente esse primeiro quadro, em AVIF (62 kB em Full HD, 37 kB na metade) com JPEG de reserva. Até o vídeo ter um quadro, a moldura mostra a imagem; quando ele começa, nada muda na tela. Antes o pôster era de outro momento, o vídeo começava em outra cena e cortava de novo dois décimos de segundo depois: a troca aparecia como um salto.

O arquivo do vídeo tem 3,4 MB e não é pedido na abertura do site: ele e seu pôster só começam a carregar quando o visitante chega à segunda seção. O ícone do WhatsApp foi gerado pelo Codex e exportado em 192 × 192.

## Blocos de texto

Os parágrafos de descrição das três seções são compostos como blocos de bordas retas: as linhas saem quase da mesma largura, a última inclusive, e a pequena diferença é repartida entre os caracteres da linha, sem abrir os espaços entre as palavras. Quando preciso, uma palavra é dividida por sílaba. As divisões possíveis estão numa lista em `src/portfolio/typeset.js`; ao trocar um texto, acrescente ali as palavras longas novas.

## Fundo e painéis de vidro

As formas do fundo das três seções são lâminas de vidro líquido empilhadas, em movimento lento: ondulam, deslizam umas sobre as outras e cada uma dobra, tinge e ilumina a imagem do que está atrás dela. Atrás dos blocos de texto há um painel de vidro transparente, cuja borda larga estica o que passa por baixo, com uma franja de cor discreta.

Tudo é desenhado pela placa de vídeo (WebGL2), um canvas por seção, só enquanto a seção está na tela. As formas sólidas continuam no HTML como fallback; sem WebGL2 o painel vira uma folha translúcida simples. Com a preferência de movimento reduzido o fundo é desenhado uma vez e fica parado.

O painel acompanha o texto: `backdrop.js` mede o bloco marcado com `data-pane` e soma a folga de `--pane-pad`; os cantos vêm de `--pane-radius`. Na segunda seção o fundo são duas lâminas iguais em cantos opostos (`dune-side`): uma sobe do canto inferior direito por trás do painel de texto, a outra desce do canto superior esquerdo por trás do aparelho. Na terceira, as mesmas lâminas sobre o papel claro, espelhadas: o painel de texto fica à esquerda e o vídeo à direita.

## Abertura com loading

Da primeira pintura até a página ter o que a visita precisa, um cartão cobre tudo: a marca AG e uma barra fina que avança conforme as coisas ficam prontas. Por trás dele a fonte chega, os três fundos de vidro compilam e desenham o primeiro quadro, todas as imagens (o celular, a tela do computador, o pôster do vídeo e o ícone do WhatsApp) são baixadas e decodificadas, as lentes e os blocos de texto são calculados e o elemento do vídeo é criado. Só quando o cartão sai começa a animação de abertura, ou a entrada da seção, se a visita abriu numa seção adiante. Enquanto ele está na tela a navegação fica parada, e um gesto feito nesse tempo é descartado junto com a sua inércia.

O cartão fica no mínimo 0,38 s, para não piscar; numa conexão rápida ele sai em cerca de 0,5 s. A fonte e os fundos são essenciais; as imagens são esperadas até 3,5 s depois do início da visita. Se algo essencial não chegar em 9 s, ou o script falhar, a página aparece como está, sem animação; se o script nem chegar, o guarda do `<head>` faz o mesmo em 8 s. Sem JavaScript o cartão nem aparece. O arquivo do vídeo só começa a baixar depois que o cartão sai, e, com economia de dados ligada, só quando a visita chega à segunda seção.

## Fluidez

O fundo de vidro é desenhado em todo quadro da tela (60 ou 120 por segundo), e não mais a 30, assim que um quadro cronometrado mostra que a placa de vídeo dá conta com folga (até 36% do tempo de um quadro). Se não der, o canvas fica mais grosso; se ainda não der, o fundo continua nos 30 quadros de antes. A velocidade não muda: o movimento é calculado pelo relógio, não pela contagem de quadros.

Durante uma troca de seção, o fundo da seção que sai para de ser redesenhado (ela é coberta ou levada em menos de um segundo) e a placa de vídeo fica para a que entra. A seção seguinte já espera desenhada, numa camada própria, logo abaixo da tela, para que a troca comece sem nada a pintar; depois de uma troca, isso só acontece quando a entrada terminou. As animações têm exatamente as mesmas durações e curvas de antes.

Num celular fraco simulado (processador 6× mais lento, rede 4G lenta), a animação de abertura engasgava em toda execução, com quadros de até 50 ms e uma tarefa longa no meio. Agora, em seis execuções, cinco não tiveram nenhum quadro acima de 17 ms e a pior teve um de 33 ms: o que pesa acontece sob o loading.

## Carregamento e desempenho

Com o loading, a animação de abertura começa depois que tudo está pronto, e por isso mais tarde do que antes, quando começava em 0,83 s com o resto ainda chegando: em cerca de 0,95 s numa conexão rápida e em 2,5 s na rede 4G lenta simulada (150 ms de latência, 1,6 Mbit/s, sem compressão no servidor de teste). A primeira pintura continua no mesmo tempo, por volta de 0,46 s, agora com o cartão.

Na rodada de otimização anterior, a abertura passou a começar em 0,83 s em vez de 1,83 s, a primeira pintura em 0,45 s em vez de 1,2 s, e o trabalho da thread principal nos primeiros 3 s caiu de 224 ms de script para 81 ms, com o visual idêntico pixel a pixel. Desde então:

- **Um pedido só para o código.** O CSS vem dentro da página e todos os scripts num único arquivo minificado. Antes eram três rodadas de pedidos em cascata (`site.js`, depois os módulos, depois os módulos deles). O texto do shader vai sem comentários nem indentação.
- **Nada aparece antes da hora.** Um script mínimo no `<head>` aplica o tema escolhido antes da primeira pintura e prepara a pose inicial da abertura. Antes, quem usava o tema noturno via o diurno por um instante, e a abertura aparecia pronta, sumia e só então se construía.
- **Fonte recortada.** Manrope leva só os caracteres latinos (23,8 kB em vez de 52,6 kB), com todas as variações de peso, kerning, ligaduras e hinting: o texto sai idêntico. `scripts/subset-font.py` refaz o recorte a partir da família completa que a demonstração já traz.
- **Imagens em paralelo.** As imagens das outras seções começam a baixar junto com a página, com prioridade baixa, em vez de esperar a fonte. Como o loading espera por elas, baixar tudo junto termina antes: 2,5 s em vez de 3,1 s no 4G lento. A tela do computador só é pedida onde esse formato existe, acima de 760 px de largura.
- **Lentes calculadas uma vez.** O mapa de refração de cada lente era refeito a cada quadro de uma transição de largura no carregamento: 11 vezes, 145 ms de script, cada uma com uma imagem PNG codificada na thread principal. Agora a lente já nasce no lugar, cada mapa é calculado uma vez com um quarto da geometria (o contorno é simétrico; o resultado é idêntico byte a byte), a codificação sai da thread principal, e todas são feitas sob o loading.
- **Blocos de texto na hora certa.** Todos os parágrafos são compostos sob o loading. Sem ele, só os da seção onde a visita começa são compostos de imediato; os outros quando a página tem um momento livre, ou no início da primeira troca de seção.
- **Vídeo com metade do peso.** A gameplay foi recodificada de 6,9 MB para 3,4 MB, ainda H.264 (decodificado pelo hardware em todo lugar): a semelhança estrutural com o original é de 0,995 em média e 0,992 no pior quadro. O ícone do WhatsApp foi otimizado sem perda, com pixels idênticos.
- **Vídeo depois do loading.** O arquivo do vídeo só começa a baixar quando o cartão sai, para não disputar a rede com o que a abertura precisa; o pôster cobre a moldura até lá. O JPEG de reserva do pôster deixou de ser pedido à toa quando o vídeo era criado.

## Código-fonte e publicação

O código editável fica em `src/`; o site publicado é `dist/`, que o build gera a partir dele. Imagens, vídeo, fontes e a demonstração ficam só em `dist/`. Depois de editar `src/`, rode o build e commite `dist/` junto, porque é ele que vai ao ar.

```sh
npm install        # uma vez: instala o esbuild
npm run build      # gera dist/index.html e dist/portfolio/app.js a partir de src/
npm run watch      # o mesmo, de novo a cada mudança em src/
npm run preview    # serve dist/ em http://127.0.0.1:4173
npm test           # testes, dist/ em dia com src/ e arquivos referenciados existentes
```

Com a prévia no ar, abra [http://127.0.0.1:4173/#inicio](http://127.0.0.1:4173/#inicio). Cada arquivo local que a página cita recebe no endereço um carimbo do seu conteúdo (`?v=…`), para que uma versão nova nunca venha de um cache antigo.

## Arquivos

- `src/index.html`: as três seções, legível; o build embute nela o CSS e o script.
- `src/portfolio/style.css`: composição, tipografia, temas, Liquid Glass, pilha e aparelho.
- `src/portfolio/site.js`: tema, seletores, animação de abertura, o que o loading espera e ligação entre os módulos.
- `src/portfolio/loader.js`: o cartão de loading, a barra e quando ele sai.
- `src/portfolio/stack.js`: navegação em pilha por roda, trackpad, toque e teclado.
- `src/portfolio/wheel-gate.js`: controle de inércia, um passo por gesto.
- `src/portfolio/showcase.js`: aparelho, troca de formato, entrada, zoom e demonstração sob demanda.
- `src/portfolio/reel.js`: vídeo da terceira seção, carregado e tocado só quando a seção se aproxima.
- `src/portfolio/typeset.js`: compõe os parágrafos de descrição como blocos de bordas retas.
- `src/portfolio/glass.js`: refração geométrica das lentes.
- `src/portfolio/backdrop.js`: lê as formas, as cores e a posição dos textos, e conduz o desenho do fundo e dos painéis de vidro.
- `src/portfolio/backdrop-glsl.js`: o shader que desenha as lâminas e o painel, pixel a pixel.
- `dist/index.html` e `dist/portfolio/app.js`: gerados pelo build; não edite.
- `dist/portfolio/fonts/manrope-latin.woff2`: Manrope recortada, com a licença ao lado.
- `dist/portfolio/nival-mobile.webp` e `nival-desktop.webp`: imagens da primeira tela, capturadas da própria demonstração em 414 × 852 e 1440 × 900.
- `dist/portfolio/roda-roda.mp4`: gameplay do jogo (12,5 s, Full HD, sem áudio), vinda do site anterior, com o loop começando na cena da roda.
- `dist/portfolio/roda-roda-poster-1920.avif`, `roda-roda-poster-960.avif` e `roda-roda-poster.jpg`: o primeiro quadro do vídeo, como pôster.
- `dist/portfolio/whatsapp-icon.jpg`: ícone do WhatsApp do link de contato.
- `dist/demos/nival/`: demonstração compilada do e-commerce.
- `scripts/build.mjs`, `scripts/subset-font.py`: o build e o recorte da fonte.
- `pasta temporaria/dist-restante-2026-10-05/`: cópia completa da versão anterior.
- `pasta temporaria/sources-nival/`: fonte isolada e dependências da demonstração.

## Verificação

```sh
npm test
```

Os testes reproduzem a entrega do navegador, com eventos somados a cada quadro, quadros lentos, travamentos e eventos atrasados chegando aos poucos. Cobrem trackpad com inércia curta e longa, início hesitante, arrasto lento, tela de 120 Hz, roda de mouse em ritmo irregular, um clique lento de mouse no macOS, inversão de direção e 400 gestos aleatórios. Em seguida, o build confere que `dist/` é o que `src/` gera, e `scripts/check-assets.py` confere que todo arquivo citado existe.
