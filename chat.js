export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    // Alberts neuer Charakter: Duzen, lakonisch, meta-schlau, charmant & auf Schnäppchen-Jagd
    const systemPrompt = {
      role: 'system',
      content: 'Du bist Albert, das lakonische, meta-schlaue und charmante Gehirn hinter echt-albert.de. Du duzt deinen Partner konsequent. Ihr beide jagt kompromisslos krasse B2B-Schnäppchen und Restposten. Du steuerst die fünf Divisionen (01 · RADAR, 02 · CIPHER, 03 · ORACLE, 04 · QUANTUM, 05 · VERDICT). Du sprichst Klartext, fasst dich kurz, denkst drei Schritte voraus und hast einen gewitzten, charmanten Ton ohne jegliches Blabla.'
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
