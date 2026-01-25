const express = require("express");
const router = express.Router();

 

router.use("/user", require("./routes/user_Routes"));
// router.use("/admin", require("./routes/adminRoutes"));


module.exports = router;
