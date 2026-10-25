/**
 * app.js - Painel Limpo de Apuração Presidencial
 * Dados Oficiais do TSE (Tribunal Superior Eleitoral - https://resultados.tse.jus.br/)
 * Atualização garantida a cada 2 minutos com contagem regressiva visível.
 */

const CONFIG = {
  updateIntervalSeconds: 120, // 2 minutos (120s)
  tseApiUrl: 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json',
  localApiUrl: 'data/tse-summary.json',
  statesApiUrl: 'data/tse-states.json',
  serverlessUrl: '/api/tse',
  circumference: 741.42 // 2 * PI * 118
};

let remainingSeconds = CONFIG.updateIntervalSeconds;
let countdownTimerId = null;

// Estado Real TSE 2026 2º Turno (https://resultados.tse.jus.br/)
let electionState = {
  progressPct: 1.67,
  sectionsCounted: 8331,
  totalSections: 499248,
  totalVotes: 2138868,
  validVotes: 2076953,
  blankVotes: 21599,
  nullVotes: 40316,
  abstentionVotes: 752379,
  abstentionPct: '26.02',
  lula: {
    votes: 1082535,
    pct: 52.12
  },
  flavio: {
    votes: 994418,
    pct: 47.88
  },
  lastUpdate: '19:12:06'
};

// Formatação PT-BR (ex: 52.925.891)
function formatBR(num) {
  return Number(num || 0).toLocaleString('pt-BR');
}

