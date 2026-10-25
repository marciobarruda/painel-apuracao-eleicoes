/**
 * simulator.js - Motor de Simulação em Tempo Real da Apuração Presidencial
 * Simula a curva real de apuração das eleições no Brasil por estado e região.
 */

class ElectionSimulator {
  constructor(candidates, options = {}) {
    this.candidates = candidates; // [cand1, cand2]
    this.scenario = options.scenario || 'virada';
    this.progress = 0; // 0 a 100 (%)
    this.totalSections = 472075;
    this.totalElectorate = 156454011;
    this.expectedTurnoutRate = 0.795; // ~79.5% comparecimento
    this.blankRate = 0.0175; // 1.75%
    this.nullRate = 0.0385; // 3.85%

    // Pesos regionais e viés histórico por UF para cada cenário
    this.stateWeights = this.buildStateProfiles();
  }

  buildStateProfiles() {
    // Votos nominais base aproximados por UF
    const base = {
      // Norte
      'AC': { share: 0.0035, speed: 0.95, biasLula: 0.29 },
      'AP': { share: 0.0036, speed: 0.98, biasLula: 0.46 },
      'AM': { share: 0.0170, speed: 0.85, biasLula: 0.51 },
      'PA': { share: 0.0390, speed: 0.88, biasLula: 0.52 },
      'RO': { share: 0.0080, speed: 0.95, biasLula: 0.29 },
      'RR': { share: 0.0026, speed: 0.99, biasLula: 0.24 },
      'TO': { share: 0.0071, speed: 0.92, biasLula: 0.51 },

      // Nordeste (Alta votação Lula)
      'AL': { share: 0.0152, speed: 0.82, biasLula: 0.59 },
      'BA': { share: 0.0735, speed: 0.78, biasLula: 0.72 },
      'CE': { share: 0.0440, speed: 0.80, biasLula: 0.70 },
      'MA': { share: 0.0325, speed: 0.75, biasLula: 0.71 },
      'PB': { share: 0.0198, speed: 0.84, biasLula: 0.66 },
      'PE': { share: 0.0455, speed: 0.80, biasLula: 0.67 },
      'PI': { share: 0.0168, speed: 0.81, biasLula: 0.76 },
      'RN': { share: 0.0165, speed: 0.85, biasLula: 0.65 },
      'SE': { share: 0.0109, speed: 0.83, biasLula: 0.64 },

      // Centro-Oeste
      'DF': { share: 0.0145, speed: 1.25, biasLula: 0.41 },
      'GO': { share: 0.0315, speed: 1.15, biasLula: 0.41 },
      'MT': { share: 0.0160, speed: 1.10, biasLula: 0.35 },
      'MS': { share: 0.0130, speed: 1.12, biasLula: 0.40 },

      // Sudeste
      'ES': { share: 0.0190, speed: 1.15, biasLula: 0.42 },
      'MG': { share: 0.1055, speed: 0.92, biasLula: 0.505 },
      'RJ': { share: 0.0830, speed: 1.05, biasLula: 0.43 },
      'SP': { share: 0.2240, speed: 1.18, biasLula: 0.45 },

      // Sul
      'PR': { share: 0.0550, speed: 1.20, biasLula: 0.36 },
      'RS': { share: 0.0560, speed: 1.08, biasLula: 0.44 },
      'SC': { share: 0.0365, speed: 1.22, biasLula: 0.31 }
    };

    return base;
  }

  setScenario(name) {
    this.scenario = name;
  }

  setProgress(pct) {
    this.progress = Math.min(100, Math.max(0, pct));
  }

