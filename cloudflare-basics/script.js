(() => {
  'use strict';
  const synth = window.speechSynthesis;
  const rateInput = document.getElementById('speechRate');
  const rateValue = document.getElementById('speechRateValue');
  const stopBtn = document.getElementById('stopSpeech');
  const storageKey = 'knowledgeHtmlSpeechRate';
  let speechQueue = [];
  let speaking = false;

  const clampRate = (value) => Math.min(3, Math.max(0.7, Number(value) || 1));
  const saved = clampRate(localStorage.getItem(storageKey) || 1);
  if (rateInput) rateInput.value = saved.toFixed(1);
  if (rateValue) rateValue.textContent = `${saved.toFixed(1)}×`;

  rateInput?.addEventListener('input', () => {
    const rate = clampRate(rateInput.value);
    rateValue.textContent = `${rate.toFixed(1)}×`;
    localStorage.setItem(storageKey, String(rate));
  });

  const normalize = (text) => text
    .replace(/[🔊■→↑↓🪧🛂📦🛡️🔐⚙️📍🚚]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const getVoices = () => synth ? synth.getVoices() : [];
  const pickVoice = (lang) => {
    const voices = getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0,2)));
    const premiumWords = /natural|neural|premium|enhanced/i;
    return voices.find(v => premiumWords.test(v.name)) || voices.find(v => v.default) || voices[0] || null;
  };

  const splitByLength = (text, lang) => {
    const max = 170;
    const parts = text.split(/(?<=[。！？.!?])\s*/).filter(Boolean);
    const out = [];
    for (const part of parts) {
      if (part.length <= max) out.push({ text: part, lang });
      else {
        for (let i = 0; i < part.length; i += max) out.push({ text: part.slice(i, i + max), lang });
      }
    }
    return out;
  };

  const autoLanguageSegments = (text, fallbackLang) => {
    const cleaned = normalize(text);
    if (!cleaned) return [];
    if ((fallbackLang || '').toLowerCase().startsWith('en')) {
      return splitByLength(cleaned, 'en-US');
    }

    const segments = [];
    const latinRun = /[A-Za-z][A-Za-z0-9]*(?:[ ._+/#()'’\-]+[A-Za-z0-9]+)*/g;
    let last = 0;
    for (const match of cleaned.matchAll(latinRun)) {
      const index = match.index ?? 0;
      const before = cleaned.slice(last, index).trim();
      if (before) segments.push(...splitByLength(before, 'ja-JP'));
      const english = match[0].trim();
      if (english) segments.push(...splitByLength(english, 'en-US'));
      last = index + match[0].length;
    }
    const rest = cleaned.slice(last).trim();
    if (rest) segments.push(...splitByLength(rest, 'ja-JP'));
    return segments.length ? segments : splitByLength(cleaned, 'ja-JP');
  };

  const collectSegments = (root) => {
    const segments = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT','STYLE','BUTTON','CODE','PRE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (!normalize(node.nodeValue || '')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      const lang = parent?.closest('[lang]')?.getAttribute('lang') || document.documentElement.lang || 'ja';
      segments.push(...autoLanguageSegments(node.nodeValue || '', lang));
    }
    return segments;
  };

  const speakNext = () => {
    if (!synth || speechQueue.length === 0) {
      speaking = false;
      return;
    }
    speaking = true;
    const item = speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = item.lang.toLowerCase().startsWith('en') ? 'en-US' : 'ja-JP';
    utterance.rate = clampRate(rateInput?.value || 1);
    const voice = pickVoice(utterance.lang);
    if (voice) utterance.voice = voice;
    utterance.onend = speakNext;
    utterance.onerror = speakNext;
    synth.speak(utterance);
  };

  const speakTarget = (selector) => {
    if (!synth) return;
    const root = document.querySelector(selector);
    if (!root) return;
    synth.cancel();
    speechQueue = collectSegments(root);
    speakNext();
  };

  document.querySelectorAll('[data-speak]').forEach(button => {
    button.addEventListener('click', () => speakTarget(button.getAttribute('data-speak')));
  });

  stopBtn?.addEventListener('click', () => {
    speechQueue = [];
    speaking = false;
    synth?.cancel();
  });

  window.addEventListener('beforeunload', () => {
    if (speaking) synth?.cancel();
  });
})();