// Atualizar interface gráfica
function updateUI(data) {
  // 1. Urnas Apuradas
  const urnasPctEl = document.getElementById('urnas-pct');
  const urnasBarEl = document.getElementById('urnas-bar');
  const urnasDetailEl = document.getElementById('urnas-detail');

  urnasPctEl.textContent = `${data.progressPct.toFixed(2).replace('.', ',')}%`;
  urnasBarEl.style.width = `${Math.min(100, data.progressPct)}%`;
  urnasDetailEl.textContent = `${formatBR(data.sectionsCounted)} de ${formatBR(data.totalSections)} seções`;

  // 2. Votos e Percentual de Lula
  const pctLulaEl = document.getElementById('pct-lula');
  const votesLulaEl = document.getElementById('votes-lula');
  const gaugeLula = document.getElementById('gauge-lula');

  pctLulaEl.textContent = `${data.lula.pct.toFixed(2).replace('.', ',')}%`;
  votesLulaEl.textContent = `${formatBR(data.lula.votes)} votos`;
  const offsetLula = CONFIG.circumference - (CONFIG.circumference * data.lula.pct / 100);
  if (gaugeLula) gaugeLula.style.strokeDashoffset = offsetLula;

  // 3. Votos e Percentual de Flávio
  const pctFlavioEl = document.getElementById('pct-flavio');
  const votesFlavioEl = document.getElementById('votes-flavio');
  const gaugeFlavio = document.getElementById('gauge-flavio');

  pctFlavioEl.textContent = `${data.flavio.pct.toFixed(2).replace('.', ',')}%`;
  votesFlavioEl.textContent = `${formatBR(data.flavio.votes)} votos`;
  const offsetFlavio = CONFIG.circumference - (CONFIG.circumference * data.flavio.pct / 100);
  if (gaugeFlavio) gaugeFlavio.style.strokeDashoffset = offsetFlavio;

  // 4. Diferença e Destaque de Liderança
  const diffVotes = Math.abs(data.lula.votes - data.flavio.votes);
  const diffPP = Math.abs(data.lula.pct - data.flavio.pct).toFixed(2);
  const leaderName = data.lula.votes >= data.flavio.votes ? 'Lula' : 'Flávio';

  document.getElementById('diff-votes').textContent = `${leaderName} +${formatBR(diffVotes)}`;
  document.getElementById('diff-pp').textContent = `${diffPP.replace('.', ',')} p.p.`;

  const cardLula = document.getElementById('card-lula');
  const cardFlavio = document.getElementById('card-flavio');
  const tagLula = document.getElementById('tag-lula');
  const tagFlavio = document.getElementById('tag-flavio');

  const lulaLeads = data.lula.votes >= data.flavio.votes;
  cardLula.classList.toggle('leading', lulaLeads);
  cardFlavio.classList.toggle('leading', !lulaLeads);

  // Selo de eleito se apuração avançada (>98% ou definição matemática)
  if (data.progressPct >= 98.5) {
    if (lulaLeads) {
      tagLula.classList.remove('hidden');
      tagFlavio.classList.add('hidden');
    } else {
      tagFlavio.classList.remove('hidden');
      tagLula.classList.add('hidden');
    }
  } else {
    tagLula.classList.add('hidden');
    tagFlavio.classList.add('hidden');
  }

  // 4.5. Ao concluir a apuração (100%), disparar animações correspondentes
  if (data.progressPct >= 100) {
    const winner = lulaLeads ? 'lula' : 'flavio';
    if (!outcomeAlreadyShown) {
      triggerOutcome(winner);
    }
  }

  // 5. Barra horizontal comparativa
  const ratioLulaEl = document.getElementById('ratio-lula');
  const ratioFlavioEl = document.getElementById('ratio-flavio');
  const totalBoth = (data.lula.votes + data.flavio.votes) || 1;
  const shareLula = (data.lula.votes / totalBoth) * 100;
  const shareFlavio = (data.flavio.votes / totalBoth) * 100;

  ratioLulaEl.style.width = `${shareLula}%`;
  ratioFlavioEl.style.width = `${shareFlavio}%`;

  // 6. Rodapé estatístico
  document.getElementById('stat-valid').textContent = formatBR(data.validVotes);
  document.getElementById('stat-total').textContent = formatBR(data.totalVotes);
  
  const blankPct = ((data.blankVotes / data.totalVotes) * 100).toFixed(2);
  document.getElementById('stat-blank').textContent = `${formatBR(data.blankVotes)} (${blankPct.replace('.', ',')}%)`;

  const nullPct = ((data.nullVotes / data.totalVotes) * 100).toFixed(2);
  document.getElementById('stat-null').textContent = `${formatBR(data.nullVotes)} (${nullPct.replace('.', ',')}%)`;

  document.getElementById('stat-abstention').textContent = `${formatBR(data.abstentionVotes)} (${data.abstentionPct.replace('.', ',')}%)`;
  document.getElementById('stat-timestamp').textContent = data.lastUpdate;
}

