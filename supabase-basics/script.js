(() => {
  const synth = window.speechSynthesis;
  let speaking = false;

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
    utterance.rate = 1.02;
    utterance.pitch = 1;
    utterance.onend = () => { speaking = false; };
    utterance.onerror = () => { speaking = false; };
    speaking = true;
    synth.speak(utterance);
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
  if (stopButton) {
    stopButton.addEventListener('click', () => {
      synth?.cancel();
      speaking = false;
    });
  }
})();
