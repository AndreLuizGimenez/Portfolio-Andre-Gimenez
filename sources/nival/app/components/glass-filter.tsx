/* Define um filtro SVG de refração que pode ser referenciado pelo CSS via url(#nival-glass).
 * O SVG fornece o efeito; são os seletores CSS consumidores que determinam onde ele aparece. */
// A displacement map bends the backdrop at the rim; lettering stays outside the filter.
const refractionMap = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80"><defs><linearGradient id="x"><stop offset="0" stop-color="#ff0000"/><stop offset=".12" stop-color="#800000"/><stop offset=".88" stop-color="#800000"/><stop offset="1" stop-color="#000000"/></linearGradient><linearGradient id="y" x2="0" y2="1"><stop offset="0" stop-color="#00ff00"/><stop offset=".24" stop-color="#008000"/><stop offset=".76" stop-color="#008000"/><stop offset="1" stop-color="#000000"/></linearGradient></defs><rect width="300" height="80" fill="url(#x)"/><rect width="300" height="80" fill="url(#y)" style="mix-blend-mode:screen"/></svg>`)}`;

export default function GlassFilter() {
  return <svg className="glass-filter-defs" aria-hidden="true" focusable="false">
    <defs>
      <filter id="nival-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={refractionMap} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lens"/>
        <feDisplacementMap in="SourceGraphic" in2="lens" scale="18" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>
  </svg>;
}
