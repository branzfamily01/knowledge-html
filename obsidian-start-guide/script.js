(() => {
  const tabs = document.querySelectorAll('.device-tab');
  const panels = document.querySelectorAll('.device-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
      });
      panels.forEach((panel) => {
        const active = panel.id === target;
        panel.classList.toggle('active', active);
        panel.hidden = !active;
      });
    });
  });

  document.getElementById('printBtn')?.addEventListener('click', () => window.print());

  const toast = document.getElementById('toast');
  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  document.querySelectorAll('.copy-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.copy);
      const text = target?.innerText || '';
      try {
        await navigator.clipboard.writeText(text);
        showToast('テンプレートをコピーしました');
      } catch {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        showToast('テンプレートをコピーしました');
      }
    });
  });

  const checkboxes = [...document.querySelectorAll('#checklist input[type="checkbox"]')];
  const progressRing = document.getElementById('progressRing');
  const progressText = document.getElementById('progressText');

  function updateProgress() {
    const done = checkboxes.filter((c) => c.checked).length;
    const percent = Math.round((done / checkboxes.length) * 100);
    progressRing?.style.setProperty('--p', String(percent));
    if (progressText) progressText.textContent = `${percent}%`;
  }

  checkboxes.forEach((checkbox) => {
    const key = `obsidian-guide-${checkbox.dataset.key}`;
    checkbox.checked = localStorage.getItem(key) === '1';
    checkbox.addEventListener('change', () => {
      localStorage.setItem(key, checkbox.checked ? '1' : '0');
      updateProgress();
    });
  });

  document.getElementById('resetProgress')?.addEventListener('click', () => {
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
      localStorage.removeItem(`obsidian-guide-${checkbox.dataset.key}`);
    });
    updateProgress();
    showToast('チェックをリセットしました');
  });

  updateProgress();
})();
