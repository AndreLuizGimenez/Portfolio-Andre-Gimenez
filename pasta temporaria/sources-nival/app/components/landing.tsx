'use client';
/* Orquestra a página: loading, acessibilidade, navegação, cena 3D e montagem das seções.
 * Refs guardam valores de animação sem renderizar React a cada frame; estados controlam mudanças visíveis da interface.
 * Os efeitos instalam recursos e devolvem funções de limpeza. JSX no final reúne hero, história, compra e especificações. */
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowUpRight, ArrowDown, ArrowUp } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { product, money } from '../content/product';
import GlassFilter from './glass-filter';
import { isCompactStory } from './story-layout';
import ProductGallery from './product-gallery';
import { photos } from './product-photos';
import { useLetterReveal } from './use-letter-reveal';
import { useScrollResistance } from './use-scroll-resistance';
import { useMobilePageHeight } from './use-mobile-page-height';
import { useHeroPhotoBoundary } from './use-hero-photo-boundary';
import { useStoryCta } from './use-story-cta';
import { scrollToSection } from './scroll-to-section';
import { useSpecificationsTransition } from './use-specifications-transition';
import { storyChapter, storyCopyBlend } from './pillow/timeline';
import { storyEntryProgress, storyOpeningMs, type ScrollGate } from './scroll-gates';
import { shouldResetStoryOpening, storyEntranceState } from './story-entrance';

// Recursos preparados antes da abertura: imagem principal, fundo da história e fotografias da galeria.
const heroMobileImage='/demos/nival/images/hero-sleep-neutral-light-2026-09-30.webp';
const heroDesktopImage='/demos/nival/images/hero-sleep-desktop-contour-2026-09-30.webp';
const heroDesktopMedia='(min-width: 1024px)';
const preloadImages=[
  heroMobileImage,
  '/demos/nival/images/story-background-photo-v1.webp',
  ...photos.map(photo=>photo.src),
];
const preloadTaskCount=preloadImages.length+3;

// Espera a decodificação, além do download, para evitar a primeira exibição com imagem incompleta.
function decodeImage(src:string){
  const image=new Image();
  image.src=src;
  return image.decode();
}

