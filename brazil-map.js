/**
 * brazil-map.js - Mapa interativo SVG dos 27 estados do Brasil
 * Projeção simplificada e otimizada para visualização de apuração eleitoral.
 */

const BrazilMap = {
  // Dados de cada UF com coordenadas de centroide aproximadas para posicionamento/labels
  statesData: {
    'AC': { name: 'Acre', region: 'Norte', eleitores: 588433 },
    'AL': { name: 'Alagoas', region: 'Nordeste', eleitores: 2325656 },
    'AP': { name: 'Amapá', region: 'Norte', eleitores: 550696 },
    'AM': { name: 'Amazonas', region: 'Norte', eleitores: 2647826 },
    'BA': { name: 'Bahia', region: 'Nordeste', eleitores: 11291528 },
    'CE': { name: 'Ceará', region: 'Nordeste', eleitores: 6820673 },
    'DF': { name: 'Distrito Federal', region: 'Centro-Oeste', eleitores: 2206126 },
    'ES': { name: 'Espírito Santo', region: 'Sudeste', eleitores: 2921506 },
    'GO': { name: 'Goiás', region: 'Centro-Oeste', eleitores: 4870354 },
    'MA': { name: 'Maranhão', region: 'Nordeste', eleitores: 5042999 },
    'MT': { name: 'Mato Grosso', region: 'Centro-Oeste', eleitores: 2469014 },
    'MS': { name: 'Mato Grosso do Sul', region: 'Centro-Oeste', eleitores: 1996510 },
    'MG': { name: 'Minas Gerais', region: 'Sudeste', eleitores: 16290870 },
    'PA': { name: 'Pará', region: 'Norte', eleitores: 6082312 },
    'PB': { name: 'Paraíba', region: 'Nordeste', eleitores: 3058869 },
    'PR': { name: 'Paraná', region: 'Sul', eleitores: 8475632 },
    'PE': { name: 'Pernambuco', region: 'Nordeste', eleitores: 7018098 },
    'PI': { name: 'Piauí', region: 'Nordeste', eleitores: 2573810 },
    'RJ': { name: 'Rio de Janeiro', region: 'Sudeste', eleitores: 12827296 },
    'RN': { name: 'Rio Grande do Norte', region: 'Nordeste', eleitores: 2554727 },
    'RS': { name: 'Rio Grande do Sul', region: 'Sul', eleitores: 8593469 },
    'RO': { name: 'Rondônia', region: 'Norte', eleitores: 1230987 },
    'RR': { name: 'Roraima', region: 'Norte', eleitores: 389863 },
    'SC': { name: 'Santa Catarina', region: 'Sul', eleitores: 5489658 },
    'SP': { name: 'São Paulo', region: 'Sudeste', eleitores: 34667793 },
    'SE': { name: 'Sergipe', region: 'Nordeste', eleitores: 1671801 },
    'TO': { name: 'Tocantins', region: 'Norte', eleitores: 1093051 }
  },

  // Paths poligonais em viewBox 0 0 600 600
  svgPaths: {
    'RR': 'M205,35 L245,45 L255,80 L235,115 L215,105 L195,65 Z',
    'AP': 'M345,65 L375,85 L365,120 L335,115 L335,85 Z',
    'AM': 'M85,115 L195,100 L230,125 L215,190 L175,225 L125,235 L75,195 L65,145 Z',
    'PA': 'M240,110 L330,85 L365,130 L380,185 L345,235 L285,245 L240,210 L230,140 Z',
    'AC': 'M40,195 L95,190 L105,225 L75,250 L40,225 Z',
    'RO': 'M125,235 L175,225 L195,265 L170,305 L130,285 Z',
    'MA': 'M375,135 L430,140 L445,185 L415,225 L375,210 L370,165 Z',
    'PI': 'M420,185 L455,185 L465,245 L435,275 L415,225 Z',
    'CE': 'M455,150 L495,155 L490,195 L460,195 L450,170 Z',
    'RN': 'M495,165 L535,175 L525,195 L490,195 Z',
    'PB': 'M490,195 L540,195 L535,215 L485,215 Z',
    'PE': 'M465,215 L535,215 L520,235 L455,235 Z',
    'AL': 'M505,235 L530,240 L520,255 L495,250 Z',
    'SE': 'M490,250 L515,255 L505,270 L485,265 Z',
    'TO': 'M345,215 L380,215 L385,305 L350,320 L335,255 Z',
    'BA': 'M385,240 L465,235 L495,270 L470,345 L415,360 L385,305 Z',
    'MT': 'M195,235 L285,245 L305,335 L260,375 L205,335 L190,265 Z',
    'GO': 'M305,325 L355,315 L365,395 L320,415 L295,365 Z',
    'DF': 'M335,348 L347,348 L347,358 L335,358 Z',
    'MS': 'M230,375 L285,370 L295,445 L245,465 L220,425 Z',
    'MG': 'M355,340 L430,345 L445,410 L385,445 L345,410 Z',
    'ES': 'M445,375 L470,385 L460,420 L440,410 Z',
    'RJ': 'M415,420 L455,420 L445,445 L405,440 Z',
    'SP': 'M315,415 L395,420 L385,475 L320,470 L305,435 Z',
    'PR': 'M295,465 L365,465 L355,510 L285,505 Z',
    'SC': 'M300,505 L360,510 L350,545 L295,535 Z',
    'RS': 'M275,525 L345,535 L335,590 L265,585 Z'
  },

  init(containerId, onStateHover, onStateClick) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let svgHtml = `
      <svg viewBox="0 0 580 610" xmlns="http://www.w3.org/2000/svg" id="brazil-map-svg">
        <defs>
          <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <g id="states-group">
    `;

    for (const [uf, path] of Object.entries(this.svgPaths)) {
      const stateMeta = this.statesData[uf] || { name: uf };
      svgHtml += `
        <path id="state-path-${uf}" 
              data-uf="${uf}" 
              data-name="${stateMeta.name}" 
              d="${path}" 
              fill="#263045"
              class="state-shape">
        </path>
      `;
    }

    // Add state UF labels
    for (const [uf] of Object.entries(this.svgPaths)) {
      const center = this.getApproxCenter(uf);
      svgHtml += `
        <text id="label-${uf}" x="${center.x}" y="${center.y}" 
              class="state-label" 
              text-anchor="middle" 
              dominant-baseline="central" 
              pointer-events="none"
              font-family="'JetBrains Mono', monospace" 
              font-size="9" 
              font-weight="700" 
              fill="rgba(255,255,255,0.7)">
          ${uf}
        </text>
      `;
    }

    svgHtml += `
        </g>
      </svg>
    `;

    container.innerHTML = svgHtml;

    // Attach interaction events
    const paths = container.querySelectorAll('.state-shape');
    paths.forEach(p => {
      p.addEventListener('mouseenter', (e) => {
        const uf = p.getAttribute('data-uf');
        if (onStateHover) onStateHover(uf, e);
      });

      p.addEventListener('mousemove', (e) => {
        const uf = p.getAttribute('data-uf');
        if (onStateHover) onStateHover(uf, e);
      });

      p.addEventListener('mouseleave', () => {
        if (onStateHover) onStateHover(null);
      });

      p.addEventListener('click', () => {
        const uf = p.getAttribute('data-uf');
        if (onStateClick) onStateClick(uf);
      });
    });
  },

  getApproxCenter(uf) {
    const centers = {
      'RR': { x: 225, y: 75 },
      'AP': { x: 355, y: 95 },
      'AM': { x: 155, y: 165 },
      'PA': { x: 300, y: 165 },
      'AC': { x: 72, y: 220 },
      'RO': { x: 160, y: 265 },
      'MA': { x: 405, y: 175 },
      'PI': { x: 440, y: 225 },
      'CE': { x: 475, y: 175 },
      'RN': { x: 515, y: 182 },
      'PB': { x: 512, y: 205 },
      'PE': { x: 495, y: 225 },
      'AL': { x: 515, y: 245 },
      'SE': { x: 500, y: 260 },
      'TO': { x: 360, y: 265 },
      'BA': { x: 435, y: 295 },
      'MT': { x: 245, y: 305 },
      'GO': { x: 330, y: 365 },
      'DF': { x: 350, y: 350 },
      'MS': { x: 260, y: 420 },
      'MG': { x: 395, y: 395 },
      'ES': { x: 455, y: 400 },
      'RJ': { x: 430, y: 435 },
      'SP': { x: 350, y: 445 },
      'PR': { x: 325, y: 485 },
      'SC': { x: 330, y: 525 },
      'RS': { x: 305, y: 560 }
    };
    return centers[uf] || { x: 300, y: 300 };
  },

  updateStateColor(uf, winnerColor, opacity = 1) {
    const el = document.getElementById(`state-path-${uf}`);
    if (el) {
      if (winnerColor) {
        el.setAttribute('fill', winnerColor);
        el.style.fillOpacity = opacity;
      } else {
        el.setAttribute('fill', '#263045');
        el.style.fillOpacity = 0.8;
      }
    }
  }
};

window.BrazilMap = BrazilMap;
