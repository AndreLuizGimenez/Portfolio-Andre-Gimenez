# Portfólio — André Gimenez

Portfólio focado em dois projetos, com prioridade para computador e adaptação para celular. A demonstração do e-commerce aparece uma única vez: começa dentro de um celular maior, pode se expandir para uma janela de computador e tem opção de tela cheia. O vídeo de desenvolvimento na Unreal Engine fica em largura total. As descrições acima das mídias tratam apenas dos projetos. A página usa os títulos do currículo e não apresenta os nomes próprios dos projetos.

O visual Liquid Glass usa branco tonalizado como base, azul escuro acinzentado nos destaques maiores, azul claro apenas nos pequenos detalhes e texto preto ou branco conforme a superfície. As bordas têm reflexos prismáticos discretos e refração do fundo em Chromium, com desfoque como fallback nos demais motores. O contato destaca o telefone em tamanho grande com link para WhatsApp.

## Prévia local

Na pasta deste arquivo:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Abra `http://127.0.0.1:4173/`. O site principal é HTML/CSS/JavaScript estático, sem instalação de dependências nem etapa de build. Validação de referências locais e sintaxe:

```sh
python3 scripts/check-assets.py
node --check dist/portfolio/site.js
node --test scripts/demo-interaction.test.mjs
node --experimental-strip-types --test sources/nival/portfolio-scroll-bridge.test.mjs
```

A suíte da ponte de rolagem tem 12 testes e requer Node.js 22.13 ou superior. Os testes usam stubs do DOM; não substituem a verificação dos gestos em um navegador.

## Arquivos principais

- `dist/index.html`: conteúdo e estrutura do portfólio.
- `dist/portfolio/style.css`: composição desktop, adaptações mobile, molduras e estados de interação.
- `dist/portfolio/site.js`: revelação dos textos, alternância de formato, escala real do iframe, recepção da rolagem externa, tela cheia e reprodução do vídeo.
- `dist/portfolio/demo-interaction.mjs`: ativação por clique, centralização, limite responsivo da moldura e saída do modo interativo.
- `scripts/demo-interaction.test.mjs`: verificação do encaixe e da centralização em telas curtas, além do fim do conteúdo e do FAQ.
- `dist/portfolio/roda-roda.mp4`: cópia do vídeo final fornecido pelo usuário.
- `dist/demos/nival/`: exportação estática da experiência original, com componentes reais e recursos locais.
- `sources/nival/`: fonte isolada e reproduzível da exportação; veja seu README antes de atualizar a demonstração.
- `sources/nival/portfolio-scroll-bridge.ts`: ponte de wheel/touch da demonstração para o portfólio nas extremidades globais.
- `sources/nival/portfolio-scroll-bridge.test.mjs`: 12 testes Node da ponte, com rolagem do FAQ, gestos, transições, tela cheia e limpeza de listeners.
- `.openai/hosting.json`: identidade e configuração de hospedagem. O site começa com acesso privado.

## Conteúdo e edição

A descrição dos projetos destaca planejamento, desenvolvimento com IA, UI/UX, testes e refinamento. O texto público não cita empresa nem vaga. Não foram inventados resultados comerciais, datas de experiência, clientes ou competências sem base no material fornecido.

O Nival é um conceito em desenvolvimento: nome “XXXX”, preço provisório e compra indisponível. O vídeo Roda Roda contém participantes simulados e uma waveform ilustrativa; não é evidência de multiplayer em rede nem de captura real de microfone.

O currículo e o contexto da vaga foram usados apenas neste projeto. Nenhum arquivo de memória global foi criado.

## Movimento

Títulos e descrições aparecem palavra por palavra, com opacidade, deslocamento e desfoque. A mídia entra com escala discreta. O seletor tem indicador deslizante em vidro escuro translúcido e a moldura se expande com uma única instância do iframe. A navegação de projetos permanece fixa durante a rolagem; identidade e tema ficam no cabeçalho inicial. O controle Diurno/Noturno alterna entre a composição clara atual e uma composição escura, preservando os acentos de vidro azul, e guarda a escolha localmente. A escolha de cada formato retorna ao início pelos controles da demonstração, antes e após o resize, com um desfoque curto durante a transição. O estado de celular usa viewport lógico 393 × 852, e o computador usa 1440 × 900, escalados proporcionalmente à moldura. Tela cheia reutiliza a mesma demonstração. `prefers-reduced-motion` mantém o texto visível, remove a revelação por palavras, a expansão espacial e o desfoque de troca, e impede autoplay do vídeo. Loops de vídeo pausam fora da tela ou quando a aba fica oculta.

Tipografia principal: SF Pro disponível localmente no sistema Apple, seguida de `-apple-system`, `BlinkMacSystemFont` e fallbacks de sistema. A página principal não baixa nem redistribui arquivos de fontes Apple. As fontes próprias da demonstração permanecem no snapshot.

## Rolagem da demonstração

A moldura começa desativada: passar o mouse apenas realça levemente suas bordas. O clique ou toque ativa a demonstração e centraliza a moldura inteira, com tamanho máximo que cabe na viewport. Clicar fora ou terminar o conteúdo desativa o modo, devolvendo a rolagem ao portfólio. Enquanto ativa, wheel sobre o fundo também segue para a demonstração. Escape oferece saída pelo teclado. A troca de formato desativa a interação e reinicia o projeto.

A ponte funciona apenas quando o iframe e o portfólio têm a mesma origem. Wheel/touch continuam na demonstração enquanto ela ou algum painel interno ainda podem rolar. O portfólio aceita a transferência ao fim do conteúdo; o FAQ desktop conserva sua rolagem interna mesmo com o cursor sobre o controle flutuante. Enquanto ativo, limite superior e carregamento preservam a centralização. Campos, diálogos, pinch, gestos horizontais e transições internas ficam independentes. Em tela cheia não há transferência. Abrir a demonstração sozinha também desativa a ponte.
