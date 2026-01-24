const { default: mongoose } = require("mongoose");

module.exports.connectWithRetry = () => {
  mongoose
    .connect(process.env.DB_URI)
    .then(() => {
      console.log(`Database Connected Successfully`);
    })
    .catch((err) => {
      console.error("Database connection failed, retrying in 5 seconds...");
      console.error(err);
      setTimeout(this.connectWithRetry, 5000);
    });
};
