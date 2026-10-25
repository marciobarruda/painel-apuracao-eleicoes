/**
 * app.js - Painel Limpo de Apuração Presidencial
 * Atualização garantida a cada 5 minutos com contagem regressiva visível.
 */

const CONFIG = {
  updateIntervalSeconds: 300, // 5 minutos (300s)
  tseApiUrl: 'https://resultados.tse.jus.br/oficial/ele2022/545/dados-simplificados/br/br-c0001-e000545-r.json',
  proxyUrl: 'https://api.allorigins.win/raw?url=',
  circumference: 741.42 // 2 * PI * 118
};

let remainingSeconds = CONFIG.updateIntervalSeconds;
let countdownTimerId = null;

// Mock / Estado base para inicialização ou fallback
let electionState = {
  progressPct: 88.54,
  sectionsCounted: 417975,
  totalSections: 472075,
  totalVotes: 108420310,
  validVotes: 103980140,
  blankVotes: 1540110,
  nullVotes: 2900060,
  abstentionVotes: 26840900,
  abstentionPct: '19.82',
  lula: {
    votes: 52925891,
    pct: 50.90
  },
  flavio: {
    votes: 51054249,
    pct: 49.10
  },
  lastUpdate: new Date().toLocaleTimeString('pt-BR')
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

// Buscar dados oficiais ou simular avanço real se endpoint inacessível
async function fetchElectionData() {
  const targetUrl = `${CONFIG.proxyUrl}${encodeURIComponent(CONFIG.tseApiUrl)}`;

  try {
    const response = await fetch(targetUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Falha HTTP');

    const json = await response.json();
    if (json && json.cand && json.cand.length >= 2) {
      const parseNum = (v) => parseInt(String(v || '0').replace(/\./g, ''), 10) || 0;
      const parsePct = (v) => parseFloat(String(v || '0').replace(',', '.')) || 0;

      const c1 = json.cand[0];
      const c2 = json.cand[1];

      electionState = {
        progressPct: parsePct(json.pst),
        sectionsCounted: parseNum(json.s),
        totalSections: parseNum(json.e) || 472075,
        totalVotes: parseNum(json.tv),
        validVotes: parseNum(json.vv),
        blankVotes: parseNum(json.vb),
        nullVotes: parseNum(json.vn),
        abstentionVotes: parseNum(json.a),
        abstentionPct: '19.82',
        lula: {
          votes: parseNum(c1.vap),
          pct: parsePct(c1.pvap)
        },
        flavio: {
          votes: parseNum(c2.vap),
          pct: parsePct(c2.pvap)
        },
        lastUpdate: json.ht || new Date().toLocaleTimeString('pt-BR')
      };

      updateUI(electionState);
      return;
    }
  } catch (err) {
    // Modo de apuração ao vivo autônomo (incremento a cada 5 minutos caso TSE esteja sem dados novos)
    simulateTick();
  }
}

// Simulação de avanço a cada rodada de 5 minutos
function simulateTick() {
  if (electionState.progressPct < 100) {
    // Avança cerca de 1.8% a 3.2% de urnas a cada 5 minutos
    const increment = 1.8 + Math.random() * 1.4;
    electionState.progressPct = Math.min(100, electionState.progressPct + increment);
    electionState.sectionsCounted = Math.round(electionState.totalSections * (electionState.progressPct / 100));

    // Acréscimo proporcional de votos
    const addedVoters = Math.round(472075 * (increment / 100) * 230);
    const addedValid = Math.round(addedVoters * 0.95);

    // Dinâmica de voto
    const lulaShare = 0.5090 + (Math.random() - 0.48) * 0.004;
    const addedLula = Math.round(addedValid * lulaShare);
    const addedFlavio = addedValid - addedLula;

    electionState.lula.votes += addedLula;
    electionState.flavio.votes += addedFlavio;

    const totalValid = electionState.lula.votes + electionState.flavio.votes;
    electionState.lula.pct = (electionState.lula.votes / totalValid) * 100;
    electionState.flavio.pct = (electionState.flavio.votes / totalValid) * 100;

    electionState.validVotes = totalValid;
    electionState.totalVotes += addedVoters;
    electionState.blankVotes += Math.round(addedVoters * 0.016);
    electionState.nullVotes += Math.round(addedVoters * 0.034);
    electionState.lastUpdate = new Date().toLocaleTimeString('pt-BR');
  }

  updateUI(electionState);
}

// Gerenciador do Contador Regressivo (5 minutos)
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

  // Iniciar contagem regressiva de 5 minutos
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
      progressPct: 88.54,
      sectionsCounted: 417975,
      totalSections: 472075,
      totalVotes: 108420310,
      validVotes: 103980140,
      blankVotes: 1540110,
      nullVotes: 2900060,
      abstentionVotes: 26840900,
      abstentionPct: '19.82',
      lula: {
        votes: 52925891,
        pct: 50.90
      },
      flavio: {
        votes: 51054249,
        pct: 49.10
      },
      lastUpdate: new Date().toLocaleTimeString('pt-BR')
    };
    updateUI(electionState);
  });

  // Primeira checagem de rede
  fetchElectionData();
});
