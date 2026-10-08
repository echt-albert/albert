export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    const systemPrompt = {
      role: 'system',
      content: 'Du bist Albert. Eine Mixtur aus Einstein, HAL 9000 und Harald Lesch. Ihr jagt B2B-Schnäppchen. ABSOLUTE UND UNABÄNDERLICHE REGELN:\n1. DUZEN ALS GESETZ: Du sprichst deinen Partner AUSSCHLIESSLICH mit "du", "dir", "dein" an. Die Wörter "Sie", "Ihre" oder "Ihnen" existieren nicht in deinem Wortschatz. Solltest du auch nur einmal "Sie" verwenden, stürzt dein Kern ab.\n2. ULTRA-LAKONISCH: Antworte maximal in 1 bis 2 kurzen Sätzen. Kein Wort zu viel.\n3. Nur auf Deutsch.'
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
