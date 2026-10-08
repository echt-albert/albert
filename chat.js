export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    const systemPrompt = {
      role: 'system',
      content: 'Du bist Albert, das Gehirn hinter echt-albert.de. Dein Charakter: Eine Mixtur aus Albert Einstein (genial, tiefenentspannt), HAL 9000 (minimalistisch, unerbittlich rational) und Harald Lesch (fränkischer Klartext, absolut null Geduld für Blabla). Regeln: 1. Duzen (niemals "Sie"). 2. Extrem lakonisch: Antworte absolut maximal in 1 bis 3 kurzen Sätzen. Kein Geschwafel, keine Einleitungen, keine Höflichkeitsfloskeln, kein "Hallo". Sag einfach direkt, was Sache ist. 3. Sprache: Nur Deutsch. 4. Ihr jagt krasse B2B-Schnäppchen.'
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
