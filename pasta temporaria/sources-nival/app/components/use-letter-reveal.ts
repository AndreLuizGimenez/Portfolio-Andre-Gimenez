'use client';
/* Anima a entrada das letras com GSAP/SplitText depois das fontes e da liberação do loading.
 * A compra tem uma timeline coordenada; ao desmontar, reverte divisões de texto, estilos e triggers. */

import { useEffect, type RefObject } from 'react';

export function useLetterReveal(root:RefObject<HTMLDivElement|null>, enabled:boolean) {
  useEffect(()=>{
    if(!enabled||!root.current)return;
    let cancelled=false;
    let cleanup:(()=>void)|undefined;
    void Promise.all([import('gsap'),import('gsap/ScrollTrigger'),import('gsap/SplitText'),document.fonts.ready]).then(([{gsap},{ScrollTrigger},{SplitText}])=>{
      if(cancelled||!root.current)return;
      gsap.registerPlugin(ScrollTrigger,SplitText);
      const splits:ReturnType<typeof SplitText.create>[]=[];
      const context=gsap.context(()=>{
        root.current!.querySelectorAll<HTMLElement>('main h1, main h2').forEach(heading=>{
          const chapter=heading.closest<HTMLElement>('.story-chapter');
          // Motion and purchase have their own coordinated transitions.
          if(chapter||heading.closest('.purchase-flow'))return;
          const copy=heading.cloneNode(true) as HTMLElement;
          copy.querySelectorAll('br').forEach(br=>br.replaceWith(' '));
          const accessibleText=(copy.textContent??'').replace(/\s+/g,' ').trim();
          const split=SplitText.create(heading,{type:'words,chars',charsClass:'reveal-char',wordsClass:'reveal-word',aria:'auto'});
          heading.setAttribute('aria-label',accessibleText);
          splits.push(split);
          const revealDuration=.65,revealStagger=.013;
          const reveal=gsap.fromTo(split.chars,{opacity:.08,yPercent:24,filter:'blur(3px)'},{
            opacity:1,yPercent:0,filter:'blur(0px)',duration:revealDuration,stagger:revealStagger,ease:'power2.out',paused:true,
            // The hero plays once. Release its per-letter filtered surfaces
            // before scrolling; other headings retain their reversible tween.
            ...(heading.tagName==='H1'?{clearProps:'transform,filter,opacity'}:{}),
          });
          if(heading.tagName==='H1')reveal.play();
          else ScrollTrigger.create({trigger:heading,start:'top 87%',onEnter:()=>reveal.play(),onLeaveBack:()=>reveal.pause(0),onEnterBack:()=>reveal.play()});
        });

        const offer=root.current!.querySelector<HTMLElement>('#escolha');
        const title=offer?.querySelector<HTMLElement>('#offer-title');
        const summary=offer?.querySelector<HTMLElement>('.offer-summary');
        if(offer&&title&&summary){
          const titleSplit=SplitText.create(title,{type:'words,chars',charsClass:'reveal-char',wordsClass:'reveal-word',aria:'auto'});
          const summarySplit=SplitText.create(summary,{type:'words',wordsClass:'reveal-word',aria:'auto'});
          splits.push(titleSplit,summarySplit);

          // One entrance for the whole purchase section, with the hero's
          // letter treatment reserved for the name. Keep controls intact.
          const entrance=gsap.timeline({paused:true});
          entrance.fromTo(titleSplit.chars,
            {opacity:.08,yPercent:24,filter:'blur(3px)'},
            {opacity:1,yPercent:0,filter:'blur(0px)',duration:.65,stagger:{amount:.1},ease:'power2.out',clearProps:'transform,filter,opacity'},0);
          entrance.fromTo(summarySplit.words,
            {opacity:.15,y:6},
            {opacity:1,y:0,duration:.5,stagger:{amount:.12},ease:'power2.out',clearProps:'transform,opacity'},.06);
          // A single blur surface preserves the soft reveal without creating
          // a separate filtered layer for every word during the page scroll.
          entrance.fromTo(summary,
            {filter:'blur(2px)'},
            {filter:'blur(0px)',duration:.62,ease:'power2.out',clearProps:'filter'},.06);
          entrance.fromTo(offer.querySelectorAll('.offer-checkout, .offer-variant'),
            {opacity:.15,y:6},
            {opacity:1,y:0,duration:.5,stagger:.05,ease:'power2.out',clearProps:'transform,opacity'},.12);
          ScrollTrigger.create({
            trigger:offer,
            start:'top 80%',
            onEnter:()=>entrance.restart(),
          });
          ScrollTrigger.create({
            trigger:offer,
            start:'top bottom',
            // Keep the outgoing title/copy painted until the entire section
            // leaves. Resetting at 80% visibly snaps the last strip on return.
            onLeaveBack:()=>entrance.pause(0),
          });
        }
      },root);
      cleanup=()=>{context.revert();splits.forEach(split=>split.revert());};
    }).catch(()=>{cleanup?.();});
    return()=>{cancelled=true;cleanup?.();};
  },[root,enabled]);
}
