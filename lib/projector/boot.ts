import { PROJECTOR_STORAGE_KEY } from "./constants";

// Runs inline in <head> before first paint so a saved late night look doesn't
// flash sunny first. Keep in sync with applyToDocument() in store.ts.
export const PROJECTOR_BOOT_SCRIPT = `(function(){
var d=document.documentElement,s={};
try{s=JSON.parse(localStorage.getItem(${JSON.stringify(PROJECTOR_STORAGE_KEY)})||"{}")||{};}catch(e){console.warn("projector: saved settings unreadable",e);}
var looks=["sunny","faded","lateNight"];
var rm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
d.dataset.look=looks.indexOf(s.look)>-1?s.look:"sunny";
d.dataset.motion=(s.paused===true||rm)?"off":"on";
d.dataset.commentary=s.commentary===true?"on":"off";
})();`;
