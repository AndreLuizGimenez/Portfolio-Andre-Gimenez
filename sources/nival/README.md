# Demonstração Nival

Cópia isolada do projeto original em 04/10/2026. Componentes React reais, folhas de estilo e assets foram preservados. O entrypoint Vite usa base `/demos/nival/`; recursos absolutos dos componentes foram ajustados na cópia para essa base. Não há backend nem checkout.

Requer Node.js 22.13 ou superior. Para atualizar os recursos compilados:

```sh
npm ci
npm run build
cp -R static/. ../../dist/demos/nival/
```

## Integração no portfólio

`main.tsx` instala `portfolio-scroll-bridge.ts` antes dos controladores React. A ponte só atua dentro de um iframe de mesma origem: transfere wheel/touch ao documento pai nas extremidades globais, depois de esgotar a rolagem de painéis internos. O FAQ desktop conserva sua rolagem mesmo quando o cursor está sobre seu controle flutuante. O evento `portfolio:scroll-handoff` cancela o gesto nos controladores internos para evitar dois destinos concorrentes.

Campos, diálogos, pinch, gestos horizontais e transições internas não são transferidos. O loader pode liberar rolagem ao portfólio. Em tela cheia e na demonstração aberta sozinha não há transferência. A ponte desativa o encadeamento nativo de overscroll no iframe e restaura estilos e listeners na limpeza.

A seleção de celular/computador no portfólio conserva o iframe e retorna ao hero `#inicio`, antes e após mudar o viewport. O reset usa `nival:section-navigation` instantâneo no mobile e rolagem direta no desktop; aguarda transições de especificações, com recarga apenas como fallback.

Execute os 12 testes da ponte nesta pasta:

```sh
node --experimental-strip-types --test portfolio-scroll-bridge.test.mjs
```

Os testes usam stubs do DOM e verificam extremidades, FAQ, exclusões de gestos, transições, tela cheia e limpeza. O visual Liquid Glass, a fonte Apple local, a revelação por palavras e o contato WhatsApp pertencem à página externa do portfólio, sem substituir o design próprio desta demonstração.

Para atualizar a cópia a partir do projeto original, revise componentes e estilos, preserve o prefixo `/demos/nival/` nos caminhos de mídia e execute o build. A demonstração do portfólio é um snapshot independente; não altera nem sincroniza automaticamente o projeto original.

Imagens geradas e a representação 3D são ilustrativas. Nome “XXXX”, preço provisório e compra indisponível permanecem como na fonte.
