# Direção visual

O site é uma pilha de seções verticais de `100vh`, pensada primeiro para desktop e adaptada para telas menores. Estão ativas a abertura, o projeto de e-commerce e o jogo em desenvolvimento.

## Loading

A página abre num cartão da cor do papel, com a marca AG num círculo fino, a mesma da identificação da abertura, e logo abaixo uma barra de 2 px. A barra avança sozinha até um terço enquanto o script não chega, e depois conforme o que a visita precisa fica pronto; a marca respira de leve. Quando tudo está pronto, a barra fecha, a marca e a barra somem encolhendo um pouco, o cartão se dissolve sobre o fundo da abertura, e só então o título começa a se construir. O cartão respeita o tema escolhido desde o primeiro quadro.

## Pilha de seções

Cada seção é uma camada opaca do tamanho da viewport. Ao avançar, a próxima sobe de baixo e cobre a atual, que fica parada atrás e escurece levemente; ao voltar, o movimento se inverte. A troca dura cerca de 0,8 s, com saída suave e chegada desacelerada, e só então a navegação aceita outro passo.

Um gesto vale uma seção. A inércia do trackpad continua emitindo rolagem por mais de um segundo depois que os dedos saem; como ela só decresce, o passo fica gasto até a rolagem pausar ou voltar a subir de forma clara. O navegador entrega essa rolagem em pedaços: quando um quadro demora, soma vários eventos num só ou os entrega atrasados. Por isso a subida é medida em velocidade, não no tamanho de cada evento, e uma pausa só vale quando os quadros desenhados durante ela confirmam que nada chegou. Um gesto no mesmo sentido que começa durante a troca é absorvido por ela; no sentido contrário, conta quando ela termina. Uma roda girada sem parar também move uma seção por vez, e uma tecla pressionada vale uma seção. No toque, a seção acompanha o dedo e, ao soltar, completa o movimento ou retorna, sem parar entre duas.

As seções alternam tonalidade: a abertura usa o papel claro com ondas discretas; o projeto usa um azul-gelo com duas lâminas de vidro em cantos opostos; o jogo volta ao papel claro, com as mesmas lâminas espelhadas.

## Fundo em Liquid Glass

As ondas da abertura são lâminas de vidro líquido empilhadas, com as silhuetas, posições e tons médios das formas originais. Na segunda seção há duas lâminas claras, uma espelho da outra: a do canto inferior direito sobe por trás do painel de texto e a do canto superior esquerdo desce por trás do aparelho. As três dunas empilhadas que ficavam atrás do aparelho foram retiradas, porque pesavam mais do que ajudavam.

Não há linha dura entre as camadas. A borda de cada lâmina é um ombro arredondado e largo: a vista através dele começa sem desvio no contorno, alcança mais longe um terço adiante e volta ao normal, de modo que o que passa por trás é espremido contra o contorno e depois esticado, sem rasgar. A luz aparece como um lóbulo suave com um fio fino dentro, no ponto em que a inclinação do ombro devolve a luz, e por isso desliza pela borda quando ela se move. O tom da lâmina escurece de leve em direção ao contorno, como a borda de um vidro grosso.

O movimento é lento e contínuo: duas ondulações percorrem cada borda, uma curta que se vê andar e uma longa por baixo, em sentidos opostos nas lâminas vizinhas; cada lâmina também desliza de lado como um todo e a largura do ombro respira com a ondulação. Com o mouse, as lâminas cedem alguns pixels, as da frente mais. Como as camadas se movem umas contra as outras, as bordas das de trás passam sob os ombros das da frente e são dobradas à vista.

## Painéis de vidro

Atrás do bloco de texto da abertura (nome, função, descrição e seletor) e das colunas de texto dos projetos há um painel de vidro transparente, com cantos bem arredondados. O centro é limpo. A faixa da borda, com cerca de um quarto da menor metade do painel, olha para uma tira fina junto à sua margem interna e a estica por toda a faixa, cada cor um pouco diferente: quando uma onda passa por trás, ela aparece puxada em listras perpendiculares à borda, com uma franja de cor discreta. Um fio claro e um fio escuro desenham o contorno; a sombra é mínima.

