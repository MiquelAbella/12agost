var CACHE_NAME = 'isaura-v1';
var CLUES_START = new Date(2026, 6, 12);
var TOTAL_CLUES = 31;
var NOTIFY_HOUR = 7;
var NOTIFY_MINUTE = 30;
var CATALAN_MONTHS = [
  'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre',
];

var STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './crypto.js',
  './pwa.js',
  './manifest.webmanifest',
  './assets/analytics.init.js',
  './assets/icon-192.svg',
  './assets/icon-512.svg',
];

var notifyTimer = null;

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

function showClueNotification(clueIndex) {
  var date = new Date(CLUES_START);
  date.setDate(date.getDate() + clueIndex);
  var dayNumber = clueIndex + 1;
  var dateLabel = formatDate(date);

  return self.registration.showNotification('Pista ' + dayNumber + ' · ' + dateLabel, {
    body: "Bon dia, Isaura! La pista d'avui ja t'espera ♥",
    icon: './assets/icon-192.svg',
    badge: './assets/icon-192.svg',
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
    if (Notification.permission !== 'granted') {
      return false;
    }

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
      return cache.addAll(STATIC_ASSETS);
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
      return checkAndNotify();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
      return cached || network;
    }).catch(function () {
      return caches.match('./index.html');
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data) {
    return;
  }

  if (event.data.type === 'CHECK_NOTIFY') {
    checkAndNotify();
  }

  if (event.data.type === 'SCHEDULE_NOTIFY') {
    scheduleNotifyAlarm();
    checkAndNotify();
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var clueIndex = event.notification.data && event.notification.data.clueIndex;
  var url = './';
  if (typeof clueIndex === 'number') {
    url = './?pista=' + (clueIndex + 1);
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
