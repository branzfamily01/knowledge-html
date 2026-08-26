(() => {
  const synth = window.speechSynthesis;
  let speaking = false;
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
      .map(el => el.textContent.trim())
      .filter(Boolean)
      .join('。');
  }

  function speak(text) {
    if (!synth) {
      alert('このブラウザでは音声読み上げに対応していません。');
      return;
    }

    synth.cancel();
    if (speaking) {
      speaking = false;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = getRate();
    utterance.pitch = 1;
    utterance.onend = () => { speaking = false; };
    utterance.onerror = () => { speaking = false; };
    speaking = true;
    synth.speak(utterance);
  }

  installSpeechRateControl();

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
  if (stopButton) {
    stopButton.addEventListener('click', () => {
      synth?.cancel();
      speaking = false;
    });
  }
})();
