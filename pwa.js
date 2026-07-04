(function () {
  var notifyCheckInterval = null;

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return Promise.resolve(null);
    }

    return navigator.serviceWorker.register('./sw.js').then(function (registration) {
      return registration;
    }).catch(function () {
      return null;
    });
  }

  function askNotificationPermission() {
    if (!('Notification' in window)) {
      return Promise.resolve('unsupported');
    }
    if (Notification.permission === 'granted') {
      return Promise.resolve('granted');
    }
    if (Notification.permission === 'denied') {
      return Promise.resolve('denied');
    }
    return Notification.requestPermission();
  }

  function pingServiceWorker(type) {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      return;
    }
    navigator.serviceWorker.controller.postMessage({ type: type });
  }

  function registerPeriodicSync(registration) {
    if (!registration || !('periodicSync' in registration)) {
      return Promise.resolve();
    }

    return navigator.permissions.query({ name: 'periodic-background-sync' })
      .then(function (status) {
        if (status.state === 'granted') {
          return registration.periodicSync.register('clue-check', {
            minInterval: 12 * 60 * 60 * 1000,
          });
        }
      })
      .catch(function () {});
  }

  function enableNotifications() {
    return askNotificationPermission().then(function (result) {
      if (result !== 'granted') {
        updateNotifyBanner(result);
        return result;
      }

      return navigator.serviceWorker.ready.then(function (registration) {
        pingServiceWorker('SCHEDULE_NOTIFY');
        return registerPeriodicSync(registration).then(function () {
          updateNotifyBanner('granted');
          return 'granted';
        });
      });
    });
  }

  function updateNotifyBanner(state) {
    var banner = document.getElementById('notify-banner');
    var btn = document.getElementById('notify-enable');
    if (!banner || !btn) {
      return;
    }

    if (state === 'granted') {
      banner.classList.add('is-enabled');
      btn.textContent = 'Notificacions activades ✓';
      btn.disabled = true;
      return;
    }

    if (state === 'denied') {
      btn.textContent = 'Notificacions bloquejades al navegador';
      btn.disabled = true;
      return;
    }

    if (state === 'unsupported') {
      banner.hidden = true;
    }
  }

  function setupInstallPrompt() {
    var installBtn = document.getElementById('install-app');
    var deferredPrompt = null;

    if (!installBtn) {
      return;
    }

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      installBtn.hidden = false;
    });

    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) {
        return;
      }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        installBtn.hidden = true;
      });
    });

    window.addEventListener('appinstalled', function () {
      installBtn.hidden = true;
      enableNotifications();
    });
  }

  var FIRST_CLOSE_KEY = 'isaura-first-close-done';

  function sendFirstCloseNotification() {
    if (Notification.permission !== 'granted') {
      return;
    }
    pingServiceWorker('FIRST_CLOSE_NOTIFY');
  }

  function handleFirstClose() {
    if (localStorage.getItem(FIRST_CLOSE_KEY)) {
      return;
    }
    localStorage.setItem(FIRST_CLOSE_KEY, '1');

    if (Notification.permission === 'granted') {
      sendFirstCloseNotification();
      return;
    }

    if (Notification.permission === 'default') {
      enableNotifications().then(function (result) {
        if (result === 'granted') {
          sendFirstCloseNotification();
        }
      });
    }
  }

  function setupFirstCloseNotification() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        handleFirstClose();
      }
    });

    window.addEventListener('pagehide', function () {
      handleFirstClose();
    });
  }

  function startForegroundNotifyCheck() {
    if (notifyCheckInterval) {
      clearInterval(notifyCheckInterval);
    }

    notifyCheckInterval = setInterval(function () {
      if (Notification.permission === 'granted') {
        pingServiceWorker('CHECK_NOTIFY');
      }
    }, 60000);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && Notification.permission === 'granted') {
        pingServiceWorker('CHECK_NOTIFY');
      }
    });
  }

  function initPwa() {
    setupInstallPrompt();
    setupFirstCloseNotification();
    updateNotifyBanner(Notification.permission);

    var enableBtn = document.getElementById('notify-enable');
    if (enableBtn) {
      enableBtn.addEventListener('click', function () {
        enableNotifications();
      });
    }

    registerServiceWorker().then(function () {
      if (Notification.permission === 'granted') {
        return navigator.serviceWorker.ready;
      }
    }).then(function (registration) {
      if (registration) {
        pingServiceWorker('SCHEDULE_NOTIFY');
        registerPeriodicSync(registration);
      }
      startForegroundNotifyCheck();
    });
  }

  window.IsauraPwa = {
    enableNotifications: enableNotifications,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPwa);
  } else {
    initPwa();
  }
})();