  // Gera snapshot atual dos dados baseado na porcentagem de apuração
  getCurrentData() {
    const globalProgress = this.progress; // 0 - 100
    const progressRatio = globalProgress / 100;

    let totalSectionsCounted = Math.round(this.totalSections * progressRatio);
    let totalExpectedVoters = this.totalElectorate * this.expectedTurnoutRate;
    let countedVoters = Math.round(totalExpectedVoters * progressRatio);

    let blankVotes = Math.round(countedVoters * this.blankRate);
    let nullVotes = Math.round(countedVoters * this.nullRate);
    let validVotesTotal = Math.max(0, countedVoters - blankVotes - nullVotes);

    let cand1VotesTotal = 0;
    let cand2VotesTotal = 0;

    const stateBreakdown = {};

    // Calcular por estado com velocidade diferenciada
    for (const [uf, profile] of Object.entries(this.stateWeights)) {
      // Modulação de velocidade da contagem por estado (Centro-Sul apura antes do interior/Nordeste)
      let ufProgressRatio = Math.min(1.0, Math.max(0, progressRatio * profile.speed));
      
      // Ajuste para garantir que quando global chega a 100%, todos chegam a 100%
      if (progressRatio >= 0.99) ufProgressRatio = 1.0;
      else if (progressRatio > 0.8) {
        ufProgressRatio = ufProgressRatio + (1.0 - ufProgressRatio) * ((progressRatio - 0.8) / 0.2);
      }

      let ufTotalVoters = this.totalElectorate * profile.share * this.expectedTurnoutRate;
      let ufCountedVoters = Math.round(ufTotalVoters * ufProgressRatio);
      let ufValidVotes = Math.round(ufCountedVoters * (1 - this.blankRate - this.nullRate));

      // Ajuste de cenário
      let biasLula = profile.biasLula;
      if (this.scenario === 'equilibrado') {
        // Empate super fino 50.5 x 49.5
        biasLula = profile.biasLula * 0.99;
      } else if (this.scenario === 'folgado') {
        // Vitória ampla Lula 54%
        biasLula = Math.min(0.85, profile.biasLula * 1.07);
      } else if (this.scenario === 'virada') {
        // Virada dramática: Nordeste entra mais tarde e consolida virada aos ~68-72%
        biasLula = profile.biasLula;
      }

      let ufCand1Votes = Math.round(ufValidVotes * biasLula);
      let ufCand2Votes = ufValidVotes - ufCand1Votes;

      cand1VotesTotal += ufCand1Votes;
      cand2VotesTotal += ufCand2Votes;

      stateBreakdown[uf] = {
        uf,
        name: BrazilMap.statesData[uf] ? BrazilMap.statesData[uf].name : uf,
        progressPct: (ufProgressRatio * 100).toFixed(2),
        validVotes: ufValidVotes,
        cand1Votes: ufCand1Votes,
        cand2Votes: ufCand2Votes,
        cand1Pct: ufValidVotes > 0 ? ((ufCand1Votes / ufValidVotes) * 100).toFixed(2) : '0.00',
        cand2Pct: ufValidVotes > 0 ? ((ufCand2Votes / ufValidVotes) * 100).toFixed(2) : '0.00',
        leader: ufCand1Votes > ufCand2Votes ? 1 : (ufCand2Votes > ufCand1Votes ? 2 : 0)
      };
    }

    const currentValidTotal = cand1VotesTotal + cand2VotesTotal;
    const cand1Pct = currentValidTotal > 0 ? ((cand1VotesTotal / currentValidTotal) * 100) : 0;
    const cand2Pct = currentValidTotal > 0 ? ((cand2VotesTotal / currentValidTotal) * 100) : 0;

    // Diferença em votos e pontos percentuais
    const voteDiff = Math.abs(cand1VotesTotal - cand2VotesTotal);
    const ppDiff = Math.abs(cand1Pct - cand2Pct);
    const leaderCand = cand1VotesTotal > cand2VotesTotal ? 1 : (cand2VotesTotal > cand1VotesTotal ? 2 : 0);

    // Verificação de Definição Matemática:
    // Votos restantes a apurar
    const remainingEstimatedValid = Math.max(0, Math.round((totalExpectedVoters * (1 - progressRatio)) * (1 - this.blankRate - this.nullRate)));
    const isMathematicallyElected = progressRatio > 0.65 && (voteDiff > remainingEstimatedValid);

    const abstentionVotes = Math.round(this.totalElectorate * (1 - this.expectedTurnoutRate) * progressRatio);

    return {
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      progressPct: globalProgress.toFixed(2),
      sectionsCounted: totalSectionsCounted,
      totalSections: this.totalSections,
      totalVotes: countedVoters,
      validVotes: currentValidTotal,
      blankVotes: blankVotes,
      nullVotes: nullVotes,
      abstentionVotes: abstentionVotes,
      abstentionPct: ((1 - this.expectedTurnoutRate) * 100).toFixed(2),
      cand1: {
        id: 1,
        name: this.candidates[0].name,
        party: this.candidates[0].party,
        number: this.candidates[0].number,
        color: this.candidates[0].color,
        votes: cand1VotesTotal,
        pct: cand1Pct.toFixed(2),
        isLeading: leaderCand === 1
      },
      cand2: {
        id: 2,
        name: this.candidates[1].name,
        party: this.candidates[1].party,
        number: this.candidates[1].number,
        color: this.candidates[1].color,
        votes: cand2VotesTotal,
        pct: cand2Pct.toFixed(2),
        isLeading: leaderCand === 2
      },
      voteDiff,
      ppDiff: ppDiff.toFixed(2),
      leader: leaderCand,
      remainingValid: remainingEstimatedValid,
      isMathematicallyElected,
      states: stateBreakdown
    };
  }
}

window.ElectionSimulator = ElectionSimulator;