// Buscar dados oficiais do TSE (https://resultados.tse.jus.br/)
async function fetchElectionData() {
  // Ordem: proxy serverless (Vercel) → TSE direto (CORS liberado) → snapshot local como último recurso
  const endpoints = [
    CONFIG.serverlessUrl,
    CONFIG.tseApiUrl,
    CONFIG.localApiUrl
  ];

  let loadedData = null;

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const json = await response.json();
        // Se for o formato de resumo direto
        if (json && json.lula && json.flavio && json.totalSections) {
          electionState = {
            progressPct: json.progressPct,
            sectionsCounted: json.sectionsCounted,
            totalSections: json.totalSections,
            totalVotes: json.totalVotes,
            validVotes: json.validVotes,
            blankVotes: json.blankVotes,
            nullVotes: json.nullVotes,
            abstentionVotes: json.abstentionVotes,
            abstentionPct: String(json.abstentionPct).replace('.', ','),
            lula: {
              votes: json.lula.votes,
              pct: json.lula.pct
            },
            flavio: {
              votes: json.flavio.votes,
              pct: json.flavio.pct
            },
            lastUpdate: json.time || new Date().toLocaleTimeString('pt-BR')
          };
          loadedData = electionState;
          break;
        }

        // Se for o formato bruto oficial do TSE (br-c0001-e006258-u.json)
        if (json && json.carg && json.carg[0] && json.carg[0].agr) {
          let lulaVotes = 0, lulaPct = 0;
          let flavioVotes = 0, flavioPct = 0;

          for (const agr of json.carg[0].agr) {
            for (const par of agr.par) {
              for (const cand of par.cand) {
                if (cand.n === '13') {
                  lulaVotes = parseInt(cand.vap, 10);
                  lulaPct = parseFloat(cand.pvap.replace(',', '.'));
                }
                if (cand.n === '22') {
                  flavioVotes = parseInt(cand.vap, 10);
                  flavioPct = parseFloat(cand.pvap.replace(',', '.'));
                }
              }
            }
          }

          const parseNum = (v) => parseInt(String(v || '0').replace(/\./g, ''), 10) || 0;
          const parsePct = (v) => parseFloat(String(v || '0').replace(',', '.')) || 0;

          electionState = {
            progressPct: parsePct(json.s?.pst),
            sectionsCounted: parseNum(json.s?.st),
            totalSections: parseNum(json.s?.ts) || 499248,
            totalVotes: parseNum(json.v?.tv),
            validVotes: parseNum(json.v?.vv),
            blankVotes: parseNum(json.v?.vb),
            nullVotes: parseNum(json.v?.vn),
            abstentionVotes: parseNum(json.e?.a),
            abstentionPct: String(json.e?.pa || '26,02').replace('.', ','),
            lula: {
              votes: lulaVotes,
              pct: lulaPct
            },
            flavio: {
              votes: flavioVotes,
              pct: flavioPct
            },
            lastUpdate: json.hg || new Date().toLocaleTimeString('pt-BR')
          };
          loadedData = electionState;
          break;
        }
      }
    } catch (e) {
      // Tenta próximo endpoint
    }
  }

  if (loadedData) {
    updateUI(electionState);
  }
  if (typeof window.syncMapWithTse === 'function') window.syncMapWithTse();
}

// Buscar totalização dos 27 estados direto no TSE (em paralelo)
const UFS = ['ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to'];

async function fetchStatesLive() {
  const results = await Promise.all(UFS.map(async (uf) => {
    try {
      const res = await fetch(`${CONFIG.serverlessUrl}?uf=${uf}`, { cache: 'no-store' });
      const json = res.ok ? await res.json() : null;
      if (json && json.carg) return [uf, json];
    } catch (e) {}
    try {
      const url = CONFIG.tseApiUrl.replace(/br\/br-/, `${uf}/${uf}-`);
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return [uf, await res.json()];
    } catch (e) {}
    return [uf, null];
  }));

  const states = {};
  for (const [uf, d] of results) {
    if (!d || !d.carg) continue;
    const entry = { lula: 0, flavio: 0, lulaVotes: 0, flavioVotes: 0 };
    for (const agr of d.carg[0].agr) {
      for (const par of agr.par) {
        for (const cand of par.cand) {
          if (cand.n === '13') {
            entry.lula = parseFloat(cand.pvap.replace(',', '.'));
            entry.lulaVotes = parseInt(cand.vap, 10);
          }
          if (cand.n === '22') {
            entry.flavio = parseFloat(cand.pvap.replace(',', '.'));
            entry.flavioVotes = parseInt(cand.vap, 10);
          }
        }
      }
    }
    states[uf.toUpperCase()] = entry;
  }
  return states;
}

// Gerenciador do Contador Regressivo (2 minutos)
function startCountdown() {
  if (countdownTimerId) clearInterval(countdownTimerId);

  const countdownEl = document.getElementById('countdown-timer');

  const updateDisplay = () => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    countdownEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  updateDisplay();

  countdownTimerId = setInterval(() => {
    remainingSeconds--;

    if (remainingSeconds <= 0) {
      remainingSeconds = CONFIG.updateIntervalSeconds;
      fetchElectionData();
    }

    updateDisplay();
  }, 1000);
}

