const fs = require('fs');
const path = require('path');

const UFS = ['ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to'];

async function syncTSE() {
  console.log('🔄 Buscando dados oficiais do TSE (https://resultados.tse.jus.br/)...');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // 1. Totalização Nacional (Brasil)
  const brUrl = 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json';
  const brRes = await fetch(brUrl);
  if (!brRes.ok) throw new Error(`Falha ao buscar dados BR do TSE: ${brRes.status}`);
  const brJson = await brRes.json();
  fs.writeFileSync(path.join(dataDir, 'tse-br.json'), JSON.stringify(brJson, null, 2));

  let lula = {}, flavio = {};
  for (const agr of brJson.carg[0].agr) {
    for (const par of agr.par) {
      for (const cand of par.cand) {
        if (cand.n === '13') {
          lula = {
            name: cand.nm,
            ballotName: cand.nmu,
            party: par.sg,
            number: cand.n,
            votes: parseInt(cand.vap, 10),
            pct: parseFloat(cand.pvap.replace(',', '.')),
            status: cand.st,
            elected: cand.e === 's'
          };
        }
        if (cand.n === '22') {
          flavio = {
            name: cand.nm,
            ballotName: cand.nmu,
            party: par.sg,
            number: cand.n,
            votes: parseInt(cand.vap, 10),
            pct: parseFloat(cand.pvap.replace(',', '.')),
            status: cand.st,
            elected: cand.e === 's'
          };
        }
      }
    }
  }

  const nationalSummary = {
    source: 'Tribunal Superior Eleitoral (https://resultados.tse.jus.br/)',
    election: 'Eleição Ordinária Federal - 2026 2º Turno (Código 6258)',
    date: brJson.dg,
    time: brJson.hg,
    progressPct: parseFloat(brJson.s.pst.replace(',', '.')),
    sectionsCounted: parseInt(brJson.s.st, 10),
    totalSections: parseInt(brJson.s.ts, 10),
    totalVotes: parseInt(brJson.v.tv, 10),
    validVotes: parseInt(brJson.v.vv, 10),
    blankVotes: parseInt(brJson.v.vb, 10),
    nullVotes: parseInt(brJson.v.vn, 10),
    abstentionVotes: parseInt(brJson.e.a, 10),
    abstentionPct: parseFloat(brJson.e.pa.replace(',', '.')),
    lula,
    flavio
  };
  fs.writeFileSync(path.join(dataDir, 'tse-summary.json'), JSON.stringify(nationalSummary, null, 2));
  console.log(`✅ Brasil apurado: ${nationalSummary.progressPct}% | Lula: ${lula.pct}% (${lula.votes.toLocaleString('pt-BR')}) | Flávio: ${flavio.pct}% (${flavio.votes.toLocaleString('pt-BR')})`);

  // 2. Totalização dos 27 Estados
  const states = {};
  for (const uf of UFS) {
    const ufUrl = `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${uf}/${uf}-c0001-e006258-u.json`;
    try {
      const ufRes = await fetch(ufUrl);
      if (ufRes.ok) {
        const d = await ufRes.json();
        let sLula = 0, sFlavio = 0, sLulaVotes = 0, sFlavioVotes = 0;
        for (const agr of d.carg[0].agr) {
          for (const par of agr.par) {
            for (const cand of par.cand) {
              if (cand.n === '13') {
                sLula = parseFloat(cand.pvap.replace(',', '.'));
                sLulaVotes = parseInt(cand.vap, 10);
              }
              if (cand.n === '22') {
                sFlavio = parseFloat(cand.pvap.replace(',', '.'));
                sFlavioVotes = parseInt(cand.vap, 10);
              }
            }
          }
        }
        states[uf.toUpperCase()] = {
          lula: sLula,
          flavio: sFlavio,
          lulaVotes: sLulaVotes,
          flavioVotes: sFlavioVotes,
          sectionsCounted: parseInt(d.s?.st || 0, 10),
          totalSections: parseInt(d.s?.ts || 0, 10),
          progressPct: parseFloat((d.s?.pst || '0').replace(',', '.')),
          lastUpdate: d.hg || ''
        };
      }
    } catch (err) {
      console.warn(`Erro no estado ${uf}:`, err.message);
    }
  }

  fs.writeFileSync(path.join(dataDir, 'tse-states.json'), JSON.stringify(states, null, 2));
  console.log(`✅ 27 Estados sincronizados do TSE com sucesso!`);
}

syncTSE().catch(err => {
  console.error('❌ Erro no sync TSE:', err);
  process.exit(1);
});
