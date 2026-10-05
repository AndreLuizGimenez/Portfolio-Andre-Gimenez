'use client';
/* Mede e posiciona o CTA da história; atualizações de pose reutilizam a geometria do layout. */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { isCompactStory } from './story-layout';
import { storyReadingStops } from './scroll-gates';

export function useStoryCta(root: RefObject<HTMLDivElement | null>, story: RefObject<HTMLElement | null>, storyProgress: RefObject<number>) {
  const stickyBuy=useRef<HTMLDivElement>(null);
  const positionSticky=useRef<(panelBottom?:number)=>void>(()=>{});
  const [sticky,setSticky]=useState(false);
  useEffect(()=>{
    // Posiciona o CTA da história com medidas em cache; acompanha legenda, fundo e saída do palco.
    const storySection=story.current,offer=root.current?.querySelector('.offer'),buy=stickyBuy.current;if(!storySection||!offer||!buy)return;
    const stage=storySection.querySelector<HTMLElement>('.story-stage');
    const progressLine=storySection.querySelector<HTMLElement>('.story-progress');
    const column=storySection.querySelector<HTMLElement>('.story-steps');
    const descriptions=Array.from(storySection.querySelectorAll<HTMLElement>('.chapter-description'));
    if(!stage||!progressLine||!column)return;
    let visible=false,frame=0,invalid=true,disposed=false,panelBottom:number|undefined;
    let geometry:{start:number;end:number;viewport:number;stageHeight:number;buttonHeight:number;progressY:number;firstBottom:number;lastBottom:number;captionExtent:number;ctaLead:number;mobile:boolean;left?:number}|undefined;
    const setValue=(name:string,value:string)=>{if(buy.style.getPropertyValue(name)!==value)buy.style.setProperty(name,value);};
    // Glyph and layout measurements only run after a resize/font change. The
    // animation supplies its panel edge directly; positioning is then arithmetic.
    const measure=()=>{
      const mobile=isCompactStory();
      const stageBounds=stage.getBoundingClientRect();
      const contentHeight=stage.querySelector<HTMLElement>('.story-content')!.clientHeight;
      const entryY=Number.parseFloat(getComputedStyle(column).translate.split(' ')[1]??'0')||0;
      const currentPanel=stage.querySelector<HTMLElement>('.story-backdrop')?.offsetHeight||stageBounds.height*.5;
      const buttonHeight=buy.getBoundingClientRect().height;
      const captionBounds=descriptions.map(description=>description.getBoundingClientRect());
      // Read all centers before changing inherited geometry variables: those
      // writes can already move the captions during this same layout refresh.
      const captionCenters=descriptions.map((description,i)=>{
        const chapter=description.closest<HTMLElement>('.story-chapter')!;
        return captionBounds[i].top-chapter.getBoundingClientRect().top+captionBounds[i].height/2;
      });
      const bottoms=descriptions.map((description,i)=>{
        const range=document.createRange();
        range.selectNodeContents(description);
        const lines=Array.from(range.getClientRects());
        const bottom=lines.length?Math.max(...lines.map(line=>line.bottom)):captionBounds[i].bottom;
        // Caption transforms change only their visual placement. Keep the
        // established background height and CTA reserves in layout space.
        if(mobile){
          const chapter=description.closest<HTMLElement>('.story-chapter')!;
          return column.offsetTop-currentPanel+chapter.offsetTop+description.offsetTop+bottom-captionBounds[i].top;
        }
        return bottom-stageBounds.top-entryY-(mobile?currentPanel:0);
      });
      const line=progressLine.getBoundingClientRect();
      // The photograph spans the physical phone screen. Controls fit the
      // stable small viewport, above Safari's toolbars and the safe inset.
      const safeBottom=Number.parseFloat(getComputedStyle(stage).getPropertyValue('--safe-bottom'))||0;
      const footerEdge=mobile?stageBounds.top+Math.min(contentHeight,stageBounds.height)-Math.max(20,safeBottom)-32:line.top+line.height/2;
      const columnBounds=column.getBoundingClientRect();
      const captionGap=mobile?Math.max(0,Number.parseFloat(getComputedStyle(column).top)-currentPanel):0;
      const captionExtent=captionGap+columnBounds.height;
      const ctaLead=44;
      // Extend only the painted background. The image panel remains the
      // stable reference for the camera, entrance motion and CTA placement.
      if(mobile&&storySection.classList.contains('is-ready')){
        const captionHeight=`${columnBounds.height.toFixed(2)}px`;
        if(stage.style.getPropertyValue('--story-caption-height')!==captionHeight)
          stage.style.setProperty('--story-caption-height',captionHeight);
        descriptions.forEach((description,i)=>{
          const chapter=description.closest<HTMLElement>('.story-chapter')!;
          const center=`${captionCenters[i].toFixed(2)}px`;
          if(chapter.style.getPropertyValue('--story-description-center')!==center)
            chapter.style.setProperty('--story-description-center',center);
        });
      }else stage.style.removeProperty('--story-caption-height');
      if(mobile&&storySection.classList.contains('is-enhanced')){
        const footer=captionExtent+ctaLead+buttonHeight+(stageBounds.bottom-footerEdge);
        const limit=stageBounds.height-footer;
        // The compact picture stays steady through all three poses. Reserve
        // the longest caption, its blue padding and the CTA label before sizing.
        const px=`${Math.max(0,Math.min(contentHeight*.5,limit)).toFixed(2)}px`;
        if(stage.style.getPropertyValue('--story-panel-base')!==px){
          stage.style.setProperty('--story-panel-base',px);
          stage.dispatchEvent(new Event('storylayoutchange'));
        }
      }else{
        stage.style.removeProperty('--story-panel-base');
      }
      const firstBottom=Math.max(bottoms[0],bottoms[1]);
      geometry={start:storySection.getBoundingClientRect().top+window.scrollY,end:offer.getBoundingClientRect().top+window.scrollY,
        viewport:stageBounds.height,stageHeight:stageBounds.height,buttonHeight,progressY:footerEdge-stageBounds.top,firstBottom,lastBottom:Math.max(firstBottom,bottoms[2]),captionExtent,ctaLead,mobile,
        left:mobile?undefined:columnBounds.left+columnBounds.width/2};
      panelBottom=currentPanel;
      invalid=false;
    };
    const place=()=>{
      frame=0;
      if(invalid||!geometry)measure();
      const layout=geometry!;
      const sectionTop=layout.start-window.scrollY;
      const next=sectionTop<=layout.viewport&&layout.end-window.scrollY>1;
      if(next!==visible){visible=next;setSticky(next);}
      if(!next){buy.style.visibility='hidden';return;}
      const travel=Math.max(0,Math.min(1,(storyProgress.current-storyReadingStops[1])/(storyReadingStops[2]-storyReadingStops[1])));
      const blend=travel*travel*(3-2*travel);
      // Parts 1 and 2 share an anchor with room for both captions. Only the
      // transition into part 3 can lower it to accommodate the final caption.
      const {firstBottom,lastBottom}=layout;
      const textBottom=firstBottom+(lastBottom-firstBottom)*blend+(layout.mobile?(panelBottom??0):0);
      const stageExit=Math.min(0,layout.end-window.scrollY-layout.stageHeight);
      const room=layout.progressY-textBottom-layout.buttonHeight;
      const captionGap=Math.min(Math.max(22,room*.62),Math.max(0,room-22));
      const backgroundClearance=layout.mobile?(panelBottom??0)+layout.captionExtent+layout.ctaLead:0;
      const preferredTop=Math.max(textBottom+captionGap,backgroundClearance);
      const top=(layout.mobile?Math.min(preferredTop,layout.progressY-layout.buttonHeight):preferredTop)+stageExit;
      const entryProgress=Math.max(0,Math.min(1,1-sectionTop/layout.viewport));
      setValue('--story-cta-top',`${top.toFixed(2)}px`);
      setValue('--story-cta-rise',`${(Math.max(0,layout.viewport-top+16)*(1-entryProgress)).toFixed(2)}px`);
      if(layout.left===undefined)buy.style.removeProperty('--story-cta-left');
      else setValue('--story-cta-left',`${layout.left.toFixed(2)}px`);
      buy.style.visibility='visible';
    };
    const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(place);};
    const invalidate=()=>{invalid=true;schedule();};
    positionSticky.current=(edge)=>{
      if(edge!==undefined)panelBottom=edge;
      // A pending layout refresh runs before the next paint, never after a
      // write inside the WebGL render callback.
      if(invalid){schedule();return;}
      if(frame){cancelAnimationFrame(frame);frame=0;}
      place();
    };
    const sizeObserver=new ResizeObserver(invalidate);
    [stage,stage.querySelector<HTMLElement>('.story-content')!,column,buy,progressLine,...descriptions].forEach(element=>sizeObserver.observe(element));
    const enhanced=new MutationObserver(invalidate);
    enhanced.observe(storySection,{attributes:true,attributeFilter:['class']});
    window.addEventListener('scroll',schedule,{passive:true});
    void document.fonts.ready.then(invalidate);
    schedule();
    return()=>{disposed=true;positionSticky.current=()=>{};cancelAnimationFrame(frame);sizeObserver.disconnect();enhanced.disconnect();window.removeEventListener('scroll',schedule);['--story-cta-top','--story-cta-rise','--story-cta-left','visibility'].forEach(name=>buy.style.removeProperty(name));['--story-panel-base','--story-caption-height'].forEach(name=>stage.style.removeProperty(name));descriptions.forEach(description=>description.closest<HTMLElement>('.story-chapter')?.style.removeProperty('--story-description-center'));};
  },[root,story,storyProgress]);
  return {sticky,stickyBuy,positionSticky};
}
