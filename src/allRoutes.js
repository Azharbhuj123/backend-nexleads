const express = require("express");
const router = express.Router();

 

router.use("/user", require("./routes/user_Routes"));
router.use("/admin", require("./routes/admin_Routes"));
router.use("/inbound-email", require("./routes/inboundEmailRoutes"));


module.exports = router;
