const { default: mongoose } = require("mongoose");

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