// ========================================================
// OUTCOME ANIMATIONS, SOUND & PARTICLES (LULA / FLÁVIO)
// ========================================================
let soundEnabled = true;
let audioCtx = null;
let currentAnimationId = null;
let outcomeAlreadyShown = false;
let lastWinner = null;

// Audio Synthesizer (Zero dependencies, pure Web Audio)
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Lula Victory Celebration Sound (Upbeat triumphant fanfare)
function playCelebrationFanfare() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [
      { f: 261.63, t: 0.0, d: 0.18 }, // C4
      { f: 329.63, t: 0.16, d: 0.18 }, // E4
      { f: 392.00, t: 0.32, d: 0.18 }, // G4
      { f: 523.25, t: 0.48, d: 0.45 }, // C5
      { f: 392.00, t: 0.88, d: 0.16 }, // G4
      { f: 523.25, t: 1.04, d: 0.75 }  // C5 long
    ];
    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.18, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d);
    });
  } catch (err) {
    console.warn('Audio error:', err);
  }
}

// Flávio Victory Sinister Sound (Ominous dark minor dissonance & lightning rumble)
function playSinisterSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [65.41, 98.00, 116.54, 138.59]; // Low minor cluster
    freqs.forEach(f => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.85, now + 2.0);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.5);
    });
  } catch (err) {
    console.warn('Audio error:', err);
  }
}

// Particle Canvas Animation
function startCanvasEffect(mode) {
  const canvas = document.getElementById('outcome-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (currentAnimationId) {
    cancelAnimationFrame(currentAnimationId);
  }

  if (mode === 'lula') {
    // Confetti particles
    const colors = ['#e52329', '#f59e0b', '#10b981', '#3b82f6', '#fbbf24', '#ffffff'];
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 6,
      h: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3.5 + 2.5,
      vx: (Math.random() - 0.5) * 2.5,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 6
    }));

    function renderConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vrot;

        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      currentAnimationId = requestAnimationFrame(renderConfetti);
    }
    renderConfetti();

  } else if (mode === 'flavio') {
    // Gloomy rain streaks
    const raindrops = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      len: Math.random() * 25 + 15,
      speed: Math.random() * 14 + 10
    }));

    function renderRain() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      raindrops.forEach(r => {
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - 2, r.y + r.len);
        r.y += r.speed;
        r.x -= 1;
        if (r.y > canvas.height) {
          r.y = -20;
          r.x = Math.random() * canvas.width;
        }
      });
      ctx.stroke();
      currentAnimationId = requestAnimationFrame(renderRain);
    }
    renderRain();
  }
}

// Disparar a Animação Final de Vitória
function triggerOutcome(winner) {
  lastWinner = winner;
  outcomeAlreadyShown = true;

  const modal = document.getElementById('outcome-modal');
  const stageLula = document.getElementById('stage-lula-winner');
  const stageFlavio = document.getElementById('stage-flavio-winner');
  const mourningBanner = document.getElementById('mourning-banner');
  const reopenBtn = document.getElementById('btn-reopen-outcome');
  const reopenText = document.getElementById('reopen-text');

  modal.classList.remove('hidden');
  if (reopenBtn) reopenBtn.classList.add('hidden');

  if (winner === 'lula') {
    // Remove escala de cinza
    document.body.classList.remove('mourning-mode');
    if (mourningBanner) mourningBanner.classList.add('hidden');

    stageLula.classList.remove('hidden');
    stageFlavio.classList.add('hidden');
    startCanvasEffect('lula');
    playCelebrationFanfare();
    if (reopenText) reopenText.textContent = '🎉 Lula Vencedor';
  } else {
    // Aplica escala de cinza total no site
    document.body.classList.add('mourning-mode');
    if (mourningBanner) mourningBanner.classList.remove('hidden');

    stageFlavio.classList.remove('hidden');
    stageLula.classList.add('hidden');
    startCanvasEffect('flavio');
    playSinisterSound();
    if (reopenText) reopenText.textContent = '⚡ Risada Diabólica de Flávio';
  }
}

