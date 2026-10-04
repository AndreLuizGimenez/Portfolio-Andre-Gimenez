'use client';
/* Galeria de compra: sincroniza foto ativa, miniaturas, setas e abertura do lightbox.
 * Pré-aquece o módulo da ampliação por proximidade/foco e devolve o foco à foto ao fechar. */

import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize2 } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { photos } from './product-photos';
import { product } from '../content/product';

let lightboxModule: ReturnType<typeof importLightbox> | undefined;
const importLightbox = () => import('./product-lightbox');
const loadLightbox = () => lightboxModule ??= importLightbox().catch(error => { lightboxModule = undefined; throw error; });
const ProductLightbox = lazy(loadLightbox);

const ProductGallery = memo(function ProductGallery({motion}:{motion:boolean}) {
  const [api,setApi]=useState<CarouselApi>();
  const [index,setIndex]=useState(0);
  const [expanded,setExpanded]=useState<number|null>(null);
  const [lightboxMounted,setLightboxMounted]=useState(false);
  const photoButtons=useRef<(HTMLButtonElement|null)[]>([]);
  const gallery=useRef<HTMLDivElement>(null);
  const lastExpanded=useRef(0);
  // Limita o índice solicitado, abre o diálogo e sincroniza a galeria.
  function showPhoto(next:number){
    const selected=Math.max(0,Math.min(photos.length-1,next));
    lastExpanded.current=selected;
    setLightboxMounted(true);
    setExpanded(selected);
    api?.scrollTo(selected,!motion);
  }
  // Prepara o diálogo antecipadamente para reduzir o atraso do primeiro clique.
  function warmLightbox(){
    if(lightboxMounted)return;
    // Mount the already downloaded, closed dialog ahead of the first click so
    // React's initial lazy resolution cannot delay the opening animation.
    void loadLightbox().then(()=>{if(gallery.current)setLightboxMounted(true);}).catch(()=>{});
  }
  useEffect(()=>{
    const element=gallery.current;
    if(!element)return;
    let active=true;
    // Warm the zoom module before the purchase area arrives on screen.
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      void loadLightbox().then(()=>{if(active)setLightboxMounted(true);}).catch(()=>{});observer.disconnect();
    },{rootMargin:'1000px'});
    observer.observe(element);return()=>{active=false;observer.disconnect();};
  },[]);
  useEffect(()=>{
    if(!api)return;
    const update=()=>setIndex(api.selectedScrollSnap());
    update();api.on('select',update);api.on('reInit',update);
    return()=>{api.off('select',update);api.off('reInit',update);};
  },[api]);
  return <><Carousel ref={gallery} onPointerEnter={warmLightbox} onFocusCapture={warmLightbox} className="offer-photo product-gallery" opts={{align:'start',loop:false,duration:motion?28:0}} setApi={setApi} aria-label={`Imagens do ${product.name}`}>
    <CarouselContent className="gallery-track">
      {photos.map((photo,i)=><CarouselItem className={`gallery-item gallery-item-${i}`} key={photo.src} aria-label={`${i+1} de ${photos.length}: ${photo.label}`}>
        <button className="gallery-enlarge" ref={el=>{photoButtons.current[i]=el;}} type="button" tabIndex={i===index?0:-1} aria-label={`Ampliar imagem: ${photo.label}`} aria-haspopup="dialog" onClick={event=>{if(!event.defaultPrevented)showPhoto(i);}}>
          <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" draggable={false}/>
          <span className="gallery-zoom-hint" aria-hidden="true"><Maximize2 size={15}/>Ampliar</span>
        </button>
      </CarouselItem>)}
    </CarouselContent>
    <div className="gallery-controls">
      <div className="gallery-thumbnails" role="group" aria-label="Escolher imagem do produto">
        {photos.map((photo,i)=><button key={photo.src} type="button" className="gallery-thumbnail" aria-label={`Ver imagem: ${photo.label}`} aria-pressed={i===index} onClick={()=>api?.scrollTo(i,!motion)}>
          <img src={photo.src} alt="" width={90} height={60} loading="lazy" draggable={false}/>
        </button>)}
      </div>
      <p className="offer-dimensions" aria-label="Medidas do travesseiro: 60 por 40 por 11 centímetros">60 × 40 × 11 <span>cm</span></p>
    </div>
    <div className="gallery-caption">
      <div className="gallery-arrows">
        <button type="button" className="button gallery-arrow" aria-label="Imagem anterior do produto" disabled={index===0} onClick={()=>api?.scrollPrev(!motion)}><ArrowLeft size={18}/></button>
        <button type="button" className="button gallery-arrow" aria-label="Próxima imagem do produto" disabled={index===photos.length-1} onClick={()=>api?.scrollNext(!motion)}><ArrowRight size={18}/></button>
      </div>
      <span aria-live="polite" aria-atomic="true" aria-label={`Imagem ${index+1} de ${photos.length}`}>{String(index+1).padStart(2,'0')} / {String(photos.length).padStart(2,'0')}</span>
    </div>
  </Carousel>
  {lightboxMounted&&<Suspense fallback={null}><ProductLightbox expanded={expanded} index={index} showPhoto={showPhoto}
    onClose={()=>setExpanded(null)} onReturnFocus={()=>photoButtons.current[lastExpanded.current]?.focus({preventScroll:true})}/></Suspense>}</>;
});

export default ProductGallery;
