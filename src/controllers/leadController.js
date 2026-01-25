const { fetchLeadsFromPlatforms } = require("../utils/leadfetcher");


exports.searchLeads = async (req, res) => {
  try {
    const { keyword, platforms, dateFrom, dateTo } = req.query;

    if (!keyword) {
      return res.status(400).json({ message: 'Keyword is required' });
    }

    const platformArray = platforms ? platforms.split(',') : ['LinkedIn', 'Upwork', 'Twitter'];
    
    const filters = {
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(dateTo) : null,
    };

    const leads = await fetchLeadsFromPlatforms(keyword, platformArray, filters);

    res.json({
      message: 'Leads fetched successfully',
      count: leads.length,
      leads,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads', error: error.message });
  }
};

exports.saveLead = async (req, res) => {
  try {
    const userId = req.user._id;
    const leadData = { ...req.body, userId };

    const lead = await Lead.create(leadData);

    // Update leads used count
    req.user.subscription.leadsUsed += 1;
    await req.user.save();

    res.status(201).json({
      message: 'Lead saved successfully',
      lead,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error saving lead', error: error.message });
  }
};

exports.getMyLeads = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, platform, jobField } = req.query;

    const filter = { userId };
    if (status) filter.status = status;
    if (platform) filter.platform = platform;
    if (jobField) filter.jobField = jobField;

    const leads = await Lead.find(filter).sort({ createdAt: -1 });

    res.json({
      count: leads.length,
      leads,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads', error: error.message });
  }
};

exports.updateLeadStatus = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { status } = req.body;

    const lead = await Lead.findOneAndUpdate(
      { _id: leadId, userId: req.user._id },
      { status },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json({
      message: 'Lead status updated',
      lead,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating lead', error: error.message });
  }
};
