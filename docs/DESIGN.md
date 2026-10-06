# Direção visual

O site é uma pilha de seções verticais de `100vh`, pensada primeiro para desktop e adaptada para telas menores. Estão ativas a abertura, o projeto de e-commerce e o jogo em desenvolvimento.

## Pilha de seções

Cada seção é uma camada opaca do tamanho da viewport. Ao avançar, a próxima sobe de baixo e cobre a atual, que fica parada atrás e escurece levemente; ao voltar, o movimento se inverte. A troca dura cerca de 0,8 s, com saída suave e chegada desacelerada, e só então a navegação aceita outro passo.

Um gesto vale uma seção. A inércia do trackpad continua emitindo rolagem por mais de um segundo depois que os dedos saem; como ela só decresce, o passo fica gasto até a rolagem pausar ou voltar a subir de forma clara. Uma roda girada sem parar também move uma seção por vez. No toque, a seção acompanha o dedo e, ao soltar, completa o movimento ou retorna, sem parar entre duas.

As seções alternam tonalidade: a abertura usa o papel claro com ondas discretas; o projeto usa um azul-gelo com dunas mais profundas atrás do aparelho.

## Fundo em Liquid Glass

As ondas da abertura e as dunas do projeto são placas de vidro empilhadas, não blocos de cor. Silhuetas, posições e proporções são as das formas originais, e cada placa conserva em média o tom que tinha quando era sólida.

Cada placa é clara no miolo e tem uma borda convexa larga, de cerca de 7% do menor lado da janela. Nessa faixa ela desloca a imagem de tudo o que está atrás, cada vez mais quanto mais perto da borda, de modo que as bordas das placas de trás aparecem dobradas e a cor de fora é puxada para dentro. Completam o material um fio de luz na borda voltada para a luz, a face iluminada que dá a espessura, uma linha escura onde essa face termina e a sombra que a placa projeta sobre o que está atrás. A luz vem do mesmo lado que nas lentes dos seletores.

O brilho e a sombra ficam nas bordas; o interior das placas continua calmo. Onde há texto por cima, a borda perde quase todo o brilho e a sombra e sobra apenas o degrau de cor, para nenhuma linha clara atravessar as letras. Em telas estreitas, onde as curvas ficam fechadas, a faixa encolhe até caber na curva, senão o vidro dobraria a imagem sobre si mesma. Não há formas, padrões nem texturas novas: o vidro só refrata o papel e as outras placas.

## Primeira seção

O conteúdo principal fica centralizado no eixo da viewport: identificação, título, nome, função, descrição e seletor de tema.

O título usa Manrope 600, servido localmente com sua licença OFL, e espaçamento que conserva a separação entre os caracteres. Textos de apoio usam a tipografia nativa Apple. A entrada é construída por grupos de palavras com máscara, escala, deformação curta, impacto e acomodação elástica. O evento de acomodação do título libera nome, função, descrição e seletor em sequência, com a mesma curva de movimento. Ao final, os estados de animação são removidos. Quem volta à abertura não revê a introdução.

A paleta diurna parte de um fundo claro tonalizado, azul escuro no título, azul médio nos acentos e azul claro nos detalhes. A paleta noturna troca o canvas para azul-marinho profundo e mantém os mesmos acentos.

## Liquid Glass

Os seletores usam um rolo azul acinzentado e uma lente transparente, sem preenchimento. A seleção expande apenas durante a troca e acomoda rapidamente. A lente captura o fundo numa área maior que sua forma, refrata e depois recorta o resultado nas curvas; isso evita cantos vazios na amostragem. A distorção aumenta linearmente numa faixa que ocupa cerca de 83% do raio. Um mapa de luz acompanha a curvatura, preservando o centro transparente. Texto e ícones ficam sobre a óptica e permanecem nítidos.

