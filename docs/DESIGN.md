# Direção atual

Página focada em dois projetos, com prioridade para computador e adaptação para celular. O visitante deve encontrar imediatamente as demonstrações. O currículo contém a apresentação profissional; não repetir blocos de biografia, processo, slogans ou uma chamada grande de contato.

Os títulos públicos seguem o currículo: **E-commerce | AI-Driven Development** e **Game Development | Unreal Engine + MCP**. Não apresentar os nomes próprios dos projetos. Os caminhos técnicos dos assets e da demonstração podem conservar seus nomes originais.

Estética Liquid Glass: fundo contínuo com gradientes suaves de azul e lavanda, superfícies translúcidas, bordas claras, desfoque e reflexos discretos. O vidro aparece na navegação, no seletor, nas molduras e nos controles; não vira um cartão para cada seção. A página principal usa SF Pro disponível localmente no sistema Apple, com fallback de sistema em outras plataformas. Nenhum arquivo da fonte Apple é distribuído ou baixado pelo portfólio.

A explicação acima de cada mídia descreve apenas o projeto. O vídeo ocupa toda a largura; a demonstração web aparece exatamente uma vez, começa em um celular maior e se expande para uma moldura de computador. O rodapé destaca o telefone em tamanho grande como link para WhatsApp, além de e-mail e retorno ao início.

Movimento: títulos e descrições aparecem palavra por palavra com opacidade, deslocamento e desfoque; mídia com escala discreta na entrada; seleção de formato com indicador deslizante; expansão da mesma moldura; respostas ao hover e foco. Não mover a moldura continuamente durante a interação. Respeitar `prefers-reduced-motion`: texto sempre visível, sem revelação por palavras ou expansão espacial, e vídeo sem autoplay. O vídeo reproduz em loop e pausa fora da tela ou com a aba oculta.

Na escolha de um formato, a demonstração sempre retorna à primeira tela. A instrução acima da moldura orienta mouse ou toque conforme o dispositivo.

A demonstração usa um iframe de mesma origem. A ponte de wheel e touch só transfere a rolagem ao portfólio nas extremidades globais do documento, após esgotar a rolagem interna, inclusive o painel de FAQ no desktop. Não transfere gestos durante as transições internas nem em tela cheia. O carregamento pode liberar rolagem ao portfólio; campos, diálogos, pinch e gestos horizontais mantêm seu comportamento próprio. A página aberta sozinha não instala a ponte. Os 12 testes Node de `sources/nival/portfolio-scroll-bridge.test.mjs` cobrem essas regras e a limpeza dos listeners.

Referências consultadas: Sites building e hosting; [Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md); orientações de [animate](https://github.com/pbakaus/impeccable/blob/main/skill/reference/animate.md) do Impeccable. As skills externas foram lidas como orientações; não foram instaladas globalmente.
