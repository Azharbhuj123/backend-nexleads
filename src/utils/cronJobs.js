const cron = require("node-cron");
const campaign = require("../models/campaign/campaign");
const { status } = require("./enums");

// Cron jobs to auto-delete inactive campaign.
cron.schedule("0 0 * * *", async () => {
  try {
    const now = new Date();
    await campaign.deleteMany({
      endDate: { $lt: now },
    });
    await campaign.updateMany(
      { startDate: { $lte: now } },
      { $set: { status: status[0] } }
    );
    console.log("✅ Cron Job: Campaigns updated successfully");
  } catch (error) {
    console.error("❌ Cron Job Error:", error);
  }
});
