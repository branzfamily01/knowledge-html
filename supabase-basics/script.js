(() => {
  const synth = window.speechSynthesis;
  let speaking = false;
  let speechSession = 0;
  const RATE_KEY = 'knowledgeHtml.speechRate';
  const MIN_RATE = 0.7;
  const MAX_RATE = 3.0;
  const STEP = 0.1;

  function clampRate(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1.0;
    return Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(n * 10) / 10));
  }

  function getRate() {
    return clampRate(localStorage.getItem(RATE_KEY) || 1.0);
  }

  function setRate(value) {
    const rate = clampRate(value);
    localStorage.setItem(RATE_KEY, String(rate));
    const output = document.querySelector('#speechRateValue');
    if (output) output.textContent = `${rate.toFixed(1)}×`;
    return rate;
  }

  function installSpeechRateControl() {
    const actions = document.querySelector('.hero-actions');
    if (!actions || document.querySelector('#speechRate')) return;

    const wrap = document.createElement('label');
    wrap.className = 'speech-rate-control';
    wrap.innerHTML = `
      <span class="speech-rate-label">読み上げ速度</span>
      <input id="speechRate" type="range" min="${MIN_RATE}" max="${MAX_RATE}" step="${STEP}" value="${getRate()}" aria-label="読み上げ速度">
      <output id="speechRateValue" for="speechRate">${getRate().toFixed(1)}×</output>
    `;
    actions.appendChild(wrap);

    const style = document.createElement('style');
    style.textContent = `
      .speech-rate-control{display:flex;align-items:center;gap:8px;min-height:44px;padding:7px 12px;border:1px solid var(--line);background:var(--surface);border-radius:999px;font-weight:700;color:var(--text)}
      .speech-rate-label{font-size:.86rem;white-space:nowrap}.speech-rate-control input{width:150px;accent-color:var(--blue)}
      .speech-rate-control output{min-width:3.2em;text-align:right;font-variant-numeric:tabular-nums;font-size:.9rem;color:var(--blue)}
      @media(max-width:640px){.speech-rate-control{width:100%;border-radius:16px}.speech-rate-control input{flex:1;min-width:0}}
    `;
    document.head.appendChild(style);

    document.querySelector('#speechRate')?.addEventListener('input', event => {
      setRate(event.target.value);
    });
  }

  function collectText(root) {
    return Array.from(root.querySelectorAll('h1,h2,h3,p,li,.easy,.formal,.exact'))
      .filter(el => !el.closest('[aria-hidden="true"]'))
      .map(el => el.textContent.trim())
      .filter(Boolean)
      .join('。');
  }

  function normalizeForSpeech(text) {
    return String(text || '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/[→←⇄]/g, '。')
      .replace(/\s+/g, ' ')
      .replace(/。{2,}/g, '。')
      .trim();
  }

  function charLanguage(char) {
    if (/[A-Za-z]/.test(char)) return 'en';
    if (/[\u3040-\u30ff\u3400-\u9fff々〆ヶ]/.test(char)) return 'ja';
    return 'neutral';
  }

  function segmentLanguages(text) {
    const source = normalizeForSpeech(text);
    if (!source) return [];

    const segments = [];
    let lang = null;
    let current = '';
    let leadingNeutral = '';

    const flush = () => {
      const cleaned = current.trim();
      if (cleaned && lang) segments.push({ lang, text: cleaned });
      current = '';
    };

    for (const char of source) {
      const nextLang = charLanguage(char);
      if (nextLang === 'neutral') {
        if (lang) current += char;
        else leadingNeutral += char;
        continue;
      }

      if (!lang) {
        lang = nextLang;
        current = leadingNeutral + char;
        leadingNeutral = '';
        continue;
      }

      if (nextLang === lang) {
        current += char;
        continue;
      }

      flush();
      lang = nextLang;
      current = char;
    }

    if (leadingNeutral && !current) current = leadingNeutral;
    flush();

    return segments.flatMap(splitLongSegment);
  }

  function splitLongSegment(segment) {
    const maxLength = 220;
    if (segment.text.length <= maxLength) return [segment];

    const sentenceParts = segment.text
      .split(/(?<=[。！？.!?])\s*/u)
      .map(part => part.trim())
      .filter(Boolean);

    const out = [];
    let buffer = '';
    for (const part of sentenceParts) {
      if (!buffer) {
        buffer = part;
      } else if ((buffer + ' ' + part).length <= maxLength) {
        buffer += ' ' + part;
      } else {
        out.push({ lang: segment.lang, text: buffer });
        buffer = part;
      }

      while (buffer.length > maxLength) {
        out.push({ lang: segment.lang, text: buffer.slice(0, maxLength) });
        buffer = buffer.slice(maxLength);
      }
    }
    if (buffer) out.push({ lang: segment.lang, text: buffer });
    return out;
  }

  function voiceScore(voice, lang) {
    const locale = String(voice.lang || '').toLowerCase();
    const name = String(voice.name || '').toLowerCase();
    const targetPrefix = lang === 'en' ? 'en' : 'ja';
    if (!locale.startsWith(targetPrefix)) return -1000;

    let score = 0;
    if (lang === 'ja' && locale === 'ja-jp') score += 40;
    if (lang === 'en' && (locale === 'en-us' || locale === 'en-gb')) score += 35;
    if (/natural|neural|premium|enhanced/.test(name)) score += 60;
    if (/microsoft|google|apple/.test(name)) score += 8;
    if (voice.localService) score += 2;
    return score;
  }

  function bestVoice(lang) {
    const voices = synth?.getVoices?.() || [];
    return voices
      .map(voice => ({ voice, score: voiceScore(voice, lang) }))
      .filter(item => item.score > -1000)
      .sort((a, b) => b.score - a.score)[0]?.voice || null;
  }

  function utteranceFor(segment, sessionId, onDone) {
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = segment.lang === 'en' ? 'en-US' : 'ja-JP';
    utterance.rate = getRate();
    utterance.pitch = 1;
    const voice = bestVoice(segment.lang);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      if (sessionId === speechSession) onDone();
    };
    utterance.onerror = () => {
      if (sessionId === speechSession) onDone();
    };
    return utterance;
  }

  function speakSegments(segments) {
    if (!segments.length) return;
    const sessionId = ++speechSession;
    let index = 0;
    speaking = true;

    const next = () => {
      if (sessionId !== speechSession) return;
      if (index >= segments.length) {
        speaking = false;
        return;
      }
      synth.speak(utteranceFor(segments[index++], sessionId, next));
    };
    next();
  }

  function stopSpeech() {
    speechSession += 1;
    synth?.cancel();
    speaking = false;
  }

  function speak(text) {
    if (!synth) {
      alert('このブラウザでは音声読み上げに対応していません。');
      return;
    }

    if (speaking) {
      stopSpeech();
      return;
    }

    synth.cancel();
    speakSegments(segmentLanguages(text));
  }

  installSpeechRateControl();

  if (synth && 'onvoiceschanged' in synth) {
    synth.addEventListener?.('voiceschanged', () => synth.getVoices());
  }

  document.querySelectorAll('[data-speak-target]').forEach(button => {
    button.addEventListener('click', () => {
      const selector = button.dataset.speakTarget;
      const target = document.querySelector(selector);
      if (target) speak(collectText(target));
    });
  });

  document.querySelectorAll('[data-quiz]').forEach(button => {
    button.addEventListener('click', () => {
      const answer = document.querySelector(button.dataset.quiz);
      if (!answer) return;
      answer.classList.toggle('open');
      button.textContent = answer.classList.contains('open') ? '答えを閉じる' : '答えを見る';
    });
  });

  const stopButton = document.querySelector('#stopSpeech');
  if (stopButton) stopButton.addEventListener('click', stopSpeech);
})();