// Fechar Modal
function closeOutcomeModal() {
  const modal = document.getElementById('outcome-modal');
  modal.classList.add('hidden');
  if (currentAnimationId) {
    cancelAnimationFrame(currentAnimationId);
  }

  const reopenBtn = document.getElementById('btn-reopen-outcome');
  if (reopenBtn && lastWinner) {
    reopenBtn.classList.remove('hidden');
  }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // Render inicial imediato
  updateUI(electionState);

  // Iniciar contagem regressiva de 2 minutos
  startCountdown();

  // Botão de atualização imediata manual
  document.getElementById('btn-refresh-now').addEventListener('click', () => {
    remainingSeconds = CONFIG.updateIntervalSeconds;
    fetchElectionData();
  });

  // Modal Close & Reopen listeners
  document.getElementById('btn-close-outcome').addEventListener('click', closeOutcomeModal);
  document.getElementById('outcome-backdrop').addEventListener('click', closeOutcomeModal);
  document.getElementById('btn-reopen-outcome').addEventListener('click', () => {
    if (lastWinner) triggerOutcome(lastWinner);
  });

  // Reabrir risada diabólica pelo banner de luto
  const btnReopenDiabolic = document.getElementById('btn-reopen-diabolic');
  if (btnReopenDiabolic) {
    btnReopenDiabolic.addEventListener('click', () => triggerOutcome('flavio'));
  }

  // Restaurar cores a partir do banner de luto
  const btnClearMourning = document.getElementById('btn-clear-mourning');
  if (btnClearMourning) {
    btnClearMourning.addEventListener('click', () => {
      document.body.classList.remove('mourning-mode');
      const mourningBanner = document.getElementById('mourning-banner');
      if (mourningBanner) mourningBanner.classList.add('hidden');
    });
  }

  // Toggle de Som
  document.getElementById('btn-toggle-sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const soundIcon = document.getElementById('sound-icon');
    const soundStatus = document.getElementById('sound-status');
    if (soundEnabled) {
      soundIcon.textContent = '🔊';
      soundStatus.textContent = 'Som Ligado';
    } else {
      soundIcon.textContent = '🔇';
      soundStatus.textContent = 'Mudo';
    }
  });

  // Botões de Simulação Rápida (100% Lula, 100% Flávio, Reset)
  document.getElementById('btn-test-lula').addEventListener('click', () => {
    electionState.progressPct = 100;
    electionState.sectionsCounted = electionState.totalSections;
    electionState.lula.pct = 50.90;
    electionState.lula.votes = 60345999;
    electionState.flavio.pct = 49.10;
    electionState.flavio.votes = 58210340;
    electionState.validVotes = electionState.lula.votes + electionState.flavio.votes;
    electionState.lastUpdate = new Date().toLocaleTimeString('pt-BR');
    updateUI(electionState);
    triggerOutcome('lula');
  });

  document.getElementById('btn-test-flavio').addEventListener('click', () => {
    electionState.progressPct = 100;
    electionState.sectionsCounted = electionState.totalSections;
    electionState.flavio.pct = 51.20;
    electionState.flavio.votes = 60720450;
    electionState.lula.pct = 48.80;
    electionState.lula.votes = 57876120;
    electionState.validVotes = electionState.lula.votes + electionState.flavio.votes;
    electionState.lastUpdate = new Date().toLocaleTimeString('pt-BR');
    updateUI(electionState);
    triggerOutcome('flavio');
  });

  document.getElementById('btn-reset-sim').addEventListener('click', () => {
    closeOutcomeModal();
    document.body.classList.remove('mourning-mode');
    const mourningBanner = document.getElementById('mourning-banner');
    if (mourningBanner) mourningBanner.classList.add('hidden');
    const reopenBtn = document.getElementById('btn-reopen-outcome');
    if (reopenBtn) reopenBtn.classList.add('hidden');

    outcomeAlreadyShown = false;
    lastWinner = null;

    electionState = {
      progressPct: 1.67,
      sectionsCounted: 8331,
      totalSections: 499248,
      totalVotes: 2138868,
      validVotes: 2076953,
      blankVotes: 21599,
      nullVotes: 40316,
      abstentionVotes: 752379,
      abstentionPct: '26.02',
      lula: {
        votes: 1082535,
        pct: 52.12
      },
      flavio: {
        votes: 994418,
        pct: 47.88
      },
      lastUpdate: '19:12:06'
    };
    updateUI(electionState);
    renderMapData(BASE_STATE_VOTES);
  });

  // ========================================================
  // MAPA DO BRASIL INTERATIVO (DADOS REAIS TSE 2026)
  // ========================================================
  const STATE_NAMES = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
    'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
    'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
    'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
    'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
    'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
    'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
  };

  // Dados Reais Oficiais do TSE (https://resultados.tse.jus.br/)
  const BASE_STATE_VOTES = {
    'AC': { lula: 38.91, flavio: 61.09, lulaVotes: 6671, flavioVotes: 10475 },
    'AL': { lula: 61.70, flavio: 38.30, lulaVotes: 7171, flavioVotes: 4451 },
    'AP': { lula: 70.70, flavio: 29.30, lulaVotes: 4797, flavioVotes: 1988 },
    'AM': { lula: 50.62, flavio: 49.38, lulaVotes: 20307, flavioVotes: 19809 },
    'BA': { lula: 71.52, flavio: 28.48, lulaVotes: 18965, flavioVotes: 7552 },
    'CE': { lula: 65.92, flavio: 34.08, lulaVotes: 5017, flavioVotes: 2594 },
    'DF': { lula: 45.11, flavio: 54.89, lulaVotes: 89778, flavioVotes: 109255 },
    'ES': { lula: 46.82, flavio: 53.18, lulaVotes: 1422, flavioVotes: 1615 },
    'GO': { lula: 45.66, flavio: 54.34, lulaVotes: 2410, flavioVotes: 2868 },
    'MA': { lula: 70.26, flavio: 29.74, lulaVotes: 38628, flavioVotes: 16349 },
    'MT': { lula: 43.88, flavio: 56.12, lulaVotes: 24268, flavioVotes: 31043 },
    'MS': { lula: 52.33, flavio: 47.67, lulaVotes: 3469, flavioVotes: 3160 },
    'MG': { lula: 49.63, flavio: 50.37, lulaVotes: 61653, flavioVotes: 62575 },
    'PA': { lula: 56.93, flavio: 43.07, lulaVotes: 188036, flavioVotes: 142271 },
    'PB': { lula: 73.55, flavio: 26.45, lulaVotes: 108808, flavioVotes: 39131 },
    'PR': { lula: 39.08, flavio: 60.92, lulaVotes: 139223, flavioVotes: 217057 },
    'PE': { lula: 72.64, flavio: 27.36, lulaVotes: 27154, flavioVotes: 10228 },
    'PI': { lula: 75.83, flavio: 24.17, lulaVotes: 4212, flavioVotes: 1342 },
    'RJ': { lula: 43.12, flavio: 56.88, lulaVotes: 326, flavioVotes: 430 },
    'RN': { lula: 64.91, flavio: 35.09, lulaVotes: 5122, flavioVotes: 2769 },
    'RS': { lula: 45.72, flavio: 54.28, lulaVotes: 5237, flavioVotes: 6218 },
    'RO': { lula: 33.15, flavio: 66.85, lulaVotes: 1205, flavioVotes: 2430 },
    'RR': { lula: 26.40, flavio: 73.60, lulaVotes: 945, flavioVotes: 2635 },
    'SC': { lula: 31.84, flavio: 68.16, lulaVotes: 1342, flavioVotes: 2873 },
    'SP': { lula: 43.23, flavio: 56.77, lulaVotes: 1854, flavioVotes: 2435 },
    'SE': { lula: 68.27, flavio: 31.73, lulaVotes: 2419, flavioVotes: 1124 },
    'TO': { lula: 53.04, flavio: 46.96, lulaVotes: 8710, flavioVotes: 7713 }
  };

  let currentStateVotes = { ...BASE_STATE_VOTES };

  const mapTooltip = document.getElementById('dashboard-map-tooltip');
  const mapTtName = document.getElementById('map-tt-name');
  const mapTtUf = document.getElementById('map-tt-uf');
  const mapTtLula = document.getElementById('map-tt-lula');
  const mapTtFlavio = document.getElementById('map-tt-flavio');
  const mapTtLeader = document.getElementById('map-tt-leader');
  const mapCountLula = document.getElementById('map-count-lula');
  const mapCountFlavio = document.getElementById('map-count-flavio');

  function renderMapData(stateData) {
    let lulaWins = 0;
    let flavioWins = 0;

    Object.keys(stateData).forEach(uf => {
      const stateEl = document.getElementById(uf);
      if (!stateEl) return;

      const data = stateData[uf];
      const lulaLeads = data.lula >= data.flavio;

      stateEl.classList.remove('state-lula', 'state-flavio');
      if (lulaLeads) {
        stateEl.classList.add('state-lula');
        lulaWins++;
      } else {
        stateEl.classList.add('state-flavio');
        flavioWins++;
      }

      // Remover listeners antigos clonando o nó
      const newEl = stateEl.cloneNode(true);
      stateEl.parentNode.replaceChild(newEl, stateEl);

      newEl.addEventListener('mousemove', (e) => {
        if (!mapTooltip) return;

        mapTtName.textContent = STATE_NAMES[uf] || uf;
        mapTtUf.textContent = uf;
        mapTtLula.textContent = `${data.lula.toFixed(2).replace('.', ',')}% (${formatBR(data.lulaVotes || 0)} votos)`;
        mapTtFlavio.textContent = `${data.flavio.toFixed(2).replace('.', ',')}% (${formatBR(data.flavioVotes || 0)} votos)`;

        if (lulaLeads) {
          const diff = (data.lula - data.flavio).toFixed(2).replace('.', ',');
          mapTtLeader.textContent = `🔴 Lula lidera (+${diff} p.p.)`;
          mapTtLeader.style.color = '#f87171';
        } else {
          const diff = (data.flavio - data.lula).toFixed(2).replace('.', ',');
          mapTtLeader.textContent = `🔵 Flávio lidera (+${diff} p.p.)`;
          mapTtLeader.style.color = '#60a5fa';
        }

        mapTooltip.style.left = `${e.clientX}px`;
        mapTooltip.style.top = `${e.clientY - 12}px`;
        mapTooltip.classList.remove('hidden');
      });

      newEl.addEventListener('mouseleave', () => {
        if (mapTooltip) mapTooltip.classList.add('hidden');
      });
    });

    if (mapCountLula) mapCountLula.textContent = lulaWins;
    if (mapCountFlavio) mapCountFlavio.textContent = flavioWins;
  }

  async function syncMapWithTse() {
    try {
      const live = await fetchStatesLive();
      if (Object.keys(live).length >= 20) {
        currentStateVotes = live;
        renderMapData(currentStateVotes);
        return;
      }
    } catch(e) {}
    try {
      const res = await fetch(CONFIG.statesApiUrl, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && Object.keys(json).length >= 20) {
          currentStateVotes = json;
          renderMapData(currentStateVotes);
          return;
        }
      }
    } catch(e) {}
    renderMapData(BASE_STATE_VOTES);
  }

  window.syncMapWithTse = syncMapWithTse;
  renderMapData(BASE_STATE_VOTES);

  // Primeira checagem de rede (também sincroniza o mapa)
  fetchElectionData();
});
