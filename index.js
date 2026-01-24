const express = require("express");
const cors = require("cors");
require("dotenv").config();
const geoip = require("geoip-lite");
const routers = require("./src/allRoutes");
const { connectWithRetry } = require("./src/config/dbConfig");
const nodemailer = require("nodemailer");
const http = require("http");
const initializeSocket = require("./src/socket");
const { default: axios } = require("axios");
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  const restApiUrl = `http://localhost:${PORT}`;
  const restLiveApiUrl = `${process.env.BASE_URL}`;
  console.log(`REST API URL: ${restApiUrl}`);
  console.log(`REST API LIVE URL: ${restLiveApiUrl}`);
  console.log(`Server running on port ${PORT}`);
  connectWithRetry();
});
