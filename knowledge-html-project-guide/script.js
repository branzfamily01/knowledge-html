const RATE_KEY='knowledgeHtml.speechRate';
const VOICE_PROFILE_KEY='knowledgeHtml.voiceProfile';
const DEFAULT_VOICE_PROFILE='feminine';
const rateInput=document.querySelector('#speechRate');
const rateValue=document.querySelector('#rateValue');
const stopButton=document.querySelector('#stopSpeech');
const toast=document.querySelector('#toast');
let voices=[];
let queue=[];
let speaking=false;
let toastTimer;

function loadRate(){
  const saved=Number(localStorage.getItem(RATE_KEY));
  const rate=Number.isFinite(saved)&&saved>=0.7&&saved<=3?saved:1;
  rateInput.value=String(rate);
  rateValue.textContent=`${rate.toFixed(1)}×`;
}

rateInput.addEventListener('input',()=>{
  const rate=Number(rateInput.value);
  rateValue.textContent=`${rate.toFixed(1)}×`;
  localStorage.setItem(RATE_KEY,String(rate));
});

function refreshVoices(){ voices=speechSynthesis.getVoices(); }
refreshVoices();
if('onvoiceschanged' in speechSynthesis) speechSynthesis.onvoiceschanged=refreshVoices;

function preferredVoice(lang){
  const candidates=voices.filter(v=>v.lang&&v.lang.toLowerCase().startsWith(lang.toLowerCase().split('-')[0]));
  if(!candidates.length) return null;
  const profile=localStorage.getItem(VOICE_PROFILE_KEY)||DEFAULT_VOICE_PROFILE;
  const feminine=/kyoko|nanami|haruka|sayaka|samantha|ava|allison|susan|zira|karen|moira|tessa|fiona|victoria|female|woman/i;
  const masculine=/otoya|ichiro|alex|daniel|david|fred|jorge|thomas|male|man/i;
  const quality=/natural|neural|premium|enhanced/i;
  const score=v=>{
    let s=0;
    if(quality.test(v.name)) s+=5;
    if(profile==='feminine'&&feminine.test(v.name)) s+=7;
    if(profile==='masculine'&&masculine.test(v.name)) s+=7;
    if(v.default) s+=1;
    return s;
  };
  return [...candidates].sort((a,b)=>score(b)-score(a))[0]||candidates[0];
}

function cleanText(text){
  return text.replace(/[→↗↑◇◫⌘✦✧⌁✓★☆◐🌐🔒]/g,' ').replace(/\s+/g,' ').trim();
}

function splitSentences(text){
  const cleaned=cleanText(text);
  if(!cleaned) return [];
  return cleaned.match(/[^。！？!?]+[。！？!?]?|[^.;]+[.;]?/g)?.map(s=>s.trim()).filter(Boolean)||[cleaned];
}

function inferLang(node,text){
  const lang=node?.closest?.('[lang]')?.getAttribute('lang');
  if(lang) return lang.startsWith('en')?'en-US':'ja-JP';
  const latin=(text.match(/[A-Za-z]/g)||[]).length;
  const jp=(text.match(/[ぁ-んァ-ヶ一-龠]/g)||[]).length;
  return latin>jp*1.5?'en-US':'ja-JP';
}

function collectChunks(root){
  const chunks=[];
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const p=node.parentElement;
    if(!p||['SCRIPT','STYLE','BUTTON','INPUT','PRE','CODE'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
    if(p.closest('[hidden]')) return NodeFilter.FILTER_REJECT;
    return cleanText(node.nodeValue).length?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  let node;
  while((node=walker.nextNode())){
    const text=cleanText(node.nodeValue);
    const lang=inferLang(node.parentElement,text);
    for(const sentence of splitSentences(text)) chunks.push({text:sentence,lang});
  }
  return chunks;
}

function speakNext(){
  if(!queue.length){ speaking=false; return; }
  speaking=true;
  const {text,lang}=queue.shift();
  const u=new SpeechSynthesisUtterance(text);
  u.lang=lang;
  u.rate=Number(rateInput.value)||1;
  const voice=preferredVoice(lang);
  if(voice) u.voice=voice;
  u.onend=speakNext;
  u.onerror=speakNext;
  speechSynthesis.speak(u);
}

function speakRoot(root){
  speechSynthesis.cancel();
  queue=collectChunks(root);
  speakNext();
}

document.querySelectorAll('[data-speak-target]').forEach(btn=>btn.addEventListener('click',()=>{
  const root=document.querySelector(btn.dataset.speakTarget);
  if(root) speakRoot(root);
}));

document.querySelectorAll('[data-speak-section]').forEach(btn=>btn.addEventListener('click',()=>{
  const section=btn.closest('section');
  if(section) speakRoot(section);
}));

stopButton.addEventListener('click',()=>{ queue=[]; speaking=false; speechSynthesis.cancel(); });
window.addEventListener('pagehide',()=>speechSynthesis.cancel());

function showToast(message){
  clearTimeout(toastTimer);
  toast.textContent=message;
  toast.classList.add('show');
  toastTimer=setTimeout(()=>toast.classList.remove('show'),1600);
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
  }catch{
    const area=document.createElement('textarea');
    area.value=text; area.style.position='fixed'; area.style.opacity='0';
    document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
  }
  showToast('コピーしました');
}

document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',()=>copyText(btn.dataset.copy)));

loadRate();
