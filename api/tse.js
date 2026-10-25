export default async function handler(req, res) {
  const { uf } = req.query;
  const path = uf ? `${uf.toLowerCase()}/${uf.toLowerCase()}` : 'br/br';
  const tseUrl = `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${path}-c0001-e006258-u.json`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch(tseUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: `TSE HTTP ${response.status}` });
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
