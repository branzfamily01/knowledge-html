const $=(s)=>document.querySelector(s);
const $$=(s)=>[...document.querySelectorAll(s)];

$("#themeBtn").addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  $("#themeBtn").textContent=document.body.classList.contains("dark")?"☀️":"🌙";
});
$("#printBtn").addEventListener("click",()=>window.print());
$("#toTop").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));

$$(".scenario-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    $$(".scenario-btn").forEach(b=>b.classList.remove("active"));
    $$(".scenario-panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    $("#scenario-"+btn.dataset.scenario).classList.add("active");
  });
});

const answers={
  think:{tool:"💚 ChatGPT",sub:"普段の相談・授業・企画・画像・アイデア。必要ならBridgeから過去知識を渡す。"},
  save:{tool:"🧠 Second Brain Bridge",sub:"X・Web・PDF・メモ・AIチャットをまずRAWへ。分類は後でOK。"},
  find:{tool:"🧠 Bridge → 💚 ChatGPT",sub:"Brainに聞くで関連情報を集め、ChatGPTへ渡して相談する。"},
  bulk:{tool:"🟢 Codex",sub:"ChatGPT/Claudeの大量履歴、Vault、数百ファイルなどの一括整理を任せる。"},
  build:{tool:"💚 ChatGPT → 🟢 Codex → 🐙 GitHub",sub:"ChatGPTで仕様を考え、Codexで実装し、GitHubを現行正本にする。"},
  remember:{tool:"💜 Obsidian Vault",sub:"AIに依存しないMarkdownの長期記憶として残す。"}
};
function updateChooser(){
  const v=$("#needSelect").value,a=answers[v];
  $("#chooserAnswer").innerHTML=`<strong style="font-size:22px">${a.tool}</strong><p style="margin:6px 0 0;color:#67637d">${a.sub}</p>`;
}
$("#needSelect").addEventListener("change",updateChooser);updateChooser();

if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(()=>{});}
