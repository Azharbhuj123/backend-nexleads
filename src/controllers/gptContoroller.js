const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.fetchGPTLeads = async (keyword, count = 5) => {
  const prompt = `
Generate ${count} unique sales leads in STRICT JSON array format.

Rules:
- Each lead must have a UNIQUE email
- Use realistic professional emails (different domains: gmail.com, outlook.com, hostinger.com)
- No repeated names or emails
- Realistic professional data
- Platform must be one of: LinkedIn, Upwork, Twitter

Fields:
name, email, platform, jobField, jobTitle, company, location, profileUrl

Keyword: "${keyword}"

ONLY return valid JSON. No explanation.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const rawContent = response.choices[0].message.content;

  // 🔑 Remove backticks/code fences
  const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Error parsing GPT leads:', cleaned);
    throw new Error('GPT returned invalid JSON');
  }
};


exports.generateOrRewriteEmail = async (req, res) => {
  try {
    const { mode, body, prompt } = req.body;

    let systemPrompt = `
You are a professional email copywriter.
Return ONLY valid JSON.
Body must be in clean HTML.
`;

    let userPrompt = "";

    if (mode === "rewrite") {
      userPrompt = `
Rewrite the following email body.

Instruction:
${prompt || "Make it more professional"}

Email Body:
${body}

Return JSON:
{
  "body": "<html>"
}
`;
    }

    if (mode === "generate") {
      userPrompt = `
Generate a professional sales email.

Prompt:
${prompt}

Return JSON:
{
  "subject": "",
  "body": "<html>"
}
`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const raw = response.choices[0].message.content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(raw);

    res.status(200).json(parsed);
  } catch (err) {
    console.error("AI email error:", err);
    res.status(500).json({ message: "AI generation failed" });
  }
};
