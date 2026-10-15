import {useEffect,useRef} from 'react';
export default function useModalKeyboard(open,onClose){
  const close=useRef(onClose);
  useEffect(()=>{close.current=onClose;},[onClose]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement;
    const dialog=[...document.querySelectorAll('.studio-dialog')].at(-1);
    if(!dialog)return;
    const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.offsetParent!==null);
    controls()[0]?.focus();
    const handle=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();return;}
      if(event.key!=='Tab')return;
      const items=controls(),first=items[0],last=items.at(-1);
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',handle);
    return()=>{document.removeEventListener('keydown',handle);if(previous?.isConnected)previous.focus();};
  },[open]);
}
