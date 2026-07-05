(function () {
  var notifyCheckInterval = null;

  var BASE_PATH = (function () {
    var path = window.location.pathname;
    if (path.endsWith('/')) {
      return path;
    }
    var slash = path.lastIndexOf('/');
    return slash > 0 ? path.slice(0, slash + 1) : '/';
  })();

  function postToServiceWorker(type) {
    if (!('serviceWorker' in navigator)) {
      return Promise.resolve();
    }

    return navigator.serviceWorker.ready.then(function (registration) {
      var worker = registration.active || registration.waiting || registration.installing;
      if (worker) {
        worker.postMessage({ type: type });
      }
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return Promise.resolve(null);
    }

    return navigator.serviceWorker.register(BASE_PATH + 'sw.js', {
      scope: BASE_PATH,
    }).then(function (registration) {
      if (registration.waiting && navigator.serviceWorker.controller) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      return registration;
    }).catch(function (error) {
      console.error('No s\'ha pogut registrar el service worker:', error);
      return null;
    });
  }

  function setupServiceWorkerUpdates() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (window.__isauraSwReloaded) {
        return;
      }
      window.__isauraSwReloaded = true;
      window.location.reload();
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

  function scheduleNotifications(registration) {
    return postToServiceWorker('SCHEDULE_NOTIFY')
      .then(function () {
        return postToServiceWorker('SCHEDULE_EARLY_NOTIFY');
      })
      .then(function () {
        return registerPeriodicSync(registration);
      });
  }

  function enableNotifications() {
    return askNotificationPermission().then(function (result) {
      if (result !== 'granted') {
        updateNotifyBanner(result);
        return result;
      }

      return navigator.serviceWorker.ready.then(function (registration) {
        return scheduleNotifications(registration).then(function () {
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
    postToServiceWorker('FIRST_CLOSE_NOTIFY');
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
        postToServiceWorker('CHECK_NOTIFY');
      }
    }, 60000);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && Notification.permission === 'granted') {
        postToServiceWorker('CHECK_NOTIFY');
      }
    });
  }

  function initPwa() {
    setupInstallPrompt();
    setupFirstCloseNotification();
    setupServiceWorkerUpdates();
    updateNotifyBanner(Notification.permission);

    var enableBtn = document.getElementById('notify-enable');
    if (enableBtn) {
      enableBtn.addEventListener('click', function () {
        enableNotifications();
      });
    }

    registerServiceWorker()
      .then(function () {
        return navigator.serviceWorker.ready;
      })
      .then(function (registration) {
        if (Notification.permission === 'granted') {
          return scheduleNotifications(registration);
        }
      })
      .finally(function () {
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
