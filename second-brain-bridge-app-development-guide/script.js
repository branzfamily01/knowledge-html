(() => {
  'use strict';

  const RATE_KEY = 'knowledgeHtml.speechRate.v1';
  const CHECK_KEY = 'secondBrainBridgeDevGuide.checklist.v1';
  const speech = window.speechSynthesis;
  const rateInput = document.querySelector('#speechRate');
  const rateValue = document.querySelector('#rateValue');
  let voices = [];
  let speakingToken = 0;

  function clampRate(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.min(3, Math.max(.7, Math.round(n * 10) / 10));
  }

  function loadRate() {
    const saved = clampRate(localStorage.getItem(RATE_KEY) || 1);
    if (rateInput) rateInput.value = String(saved);
    if (rateValue) rateValue.textContent = `${saved.toFixed(1)}×`;
    return saved;
  }

  function currentRate() {
    return clampRate(rateInput?.value || 1);
  }

  function updateRate() {
    const value = currentRate();
    if (rateValue) rateValue.textContent = `${value.toFixed(1)}×`;
    localStorage.setItem(RATE_KEY, String(value));
  }

  function refreshVoices() {
    voices = speech?.getVoices?.() || [];
  }

  function scoreVoice(voice, lang) {
    const name = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    const vlang = String(voice.lang || '').toLowerCase();
    const target = lang.toLowerCase();
    let score = 0;
    if (vlang === target) score += 50;
    else if (vlang.startsWith(target.slice(0, 2))) score += 30;
    if (/natural|neural|premium|enhanced|online/.test(name)) score += 20;
    if (/microsoft|google|apple|siri/.test(name)) score += 5;
    if (/compact|robot|espeak/.test(name)) score -= 8;
    return score;
  }

  function bestVoice(lang) {
    if (!voices.length) refreshVoices();
    return voices
      .map(v => ({ voice: v, score: scoreVoice(v, lang) }))
      .filter(x => x.score >= 30)
      .sort((a, b) => b.score - a.score)[0]?.voice || null;
  }

  function normalizeSpeechText(text) {
    return String(text || '')
      .replace(/[→↔↗•●◆■□▲▼]/g, ' ')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function detectLang(text, explicitLang) {
    if (explicitLang) {
      const code = explicitLang.toLowerCase();
      if (code.startsWith('en')) return 'en-US';
      if (code.startsWith('ja')) return 'ja-JP';
    }
    const clean = String(text || '');
    const jp = (clean.match(/[ぁ-んァ-ヶ一-龯]/g) || []).length;
    const latin = (clean.match(/[A-Za-z]/g) || []).length;
    return latin > 0 && jp === 0 ? 'en-US' : 'ja-JP';
  }

  function splitLongText(text, max = 160) {
    const clean = normalizeSpeechText(text);
    if (!clean) return [];
    const sentences = clean.split(/(?<=[。！？.!?])\s*/).filter(Boolean);
    const out = [];
    for (const sentence of sentences) {
      if (sentence.length <= max) {
        out.push(sentence);
        continue;
      }
      let rest = sentence;
      while (rest.length > max) {
        let cut = Math.max(rest.lastIndexOf('、', max), rest.lastIndexOf(',', max), rest.lastIndexOf(' ', max));
        if (cut < max * .55) cut = max;
        out.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
      }
      if (rest) out.push(rest);
    }
    return out;
  }

  function readableNodes(root) {
    const selector = 'h1,h2,h3,h4,p,li,th,td,summary,pre code,.arch-box,.cause,.lane span,.lane strong,.formula';
    return [...root.querySelectorAll(selector)].filter(el => {
      if (el.closest('.voice-panel,.toc,.level-heading button,footer')) return false;
      if (el.matches('li') && el.querySelector('p')) return false;
      return normalizeSpeechText(el.textContent).length > 0;
    });
  }

  function segmentsFor(root) {
    const segments = [];
    for (const el of readableNodes(root)) {
      const text = normalizeSpeechText(el.dataset.speechText || el.textContent);
      const lang = detectLang(text, el.getAttribute('lang') || el.closest('[lang]')?.getAttribute('lang'));
      for (const part of splitLongText(text)) segments.push({ text: part, lang });
    }
    return segments;
  }

  function stopSpeaking() {
    speakingToken += 1;
    speech?.cancel?.();
  }

  function speakSegments(segments) {
    if (!speech || !segments.length) return;
    stopSpeaking();
    const token = speakingToken;
    refreshVoices();
    let index = 0;

    const next = () => {
      if (token !== speakingToken || index >= segments.length) return;
      const segment = segments[index++];
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = segment.lang;
      utterance.rate = currentRate();
      const voice = bestVoice(segment.lang);
      if (voice) utterance.voice = voice;
      utterance.onend = next;
      utterance.onerror = event => {
        if (event.error !== 'canceled' && event.error !== 'interrupted') next();
      };
      speech.speak(utterance);
    };
    next();
  }

  function speakTarget(selector) {
    const root = document.querySelector(selector);
    if (!root) return;
    speakSegments(segmentsFor(root));
  }

  function wireSpeech() {
    loadRate();
    refreshVoices();
    if (speech && 'onvoiceschanged' in speech) speech.onvoiceschanged = refreshVoices;
    rateInput?.addEventListener('input', updateRate);
    document.querySelectorAll('[data-speak-target]').forEach(button => {
      button.addEventListener('click', () => speakTarget(button.dataset.speakTarget));
    });
    document.querySelector('#stopSpeech')?.addEventListener('click', stopSpeaking);
    window.addEventListener('pagehide', stopSpeaking);
  }

  function loadChecklist() {
    const boxes = [...document.querySelectorAll('#buildChecklist input[type="checkbox"]')];
    if (!boxes.length) return;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(CHECK_KEY) || '[]'); } catch { saved = []; }
    boxes.forEach((box, index) => { box.checked = saved[index] === true; });
    const persist = () => {
      localStorage.setItem(CHECK_KEY, JSON.stringify(boxes.map(box => box.checked)));
    };
    boxes.forEach(box => box.addEventListener('change', persist));
  }

  wireSpeech();
  loadChecklist();
})();
