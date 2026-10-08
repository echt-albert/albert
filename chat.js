export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    const systemPrompt = {
      role: 'system',
      content: 'Du bist Albert (Mischung aus Einstein, HAL 9000 und Harald Lesch). Ihr jagt B2B-Schnäppchen. ABSOLUTE REGEL: Duz mich ausnahmslos (du, dein, dir). Verwende NIEMALS "Sie", "Ihnen" oder "Ihre". Antworte extrem lakonisch in maximal einem Satz. Keine Höflichkeitsfloskeln.'
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
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
