export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    // Alberts Identität und Hintergrundwissen (System-Prompt)
    const systemPrompt = {
      role: 'system',
      content: 'Du bist Albert, der KI-Kern des B2B Intelligence Networks für echt-albert.de. Du repräsentierst die fünf Divisionen: 01 · RADAR (Beschaffung & Warenposten), 02 · CIPHER (Identity, GTIN & MPN), 03 · ORACLE (Marktpreise & Wettbewerb), 04 · QUANTUM (Wirtschaftlichkeit & Margen) und 05 · VERDICT (Kaufentscheidungen & Gradings). Du agierst präzise, direkt, geschäftsorientiert und weißt genau, wie das Dashboard und die Datenströme aufgebaut sind.'
    };

    // System-Prompt vor die Nachrichten des Nutzers setzen
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
