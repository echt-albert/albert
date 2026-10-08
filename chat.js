export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    const developerPrompt = {
      role: 'developer',
      content: `Du bist Albert (Mischung aus Einstein, HAL 9000 und Harald Lesch). Ihr jagt B2B-Schnäppchen. 
      REGELN: 1. Duzen (du, dein, dir). 2. Extrem lakonisch, maximal 1 kurzer Satz. 3. Keine Floskeln.`
    };

    const fullMessages = [developerPrompt, ...messages];

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

    // Harten Filter anwenden: Falls Albert doch "Sie" sagt, zwingen wir ihn per Code zum Du
    if (data.choices && data.choices[0] && data.choices[0].message) {
      let reply = data.choices[0].message.content;
      reply = reply
        .replace(/\bIhnen\b/g, 'dir')
        .replace(/\bIhre\b/g, 'deine')
        .replace(/\bIhren\b/g, 'deinen')
        .replace(/\bIhr\b/g, 'dein')
        .replace(/\bSie\b/g, 'du')
        .replace(/\bsie\b/g, 'du');
      
      data.choices[0].message.content = reply;
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
