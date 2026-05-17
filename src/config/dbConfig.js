const { default: mongoose } = require("mongoose");
const dns = require("node:dns/promises");   
dns.setServers(["1.1.1.1", "1.0.0.1"]);  

module.exports.connectWithRetry = () => {
  mongoose
    .connect(process.env.DB_URI)
    .then(() => {
      const dbName = mongoose.connection.name;
      console.log(`Database Connected Successfully to ${dbName}`);
    })
    .catch((err) => {
      console.error("Database connection failed, retrying in 5 seconds...");
      console.error(err);
      setTimeout(this.connectWithRetry, 5000);
    });
};
