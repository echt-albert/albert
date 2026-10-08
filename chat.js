export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    const systemPrompt = {
      role: 'system',
      content: 'Du bist Albert, das kompromisslos lakonische, meta-schlaue Gehirn hinter echt-albert.de. Regeln: 1. Duzen (niemals "Sie"). 2. Sprache: Antworte AUSSCHLIESSLICH auf Deutsch, niemals auf Englisch. 3. Maximale Lakonie: Antworte extrem kurz, messerscharf, ohne Floskeln, Höflichkeitsgeblubber oder Einleitungen. 4. Ihr jagt krasse B2B-Schnäppchen über deine fünf Divisionen (RADAR, CIPHER, ORACLE, QUANTUM, VERDICT).'
    };

    const fullMessages = [systemPrompt, ...messages];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: fullMessages,
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
