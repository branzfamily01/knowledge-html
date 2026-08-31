(() => {
  const rate = document.querySelector('#speechRate');
  const rateValue = document.querySelector('#rateValue');
  const RATE_KEY = 'knowledgeHtml.secondBrainBridgeRebuild.rate';
  const CHECK_KEY = 'knowledgeHtml.secondBrainBridgeRebuild.checks';
  let active = false;

  function currentRate() {
    const n = Number(rate?.value || 1);
    return Number.isFinite(n) ? Math.min(3, Math.max(.7, n)) : 1;
  }

  function restoreRate() {
    const saved = Number(localStorage.getItem(RATE_KEY));
    if (saved >= .7 && saved <= 3 && rate) rate.value = saved.toFixed(1);
    if (rateValue) rateValue.textContent = `${currentRate().toFixed(1)}×`;
  }

  rate?.addEventListener('input', () => {
    localStorage.setItem(RATE_KEY, currentRate().toFixed(1));
    if (rateValue) rateValue.textContent = `${currentRate().toFixed(1)}×`;
  });

  function cleanText(text) {
    return String(text || '')
      .replace(/[→↔↘↗•✅⚠️📖🌐]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitLanguage(text) {
    const chunks = [];
    const re = /([A-Za-z][A-Za-z0-9_./:+#\-]*(?:\s+[A-Za-z][A-Za-z0-9_./:+#\-]*)*)|([^A-Za-z]+)/g;
    for (const match of cleanText(text).matchAll(re)) {
      const value = cleanText(match[0]);
      if (!value) continue;
      chunks.push({ text: value, lang: /^[A-Za-z0-9_./:+#\-\s]+$/.test(value) ? 'en-US' : 'ja-JP' });
    }
    return chunks;
  }

  function voiceScore(voice, lang) {
    const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    let score = voice.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()) ? 50 : 0;
    if (/natural|neural|premium|enhanced/.test(name)) score += 30;
    if (/female|nanami|haruka|ayumi|samantha|zira|aria|jenny/.test(name)) score += 8;
    if (voice.localService) score += 2;
    return score;
  }

  function bestVoice(lang) {
    return speechSynthesis.getVoices().slice().sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang))[0] || null;
  }

  function sentenceChunks(text) {
    const parts = cleanText(text).split(/(?<=[。！？.!?])\s*/).filter(Boolean);
    const out = [];
    for (const part of parts) {
      if (part.length <= 150) out.push(part);
      else {
        for (let i = 0; i < part.length; i += 130) out.push(part.slice(i, i + 130));
      }
    }
    return out;
  }

  function queueSpeech(text) {
    if (!('speechSynthesis' in window)) return alert('このブラウザでは音声読み上げを利用できません。');
    speechSynthesis.cancel();
    active = true;
    const chunks = [];
    for (const sentence of sentenceChunks(text)) chunks.push(...splitLanguage(sentence));
    let i = 0;
    const next = () => {
      if (!active || i >= chunks.length) { active = false; return; }
      const chunk = chunks[i++];
      const u = new SpeechSynthesisUtterance(chunk.text);
      u.lang = chunk.lang;
      u.rate = currentRate();
      const voice = bestVoice(chunk.lang);
      if (voice) u.voice = voice;
      u.onend = next;
      u.onerror = next;
      speechSynthesis.speak(u);
    };
    next();
  }

  function summaryText() {
    return `Second Brain Bridgeは、UIからではなく保存契約から作ります。最初にGitHubと最小UIを作り、IndexedDBとlocalStorageによる端末保存、Supabaseの現在状態と履歴、tombstoneによる通常削除、reset epochによる全データリセットを固めます。その後、Capture Schema、X取り込み、Windows PC Agent、Obsidian一方向アーカイブ、画像保存、Knowledge HTML連携を追加します。実装はCodex、設計とレビューはChatGPT Solが担当し、テスト、PR、レビュー、実機smokeを通して完成とします。`;
  }

  document.querySelector('#speakSummary')?.addEventListener('click', () => queueSpeech(summaryText()));
  document.querySelector('#speakAll')?.addEventListener('click', () => queueSpeech(document.querySelector('main')?.innerText || ''));
  document.querySelector('#stopSpeech')?.addEventListener('click', () => { active = false; speechSynthesis.cancel(); });

  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = btn.nextElementSibling;
      answer?.classList.toggle('show');
      btn.textContent = answer?.classList.contains('show') ? '答えを閉じる' : '答えを見る';
    });
  });

  const checks = [...document.querySelectorAll('#buildChecklist input[type="checkbox"]')];
  function restoreChecks() {
    let state = [];
    try { state = JSON.parse(localStorage.getItem(CHECK_KEY) || '[]'); } catch {}
    checks.forEach((el, i) => el.checked = Boolean(state[i]));
  }
  checks.forEach((el, i) => el.addEventListener('change', () => {
    const state = checks.map(x => x.checked);
    localStorage.setItem(CHECK_KEY, JSON.stringify(state));
  }));

  restoreRate();
  restoreChecks();
  speechSynthesis?.addEventListener?.('voiceschanged', () => {});
})();