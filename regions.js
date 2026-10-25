/**
 * regions.js - Apuração por região e projeção do resultado final
 *
 * Projeção (por estado, depois somada por região):
 *   votos válidos restantes = (eleitores aptos - eleitores das seções apuradas)
 *                             × (votos válidos / eleitores das seções apuradas)
 *   cada candidato recebe os votos restantes na proporção que tem hoje no estado.
 * Assim o peso de cada região vem do tamanho do seu eleitorado, não só do que já foi apurado.
 */

(function () {
  const REGIONS = [
    { name: 'Norte', ufs: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'] },
    { name: 'Nordeste', ufs: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] },
    { name: 'Centro-Oeste', ufs: ['DF', 'GO', 'MS', 'MT'] },
    { name: 'Sudeste', ufs: ['ES', 'MG', 'RJ', 'SP'] },
    { name: 'Sul', ufs: ['PR', 'RS', 'SC'] }
  ];

  // Participação de Lula na rodada anterior, para indicar a direção da tendência
  let previousLulaShare = {};

  const fmtInt = (n) => Math.round(n).toLocaleString('pt-BR');
  const fmtPct = (n) => `${n.toFixed(2).replace('.', ',')}%`;

  function projectState(s) {
    const counted = s.lulaVotes + s.flavioVotes;
    const lulaShare = counted > 0 ? s.lulaVotes / counted : 0.5;
    const validRate = s.electorateCounted > 0 ? s.validVotes / s.electorateCounted : 0;
    const remainingValid = Math.max(0, s.electorate - s.electorateCounted) * validRate;
    return {
      lula: s.lulaVotes + remainingValid * lulaShare,
      flavio: s.flavioVotes + remainingValid * (1 - lulaShare)
    };
  }

  function aggregate(states, ufs) {
    const agg = {
      electorate: 0, electorateCounted: 0, sectionsCounted: 0, totalSections: 0,
      lulaVotes: 0, flavioVotes: 0, projLula: 0, projFlavio: 0
    };
    ufs.forEach(uf => {
      const s = states[uf];
      if (!s) return;
      const proj = projectState(s);
      agg.electorate += s.electorate;
      agg.electorateCounted += s.electorateCounted;
      agg.sectionsCounted += s.sectionsCounted;
      agg.totalSections += s.totalSections;
      agg.lulaVotes += s.lulaVotes;
      agg.flavioVotes += s.flavioVotes;
      agg.projLula += proj.lula;
      agg.projFlavio += proj.flavio;
    });
    const counted = agg.lulaVotes + agg.flavioVotes;
    const projected = agg.projLula + agg.projFlavio;
    agg.lulaPct = counted > 0 ? (agg.lulaVotes / counted) * 100 : 0;
    agg.flavioPct = counted > 0 ? 100 - agg.lulaPct : 0;
    agg.projLulaPct = projected > 0 ? (agg.projLula / projected) * 100 : 0;
    agg.projFlavioPct = projected > 0 ? 100 - agg.projLulaPct : 0;
    agg.sectionsPct = agg.totalSections > 0 ? (agg.sectionsCounted / agg.totalSections) * 100 : 0;
    return agg;
  }

  function trendCell(name, agg) {
    const prev = previousLulaShare[name];
    let arrow = '';
    if (typeof prev === 'number') {
      const delta = agg.lulaPct - prev;
      if (delta > 0.01) arrow = `<span class="trend-arrow lula" title="Lula subiu ${fmtPct(delta)} desde a última atualização">▲ Lula</span>`;
      else if (delta < -0.01) arrow = `<span class="trend-arrow flavio" title="Flávio subiu ${fmtPct(-delta)} desde a última atualização">▲ Flávio</span>`;
      else arrow = '<span class="trend-arrow">= estável</span>';
    }
    const lulaLeads = agg.projLulaPct >= agg.projFlavioPct;
    const margin = Math.abs(agg.projLulaPct - agg.projFlavioPct);
    const leader = lulaLeads
      ? `<span class="lead-tag lula">Lula +${margin.toFixed(1).replace('.', ',')}</span>`
      : `<span class="lead-tag flavio">Flávio +${margin.toFixed(1).replace('.', ',')}</span>`;
    return `${leader}${arrow}`;
  }

  function row(name, agg, totalElectorate, isTotal) {
    const share = totalElectorate > 0 ? (agg.electorate / totalElectorate) * 100 : 0;
    return `
      <tr class="${isTotal ? 'region-total' : ''}">
        <th scope="row">${name}</th>
        <td data-label="Eleitores aptos"><span>${fmtInt(agg.electorate)}</span><small>${fmtPct(share)} do eleitorado</small></td>
        <td data-label="Urnas apuradas">
          <div class="region-progress"><div style="width:${Math.min(100, agg.sectionsPct)}%"></div></div>
          <span>${fmtPct(agg.sectionsPct)}</span><small>${fmtInt(agg.sectionsCounted)} de ${fmtInt(agg.totalSections)} seções</small>
        </td>
        <td data-label="Lula" class="num lula">${fmtPct(agg.lulaPct)}</td>
        <td data-label="Flávio" class="num flavio">${fmtPct(agg.flavioPct)}</td>
        <td data-label="Projeção final" class="num"><span>${fmtPct(agg.projLulaPct)} × ${fmtPct(agg.projFlavioPct)}</span><small>${fmtInt(agg.projLula)} × ${fmtInt(agg.projFlavio)}</small></td>
        <td data-label="Tendência">${trendCell(name, agg)}</td>
      </tr>`;
  }

  function render(states) {
    const tbody = document.getElementById('regions-tbody');
    const verdict = document.getElementById('regions-verdict');
    if (!tbody || !verdict) return;

    const hasElectorate = Object.values(states).some(s => s.electorate > 0);
    if (!hasElectorate) return;

    const regionAggs = REGIONS.map(r => ({ name: r.name, agg: aggregate(states, r.ufs) }));
    const total = aggregate(states, REGIONS.flatMap(r => r.ufs));

    tbody.innerHTML = regionAggs.map(r => row(r.name, r.agg, total.electorate, false)).join('')
      + row('Brasil (27 UFs)', total, total.electorate, true);

    const lulaWins = total.projLula >= total.projFlavio;
    const winner = lulaWins ? 'Lula' : 'Flávio Bolsonaro';
    const margin = Math.abs(total.projLula - total.projFlavio);
    const marginPp = Math.abs(total.projLulaPct - total.projFlavioPct);
    const regionsLula = regionAggs.filter(r => r.agg.projLulaPct >= r.agg.projFlavioPct).map(r => r.name);
    const regionsFlavio = regionAggs.filter(r => r.agg.projLulaPct < r.agg.projFlavioPct).map(r => r.name);
    const confidence = total.sectionsPct < 30 || marginPp < 2
      ? 'baixa — ainda há muita urna por apurar ou a disputa está apertada'
      : total.sectionsPct < 70 || marginPp < 5 ? 'moderada' : 'alta';

    verdict.className = `regions-verdict ${lulaWins ? 'lula' : 'flavio'}`;
    verdict.innerHTML = `
      <span class="verdict-label">PROJEÇÃO DO RESULTADO FINAL</span>
      <strong class="verdict-winner">${winner} deve vencer</strong>
      <span class="verdict-detail">
        ${fmtPct(total.projLulaPct)} Lula × ${fmtPct(total.projFlavioPct)} Flávio
        • diferença estimada de ${fmtInt(margin)} votos (${marginPp.toFixed(2).replace('.', ',')} p.p.)
      </span>
      <span class="verdict-detail">
        Lula à frente em: ${regionsLula.join(', ') || '—'} • Flávio à frente em: ${regionsFlavio.join(', ') || '—'}
      </span>
      <span class="verdict-confidence">Confiança ${confidence}. Apurado até agora: ${fmtPct(total.sectionsPct)} das seções.</span>`;

    regionAggs.forEach(r => { previousLulaShare[r.name] = r.agg.lulaPct; });
    previousLulaShare['Brasil (27 UFs)'] = total.lulaPct;
  }

  window.RegionsPanel = { render };
})();
