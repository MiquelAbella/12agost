(function () {
  const TARGET_DATE = new Date('2026-08-12T00:00:00');
  const CLUES_START = new Date(2026, 6, 5);
  const PRE_CLUES_COUNT = 8;
  const TOTAL_CLUES = 38;
  const UNLOCK_ALL_CLUES = false;

  const CATALAN_MONTHS = [
    'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
    'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre',
  ];

  const daysEl = document.getElementById('days');
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const messageEl = document.getElementById('countdown-message');

  const menuToggle = document.getElementById('menu-toggle');
  const menuOverlay = document.getElementById('menu-overlay');
  const menuBackdrop = document.getElementById('menu-backdrop');
  const menuClose = document.getElementById('menu-close');
  const cluesList = document.getElementById('clues-list');

  const clueModal = document.getElementById('clue-modal');
  const clueModalBackdrop = document.getElementById('clue-modal-backdrop');
  const clueModalClose = document.getElementById('clue-modal-close');
  const clueModalDate = document.getElementById('clue-modal-date');
  const clueModalTitle = document.getElementById('clue-modal-title');
  const clueModalText = document.getElementById('clue-modal-text');

  let clues = null;
  let previousValues = { days: '', hours: '', minutes: '', seconds: '' };

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function getClueDate(index) {
    const date = new Date(CLUES_START);
    date.setDate(date.getDate() + index);
    return date;
  }

  function formatDate(date) {
    return date.getDate() + ' de ' + CATALAN_MONTHS[date.getMonth()];
  }

  function isClueUnlocked(date) {
    if (UNLOCK_ALL_CLUES) {
      return true;
    }
    return startOfDay(new Date()) >= startOfDay(date);
  }

  function updateElement(el, value, key) {
    const formatted = pad(value);
    if (previousValues[key] !== formatted) {
      el.textContent = formatted;
      el.classList.remove('tick');
      void el.offsetWidth;
      el.classList.add('tick');
      previousValues[key] = formatted;
    }
  }

  function updateCountdown() {
    const now = new Date();
    const diff = TARGET_DATE - now;

    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      secondsEl.textContent = '00';
      messageEl.innerHTML =
        'Avui s\'acaben les pistes. El que et regalo no és una cosa, és un record per a tota la vida. ' +
        'Preparada per fer un <strong>salt en paracaigudes</strong>? 🪂❤️';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    updateElement(daysEl, days, 'days');
    updateElement(hoursEl, hours, 'hours');
    updateElement(minutesEl, minutes, 'minutes');
    updateElement(secondsEl, seconds, 'seconds');

    messageEl.textContent = "Cada segon t'acosta una mica més al teu regal...";
  }

  function createParticles() {
    const container = document.getElementById('particles');
    const count = 30;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.setProperty('--duration', 3 + Math.random() * 4 + 's');
      particle.style.setProperty('--delay', Math.random() * 5 + 's');
      container.appendChild(particle);
    }
  }

  function getClueLabel(index) {
    if (index < PRE_CLUES_COUNT) {
      return 'Pre-pista ' + (index + 1);
    }
    return 'Pista ' + (index - PRE_CLUES_COUNT + 1);
  }

  function appendMenuSection(title) {
    const li = document.createElement('li');
    li.className = 'menu-section';
    li.textContent = title;
    cluesList.appendChild(li);
  }

  function buildCluesMenu() {
    cluesList.innerHTML = '';

    if (!clues) {
      const li = document.createElement('li');
      li.className = 'menu-item menu-item-loading';
      li.textContent = 'Carregant pistes...';
      cluesList.appendChild(li);
      return;
    }

    for (let i = 0; i < TOTAL_CLUES; i++) {
      if (i === 0) {
        appendMenuSection('Introducció · 5–11 de juliol');
      }
      if (i === PRE_CLUES_COUNT) {
        appendMenuSection('Pistes del regal · 13 de juliol – 11 d\'agost');
      }

      const date = getClueDate(i);
      const unlocked = isClueUnlocked(date);
      const dateLabel = formatDate(date);
      const clueLabel = getClueLabel(i);

      const li = document.createElement('li');
      li.className = 'menu-item' + (unlocked ? ' menu-item-unlocked' : '');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-item-btn';
      btn.disabled = !unlocked;

      if (unlocked) {
        btn.setAttribute('aria-label', 'Obrir ' + clueLabel.toLowerCase() + ' del ' + dateLabel);
        btn.addEventListener('click', function () {
          openClueModal(clueLabel, dateLabel, clues[i]);
        });
      } else {
        btn.setAttribute('aria-label', clueLabel + ' del ' + dateLabel + ', encara bloquejada');
      }

      btn.innerHTML =
        '<span class="menu-item-day">' + (i < PRE_CLUES_COUNT ? '★' : (i - PRE_CLUES_COUNT + 1)) + '</span>' +
        '<span class="menu-item-label">' + dateLabel + ' · ' + clueLabel + '</span>' +
        '<span class="menu-item-icon" aria-hidden="true">' + (unlocked ? '→' : '🔒') + '</span>';

      li.appendChild(btn);
      cluesList.appendChild(li);
    }
  }

  function openMenu() {
    menuOverlay.classList.add('is-open');
    menuToggle.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-open');
  }

  function closeMenu() {
    menuOverlay.classList.remove('is-open');
    menuToggle.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
  }

  function openClueModal(clueLabel, dateLabel, text) {
    clueModalDate.textContent = dateLabel;
    clueModalTitle.textContent = clueLabel;
    clueModalText.textContent = text;
    clueModal.classList.add('is-open');
    clueModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    closeMenu();
  }

  function closeClueModal() {
    clueModal.classList.remove('is-open');
    clueModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function openClueFromParam() {
    var params = new URLSearchParams(window.location.search);
    var pista = parseInt(params.get('pista'), 10);
    if (!pista || !clues || pista < 1 || pista > TOTAL_CLUES) {
      return;
    }

    var index = pista - 1;
    var date = getClueDate(index);
    if (!isClueUnlocked(date)) {
      return;
    }

    openClueModal(getClueLabel(index), formatDate(date), clues[index]);
    history.replaceState(null, '', window.location.pathname);
  }

  window.openClueByDay = function (dayNumber) {
    if (!clues || dayNumber < 1 || dayNumber > TOTAL_CLUES) {
      return;
    }
    var index = dayNumber - 1;
    var date = getClueDate(index);
    if (isClueUnlocked(date)) {
      openClueModal(getClueLabel(index), formatDate(date), clues[index]);
    }
  };

  menuToggle.addEventListener('click', function () {
    if (menuOverlay.classList.contains('is-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  menuClose.addEventListener('click', closeMenu);
  menuBackdrop.addEventListener('click', closeMenu);
  clueModalClose.addEventListener('click', closeClueModal);
  clueModalBackdrop.addEventListener('click', closeClueModal);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (clueModal.classList.contains('is-open')) {
        closeClueModal();
      } else if (menuOverlay.classList.contains('is-open')) {
        closeMenu();
      }
    }
  });

  createParticles();
  buildCluesMenu();
  updateCountdown();
  setInterval(updateCountdown, 1000);
  setInterval(buildCluesMenu, 60000);

  CluesCrypto.load()
    .then(function (decryptedClues) {
      clues = decryptedClues;
      buildCluesMenu();
      openClueFromParam();
    })
    .catch(function () {
      cluesList.innerHTML = '';
      const li = document.createElement('li');
      li.className = 'menu-item menu-item-loading';
      li.textContent = 'No s\'han pogut carregar les pistes.';
      cluesList.appendChild(li);
    });
})();
