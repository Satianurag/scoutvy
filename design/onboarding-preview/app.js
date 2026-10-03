/* Original Scoutvy onboarding concept. No account or financial state is simulated. */
const scenes = [
  {name:'Possibility',kicker:'A WORLD OF POSSIBILITY',title:'Big ideas.<br>Meet go-getters.',description:'Post a bounty. Find a challenge.<br>Make something happen.',background:'#F6F0E3',art:'possibility',cta:'Get started'},
  {name:'Your bounty',kicker:'YOUR IDEA, IN MOTION',title:'Set the task.<br>Set it in motion.',description:'Your requirements. Your reward.<br>Online or out in the world.',background:'#F6E9AC',art:'brief',cta:'Continue'},
  {name:'The reward',kicker:'GOOD WORK GOES BOTH WAYS',title:'Good work.<br>Well rewarded.',description:'Rewards are funded upfront.<br>Submit your work. Get paid when approved.',background:'#CEE7D1',art:'reward',cta:'Continue'},
  {name:'Get connected',kicker:'YOUR NEXT CHAPTER',title:'Your next move.<br>Starts here.',description:'Connect your wallet to join Scoutvy.<br>Your keys stay with you.',background:'#BEB0ED',art:'wallet',cta:'Connect wallet'},
];
function illustration(name,prefix){return window.SCOUTVY_ART[name].replace(/\bid="([^"]+)"/g,(_,id)=>`id="${prefix}-${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}-${id})`);}
const byId=id=>document.getElementById(id);
const phone=byId('phone'),art=byId('art'),copy=byId('copy'),content=byId('sceneContent');
const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
let current=0,flowTimer=null,autoPlaying=false,reduce=preference.matches,motions=[],dragStart=null,dragged=false;
const ease='cubic-bezier(.22,1,.36,1)';
function cancelMotions(){motions.forEach(a=>a.cancel());motions=[];}
function animate(el,frames,options){if(reduce)return null;const animation=el.animate(frames,{easing:ease,...options});motions.push(animation);return animation;}
function sceneMotion(){
  cancelMotions();
  if(reduce)return;
  art.querySelectorAll('[data-motion]').forEach(el=>{
    const kind=el.dataset.motion,delay=Number(el.dataset.delay||0);
    el.style.transformBox='fill-box';el.style.transformOrigin='center';
    if(kind==='orbit'){
      animate(el,[{opacity:0,transform:'rotate(-18deg) scale(.85)'},{opacity:1,transform:'rotate(0deg) scale(1)'}],{duration:1300,delay:80});
    }else if(kind==='coin'){
      animate(el,[{opacity:0,transform:'translateY(-64px) rotate(-26deg) scale(.75)'},{opacity:1,transform:'translateY(11px) rotate(8deg) scale(1.02)',offset:.7},{opacity:1,transform:'translateY(0) rotate(0) scale(1)'}],{duration:1100,delay:100});
    }else if(kind==='card'){
      animate(el,[{opacity:0,transform:'translateY(82px) rotate(8deg)'},{opacity:1,transform:'translateY(-7px) rotate(-2deg)',offset:.75},{opacity:1,transform:'translateY(0) rotate(0)'}],{duration:950,delay});
    }else if(kind==='pencil'){
      animate(el,[{opacity:0,transform:'translate(45px,-55px) rotate(-12deg)'},{opacity:1,transform:'translate(-3px,4px) rotate(2deg)',offset:.75},{opacity:1,transform:'translate(0,0) rotate(0)'}],{duration:1050,delay:160});
    }else if(kind==='lines'){
      animate(el,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:550,delay:260});
    }else{
      animate(el,[{opacity:0,transform:`translateY(${kind==='back'?30:22}px) rotate(-8deg) scale(${kind==='spark'?.45:.82})`},{opacity:1,transform:'translateY(-3px) rotate(1deg) scale(1.015)',offset:.72},{opacity:1,transform:'translateY(0) rotate(0) scale(1)'}],{duration:kind==='hero'?1050:800,delay});
    }
  });
}
function stopFlow(){clearTimeout(flowTimer);flowTimer=null;autoPlaying=false;byId('walkthrough').innerHTML='<span aria-hidden="true">▶</span> Play the flow';}
function go(index,{manual=true,direction=1,focus=false}={}){
  if(manual)stopFlow();
  const next=Math.max(0,Math.min(3,index));current=next;
  const scene=scenes[next];
  phone.dataset.scene=String(next);phone.style.setProperty('--scene-bg',scene.background);
  art.innerHTML=illustration(scene.art,`live-${next}`);
  byId('kicker').textContent=scene.kicker;byId('headline').innerHTML=scene.title;byId('description').innerHTML=scene.description;
  byId('next').querySelector('span').textContent=scene.cta;
  byId('secondary').textContent=next===3?'Get a wallet':'I already have a wallet';
  byId('skip').innerHTML=next===3?'Why a wallet?':'Skip intro <span aria-hidden="true">↗</span>';
  byId('back').disabled=next===0;byId('back').tabIndex=next===0?-1:0;
  [...document.querySelectorAll('[data-goto]')].forEach(button=>{if(Number(button.dataset.goto)===next)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
  content.style.transform='';sceneMotion();
  animate(copy,[{opacity:0,transform:`translateX(${direction*18}px)`},{opacity:1,transform:'translateX(0)'}],{duration:470,delay:60});
  if(focus)byId('headline').focus({preventScroll:true});
}
function makeNavigation(){
  byId('progress').innerHTML=scenes.map((s,i)=>`<button type="button" data-goto="${i}" aria-label="Scene ${i+1}: ${s.name}"></button>`).join('');
  byId('sceneSelector').innerHTML=scenes.map((s,i)=>`<button type="button" data-goto="${i}" aria-label="Scene ${i+1}: ${s.name}"><span class="scene-number">${i+1}</span><span>${s.name}</span></button>`).join('');
  document.querySelectorAll('[data-goto]').forEach(button=>button.addEventListener('click',()=>go(Number(button.dataset.goto),{direction:Number(button.dataset.goto)>=current?1:-1})));
}
function setReduced(value){reduce=value;byId('reduceMotion').checked=value;document.body.classList.toggle('reduced-motion',value);if(value){stopFlow();cancelMotions();content.style.transform='';}}
preference.addEventListener('change',event=>setReduced(event.matches));
byId('reduceMotion').addEventListener('change',event=>{setReduced(event.target.checked);if(!reduce)sceneMotion();});
byId('next').addEventListener('click',()=>{if(current<3)go(current+1,{focus:true});else{stopFlow();byId('walletDialog').showModal();}});
byId('back').addEventListener('click',()=>go(current-1,{direction:-1,focus:true}));
byId('skip').addEventListener('click',()=>{if(current<3)go(3,{focus:true});else{stopFlow();byId('whyWalletDialog').showModal();}});
byId('secondary').addEventListener('click',()=>{if(current<3)go(3,{focus:true});else window.open('https://play.google.com/store/apps/details?id=com.solflare.mobile','_blank','noopener,noreferrer');});
byId('researchOpen').addEventListener('click',()=>{stopFlow();byId('researchDialog').showModal();});
byId('restart').addEventListener('click',()=>{byId('walletDialog').close();go(0,{focus:true});});
byId('replay').addEventListener('click',()=>{stopFlow();sceneMotion();});
art.addEventListener('click',()=>{if(!dragged){stopFlow();sceneMotion();}});
byId('walkthrough').addEventListener('click',()=>{
  if(autoPlaying){stopFlow();return;}
  go(0);autoPlaying=true;byId('walkthrough').innerHTML='<span aria-hidden="true">Ⅱ</span> Pause the flow';
  function advance(){if(!autoPlaying)return;if(current===3){stopFlow();return;}go(current+1,{manual:false});flowTimer=setTimeout(advance,4400);}
  flowTimer=setTimeout(advance,4400);
});
function resize(){const height=window.innerHeight;const scale=Math.max(.57,Math.min(1,(height-164)/800));document.documentElement.style.setProperty('--scale',String(scale));}
window.addEventListener('resize',resize);resize();
phone.addEventListener('pointerdown',event=>{if(event.target.closest('button,a'))return;dragStart={x:event.clientX,y:event.clientY};dragged=false;});
phone.addEventListener('pointermove',event=>{if(!dragStart)return;const x=event.clientX-dragStart.x,y=event.clientY-dragStart.y;if(Math.abs(x)>12&&Math.abs(x)>Math.abs(y)){dragged=true;if(!reduce)content.style.transform=`translateX(${Math.max(-45,Math.min(45,x*.28))}px)`;}});
function finishDrag(event){if(!dragStart)return;const x=event.clientX-dragStart.x,y=event.clientY-dragStart.y;dragStart=null;const oldTransform=content.style.transform;content.style.transform='';if(Math.abs(x)>46&&Math.abs(x)>Math.abs(y)*1.3){go(current+(x<0?1:-1),{direction:x<0?1:-1});}else if(oldTransform){animate(content,[{transform:oldTransform},{transform:'translateX(0)'}],{duration:240});}setTimeout(()=>{dragged=false;},0);}
phone.addEventListener('pointerup',finishDrag);phone.addEventListener('pointercancel',()=>{dragStart=null;content.style.transform='';});phone.addEventListener('pointerleave',event=>{if(dragStart)finishDrag(event);});
document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]')||document.body.classList.contains('board-view')||event.target.matches('input'))return;if(event.key==='ArrowRight'){event.preventDefault();go(current+1,{focus:true});}if(event.key==='ArrowLeft'){event.preventDefault();go(current-1,{direction:-1,focus:true});}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFlow();motions.forEach(a=>a.pause());}else if(!reduce)motions.forEach(a=>a.play());});
byId('storyboardGrid').innerHTML=scenes.map((scene,i)=>`<article class="story-card" style="--scene-bg:${scene.background}"><div class="mini-header">scoutvy<small>0${i+1} / 04</small></div>${illustration(scene.art,`board-${i}`)}<p class="scene-kicker">${scene.kicker}</p><h2>${scene.title}</h2><p class="mini-copy">${scene.description}</p><div class="mini-cta">${scene.cta}<span>→</span></div><div class="mini-foot">${i===3?'Get a wallet':'I already have a wallet'}</div></article>`).join('');
let board=false;
byId('boardToggle').addEventListener('click',()=>{stopFlow();board=!board;document.body.classList.toggle('board-view',board);document.querySelector('.presentation').hidden=board;byId('storyboard').hidden=!board;byId('boardToggle').innerHTML=board?'Back to preview <span aria-hidden="true">↗</span>':'View all scenes <span aria-hidden="true">↗</span>';window.scrollTo(0,0);});
makeNavigation();setReduced(reduce);go(0);
