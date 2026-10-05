'use client';
/* Diálogo de ampliação: apresenta a foto ativa e seus controles, preservando fechamento e retorno de foco. */
import { useRef } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { product } from '../content/product';
import { photos } from './product-photos';

export default function ProductLightbox({expanded,index,showPhoto,onClose,onReturnFocus}:{expanded:number|null;index:number;showPhoto:(index:number)=>void;onClose:()=>void;onReturnFocus:()=>void}) {
  const touchStart=useRef<{x:number;y:number}|null>(null);
  const activePhoto=photos[expanded??index];
  return (
  <Dialog open={expanded!==null} onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent className="product-lightbox"
      onCloseAutoFocus={event=>{event.preventDefault();onReturnFocus();}}
      onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();showPhoto((expanded??0)+(event.key==='ArrowRight'?1:-1));}}}>
      <div className="lightbox-header"><DialogTitle>{product.name}</DialogTitle><button className="button gallery-arrow" type="button" aria-label="Fechar imagem ampliada" onClick={onClose}><X size={20}/></button></div>
      <DialogDescription className="sr-only">Imagem completa do produto. Use as setas para navegar e Escape para fechar.</DialogDescription>
      <div className="lightbox-image" onPointerDown={event=>{touchStart.current=event.pointerType==='touch'&&event.isPrimary?{x:event.clientX,y:event.clientY}:null;}} onPointerCancel={()=>{touchStart.current=null;}} onPointerUp={event=>{const start=touchStart.current;touchStart.current=null;if(start&&Math.abs(event.clientX-start.x)>60&&Math.abs(event.clientY-start.y)<60)showPhoto((expanded??0)+(event.clientX<start.x?1:-1));}}>
        <img src={activePhoto.src} alt={activePhoto.alt} width={activePhoto.width} height={activePhoto.height} draggable={false}/>
      </div>
      <div className="lightbox-footer"><div className="gallery-caption" aria-live="polite" aria-atomic="true"><span>{String((expanded??index)+1).padStart(2,'0')} / 03</span><p>{activePhoto.label}</p></div><div className="gallery-arrows"><button className="button gallery-arrow" type="button" aria-label="Imagem ampliada anterior" disabled={expanded===0} onClick={()=>showPhoto((expanded??0)-1)}><ArrowLeft size={18}/></button><button className="button gallery-arrow" type="button" aria-label="Próxima imagem ampliada" disabled={expanded===photos.length-1} onClick={()=>showPhoto((expanded??0)+1)}><ArrowRight size={18}/></button></div></div>
    </DialogContent>
  </Dialog>);
}