O texto fica sempre para dentro da faixa da borda, e dali para dentro as lâminas atrás do painel perdem quase toda a luz e a sombra das suas bordas, restando o degrau de tom. O painel também puxa de leve o que está atrás em direção à cor da página. Com isso todo texto mantém contraste AA contra o pixel mais desfavorável do fundo, nos dois temas.

O painel chega junto com o texto: na abertura, quando o título assenta; no projeto, vindo da esquerda um pouco antes dos textos; no jogo, da direita, do mesmo modo.

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

No formato Celular, clicar no aparelho o traz para perto. Ele sai do lugar, vai ao centro da tela e cresce até o maior tamanho que cabe inteiro, com 12 a 28 px de folga, botões laterais incluídos. A curva sai devagar e chega longa (0,78 s), e a volta faz o mesmo caminho. O anel de foco some durante o zoom; o desfoque já diz quem tem a atenção. Atrás do aparelho, um véu desfoca o resto da seção. Como o navegador espelha a imagem nas bordas da tela, um texto encostado nelas ficaria nítido; por isso o texto e o fundo ganham um desfoque próprio por cima do véu. O seletor fica só com o véu, para que nenhum ancestral da lente receba um filtro. Clique no véu, Esc ou troca de seção devolvem o aparelho; se a janela mudar de tamanho durante o zoom, ele é recentralizado.

## Terceira seção

A seção espelha a segunda, para que os projetos alternem de lado. O texto fica numa coluna à esquerda, sobre um painel de vidro: índice, nome, descrição e tecnologias. Logo abaixo do painel, alinhado ao início do texto, vem o contato: o ícone do WhatsApp e o número em Manrope grande, os dois dentro do mesmo link. O verde do ícone é o único ponto de cor fora da paleta azul, de propósito: é a ação que a página pede. O vídeo ocupa o resto da largura, no maior quadro 16:9 que cabe, centrado na altura, numa moldura escura como a do aparelho da segunda seção.

No celular e no tablet em pé, tudo vira uma coluna centrada: texto, vídeo e contato, com o vídeo exatamente da largura do painel. Em celulares baixos o texto aperta, com o título numa linha e sem a lista de tecnologias; se ainda faltar altura, é o vídeo que estreita, e o contato nunca fica coberto. No celular deitado, o texto encolhe ao lado do vídeo, sem a lista de tecnologias, para caber na altura.

Na entrada, a moldura parte da esquerda, sobre o lugar que o texto vai ocupar, e cruza para a direita girando de leve no eixo vertical até ficar de frente, com um retorno curto, como o celular da segunda seção, só que mais calma. O texto vem da direita, em sequência, com a mesma curva elástica; o painel chega um pouco antes dele e o contato por último. Revelada por baixo, a seção já está pronta.

Durante a entrada a moldura mostra o primeiro quadro do vídeo, parado; o vídeo só começa quando ela para, então nada é decodificado enquanto as coisas se movem. O loop começa no início da cena da roda, e a imagem que fica sob o vídeo é exatamente esse quadro: o vídeo a cobre assim que tem um quadro próprio, e começar a tocar não muda nada na tela. O vídeo repete sem parar, sem som. O botão de pausa fica no canto da moldura e só aparece com o cursor sobre o vídeo, ou quando ele está pausado.

Uma seção pulada por um salto direto (Home, End ou um link) não fica presa na pose de espera: quando é descoberta por cima aparece no lugar, e toda seção que volta a ficar abaixo da atual recomeça sua entrada na próxima subida.

## Blocos de texto

Os parágrafos de descrição (o da abertura, a chamada e a descrição do e-commerce, a descrição do jogo) formam blocos de bordas retas, como um texto justificado, mas sem abrir os espaços entre as palavras. As linhas são quebradas de modo que todas, inclusive a última, fiquem quase da mesma largura, e a pequena diferença que sobra é repartida entre todos os caracteres da linha: uma fração de pixel em cada um, de −0,02 a +0,04 em nas telas testadas. Quando as palavras inteiras não fecham o bloco, uma palavra é dividida por sílaba, com hífen.

