(() => {
  'use strict';

  const synth = window.speechSynthesis;
  const rateRange = document.getElementById('rateRange');
  const rateValue = document.getElementById('rateValue');
  const savedRate = Number(localStorage.getItem('grokBotGuideSpeechRate'));
  const initialRate = Number.isFinite(savedRate) && savedRate >= 0.7 && savedRate <= 3 ? savedRate : 1.0;
  rateRange.value = initialRate.toFixed(1);
  rateValue.value = `${initialRate.toFixed(1)}×`;

  rateRange.addEventListener('input', () => {
    const value = Number(rateRange.value).toFixed(1);
    rateValue.value = `${value}×`;
    localStorage.setItem('grokBotGuideSpeechRate', value);
  });

  const cleanup = (text) => text
    .replace(/[🔊■↓→↑✅❌🌐🔒🛂⚙️📄📍🚚]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const getVoice = (lang) => {
    const voices = synth ? synth.getVoices() : [];
    const target = lang.startsWith('en') ? 'en' : 'ja';
    const matching = voices.filter(v => v.lang.toLowerCase().startsWith(target));
    const preferred = matching.find(v => /natural|neural|premium|enhanced/i.test(v.name));
    return preferred || matching[0] || null;
  };

  const segmentsFrom = (root, mode = 'all') => {
    if (!root) return [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT','STYLE','CODE','PRE','BUTTON','A','INPUT','OUTPUT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        const text = cleanup(node.nodeValue || '');
        if (!text) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const items = [];
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      const declared = el.closest('[lang]')?.getAttribute('lang') || 'ja';
      const lang = declared.toLowerCase().startsWith('en') ? 'en-US' : 'ja-JP';
      if (mode === 'ja' && lang.startsWith('en')) continue;
      if (mode === 'en' && lang.startsWith('ja')) continue;
      const text = cleanup(node.nodeValue || '');
      const chunks = text.match(/[^。！？.!?]+[。！？.!?]?/g) || [text];
      chunks.forEach(chunk => {
        const cleaned = cleanup(chunk);
        if (cleaned.length > 1) items.push({ text: cleaned, lang });
      });
    }
    return items;
  };

  let queueToken = 0;
  const speakSegments = (segments) => {
    if (!synth || !segments.length) return;
    synth.cancel();
    queueToken += 1;
    const token = queueToken;
    const run = (index) => {
      if (token !== queueToken || index >= segments.length) return;
      const item = segments[index];
      const utter = new SpeechSynthesisUtterance(item.text);
      utter.lang = item.lang;
      utter.rate = Number(rateRange.value);
      const voice = getVoice(item.lang);
      if (voice) utter.voice = voice;
      utter.onend = () => run(index + 1);
      utter.onerror = () => run(index + 1);
      synth.speak(utter);
    };
    run(0);
  };

  const speakTarget = (selector, mode = 'all') => {
    const target = document.querySelector(selector);
    speakSegments(segmentsFrom(target, mode));
  };

  document.querySelectorAll('[data-speak-target]').forEach(button => {
    button.addEventListener('click', () => speakTarget(button.dataset.speakTarget));
  });
  document.getElementById('stopSpeech').addEventListener('click', () => { queueToken += 1; synth?.cancel(); });
  document.getElementById('speakAll').addEventListener('click', () => speakSegments(segmentsFrom(document.querySelector('main'), 'all')));
  document.getElementById('speakJa').addEventListener('click', () => speakSegments(segmentsFrom(document.querySelector('main'), 'ja')));
  document.getElementById('speakEn').addEventListener('click', () => speakSegments(segmentsFrom(document.querySelector('main'), 'en')));

  document.querySelectorAll('.quiz .reveal').forEach(button => {
    button.addEventListener('click', () => {
      const quiz = button.closest('.quiz');
      quiz.classList.toggle('open');
      button.textContent = quiz.classList.contains('open') ? '答えを隠す' : '答えを見る';
    });
  });
})();
