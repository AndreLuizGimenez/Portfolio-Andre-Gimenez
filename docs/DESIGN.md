# Direção visual da primeira seção

A versão ativa é uma única seção vertical de `100vh`, pensada primeiro para desktop e adaptada para telas menores. O conteúdo principal fica centralizado no eixo da viewport: identificação, título, nome, função, descrição e seletor de tema.

O título usa Manrope 600, servido localmente com sua licença OFL, e espaçamento que conserva a separação entre os caracteres. Textos de apoio usam a tipografia nativa Apple. A entrada é construída por grupos de palavras com máscara, escala, deformação curta, impacto e acomodação elástica. O evento de acomodação do título libera nome, função, descrição e seletor em sequência, com a mesma curva de movimento. Ao final, os estados de animação são removidos.

A paleta diurna parte de um fundo claro tonalizado, azul escuro no título, azul médio nos acentos e azul claro nos detalhes. A paleta noturna troca o canvas para azul-marinho profundo e mantém os mesmos acentos. O fundo tem apenas formas sólidas suaves e discretas; não há degradês.

O seletor diurno/noturno usa um rolo azul acinzentado e uma lente transparente, sem preenchimento. A seleção expande apenas durante a troca e acomoda rapidamente. A lente captura o fundo numa área maior que sua forma, refrata e depois recorta o resultado nas curvas; isso evita cantos vazios na amostragem. A distorção aumenta linearmente numa faixa que ocupa cerca de 83% do raio. Um mapa de luz acompanha a curvatura, preservando o centro transparente. Texto e ícones ficam sobre a óptica e permanecem nítidos.

Nenhum ancestral do seletor mantém máscara, opacidade parcial ou filtro depois da entrada. Essas propriedades limitam o conteúdo que um filtro de fundo pode amostrar, conforme a [definição de Backdrop Root do CSSWG](https://drafts.csswg.org/filter-effects-2/#BackdropRoot). O rolo não usa um filtro de fundo, permitindo que a lente refrate tanto sua borda quanto a página. Chromium recebe refração SVG; outros motores conservam reflexos e transparência como fallback.

O código da versão anterior foi preservado em [`pasta temporaria/`](../pasta%20temporaria/), incluindo a exportação antiga e `sources-nival`.
