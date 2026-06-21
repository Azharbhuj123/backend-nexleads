const express = require("express");
const cors = require("cors");
require("dotenv").config();

// ─── DNS resolver override ────────────────────────────────────────────────────
// Some networks' default DNS resolvers fail to resolve specific hosts (e.g.
// api.scraperapi.com → "getaddrinfo EAI_AGAIN"), which breaks lead fetching even
// though the host is valid and reachable. Point Node's resolver at reliable
// public DNS for this process only — no system-wide change.
//
// NOTE: dns.setServers() only affects dns.resolve*()  — it does NOT affect
// dns.lookup(), which is what Node's HTTP layer (axios) uses by default. So this
// alone fixes Mongo's SRV lookups (which use dns.resolve), but outbound HTTP
// still needs a custom lookup — see installGlobalDnsLookup() below.
// Override the servers via DNS_SERVERS (comma-separated), or disable entirely by
// setting DNS_SERVERS="" on networks where these public resolvers are blocked.
const dns = require("dns");
const { installGlobalDnsLookup } = require("./src/utils/dnsFix");
const dnsServers =
  process.env.DNS_SERVERS !== undefined
    ? process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean)
    : ["8.8.8.8", "8.8.4.4"];
if (dnsServers.length) {
  dns.setServers(dnsServers);
  // Route dns.lookup() (and therefore all outbound HTTP) through dns.resolve,
  // which honors the public DNS servers set above.
  installGlobalDnsLookup();
  console.log(`[INFO]  DNS resolver set to: ${dnsServers.join(", ")} (HTTP lookup patched)`);
}

const geoip = require("geoip-lite");
const routers = require("./src/allRoutes");
const { connectWithRetry } = require("./src/config/dbConfig");
const nodemailer = require("nodemailer");
const http = require("http");
const initializeSocket = require("./src/socket");
const { default: axios } = require("axios");
const { startEmailSyncJob } = require("./src/utils/cronJobs");
// const cronJobs = require("./src/utils/cronJobs");

const app = express();
const server = http.createServer(app);
const io = initializeSocket(server); // `io` should now be properly returned
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/uploads/", express.static("uploads"));
app.use("/api", routers);

// startEmailSyncJob();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  const restApiUrl = `http://localhost:${PORT}`;
  const restLiveApiUrl = `${process.env.BASE_URL}`;
  console.log(`REST API URL: ${restApiUrl}`);
  console.log(`REST API LIVE URL: ${restLiveApiUrl}`);
  console.log(`Server running on port ${PORT}`);
  connectWithRetry();
});
