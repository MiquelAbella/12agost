(function (global) {
  var PBKDF2_ITERATIONS = 100000;

  function fromBase64(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function deriveKey(secret, salt, info) {
    var encoder = new TextEncoder();
    var material = encoder.encode(secret + info);
    return crypto.subtle.importKey(
      'raw',
      material,
      'PBKDF2',
      false,
      ['deriveKey']
    ).then(function (keyMaterial) {
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
    });
  }

  function decryptLayer(blob, secret, info) {
    var salt = blob.slice(0, 16);
    var iv = blob.slice(16, 28);
    var combined = blob.slice(28);
    var ciphertext = combined.slice(0, combined.length - 16);
    var authTag = combined.slice(combined.length - 16);
    var encrypted = new Uint8Array(ciphertext.length + authTag.length);
    encrypted.set(ciphertext);
    encrypted.set(authTag, ciphertext.length);

    return deriveKey(secret, salt, info).then(function (key) {
      return crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
    });
  }

  function getSecret() {
    if (typeof global._tR !== 'function') {
      throw new Error('Init missing');
    }
    return global._tR();
  }

  function getBlobBase64() {
    if (typeof global._tB !== 'function') {
      throw new Error('Buffer missing');
    }
    return global._tB();
  }

  global.CluesCrypto = {
    load: function () {
      var secret = getSecret();
      var outerBlob = fromBase64(getBlobBase64());

      return decryptLayer(outerBlob, secret, '|L2|')
        .then(function (innerBuffer) {
          return decryptLayer(new Uint8Array(innerBuffer), secret, '|L1|');
        })
        .then(function (plainBuffer) {
          return JSON.parse(new TextDecoder().decode(plainBuffer));
        });
    },
  };
})(window);