export default function Landing(){
  // Referências do DOM e da animação: valores mutáveis que não exigem um novo render React.
  const root=useRef<HTMLDivElement>(null);
  const story=useRef<HTMLElement>(null);
  const canvas=useRef<HTMLDivElement>(null);
  const storyProgress=useRef(0);
  const {sticky,stickyBuy,positionSticky}=useStoryCta(root,story,storyProgress);
  const storyOpeningComplete=useRef(false);
  const ensureStoryOpening=useRef<()=>void>(()=>{});
  const syncStoryScroll=useRef<(y:number)=>void>(()=>{});
  const onScrollFrame=useCallback((y:number)=>syncStoryScroll.current(y),[]);
  const revealed=useRef(false);
  const canLeaveStoryEntrance=useCallback(()=>storyOpeningComplete.current,[]);
  const storyCopyOpacity=useRef([1,0,0]);
  const storyDestination=useRef<{chapter:number;origin:number;opacity:number[]}|undefined>(undefined);
  const selectedStoryChapter=useRef<number|null>(null);
  const updateStoryChapter=useRef<()=>void>(()=>{});
  const onScrollDestination=useCallback((target:ScrollGate|undefined,settled:boolean)=>{
    // Capture the current blend on each gesture, including a reversal.
    // Arrival must not restart a fade that already completed with the model.
    if(!target){storyDestination.current=undefined;selectedStoryChapter.current=null;updateStoryChapter.current();return;}
    if(target.storyChapter!==undefined){
      if(!settled)storyDestination.current={chapter:target.storyChapter,origin:storyProgress.current,opacity:[...storyCopyOpacity.current]};
      if(settled){
        if(target.storyChapter===0)ensureStoryOpening.current();
        updateStoryChapter.current();
      }
    }
  },[]);
  // Estados de interface: preferências, compra, recuperação WebGL e etapas do loading.
  const [systemReduced,setSystemReduced]=useState(false);
  const [purchaseRequested,setPurchaseRequested]=useState(false);
  const [sceneFailed,setSceneFailed]=useState(false);
  const [scenePrepared,setScenePrepared]=useState(false);
  const [sceneRevision,setSceneRevision]=useState(0);
  const [preloadCount,setPreloadCount]=useState(0);
  const [assetsPrepared,setAssetsPrepared]=useState(false);
  const [loaderLeaving,setLoaderLeaving]=useState(false);
  const [siteRevealed,setSiteRevealed]=useState(false);
  const loadingStarted=useRef(0);
  const allowMotion=!systemReduced;
  const sceneReady=scenePrepared||sceneFailed||!allowMotion;
  const loadingProgress=Math.round((preloadCount+(sceneReady?1:0))/(preloadTaskCount+1)*100);
  const {open:specificationsOpen,mounted:specificationsMounted,button:specificationsButton,toggle:toggleSpecifications,close:closeSpecifications}=useSpecificationsTransition(root,allowMotion);
  useLetterReveal(root,allowMotion&&siteRevealed);
  useMobilePageHeight(root);
  useHeroPhotoBoundary(root);
  useScrollResistance(root,allowMotion,onScrollDestination,canLeaveStoryEntrance,closeSpecifications,onScrollFrame);
  useEffect(()=>{
    revealed.current=siteRevealed;
    if(siteRevealed)ensureStoryOpening.current();
  },[siteRevealed]);

  useEffect(()=>{
    // Pré-carrega fotos, fontes e módulos; cada tarefa concluída atualiza a barra de progresso.
    loadingStarted.current=performance.now();
    let active=true;
    const settled=()=>{if(active)setPreloadCount(value=>Math.min(preloadTaskCount,value+1));};
    // Decode every photograph used by the page, even those below the fold.
    // The model has its own readiness signal after its meshes and shaders load.
    const heroImage=window.matchMedia(heroDesktopMedia).matches?heroDesktopImage:heroMobileImage;
    const tasks=[
      ...preloadImages.map(src=>decodeImage(src===heroMobileImage?heroImage:src)),
      document.fonts.load('500 16px Manrope'),
      document.fonts.load('500 16px "DM Sans"'),
      Promise.all([import('gsap/SplitText'),import('./product-lightbox')]),
    ];
    void Promise.all(tasks.map(task=>Promise.resolve(task).then(settled,settled))).then(()=>{
      if(active)setAssetsPrepared(true);
    });
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    // Limite de espera: libera a apresentação de fallback se um recurso não responder.
    if(loaderLeaving||siteRevealed)return;
    // A broken network or WebGL driver must never leave the visitor trapped.
    const timeout=window.setTimeout(()=>{
      setPreloadCount(preloadTaskCount);
      setAssetsPrepared(true);
      setSceneFailed(true);
    },20000);
    return()=>window.clearTimeout(timeout);
  },[loaderLeaving,siteRevealed]);
  useEffect(()=>{
    // Só inicia a saída quando os recursos e a cena estão prontos, respeitando o tempo mínimo visual.
    if(!assetsPrepared||!sceneReady||loaderLeaving)return;
    const remaining=Math.max(0,750-(performance.now()-loadingStarted.current));
    const timer=window.setTimeout(()=>setLoaderLeaving(true),remaining);
    return()=>window.clearTimeout(timer);
  },[assetsPrepared,sceneReady,loaderLeaving]);
  useEffect(()=>{
    // Após a saída do overlay, libera o conteúdo e suas animações de entrada.
    if(!loaderLeaving)return;
    const timer=window.setTimeout(()=>setSiteRevealed(true),systemReduced?0:600);
    return()=>window.clearTimeout(timer);
  },[loaderLeaving,systemReduced]);
  useEffect(()=>{
    // Position a deep link beneath the fading loader, before touch and wheel
    // input are released. Otherwise the page visibly jumps after reveal.
    if(!loaderLeaving||!window.location.hash)return;
    const id=decodeURIComponent(window.location.hash.slice(1));
    const target=document.getElementById(id);
    if(!target)return;
    const frame=requestAnimationFrame(()=>scrollToSection(target,'instant'));
    return()=>cancelAnimationFrame(frame);
  },[loaderLeaving]);

  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setSystemReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{
    document.documentElement.classList.toggle('motion-paused',!allowMotion);
    return()=>document.documentElement.classList.remove('motion-paused');
  },[allowMotion]);
  useEffect(()=>{
    // Ajusta o título apenas se houver corte horizontal; observa o painel, não cada frame.
    const title=root.current?.querySelector<HTMLElement>('.hero-copy h1');
    const panel=root.current?.querySelector<HTMLElement>('.hero-panel');
    if(!title||!panel)return;
    let frame=0;
    const fitOnlyWhenClipped=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        // Restore the breakpoint's intended type size first. Only scale it
        // down if a no-wrap headline would otherwise be cut by its text box.
        title.style.removeProperty('font-size');
        const preferred=Number.parseFloat(getComputedStyle(title).fontSize);
        if(title.scrollWidth<=title.clientWidth+1)return;
        let low=30,high=preferred;
        for(let i=0;i<12;i++){
          const candidate=(low+high)/2;
          title.style.fontSize=`${candidate}px`;
          if(title.scrollWidth<=title.clientWidth+1)low=candidate;
          else high=candidate;
        }
        title.style.fontSize=`${low}px`;
      });
    };
    const observer=new ResizeObserver(fitOnlyWhenClipped);
    observer.observe(panel);
    fitOnlyWhenClipped();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();title.style.removeProperty('font-size');};
  },[]);


  useEffect(()=>{
    // A temporary asset/module failure must not permanently pin a preview tab
    // to the static poster, including after a development update is repaired.
    // Permite recuperar uma falha temporária ao retomar a aba, reconectar ou atualizar em desenvolvimento.
    if(!sceneFailed)return;
    const recover=()=>{setSceneFailed(false);setSceneRevision(value=>value+1);};
    const visible=()=>{if(!document.hidden)recover();};
    const hot=(import.meta as ImportMeta & {hot?:{on:(event:string,callback:()=>void)=>void;off:(event:string,callback:()=>void)=>void}}).hot;
    window.addEventListener('online',recover);
    window.addEventListener('pageshow',recover);
    document.addEventListener('visibilitychange',visible);
    hot?.on('vite:afterUpdate',recover);
    return()=>{
      window.removeEventListener('online',recover);
      window.removeEventListener('pageshow',recover);
      document.removeEventListener('visibilitychange',visible);
      hot?.off('vite:afterUpdate',recover);
    };
  },[sceneFailed]);

  useEffect(()=>{
    // Ciclo de vida 3D: importa módulos, tenta carregar, instala timelines e desmonta recursos/listeners.
    const sectionElement=story.current,hostElement=canvas.current;if(!sectionElement||!hostElement||!allowMotion||sceneFailed)return;
    const section:HTMLElement=sectionElement,host:HTMLDivElement=hostElement;
    let cancelled=false,attempts=0,recovering=false,retryTimer=0;
    const sceneRequest=new AbortController();
    let disposeScene:(()=>void)|undefined;
    let disposeCallout:(()=>void)|undefined;
    let disposeSceneLayout:(()=>void)|undefined;
    let killTrigger:(()=>void)|undefined;
    // Desliga triggers, observadores e cena, e restaura a semântica das descrições de fallback.
    function clearScene(){
      section.classList.remove('is-opening');
      storyOpeningComplete.current=true;
      ensureStoryOpening.current=()=>{};
      syncStoryScroll.current=()=>{};
      updateStoryChapter.current=()=>{};
      killTrigger?.();killTrigger=undefined;
      disposeSceneLayout?.();disposeSceneLayout=undefined;
      disposeCallout?.();disposeCallout=undefined;
      disposeScene?.();disposeScene=undefined;
      section.classList.remove('is-enhanced');
      section.querySelectorAll<HTMLElement>('.story-chapter').forEach(el=>{el.removeAttribute('aria-hidden');el.inert=false;el.style.removeProperty('opacity');el.style.removeProperty('visibility');});
    }
    // Limpa a tentativa que falhou e agenda nova tentativa limitada, ou ativa a imagem de fallback.
    function failed(error:unknown){
      if(cancelled||recovering)return;
      recovering=true;
      setScenePrepared(false);
      clearScene();
      console.warn('[Nival] Não foi possível carregar a cena 3D.',error);
      if(attempts<3){
        retryTimer=window.setTimeout(()=>{void startScene();},attempts*650);
      }else setSceneFailed(true);
    }
    // Carrega os módulos em paralelo e conecta cena, linha explicativa e progresso de rolagem.
    async function startScene(){
      if(cancelled)return;
      recovering=false;attempts++;
      storyOpeningComplete.current=false;
      try {
        const [{createPillowScene},{createStoryCallout},{gsap},{ScrollTrigger}]=await Promise.all([import('./pillow-scene'),import('./story-callout'),import('gsap'),import('gsap/ScrollTrigger')]);
        if(cancelled)return;
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ignoreMobileResize:true});
        const callout=createStoryCallout(section,host);
        disposeCallout=()=>callout.dispose();
        const scene=await createPillowScene(host,()=>failed(new Error('Contexto WebGL interrompido.')),sceneRequest.signal,(anchor,panelBottom)=>{callout.update(anchor);positionSticky.current(panelBottom);});
        if(cancelled){scene.dispose();return;}
        disposeScene=()=>scene.dispose();
        section.classList.add('is-enhanced');
        scene.prepare();
        const chapters=Array.from(section.querySelectorAll<HTMLElement>('.story-chapter'));
        const dots=Array.from(section.querySelectorAll<HTMLElement>('.story-dot'));
        const progressbar=section.querySelector<HTMLElement>('.story-progress-fill');
        const buttonProgress=stickyBuy.current?.querySelector<HTMLElement>('.story-button-progress');
        let prior=-1;
        // Sincroniza opacidade, capítulo acessível e indicadores com o mesmo progresso do modelo.
        function updateCopy(progress=storyProgress.current){
          const destination=storyDestination.current;
          const opacity=storyCopyOpacity.current;
          if(destination!==undefined){
            const blend=storyCopyBlend(progress,destination.origin,destination.chapter);
            // Keep the two full-size descriptions from stacking over each
            // other. A narrow, low-opacity overlap preserves continuity.
            const outgoing=Math.max(0,1-blend/.55);
            const incoming=Math.max(0,(blend-.45)/.55);
            for(let i=0;i<chapters.length;i++)opacity[i]=destination.opacity[i]*outgoing+(i===destination.chapter?incoming:0);
            if(blend===1){selectedStoryChapter.current=destination.chapter;storyDestination.current=undefined;}
          }else{
            if(selectedStoryChapter.current===null||document.documentElement.classList.contains('scroll-native-mobile'))selectedStoryChapter.current=storyChapter(progress);
            for(let i=0;i<chapters.length;i++)opacity[i]=i===selectedStoryChapter.current?1:0;
          }
          // The chapter number and caption share the model's animation clock.
          chapters.forEach((chapter,i)=>{
            const value=String(opacity[i]);
            if(chapter.style.opacity!==value)chapter.style.opacity=value;
          });
          const active=opacity.indexOf(Math.max(...opacity));
          if(active!==prior){chapters.forEach((chapter,i)=>{chapter.classList.toggle('is-active',i===active);chapter.setAttribute('aria-hidden',String(i!==active));chapter.inert=i!==active;});dots.forEach((dot,i)=>dot.classList.toggle('is-active',i===active));if(buttonProgress)buttonProgress.textContent=`${String(active+1).padStart(2,'0')} / ${String(chapters.length).padStart(2,'0')}`;prior=active;}
          return active;
        }
        updateStoryChapter.current=updateCopy;
        const state={entry:0,progress:0,auto:0};
        const stage=section.querySelector<HTMLElement>('.story-stage')!;
        let closingTravel=.3,entranceTravel=stage.clientHeight,sectionStart=0,storyTravel=1;
        // Mede o espaço para fechar as capas antes que saiam do enquadramento.
        function measureClosingGeometry(){
          // offsetTop is the resting layout position: CSS entrance translate
          // never affects it. Read geometry only when the actual layout changes.
          const clearance=Math.max(1,host.offsetTop+scene.exitTop*host.clientHeight-24);
          entranceTravel=stage.clientHeight;
          sectionStart=section.getBoundingClientRect().top+window.scrollY;
          storyTravel=Math.max(1,section.offsetHeight-entranceTravel);
          const entryDistance=isCompactStory()?stage.querySelector<HTMLElement>('.story-backdrop')!.offsetHeight:stage.clientHeight*.625;
          closingTravel=Math.min(.3,clearance/Math.max(1,entryDistance));
        }
        measureClosingGeometry();
        let autoOpen:{kill:()=>void}|undefined,autoStarted=false;
        // Ao chegar à história, abre o travesseiro automaticamente antes de liberar a leitura seguinte.
        function startAutoOpen(){
          if(autoStarted||!revealed.current)return;
          autoStarted=true;
          if(state.auto>=1)return;
          section.classList.add('is-opening');
          const mobile=window.matchMedia('(max-width: 1023px), (pointer: coarse)').matches;
          autoOpen=gsap.to(state,{auto:1,duration:storyOpeningMs[mobile?'mobile':'desktop']/1000,ease:'power1.inOut',onUpdate:()=>update(true),onComplete:()=>{autoOpen=undefined;section.classList.remove('is-opening');update(true);}});
        }
        ensureStoryOpening.current=()=>{
          if(Math.abs(window.scrollY-sectionStart)>4)return;
          state.entry=1;
          startAutoOpen();
          update(true);
        };
        function resetAutoOpen(){
          autoOpen?.kill();autoOpen=undefined;autoStarted=false;state.auto=0;storyOpeningComplete.current=false;
          section.classList.remove('is-opening');
        }
        // Converte entrada e progresso interno em uma única pose para a cena e a descrição.
        function update(immediate=false){
          // The pillow stays closed while the color expands, then opens by
          // itself to the first reading pose. Further layers follow the scroll.
          const entrance=storyEntranceState(state.entry,entranceTravel,state.auto);
          const entry=entrance==='approaching'?state.entry:1;
          let closing=1;
          if(entry<1&&(state.auto>0||state.progress>0)){
            // Complete the reverse motion before the first textile edge clips.
            closing=Math.max(0,Math.min(1,1-(1-entry)/closingTravel));
          }
          const p=(state.auto*storyEntryProgress+state.progress*(1-storyEntryProgress))*closing;
          storyProgress.current=p;
          storyOpeningComplete.current=entrance==='ready';
          scene.draw(p,closing,updateCopy(p),immediate);
          if(progressbar){const value=`scaleX(${p})`;if(progressbar.style.transform!==value)progressbar.style.transform=value;}
        }
        // One physical scroll position owns both entrance and reading. Tiny
        // arrival rounding must never finish the automatic opening early.
        function syncPosition(y:number,immediate=false){
          const offset=y-sectionStart;
          const entry=offset>=-4?1:Math.max(0,1+offset/entranceTravel);
          const progress=offset>4?Math.min(1,offset/storyTravel):0;
          const changed=state.entry!==entry||state.progress!==progress;
          state.entry=entry;state.progress=progress;
          if(progress>0){
            if(state.auto<1){autoOpen?.kill();autoOpen=undefined;section.classList.remove('is-opening');state.auto=1;autoStarted=true;update(immediate);return;}
          }else if(entry===1)startAutoOpen();
          // The photo overlaps the first few pixels of the story, so its
          // entrance fraction may never reach zero at the hero stop. Reset as
          // soon as the pillow has fully closed, before the next visit.
          else if(shouldResetStoryOpening(entry,closingTravel)){
            const wasOpen=state.auto>0;
            resetAutoOpen();
            if(wasOpen){update(immediate);return;}
          }
          else if(autoOpen){autoOpen.kill();autoOpen=undefined;autoStarted=false;section.classList.remove('is-opening');}
          if(changed)update(immediate);
        }
        const trigger=ScrollTrigger.create({
          trigger:section,start:()=>sectionStart-entranceTravel,end:()=>sectionStart+storyTravel,
          onUpdate:()=>syncPosition(window.scrollY),onRefresh:()=>syncPosition(window.scrollY),
        });
        syncStoryScroll.current=y=>syncPosition(y,true);
        const refreshGeometry=()=>{measureClosingGeometry();trigger.refresh();syncPosition(window.scrollY);};
        const closingLayout=new ResizeObserver(refreshGeometry);
        closingLayout.observe(stage);closingLayout.observe(host);if(root.current)closingLayout.observe(root.current);
        stage.addEventListener('storylayoutchange',refreshGeometry);
        root.current?.addEventListener('herophotoboundarychange',refreshGeometry);
        const page=root.current;
        disposeSceneLayout=()=>{
          closingLayout.disconnect();stage.removeEventListener('storylayoutchange',refreshGeometry);
          page?.removeEventListener('herophotoboundarychange',refreshGeometry);
        };
        // Initialization callbacks may have seen progress zero before the
        // browser restored its scroll position. Select copy from the final
        // initialized pose, not that intermediate callback.
        selectedStoryChapter.current=null;
        storyDestination.current=undefined;
        let resumeFrame=0;
        const resumeScene=()=>{
          cancelAnimationFrame(resumeFrame);
          if(document.hidden)return;
          // Safari may restore scroll after pageshow without a normal scroll
          // event. Refresh the layout on resume without changing the user's
          // restored position; ordinary scroll frames reuse those measurements.
          resumeFrame=requestAnimationFrame(()=>{
            resumeFrame=0;
            measureClosingGeometry();trigger.refresh();
            selectedStoryChapter.current=null;
            storyDestination.current=undefined;
            syncPosition(window.scrollY);update();
          });
        };
        window.addEventListener('pageshow',resumeScene);
        document.addEventListener('visibilitychange',resumeScene);
        killTrigger=()=>{
          cancelAnimationFrame(resumeFrame);
          window.removeEventListener('pageshow',resumeScene);
          document.removeEventListener('visibilitychange',resumeScene);
          autoOpen?.kill();trigger.kill();
        };
        syncPosition(window.scrollY);update();
        setScenePrepared(true);
      }catch(error){failed(error);}
    }
    // The opening screen now prepares the complete scene before revealing the site.
    void startScene();
    return()=>{cancelled=true;window.clearTimeout(retryTimer);sceneRequest.abort();clearScene();};
  },[allowMotion,sceneFailed,sceneRevision,positionSticky]);

  useEffect(()=>{
    // Anima a entrada das camadas visuais; usa transformações dos elementos em vez de recalcular o layout inteiro.
    if(!allowMotion)return;let cancelled=false,cleanup:(()=>void)|undefined;
    void Promise.all([import('gsap'),import('gsap/ScrollTrigger')]).then(([{gsap},{ScrollTrigger}])=>{
      if(cancelled)return;gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ignoreMobileResize:true});
      const context=gsap.context(()=>{
        // Keep the hero photograph anchored to its layout as the page scrolls.
        gsap.set('.hero-visual',{xPercent:-50,x:0,y:0,scale:1});
        // Modern mobile browsers compose the entrance together with the page
        // hold in CSS. Keep a synchronized fallback for desktop/older engines.
        const stage=story.current?.querySelector<HTMLElement>('.story-stage');
        if(stage&&!sceneFailed){
          const callout=stage.querySelector<SVGElement>('.story-callout');
          const setupEntrance=()=>{
            const layers=stage.querySelectorAll<HTMLElement>(isCompactStory()?'.story-backdrop, .story-top, .story-steps, .story-scene, .story-bottom':'.story-backdrop, .story-top, .story-steps, .story-scene');
            const entrance=gsap.fromTo(layers,{
              translate:()=>`0px ${-(isCompactStory()?stage.querySelector<HTMLElement>('.story-backdrop')!.offsetHeight:stage.clientHeight*.625)}px`,
            },{
              translate:'0px 0px',ease:'none',
              onUpdate:function(this:{progress:()=>number}){if(callout)callout.style.opacity=String(Math.max(0,Math.min(1,(this.progress()-.99)*100)));},
              scrollTrigger:{trigger:story.current,start:()=>`top ${stage.clientHeight}px`,end:'top top',scrub:true,invalidateOnRefresh:true},
            });
            entrance.progress(entrance.scrollTrigger?.progress??0);
            return()=>callout?.style.removeProperty('opacity');
          };
          const cssEntrance=CSS.supports('(animation-timeline: view()) and (animation-range: contain)');
          gsap.matchMedia().add(cssEntrance?'(min-width: 1024px)':'all',setupEntrance);
        }
      },root);
      cleanup=()=>{context.revert();story.current?.querySelector<SVGElement>('.story-callout')?.style.removeProperty('opacity');};
    });return()=>{cancelled=true;cleanup?.();};
  },[allowMotion,sceneFailed]);

  useEffect(()=>{
    // Expõe a ficha somente de leitura para navegadores compatíveis com WebMCP.
    type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
    const context=(document as Document & {modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context)return;const lifecycle=new AbortController();
    const tools:Tool[]=[{name:'read_nival_product',description:'Read the product reference for this preview. Sales price and checkout are not yet available.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('Expected an empty object');return {name:product.name,brandIsProvisional:true,reference:product.referenceModel,source:product.sourceUrl,imagesAreGenerated:true,price:product.demoPrice,currency:'BRL',checkoutAvailable:false};}}];
    for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    return()=>lifecycle.abort();
  },[]);

  // Centraliza os links entre seções: atualiza hash, foco acessível e controlador de rolagem.
  function navigateSection(event:MouseEvent<HTMLDivElement>){
    const link=(event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const hash=link.getAttribute('href');if(!hash)return;
    const target=document.getElementById(hash.slice(1));if(!target)return;
    event.preventDefault();event.stopPropagation();
    window.history.replaceState(window.history.state,'',hash);
    target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
    // Explicit document position avoids a sticky descendant changing the
    // alignment chosen for the oversized story section in WebKit.
    scrollToSection(target,allowMotion?'smooth':'instant');
  }
  return <>{!siteRevealed&&<div className={`site-loader ${loaderLeaving?'is-leaving':''}`} role="status" aria-live="polite" aria-label="Carregando o site">
    <div className="site-loader-content">
      <p className="site-loader-eyebrow">SEU MOMENTO DE DESCANSO</p>
      <p className="site-loader-brand">{product.brand}</p>
      <div className="site-loader-progress" role="progressbar" aria-label="Carregamento do site" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadingProgress}><span style={{width:`${loadingProgress}%`}}/></div>
      <p className="site-loader-caption">Preparando sua experiência <span>{loadingProgress}%</span></p>
    </div>
  </div>}<div ref={root} className="nival-page" onClickCapture={navigateSection}
    onCopy={event=>event.preventDefault()} onCut={event=>event.preventDefault()} onContextMenu={event=>event.preventDefault()}>
    <GlassFilter/>
    <a className="skip-link" href="#camadas">Pular para o conteúdo</a>
    <header className="site-header"><a className="wordmark" href="#inicio" aria-label={`${product.brand}, início`}>{product.brand}</a><nav aria-label="Navegação principal"><a href="#camadas">Por dentro</a></nav></header>
    <main>
      <section className="hero hero-sleep" id="inicio">
        <p className="eyebrow hero-eyebrow">SEU MOMENTO DE DESCANSO</p>
        <div className="hero-panel">
          <div className="hero-copy"><div className="hero-copy-frame"><h1>Sua noite.<br/><span>Em outro clima.</span></h1><p className="hero-description">Conforto que se adapta a você.</p><a href="#camadas" className="button button-primary section-scroll-button"><span>Role para baixo <ArrowDown size={20} aria-hidden="true"/></span></a></div></div>
          <div className="hero-product-space">
            <div className="hero-visual"><picture><source media={heroDesktopMedia} srcSet={heroDesktopImage}/><img src={heroMobileImage} alt="Mulher dormindo abraçada ao travesseiro branco, sobre uma cama com roupa branca" width="1254" height="1254" fetchPriority="high"/></picture></div>
          </div>
        </div>
      </section>
      {/* Seção 2: palco compartilhado das três poses; o controlador troca a descrição e anima as camadas. */}
      <section className={`story ${allowMotion&&!sceneFailed?'is-ready':''}`} id="camadas" ref={story} aria-label="Conheça o travesseiro por dentro">
        <div className="story-stage">
          <div className="story-content">
            <div className="story-backdrop" aria-hidden="true"/>
            <div className="story-top" id="introducao"><p className="eyebrow">{product.brand} · POR DENTRO</p><span>CONTINUE EXPLORANDO <ArrowDown size={13}/></span></div>
            <div className="story-scene" ref={canvas} role="img" aria-label="Travesseiro 3D fechado que se abre para mostrar três etapas: tecido e espuma solta, flocos se agrupando e uma película azul descendo sobre o enchimento"/>
            <div className="story-poster"><img src="/demos/nival/images/nival-product-hero.webp" alt="Visualização gerada do travesseiro branco baseado no produto de referência" width="1536" height="1024" loading="lazy"/></div>
            <svg className="story-callout" aria-hidden="true" focusable="false"><path className="story-callout-underlay" pathLength="1"/><path className="story-callout-line" pathLength="1"/><g className="story-callout-target"><circle className="story-callout-halo" r="15"/><circle className="story-callout-pin" r="10"/><text className="story-callout-number" textAnchor="middle" dy=".35em">01</text></g></svg>
            <div className="story-steps">{product.layers.map((layer,i)=><article className={`story-chapter ${i===0?'is-active':''}`} aria-label={layer.label} key={layer.label}><p className="layer-index"><span className="layer-number"><span>{`${String(i+1).padStart(2,'0')} / ${String(product.layers.length).padStart(2,'0')}`}</span><span className="layer-part">{layer.calloutLabel}</span></span></p><h2>{layer.title.split('\n').map((line,j)=><span key={line}>{line}{j===0&&<br/>}</span>)}</h2><p className="chapter-description">{layer.text.split(/(Bambu|algodão|viscoelástica|Kulkote|frescor)/).map((text,index)=>index%2?<span className="story-ice-text" key={index}>{text}</span>:text)}</p></article>)}</div>
            <div className="story-bottom"><div className="story-dots" aria-hidden="true">{product.layers.map((l,i)=><span className={`story-dot ${i===0?'is-active':''}`} key={l.label}>{String(i+1).padStart(2,'0')}<i/>{l.label}</span>)}</div><div className="story-progress"><div className="story-progress-fill"/></div></div>
          </div>
        </div>
      </section>
      {/* Seção 3: agrupa compra e painel de especificações para coordenar layout, foco e rolagem. */}
      <div className={`purchase-flow ${specificationsOpen?'specifications-open':''}`} role="region" aria-label="Compra e especificações" tabIndex={-1}>
      <section className="offer section-width" id="escolha" aria-labelledby="offer-title">
        <div className="offer-media">
          <h2 id="offer-title">{product.name}</h2>
          <ProductGallery motion={allowMotion}/>
          <p className="offer-summary">Toque de bambu e algodão, com o acolhimento da espuma viscoelástica.</p>
        </div>
        {/* Preço/CTA e ações: a ordem também determina a leitura acessível. */}
        <div className="offer-details">
          <div className="offer-checkout">
            <div className="offer-price"><p className="price">{product.demoPrice!==null?money(product.demoPrice):product.placeholderPrice}</p></div>
            {product.checkoutUrl?<a className="button button-primary purchase-button" href={product.checkoutUrl}><span>Garantir meu {product.brand} <ArrowUpRight size={20} aria-hidden="true"/></span></a>:<button type="button" className="button button-primary purchase-button" aria-describedby="purchase-status" onClick={()=>setPurchaseRequested(true)}><span>Garantir meu {product.brand} <ArrowUpRight size={20} aria-hidden="true"/></span></button>}
            <p className="sr-only" id="purchase-status" role="status">{purchaseRequested?'Em breve, a compra ainda não está disponível.':''}</p>
          </div>
          <div className="offer-actions">
            <div className="spec-origin" aria-hidden="true"/>
            <a className="button spec-toggle offer-inside-link" href="#camadas"><span>Ver por dentro</span><ArrowUp size={16} aria-hidden="true"/></a>
          </div>
        </div>
      </section>
      <button ref={specificationsButton} type="button" className="button spec-toggle spec-mover" aria-label={specificationsOpen?'Ocultar especificações':'Ver especificações'} aria-expanded={specificationsOpen} aria-controls="duvidas" onClick={toggleSpecifications}>
        <span className="spec-label" aria-hidden="true"><span className="spec-label-closed">Ver especificações</span><span className="spec-label-open">Ocultar especificações</span></span>
        <ArrowDown size={16} aria-hidden="true"/>
      </button>
      {/* hidden controla montagem visual; inert impede interação durante o fechamento animado. */}
      <div className="specifications-scroll" hidden={!specificationsMounted} inert={!specificationsOpen} aria-hidden={!specificationsOpen} tabIndex={-1}>
      <section className="faq section-width" id="duvidas" tabIndex={-1} aria-labelledby="specifications-title"><div><h2 id="specifications-title">Os detalhes<br/>fazem diferença.</h2><div className="spec-destination" aria-hidden="true"/></div><Accordion type="single" collapsible className="faq-list">{product.faqs.map((faq,i)=><AccordionItem key={faq.question} value={`faq-${i}`}><AccordionTrigger className="faq-question">{faq.question}</AccordionTrigger><AccordionContent className="faq-answer">{faq.answer}</AccordionContent></AccordionItem>)}</Accordion><footer className="footer"><div className="footer-main"><a className="wordmark" href="#inicio">{product.brand}</a><a href="#inicio" className="text-link">Voltar ao início <ArrowUpRight size={16}/></a></div><div className="footer-meta"><p>© 2026 {product.brand} · Nome provisório.</p><p>Visualizações geradas a partir do produto de referência.</p></div></footer></section>
      </div>
      </div>
    </main>
    <div ref={stickyBuy} className={`sticky-buy ${sticky?'is-visible':''}`} aria-hidden={!sticky}><a href="#escolha" className="button section-scroll-button" data-story-next tabIndex={sticky?0:-1}><span className="story-button-progress">01 / {String(product.layers.length).padStart(2,'0')}</span><span className="story-button-label">Role para baixo <ArrowDown size={20} aria-hidden="true"/></span></a></div>
  </div></>;
}
