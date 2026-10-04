# Demonstração Nival

Cópia isolada do projeto original em 04/10/2026. Componentes React reais, folhas de estilo e assets foram preservados. O entrypoint Vite usa base `/demos/nival/`; recursos absolutos dos componentes foram ajustados na cópia para essa base. Não há backend nem checkout.

Requer Node.js 22.13 ou superior. Para atualizar os recursos compilados:

```sh
npm ci
npm run build
cp -R static/. ../../dist/demos/nival/
```

Para atualizar a cópia a partir do projeto original, revise componentes e estilos, preserve o prefixo `/demos/nival/` nos caminhos de mídia e execute o build. A demonstração do portfólio é um snapshot independente; não altera nem sincroniza automaticamente o projeto original.

Imagens geradas e a representação 3D são ilustrativas. Nome “XXXX”, preço provisório e compra indisponível permanecem como na fonte.
