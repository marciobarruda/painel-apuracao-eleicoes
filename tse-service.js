/**
 * tse-service.js - Conector para a API Oficial de Resultados do TSE
 * Suporta consulta aos arquivos oficiais de totalização simplificada do TSE.
 */

const TSEService = {
  defaultUrl: 'https://resultados.tse.jus.br/oficial/ele2022/545/dados-simplificados/br/br-c0001-e000545-r.json',
  proxyUrl: 'https://api.allorigins.win/raw?url=',

  async fetchResults(url, useProxy = true) {
    const targetUrl = url || this.defaultUrl;
    const finalUrl = useProxy ? `${this.proxyUrl}${encodeURIComponent(targetUrl)}` : targetUrl;

    try {
      const response = await fetch(finalUrl, {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();
      return this.parseTseResponse(rawData);
    } catch (err) {
      console.warn('Erro ao consultar TSE API:', err);
      throw err;
    }
  },

  parseTseResponse(data) {
    if (!data || !data.cand) {
      throw new Error('Formato de dados JSON do TSE inválido ou ausente.');
    }

    // Normaliza os números e percentuais
    const parseNumber = (val) => parseInt(String(val || '0').replace(/\./g, ''), 10) || 0;
    const parsePct = (val) => parseFloat(String(val || '0').replace(',', '.')) || 0;

    const candList = data.cand.map(c => ({
      number: c.n,
      name: c.nm,
      party: c.cc || '',
      votes: parseNumber(c.vap),
      pct: parsePct(c.pvap).toFixed(2),
      situation: c.st || ''
    }));

    // Ordena por votos decrescente
    candList.sort((a, b) => b.votes - a.votes);

    const c1 = candList[0] || { number: '13', name: 'Lula', votes: 0, pct: '0.00' };
    const c2 = candList[1] || { number: '22', name: 'Flávio', votes: 0, pct: '0.00' };

    const totalSectionsCounted = parseNumber(data.s);
    const totalSections = parseNumber(data.e);
    const progressPct = parsePct(data.pst).toFixed(2);
    const validVotes = parseNumber(data.vv);
    const totalVotes = parseNumber(data.tv);
    const blankVotes = parseNumber(data.vb);
    const nullVotes = parseNumber(data.vn);
    const abstentionVotes = parseNumber(data.a);

    const voteDiff = Math.abs(c1.votes - c2.votes);
    const ppDiff = Math.abs(parseFloat(c1.pct) - parseFloat(c2.pct)).toFixed(2);

    return {
      source: 'TSE Oficial',
      timestamp: data.ht || new Date().toLocaleTimeString('pt-BR'),
      progressPct,
      sectionsCounted: totalSectionsCounted,
      totalSections,
      totalVotes,
      validVotes,
      blankVotes,
      nullVotes,
      abstentionVotes,
      cand1: {
        id: 1,
        number: c1.number,
        name: c1.name,
        party: c1.party,
        color: '#e52329',
        votes: c1.votes,
        pct: c1.pct,
        situation: c1.situation,
        isLeading: c1.votes >= c2.votes
      },
      cand2: {
        id: 2,
        number: c2.number,
        name: c2.name,
        party: c2.party,
        color: '#0066cc',
        votes: c2.votes,
        pct: c2.pct,
        situation: c2.situation,
        isLeading: c2.votes > c1.votes
      },
      voteDiff,
      ppDiff,
      leader: c1.votes >= c2.votes ? 1 : 2,
      isMathematicallyElected: c1.situation.toLowerCase().includes('eleito') || c2.situation.toLowerCase().includes('eleito')
    };
  }
};

window.TSEService = TSEService;