O número de linhas é o mesmo que o texto teria sem o ajuste, então a altura da seção não muda. O bloco pode ficar mais estreito que a coluna: o que importa é a borda reta. Quando encher a última linha exigiria dividir várias palavras seguidas, ela fica curta e começa na borda esquerda do bloco, também nos layouts centralizados. Um parágrafo de uma linha só fica como está.

As divisões silábicas vêm de uma lista escrita à mão em `typeset.js`. Um texto novo precisa ter suas palavras longas acrescentadas ali, senão só quebra entre palavras. Num parágrafo com palavra dividida o leitor de tela recebe o texto original, inteiro. Sem JavaScript os parágrafos ficam como escritos.

## Leveza

A página chega num pedido com o CSS embutido, e todo o JavaScript vem num único arquivo minificado. Um script mínimo no `<head>` aplica o tema escolhido e a pose inicial da abertura antes da primeira pintura, para que nem o tema diurno nem a abertura pronta apareçam por um instante. A Manrope vai recortada aos caracteres latinos, com todas as variações e recursos, e a animação de abertura espera só por ela.

Tudo o que a visita vai precisar é preparado sob o cartão de loading, e nada disso fica para depois: as animações não disputam a rede nem o processador com downloads, compilações ou cálculos. As imagens das outras seções começam a baixar junto com a página, com prioridade baixa, e são decodificadas antes de o cartão sair; a tela do computador só é pedida onde esse formato existe. A demonstração real é carregada somente quando alguém clica na tela, com uma barra de progresso no topo, e é removida ao sair. Fora desse momento as duas seções não executam nada em segundo plano.

O pôster do vídeo do jogo vem com as outras imagens; o arquivo do vídeo começa a baixar só depois que o cartão sai, ou, com economia de dados, quando o visitante chega à seção anterior. O vídeo só toca enquanto a sua seção está na tela. Ele continua em H.264, decodificado pelo hardware em todo lugar, recodificado com metade do peso e sem diferença visível.

Os blocos de texto são compostos sob o cartão. Depois, a composição roda de novo só quando a largura disponível muda, em 2 a 4 ms por quadro. Parada, não faz nada.

O mapa de refração de cada lente é calculado uma vez por tamanho, sob o cartão: a lente já nasce no lugar, sem a transição de largura que o fazia ser refeito a cada quadro. A geometria é calculada num quarto do contorno, que é simétrico, com resultado idêntico byte a byte, e a imagem é codificada fora da thread principal.

As animações de entrada e a troca de seção usam apenas transformações e opacidade. Seções cobertas ficam ocultas e inertes; a seguinte espera desenhada logo abaixo da tela, numa camada própria, para que a troca comece sem nada a pintar, e depois de uma troca só é desenhada quando a entrada terminou. As camadas de profundidade do celular só existem durante o giro.

O fundo em vidro é desenhado pela placa de vídeo, um canvas por seção. Só a seção na tela desenha, em todo quadro da tela, e o movimento depende só do relógio, então a velocidade é a mesma a 30, 60 ou 120 quadros. Numa troca de seção, a que sai para de desenhar. Fora da tela, com a aba oculta ou com a demonstração do e-commerce ativa, não desenha nada. A parte da página acima da onda mais alta e do painel nem é calculada.

A resolução do canvas tem teto fixo. O fundo começa a 30 quadros por segundo e, logo no início, um quadro é cronometrado até o fim: se a placa de vídeo usar até 36% do tempo de um quadro (entre 3 e 6 ms), o fundo passa a ser desenhado em todo quadro. Se não, o quadro é cronometrado de novo um segundo depois; lento duas vezes, o canvas fica mais grosso, nunca abaixo de um pixel por pixel de CSS, e é cronometrado mais uma vez. Lento ainda, fica nos 30 quadros. Trocar de tema é uma mistura dos parâmetros dentro do mesmo desenho, sem imagens guardadas.

Sem WebGL2, se o shader não compilar ou se o contexto for perdido, voltam as formas sólidas, com uma folha translúcida simples no lugar do painel. Sem JavaScript ficam só as formas sólidas.

O código da versão anterior foi preservado em [`pasta temporaria/`](../pasta%20temporaria/), incluindo a exportação antiga e `sources-nival`.
