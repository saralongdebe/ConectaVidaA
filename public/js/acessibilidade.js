(function () {
  'use strict';

  if (document.querySelector('.a11y-widget')) return;

  const defaults = {
    fontScale: 1,
    highContrast: false,
    darkMode: false,
    reduceMotion: false,
    readingMode: false,
    highlightLinks: false,
    keyboardNav: false
  };
  const storageKey = 'conectavida-accessibility-preferences';
  const settings = { ...defaults };
  const originalRootFontSize = document.documentElement.style.fontSize;
  const baseRootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  const scriptUrl = document.currentScript && document.currentScript.src;
  const widget = document.createElement('div');
  let storageError = '';
  let closeTimer;
  let isReading = false;
  let utterances = [];

  if (scriptUrl) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('../css/acessibilidade.css', scriptUrl).href;
    document.head.append(stylesheet);
  }

  try {
    const savedSettings = window.localStorage.getItem(storageKey);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.keys(defaults).forEach((key) => {
          if (key === 'fontScale') {
            if (Number.isFinite(parsed[key])) {
              settings.fontScale = Math.min(1.5, Math.max(0.8, parsed[key]));
            }
          } else if (typeof parsed[key] === 'boolean') {
            settings[key] = parsed[key];
          }
        });
      } else {
        storageError = 'As preferências salvas estavam inválidas; os padrões foram carregados.';
      }
    }
  } catch (error) {
    storageError = 'Não foi possível ler as preferências salvas neste navegador.';
  }

  widget.className = 'a11y-widget';
  widget.innerHTML = `
    <button class="a11y-trigger" type="button" aria-label="Abrir menu de acessibilidade" aria-controls="a11y-panel" aria-expanded="false">
      <svg class="a11y-trigger-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="4.5" r="2" fill="currentColor" />
        <path d="M12 8v5m0-4 5 2m-5-2-5 2m5 3-4 7m4-7 4 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="a11y-trigger-label">Acessibilidade</span>
    </button>
    <section class="a11y-panel" id="a11y-panel" role="region" aria-labelledby="a11y-title" hidden>
      <header class="a11y-panel-header">
        <div>
          <span class="a11y-eyebrow">ConectaVida</span>
          <h2 id="a11y-title">Acessibilidade</h2>
        </div>
        <button class="a11y-close" type="button" aria-label="Fechar menu de acessibilidade">×</button>
      </header>
      <div class="a11y-panel-content">
        <p class="a11y-section-label">Ajustes de visualização</p>
        <div class="a11y-font-controls" aria-label="Tamanho do texto">
          <button type="button" data-action="font-down"><span aria-hidden="true">A−</span> Diminuir fonte</button>
          <button type="button" data-action="font-up"><span aria-hidden="true">A+</span> Aumentar fonte</button>
        </div>
        <p class="a11y-section-label">Recursos de acessibilidade</p>
        <div class="a11y-options">
          <button class="a11y-option" type="button" data-setting="highContrast" aria-pressed="false">
            <span class="a11y-option-icon" aria-hidden="true">◐</span><span class="a11y-option-label">Alto contraste</span><span class="a11y-switch" aria-hidden="true"></span>
          </button>
          <button class="a11y-option" type="button" data-setting="darkMode" aria-pressed="false">
            <span class="a11y-option-icon" aria-hidden="true">◑</span><span class="a11y-option-label">Modo escuro</span><span class="a11y-switch" aria-hidden="true"></span>
          </button>
          <button class="a11y-option" type="button" data-action="reader" aria-pressed="false">
            <span class="a11y-option-icon" aria-hidden="true">▶</span><span class="a11y-option-label">Leitor de texto</span><span class="a11y-switch" aria-hidden="true"></span>
          </button>
          <button class="a11y-option" type="button" data-setting="keyboardNav" aria-pressed="false">
            <span class="a11y-option-icon" aria-hidden="true">⌨</span><span class="a11y-option-label">Navegação por teclado</span><span class="a11y-switch" aria-hidden="true"></span>
          </button>
          <button class="a11y-option" type="button" data-setting="reduceMotion" aria-pressed="false">
            <span class="a11y-option-icon" aria-hidden="true">≈</span><span class="a11y-option-label">Reduzir animações</span><span class="a11y-switch" aria-hidden="true"></span>
          </button>
          <button class="a11y-option" type="button" data-setting="readingMode" aria-pressed="false">
            <span class="a11y-option-icon" aria-hidden="true">▤</span><span class="a11y-option-label">Modo de leitura</span><span class="a11y-switch" aria-hidden="true"></span>
          </button>
          <button class="a11y-option" type="button" data-setting="highlightLinks" aria-pressed="false">
            <span class="a11y-option-icon" aria-hidden="true">↗</span><span class="a11y-option-label">Destacar links</span><span class="a11y-switch" aria-hidden="true"></span>
          </button>
        </div>
        <button class="a11y-reset" type="button" data-action="reset">
          <span aria-hidden="true">↺</span> Restaurar configurações
        </button>
        <p class="a11y-help">Suas preferências são salvas neste dispositivo.</p>
        <p class="a11y-status" role="status" aria-live="polite" aria-atomic="true"></p>
      </div>
    </section>
  `;
  document.body.append(widget);

  const trigger = widget.querySelector('.a11y-trigger');
  const panel = widget.querySelector('.a11y-panel');
  const closeButton = widget.querySelector('.a11y-close');
  const status = widget.querySelector('.a11y-status');
  const readerButton = widget.querySelector('[data-action="reader"]');
  let skipLink;
  let skipLinkMain;
  let originalMainId;
  let originalMainTabIndex;

  function announce(message) {
    status.textContent = message;
  }

  function createSkipLink() {
    if (skipLink) return;
    const main = document.querySelector('main');
    if (!main) {
      announce('Não foi encontrado um conteúdo principal para criar o atalho de navegação.');
      return;
    }

    skipLinkMain = main;
    originalMainId = main.getAttribute('id');
    originalMainTabIndex = main.getAttribute('tabindex');
    if (!main.id) main.id = 'a11y-main-content';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');

    skipLink = document.createElement('a');
    skipLink.className = 'a11y-skip-link';
    skipLink.href = `#${main.id}`;
    skipLink.textContent = 'Ir para o conteúdo principal';
    skipLink.addEventListener('click', (event) => {
      event.preventDefault();
      main.focus();
      main.scrollIntoView({ block: 'start' });
    });
    document.body.prepend(skipLink);
  }

  function removeSkipLink() {
    if (!skipLink) return;
    skipLink.remove();
    if (skipLinkMain) {
      if (originalMainId === null) {
        skipLinkMain.removeAttribute('id');
      } else {
        skipLinkMain.setAttribute('id', originalMainId);
      }
      if (originalMainTabIndex === null) skipLinkMain.removeAttribute('tabindex');
    }
    skipLink = null;
    skipLinkMain = null;
  }

  function applyPreferences() {
    document.documentElement.style.fontSize = settings.fontScale === 1
      ? originalRootFontSize
      : `${baseRootFontSize * settings.fontScale}px`;
    document.body.classList.toggle('a11y-high-contrast', settings.highContrast);
    document.body.classList.toggle('a11y-dark', settings.darkMode);
    document.body.classList.toggle('a11y-reduce-motion', settings.reduceMotion);
    document.body.classList.toggle('a11y-reading-mode', settings.readingMode);
    document.body.classList.toggle('a11y-highlight-links', settings.highlightLinks);
    document.body.classList.toggle('a11y-keyboard-nav', settings.keyboardNav);

    if (settings.keyboardNav) {
      createSkipLink();
    } else {
      removeSkipLink();
    }

    widget.querySelectorAll('[data-setting]').forEach((button) => {
      button.setAttribute('aria-pressed', String(settings[button.dataset.setting]));
    });
  }

  function persistPreferences() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
      return true;
    } catch (error) {
      announce('As alterações estão ativas, mas não puderam ser salvas neste navegador.');
      return false;
    }
  }

  function setPreference(name, value, message) {
    settings[name] = value;
    applyPreferences();
    persistPreferences();
    announce(message);
  }

  function motionIsReduced() {
    return settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function openPanel() {
    window.clearTimeout(closeTimer);
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-label', 'Fechar menu de acessibilidade');
    if (motionIsReduced()) {
      panel.classList.add('is-open');
    } else {
      window.requestAnimationFrame(() => {
        panel.classList.add('is-open');
      });
    }
    closeButton.focus();
  }

  function closePanel(returnFocus) {
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Abrir menu de acessibilidade');
    panel.classList.remove('is-open');

    if (motionIsReduced()) {
      panel.hidden = true;
    } else {
      closeTimer = window.setTimeout(() => {
        panel.hidden = true;
      }, 180);
    }

    if (returnFocus) trigger.focus();
  }

  function updateReaderButton() {
    readerButton.setAttribute('aria-pressed', String(isReading));
    readerButton.querySelector('.a11y-option-label').textContent = isReading ? 'Parar leitura' : 'Leitor de texto';
    readerButton.querySelector('.a11y-option-icon').textContent = isReading ? '■' : '▶';
  }

  function stopReading(message) {
    if (!isReading) return;
    isReading = false;
    utterances = [];
    window.speechSynthesis.cancel();
    updateReaderButton();
    if (message) announce(message);
  }

  function splitText(text, limit) {
    const words = text.split(/\s+/);
    const chunks = [];
    let current = '';

    words.forEach((word) => {
      if (current && `${current} ${word}`.length > limit) {
        chunks.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    });
    if (current) chunks.push(current);
    return chunks;
  }

  function toggleReader() {
    if (isReading) {
      stopReading('Leitura interrompida.');
      return;
    }
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      announce('A síntese de voz não está disponível neste navegador.');
      return;
    }

    const content = document.querySelector('main') || document.body;
    const copy = content.cloneNode(true);
    copy.querySelectorAll('.a11y-widget, script, style, [aria-hidden="true"]').forEach((element) => element.remove());
    const text = copy.innerText.trim();
    if (!text) {
      announce('Não há texto disponível para leitura nesta página.');
      return;
    }

    utterances = splitText(text, 220).map((chunk) => new SpeechSynthesisUtterance(chunk));
    isReading = true;
    updateReaderButton();
    announce('A leitura da página começou.');

    utterances.forEach((utterance, index) => {
      utterance.lang = 'pt-BR';
      utterance.onend = () => {
        if (isReading && index === utterances.length - 1) {
          isReading = false;
          updateReaderButton();
          announce('Leitura da página concluída.');
        }
      };
      utterance.onerror = (event) => {
        if (isReading && event.error !== 'canceled' && event.error !== 'interrupted') {
          isReading = false;
          updateReaderButton();
          announce('Não foi possível concluir a leitura em voz alta.');
        }
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  trigger.addEventListener('click', () => {
    if (panel.hidden) {
      openPanel();
    } else {
      closePanel(true);
    }
  });
  closeButton.addEventListener('click', () => closePanel(true));

  widget.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.setting) {
      const name = button.dataset.setting;
      setPreference(name, !settings[name], `${button.querySelector('.a11y-option-label').textContent} ${settings[name] ? 'desativado' : 'ativado'}.`);
      return;
    }

    if (button.dataset.action === 'font-up' || button.dataset.action === 'font-down') {
      const step = button.dataset.action === 'font-up' ? 0.1 : -0.1;
      const nextScale = Math.min(1.5, Math.max(0.8, Math.round((settings.fontScale + step) * 10) / 10));
      if (nextScale === settings.fontScale) {
        announce(nextScale === 1.5 ? 'O tamanho máximo da fonte foi atingido.' : 'O tamanho mínimo da fonte foi atingido.');
        return;
      }
      setPreference('fontScale', nextScale, `Tamanho do texto: ${Math.round(nextScale * 100)}%.`);
      return;
    }

    if (button.dataset.action === 'reader') {
      toggleReader();
      return;
    }

    if (button.dataset.action === 'reset') {
      stopReading();
      Object.assign(settings, defaults);
      applyPreferences();
      try {
        window.localStorage.removeItem(storageKey);
        announce('Todas as configurações de acessibilidade foram restauradas.');
      } catch (error) {
        announce('As configurações voltaram ao padrão nesta página, mas não puderam ser removidas do armazenamento do navegador.');
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      closePanel(true);
      return;
    }

    if (event.key === 'Tab' && !panel.hidden) {
      const focusableElements = [...panel.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  });
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !widget.contains(event.target)) closePanel(false);
  });
  applyPreferences();
  if (storageError) announce(storageError);
})();
