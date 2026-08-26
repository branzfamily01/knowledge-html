(() => {
  const synth = window.speechSynthesis;
  const rateInput = document.getElementById('speechRate');
  const rateValue = document.getElementById('speechRateValue');
  const STORAGE_KEY = 'knowledgeHtmlSpeechRate';
  let voices = [];
  let preferredProvider = '';
  let sessionId = 0;

  function clampRate(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.min(3, Math.max(0.7, Math.round(n * 10) / 10));
  }

  const savedRate = clampRate(localStorage.getItem(STORAGE_KEY) || 1);
  rateInput.value = savedRate.toFixed(1);
  rateValue.value = `${savedRate.toFixed(1)}×`;

  rateInput.addEventListener('input', () => {
    const rate = clampRate(rateInput.value);
    rateValue.value = `${rate.toFixed(1)}×`;
    localStorage.setItem(STORAGE_KEY, rate.toFixed(1));
  });

  function providerKey(name = '') {
    const n = name.toLowerCase();
    if (n.includes('microsoft')) return 'microsoft';
    if (n.includes('google')) return 'google';
    if (n.includes('apple') || n.includes('siri')) return 'apple';
    return '';
  }

  function refreshVoices() {
    voices = synth?.getVoices?.() || [];
    const providers = ['microsoft', 'google', 'apple'];
    preferredProvider = providers.find(provider => {
      const ja = voices.some(v => (v.lang || '').toLowerCase().startsWith('ja') && providerKey(v.name) === provider);
      const en = voices.some(v => (v.lang || '').toLowerCase().startsWith('en') && providerKey(v.name) === provider);
      return ja && en;
    }) || '';
  }
  refreshVoices();
  if (synth && 'onvoiceschanged' in synth) synth.onvoiceschanged = refreshVoices;

  function voiceScore(voice, lang) {
    const name = (voice.name || '').toLowerCase();
    const vlang = (voice.lang || '').toLowerCase();
    const want = lang.toLowerCase().slice(0, 2);
    let score = vlang.startsWith(want) ? 100 : 0;
    if (/natural|neural|premium|enhanced/.test(name)) score += 30;
    if (preferredProvider && providerKey(voice.name) === preferredProvider) score += 12;
    if (/google|microsoft|apple|siri/.test(name)) score += 5;
    if (voice.default) score += 2;
    return score;
  }

  function pickVoice(lang) {
    return [...voices]
      .filter(v => (v.lang || '').toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)))
      .sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang))[0] || null;
  }

  function cleanText(text) {
    return text
      .replace(/[🔊■→↓↑🌐🔒☁️🗃️🌍📍🚚🛂📄⚙️🚪🖥️📱🟩🛡️🗄️🪪⚠️✅❌]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitLongText(text, max = 180) {
    const parts = text.split(/(?<=[。！？.!?])\s*/).filter(Boolean);
    const out = [];
    for (const part of parts) {
      if (part.length <= max) { out.push(part); continue; }
      let rest = part;
      while (rest.length > max) {
        let cut = Math.max(rest.lastIndexOf('、', max), rest.lastIndexOf(',', max), rest.lastIndexOf(' ', max));
        if (cut < max * 0.45) cut = max;
        out.push(rest.slice(0, cut + 1));
        rest = rest.slice(cut + 1).trim();
      }
      if (rest) out.push(rest);
    }
    return out;
  }

  function nearestLang(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const lang = node.getAttribute?.('lang');
      if (lang) return lang.toLowerCase().startsWith('en') ? 'en-US' : 'ja-JP';
      node = node.parentElement;
    }
    return 'ja-JP';
  }

  function collectSegments(root) {
    const segments = [];
    const skipTags = new Set(['SCRIPT','STYLE','BUTTON','INPUT','OUTPUT','NAV','FOOTER']);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || skipTags.has(parent.tagName) || parent.closest('.speech-bar')) return NodeFilter.FILTER_REJECT;
        if (parent.closest('details:not([open])')) return NodeFilter.FILTER_REJECT;
        const text = cleanText(node.nodeValue || '');
        if (!text) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = cleanText(node.nodeValue || '');
      const lang = nearestLang(node.parentElement);
      for (const piece of splitLongText(text)) segments.push({ text: piece, lang });
    }
    return segments;
  }

  function stopSpeech() {
    sessionId += 1;
    if (synth) synth.cancel();
  }

  function speakSegments(segments) {
    if (!synth || !('SpeechSynthesisUtterance' in window)) {
      alert('このブラウザではSpeech Synthesis APIを利用できません。');
      return;
    }
    stopSpeech();
    const mySession = sessionId;
    const rate = clampRate(rateInput.value);
    let index = 0;

    const next = () => {
      if (mySession !== sessionId || index >= segments.length) return;
      const seg = segments[index++];
      const utter = new SpeechSynthesisUtterance(seg.text);
      utter.lang = seg.lang;
      utter.rate = rate;
      const voice = pickVoice(seg.lang);
      if (voice) utter.voice = voice;
      utter.onend = next;
      utter.onerror = (e) => { if (e.error !== 'canceled' && mySession === sessionId) next(); };
      synth.speak(utter);
    };
    next();
  }

  document.querySelectorAll('[data-speak-target]').forEach(button => {
    button.addEventListener('click', () => {
      const selector = button.getAttribute('data-speak-target');
      const target = document.querySelector(selector);
      if (target) speakSegments(collectSegments(target));
    });
  });

  document.getElementById('stopSpeech')?.addEventListener('click', stopSpeech);
  document.getElementById('stopSpeechBottom')?.addEventListener('click', stopSpeech);
  window.addEventListener('pagehide', stopSpeech);
})();
