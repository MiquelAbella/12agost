var CACHE_NAME = 'isaura-v9';
var CLUES_START = new Date(2026, 5, 16);
var PRE_CLUES_COUNT = 8;
var TOTAL_CLUES = 38;
var EARLY_NOTIFY_DELAY_MS = 15 * 60 * 1000;
var NOTIFY_HOUR = 7;
var NOTIFY_MINUTE = 30;
var CATALAN_MONTHS = [
  'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre',
];

var STATIC_ASSETS = [
  'index.html',
  'styles.css',
  'script.js',
  'crypto.js',
  'pwa.js',
  'manifest.webmanifest',
  'assets/analytics.init.js',
  'assets/icon-192.svg',
  'assets/icon-512.svg',
];

var notifyTimer = null;
var earlyNotifyTimer = null;

function assetUrl(path) {
  return new URL(path, self.registration.scope).href;
}

function cacheUrl(path) {
  return new URL(path, self.location).href;
}

function putInCache(request, response) {
  if (!response || response.status !== 200) {
    return;
  }
  var copy = response.clone();
  caches.open(CACHE_NAME).then(function (cache) {
    cache.put(request, copy);
  });
}

function networkFirst(request, fallbackPath) {
  return fetch(request).then(function (response) {
    putInCache(request, response);
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) {
        return cached;
      }
      return caches.match(cacheUrl(fallbackPath));
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    var networkFetch = fetch(request).then(function (response) {
      putInCache(request, response);
      return response;
    }).catch(function () {
      return cached;
    });
    return cached || networkFetch;
  });
}

