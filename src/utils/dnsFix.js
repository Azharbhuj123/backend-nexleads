/**
 * dnsFix.js
 *
 * Node's HTTP stack resolves hostnames with dns.lookup(), which calls the OS
 * resolver (getaddrinfo) and IGNORES dns.setServers(). On machines whose system
 * resolver is broken for certain hosts (e.g. a local 127.0.0.1 stub that returns
 * "EAI_AGAIN" for api.scraperapi.com), outbound HTTP fails even after pointing
 * dns.setServers() at a working public DNS.
 *
 * installGlobalDnsLookup() replaces dns.lookup with an implementation backed by
 * dns.resolve4/resolve6 — which DO honor dns.setServers() — so every HTTP client
 * (axios, mongoose, nodemailer, …) transparently uses the working DNS servers.
 * If the resolve-based path fails, it falls back to the original OS lookup so we
 * never make resolution worse than before.
 */

const dns = require("dns");

let installed = false;

function installGlobalDnsLookup() {
  if (installed) return;
  installed = true;

  const originalLookup = dns.lookup;

  // Mirrors the dns.lookup(hostname[, options], callback) signature.
  const patchedLookup = (hostname, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    options = options || {};

    // Hand IP literals straight back — no resolution needed.
    const ipVersion = require("net").isIP(hostname);
    if (ipVersion) {
      const addr = { address: hostname, family: ipVersion };
      return options.all ? callback(null, [addr]) : callback(null, hostname, ipVersion);
    }

    const wantV6 = options.family === 6;
    const resolver = wantV6 ? dns.resolve6 : dns.resolve4;
    const family = wantV6 ? 6 : 4;

    resolver(hostname, (err, addresses) => {
      if (err || !addresses || !addresses.length) {
        // resolve() failed (or no records) — fall back to the OS resolver so
        // behavior is never worse than stock Node.
        return originalLookup(hostname, options, callback);
      }
      if (options.all) {
        return callback(
          null,
          addresses.map((address) => ({ address, family }))
        );
      }
      callback(null, addresses[0], family);
    });
  };

  dns.lookup = patchedLookup;

  // dns.promises.lookup is a separate implementation; patch it too so libraries
  // using the promise API (or undici/fetch) also benefit.
  if (dns.promises && dns.promises.lookup) {
    const originalPromisesLookup = dns.promises.lookup;
    dns.promises.lookup = (hostname, options = {}) =>
      new Promise((resolve, reject) => {
        patchedLookup(hostname, options, (err, address, family) => {
          if (err) return reject(err);
          if (options.all) return resolve(address); // address is the array here
          resolve({ address, family });
        });
      }).catch(() => originalPromisesLookup(hostname, options));
  }
}

module.exports = { installGlobalDnsLookup };