Nenhum ancestral de um seletor mantém máscara, opacidade parcial ou filtro depois da entrada. Essas propriedades limitam o conteúdo que um filtro de fundo pode amostrar, conforme a [definição de Backdrop Root do CSSWG](https://drafts.csswg.org/filter-effects-2/#BackdropRoot). O rolo não usa um filtro de fundo, permitindo que a lente refrate tanto sua borda quanto a página. Chromium recebe refração SVG; outros motores conservam reflexos e transparência como fallback.

## Segunda seção

O texto ocupa uma coluna fixa à direita: índice, nome do projeto, o que ele é, descrição, tecnologias e o seletor Computador/Celular. A coluna não se move quando o formato muda, para que o seletor permaneça sob o cursor. O aparelho ocupa o espaço restante à esquerda.

O celular tem Dynamic Island, barra de status e botões laterais, sem marca alguma; a traseira mostra apenas as lentes. Na entrada ele parte da direita, sobre o lugar que o texto vai ocupar, cruza para a esquerda girando no eixo vertical e acomoda com um retorno curto. Durante o giro ganha traseira e espessura; em repouso volta a ser um único plano. Os textos fazem o caminho contrário, da esquerda para a direita, em sequência e sem rotação, usando a mesma curva elástica da abertura. A entrada se repete sempre que a seção sobe; quando ela é revelada por baixo, já está pronta.

Ao escolher Computador, o corpo do celular muda de largura, altura, raio e moldura até virar uma janela no estilo macOS, com barra de título e três pontos. A imagem do site recebe blur e leve ampliação enquanto o corpo se remodela e volta a ficar nítida na chegada. Abaixo de 760 px de largura não há seletor: só a versão de celular.

## Terceira seção

O título e a descrição dividem a faixa do alto, o vídeo ocupa o maior quadro 16:9 que cabe no meio, numa moldura escura como a do aparelho da segunda seção, e o contato fecha a tela: o ícone do WhatsApp à esquerda e o número em Manrope grande, os dois dentro do mesmo link. O verde do ícone é o único ponto de cor fora da paleta azul, de propósito: é a ação que a página pede.

O vídeo começa sozinho, sem som, e repete sem parar. O botão de pausa fica no canto da moldura e só aparece com o cursor sobre o vídeo, ou quando ele está pausado. Ao subir, título, descrição, vídeo e contato se acomodam em sequência com a mesma curva dos textos da abertura; revelada por baixo, a seção já está pronta. O fundo desta seção ainda é o papel liso, sem placas de vidro.

Uma seção pulada por um salto direto (Home, End ou um link) não fica presa na pose de espera: quando é descoberta por cima aparece no lugar, e toda seção que volta a ficar abaixo da atual recomeça sua entrada na próxima subida.

## Leveza

O aparelho exibe uma imagem do site em alta resolução. A demonstração real é carregada somente quando alguém clica na tela, com uma barra de progresso no topo, e é removida ao sair. Fora desse momento as duas seções não executam nada em segundo plano.

O vídeo do jogo e seu pôster só são pedidos quando o visitante chega à seção anterior, e o vídeo só toca enquanto a sua seção está na tela.

As animações de entrada e a troca de seção usam apenas transformações e opacidade. Seções cobertas ficam ocultas e inertes. As camadas de profundidade do celular só existem durante o giro.

O fundo em vidro é calculado uma vez por tamanho de janela, num worker, e vira uma imagem parada; o worker é encerrado em seguida. Enquanto a janela é arrastada a imagem antiga apenas estica, e o novo cálculo só acontece quando o tamanho para de mudar. Os dois temas saem do mesmo cálculo, então trocar de tema é apenas um esmaecimento entre duas imagens. A resolução tem teto fixo, igual numa tela 4K e num celular. Sem JavaScript ou sem worker ficam as formas sólidas.

O código da versão anterior foi preservado em [`pasta temporaria/`](../pasta%20temporaria/), incluindo a exportação antiga e `sources-nival`.
