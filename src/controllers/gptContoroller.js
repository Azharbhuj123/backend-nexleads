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