function startOfDay(date) {
  var copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(date) {
  return date.getDate() + ' de ' + CATALAN_MONTHS[date.getMonth()];
}

function getTodayClueIndex() {
  var today = startOfDay(new Date());
  var start = startOfDay(CLUES_START);
  var diff = Math.floor((today - start) / 86400000);
  if (diff < 0 || diff >= TOTAL_CLUES) {
    return null;
  }
  return diff;
}

function isPastNotifyTime() {
  var now = new Date();
  return now.getHours() > NOTIFY_HOUR ||
    (now.getHours() === NOTIFY_HOUR && now.getMinutes() >= NOTIFY_MINUTE);
}

function todayKey() {
  var now = new Date();
  return now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate();
}

function openDb() {
  return new Promise(function (resolve, reject) {
    var request = indexedDB.open('isaura-pwa', 1);
    request.onupgradeneeded = function () {
      request.result.createObjectStore('meta');
    };
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () { reject(request.error); };
  });
}

function dbGet(key) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('meta', 'readonly');
      var req = tx.objectStore('meta').get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function dbSet(key, value) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('meta', 'readwrite');
      var req = tx.objectStore('meta').put(value, key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function showEarlyClueNotification() {
  return self.registration.showNotification('Isaura · El teu regal t\'espera', {
    body: 'Ja tens la primera pista! Obre l\'app i descobreix-la ♥',
    icon: assetUrl('assets/icon-192.svg'),
    badge: assetUrl('assets/icon-192.svg'),
    tag: 'early-clue',
    renotify: true,
    data: { clueIndex: 0, type: 'early-clue' },
  });
}

function fireEarlyClueNotification() {
  return dbGet('earlyNotifySent').then(function (sent) {
    if (sent) {
      return false;
    }

    return showEarlyClueNotification().then(function () {
      return dbSet('earlyNotifySent', true).then(function () { return true; });
    });
  });
}

function checkEarlyClueNotification() {
  return dbGet('earlyNotifySent').then(function (sent) {
    if (sent) {
      return false;
    }

    return dbGet('earlyNotifyAt').then(function (notifyAt) {
      if (!notifyAt || Date.now() < notifyAt) {
        return false;
      }
      return fireEarlyClueNotification();
    });
  });
}

function scheduleEarlyClueNotification() {
  return dbGet('earlyNotifySent').then(function (sent) {
    if (sent) {
      return;
    }

    return dbGet('earlyNotifyAt').then(function (existingAt) {
      var notifyAt = existingAt;
      if (!notifyAt) {
        notifyAt = Date.now() + EARLY_NOTIFY_DELAY_MS;
        return dbSet('earlyNotifyAt', notifyAt).then(function () {
          return notifyAt;
        });
      }
      return notifyAt;
    }).then(function (notifyAt) {
      if (earlyNotifyTimer) {
        clearTimeout(earlyNotifyTimer);
      }

      var delay = Math.max(0, notifyAt - Date.now());
      if (delay === 0) {
        return checkEarlyClueNotification();
      }

      earlyNotifyTimer = setTimeout(function () {
        checkEarlyClueNotification();
      }, delay);
    });
  });
}

function showFirstCloseNotification() {
  return dbGet('firstCloseNotify').then(function (sent) {
    if (sent) {
      return false;
    }

    return self.registration.showNotification('Isaura · El teu regal t\'espera', {
      body: 'Fins demà! La propera pista t\'espera ♥',
      icon: assetUrl('assets/icon-192.svg'),
      badge: assetUrl('assets/icon-192.svg'),
      tag: 'first-close',
      data: { type: 'first-close' },
    }).then(function () {
      return dbSet('firstCloseNotify', true).then(function () { return true; });
    });
  });
}

function getClueLabel(clueIndex) {
  if (clueIndex < PRE_CLUES_COUNT) {
    return 'Pre-pista ' + (clueIndex + 1);
  }
  return 'Pista ' + (clueIndex - PRE_CLUES_COUNT + 1);
}

function showClueNotification(clueIndex) {
  var date = new Date(CLUES_START);
  date.setDate(date.getDate() + clueIndex);
  var dateLabel = formatDate(date);
  var clueLabel = getClueLabel(clueIndex);

  return self.registration.showNotification(clueLabel + ' · ' + dateLabel, {
    body: "Bon dia, Isaura! La pista d'avui ja t'espera ♥",
    icon: assetUrl('assets/icon-192.svg'),
    badge: assetUrl('assets/icon-192.svg'),
    tag: 'clue-' + todayKey(),
    renotify: true,
    data: { clueIndex: clueIndex },
  });
}

function checkAndNotify() {
  if (!self.registration) {
    return Promise.resolve(false);
  }

  return self.registration.getNotifications().then(function (existing) {
    var clueIndex = getTodayClueIndex();
    if (clueIndex === null || !isPastNotifyTime()) {
      return false;
    }

    var key = todayKey();
    return dbGet('lastNotify').then(function (last) {
      if (last === key) {
        return false;
      }

      var alreadyVisible = existing.some(function (item) {
        return item.tag === 'clue-' + key;
      });
      if (alreadyVisible) {
        return false;
      }

      return showClueNotification(clueIndex).then(function () {
        return dbSet('lastNotify', key).then(function () { return true; });
      });
    });
  });
}

function msUntilNextNotifyTime() {
  var now = new Date();
  var next = new Date(now);
  next.setHours(NOTIFY_HOUR, NOTIFY_MINUTE, 0, 0);
  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }
  return next - now;
}

function scheduleNotifyAlarm() {
  if (notifyTimer) {
    clearTimeout(notifyTimer);
  }

  var delay = msUntilNextNotifyTime();
  notifyTimer = setTimeout(function () {
    checkAndNotify().finally(function () {
      scheduleNotifyAlarm();
    });
  }, delay);
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        STATIC_ASSETS.map(function (assetPath) {
          return cache.add(cacheUrl(assetPath)).catch(function () {
            return null;
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      scheduleNotifyAlarm();
      scheduleEarlyClueNotification();
      return checkAndNotify();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, 'index.html'));
    return;
  }

  var destination = event.request.destination;
  if (destination === 'script' || destination === 'style' || destination === 'manifest') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(
    staleWhileRevalidate(event.request).catch(function () {
      return caches.match(cacheUrl('index.html'));
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data) {
    return;
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CHECK_NOTIFY') {
    checkAndNotify();
    checkEarlyClueNotification();
  }

  if (event.data.type === 'SCHEDULE_NOTIFY') {
    scheduleNotifyAlarm();
    scheduleEarlyClueNotification();
    checkAndNotify();
  }

  if (event.data.type === 'SCHEDULE_EARLY_NOTIFY') {
    event.waitUntil(scheduleEarlyClueNotification());
  }

  if (event.data.type === 'FIRST_CLOSE_NOTIFY') {
    event.waitUntil(showFirstCloseNotification());
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var clueIndex = event.notification.data && event.notification.data.clueIndex;
  var url = self.registration.scope;
  if (typeof clueIndex === 'number') {
    url = url + '?pista=' + (clueIndex + 1);
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('periodicsync', function (event) {
  if (event.tag === 'clue-check') {
    event.waitUntil(checkAndNotify());
  }
});
