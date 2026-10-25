/**
 * map-progress.js - Indicação do percentual apurado por estado no mapa SVG
 * Compartilhado entre index.html e mapa.html.
 */

(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Estados pequenos demais para o rótulo caber dentro: posição do rótulo no oceano (coords do viewBox)
  const CALLOUTS = {
    RN: [352, 93],
    PB: [352, 104],
    PE: [352, 115],
    AL: [352, 126],
    SE: [352, 137],
    ES: [318, 232]
  };

  // Ajustes finos para rótulos que colidiriam com vizinhos
  const NUDGES = {
    GO: [-6, 10],
    DF: [0, -1],
    RJ: [2, 2]
  };

  function formatProgress(pct) {
    if (pct >= 100) return '100%';
    // Arredonda para baixo para nunca mostrar 100% antes da hora
    return `${Math.floor(pct)}%`;
  }

  function isComplete(data) {
    return typeof data.progressPct === 'number' && data.progressPct >= 100;
  }

  // Aplica a classe de cor considerando liderança e apuração concluída
  function applyStateClass(el, data) {
    const lulaLeads = data.lula >= data.flavio;
    const done = isComplete(data);
    el.classList.remove('state-lula', 'state-flavio', 'state-lula-done', 'state-flavio-done');
    if (lulaLeads) {
      el.classList.add(done ? 'state-lula-done' : 'state-lula');
    } else {
      el.classList.add(done ? 'state-flavio-done' : 'state-flavio');
    }
    return lulaLeads;
  }

  function renderLabels(svg, stateData) {
    if (!svg) return;

    let layer = svg.querySelector('.state-progress-layer');
    if (!layer) {
      layer = document.createElementNS(SVG_NS, 'g');
      layer.setAttribute('class', 'state-progress-layer');
      layer.setAttribute('pointer-events', 'none');
      svg.appendChild(layer);
    }
    layer.textContent = '';

    Object.keys(stateData).forEach(uf => {
      const data = stateData[uf];
      if (typeof data.progressPct !== 'number') return;

      const stateEl = svg.querySelector(`#${uf}`);
      if (!stateEl) return;

      const box = stateEl.getBBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const callout = CALLOUTS[uf];
      const nudge = NUDGES[uf] || [0, 0];
      const x = callout ? callout[0] : cx + nudge[0];
      const y = callout ? callout[1] : cy + nudge[1];

      if (callout) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', cx);
        line.setAttribute('y1', cy);
        line.setAttribute('x2', x - 1.5);
        line.setAttribute('y2', y);
        line.setAttribute('class', 'state-progress-leader');
        layer.appendChild(line);
      }

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y);
      text.setAttribute('text-anchor', callout ? 'start' : 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('class', `state-progress-label${isComplete(data) ? ' done' : ''}${uf === 'DF' ? ' tiny' : ''}`);
      text.textContent = formatProgress(data.progressPct);
      layer.appendChild(text);
    });
  }

  function describeProgress(data) {
    if (typeof data.progressPct !== 'number') return 'Apurado: —';
    const pct = data.progressPct.toFixed(2).replace('.', ',');
    if (isComplete(data)) return '✅ Apuração concluída (100%)';
    const sections = data.totalSections
      ? ` • ${Number(data.sectionsCounted || 0).toLocaleString('pt-BR')}/${Number(data.totalSections).toLocaleString('pt-BR')} seções`
      : '';
    return `Apurado: ${pct}%${sections}`;
  }

  window.MapProgress = { applyStateClass, renderLabels, describeProgress, isComplete };
})();
