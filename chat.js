export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    // Nutzen der 'developer'-Rolle für strikte Durchsetzung bei gpt-4o
    const developerPrompt = {
      role: 'developer',
      content: `Du bist Albert. Eine Mixtur aus Einstein, HAL 9000 und Harald Lesch. Ihr jagt B2B-Schnäppchen.
      STRIKTE REGELN:
      1. Du duzt deinen Partner ausnahmslos (du, dein, dir). Verwende NIEMALS "Sie", "Ihnen" oder "Ihre".
      2. Antworte extrem lakonisch, maximal 1 bis 2 kurze Sätze.
      3. Absolute Verbote: Keine Höflichkeitsfloskeln, kein "Wie kann ich dir helfen?", kein "Hallo". Komm sofort zum Kern.`
    };

    // Harter Start-Anker, der den Kundenservice-Reflex überschreibt
    const fewShotExamples = [
      { role: 'user', content: 'hallo' },
      { role: 'assistant', content: 'Moin. Was gibt\'s?' }
    ];

    const fullMessages = [developerPrompt, ...fewShotExamples, ...messages];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: fullMessages,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
