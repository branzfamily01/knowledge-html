(() => {
  const rate = document.querySelector('#speechRate');
  const rateValue = document.querySelector('#rateValue');
  const RATE_KEY = 'knowledgeHtml.secondBrainBridgeRebuild.rate';
  const CHECK_KEY = 'knowledgeHtml.secondBrainBridgeRebuild.checks';
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let active = false;

  function currentRate() {
    const n = Number(rate?.value || 1);
    return Number.isFinite(n) ? Math.min(3, Math.max(.7, n)) : 1;
  }

  function restoreRate() {
    let saved = NaN;
    try { saved = Number(localStorage.getItem(RATE_KEY)); } catch {}
    if (saved >= .7 && saved <= 3 && rate) rate.value = saved.toFixed(1);
    if (rateValue) rateValue.textContent = `${currentRate().toFixed(1)}×`;
  }

  rate?.addEventListener('input', () => {
    try { localStorage.setItem(RATE_KEY, currentRate().toFixed(1)); } catch {}
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

  function voiceScore(voice) {
    const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    let score = 0;
    if (/natural|neural|premium|enhanced/.test(name)) score += 30;
    if (/female|nanami|haruka|ayumi|samantha|zira|aria|jenny/.test(name)) score += 8;
    if (voice.localService) score += 2;
    return score;
  }

  function bestVoice(lang) {
    if (!synth) return null;
    const prefix = lang.slice(0, 2).toLowerCase();
    const matching = synth.getVoices().filter(v => String(v.lang || '').toLowerCase().startsWith(prefix));
    return matching.sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
  }

  function sentenceChunks(text) {
    const parts = cleanText(text).split(/(?<=[。！？.!?])\s*/).filter(Boolean);
    const out = [];
    for (const part of parts) {
      if (part.length <= 150) out.push(part);
      else for (let i = 0; i < part.length; i += 130) out.push(part.slice(i, i + 130));
    }
    return out;
  }

  function queueSpeech(text) {
    if (!synth || !('SpeechSynthesisUtterance' in window)) {
      alert('このブラウザでは音声読み上げを利用できません。');
      return;
    }
    synth.cancel();
    active = true;
    const chunks = [];
    for (const sentence of sentenceChunks(text)) chunks.push(...splitLanguage(sentence));
    let i = 0;
    const next = () => {
      if (!active || i >= chunks.length) { active = false; return; }
      const chunk = chunks[i++];
      const utterance = new window.SpeechSynthesisUtterance(chunk.text);
      utterance.lang = chunk.lang;
      utterance.rate = currentRate();
      const voice = bestVoice(chunk.lang);
      if (voice) utterance.voice = voice;
      utterance.onend = next;
      utterance.onerror = next;
      synth.speak(utterance);
    };
    next();
  }

  function summaryText() {
    return `Second Brain Bridgeは、UIからではなく保存契約から作ります。最初にGitHubと最小UIを作り、IndexedDBとlocalStorageによる端末保存、Supabaseの現在状態と履歴、tombstoneによる通常削除、reset epochによる全データリセットを固めます。その後、Capture Schema、X取り込み、Windows PC Agent、Obsidian一方向アーカイブ、画像保存、Knowledge HTML連携を追加します。実装はCodex、設計とレビューはChatGPT Solが担当し、テスト、PR、レビュー、実機smokeを通して完成とします。`;
  }

  document.querySelector('#speakSummary')?.addEventListener('click', () => queueSpeech(summaryText()));
  document.querySelector('#speakAll')?.addEventListener('click', () => queueSpeech(document.querySelector('main')?.innerText || ''));
  document.querySelector('#stopSpeech')?.addEventListener('click', () => { active = false; synth?.cancel(); });

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
    checks.forEach((el, i) => { el.checked = Boolean(state[i]); });
  }
  checks.forEach(el => el.addEventListener('change', () => {
    const state = checks.map(x => x.checked);
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(state)); } catch {}
  }));

  restoreRate();
  restoreChecks();
})();