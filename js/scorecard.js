// SuperCrick Pro - Scorecard Renderer
const Scorecard = {
  async render(matchId) {
    const match = await DB.getMatch(matchId);
    if (!match) return;

    const team1 = await DB.getTeam(match.team1Id);
    const team2 = await DB.getTeam(match.team2Id);
    const innings = await DB.getMatchInnings(matchId);
    const allBalls = await DB.getMatchBalls(matchId);
    await App.refreshPlayerMap();

    const container = document.getElementById('scorecard-content');
    let html = '';

    for (const inn of innings) {
      const battingTeam = inn.battingTeamId === match.team1Id ? team1 : team2;
      const bowlingTeam = inn.bowlingTeamId === match.team1Id ? team1 : team2;
      const innBalls = allBalls.filter(b => b.inningsId === inn.id);

      html += Scorecard._renderInnings(inn, battingTeam, bowlingTeam, innBalls, match);
    }

    if (match.result) {
      html += `<div class="sc-result">${match.result}</div>`;
    }

    container.innerHTML = html;

    // Render charts
    for (const inn of innings) {
      Scorecard._renderCharts(inn, allBalls.filter(b => b.inningsId === inn.id));
    }
  },

  async renderMini(matchId, container) {
    const match = await DB.getMatch(matchId);
    if (!match) return;

    const team1 = await DB.getTeam(match.team1Id);
    const team2 = await DB.getTeam(match.team2Id);
    const innings = await DB.getMatchInnings(matchId);
    const allBalls = await DB.getMatchBalls(matchId);

    let html = '';
    for (const inn of innings) {
      const battingTeam = inn.battingTeamId === match.team1Id ? team1 : team2;
      const bowlingTeam = inn.bowlingTeamId === match.team1Id ? team1 : team2;
      const innBalls = allBalls.filter(b => b.inningsId === inn.id);
      html += Scorecard._renderInnings(inn, battingTeam, bowlingTeam, innBalls, match);
    }

    container.innerHTML = html;
  },

  _renderInnings(inn, battingTeam, bowlingTeam, innBalls, match) {
    const players = App._playerMap;
    const battingXI = inn.battingXI || [];
    const bowlingXI = inn.bowlingXI || [];

    // Build batting data
    const batData = [];
    const dismissed = {};
    const batStats = {};

    for (const pid of battingXI) {
      batStats[pid] = { runs: 0, balls: 0, fours: 0, sixes: 0, howOut: 'did not bat', wicketBall: null };
    }

    for (const ball of innBalls) {
      if (batStats[ball.batsmanId]) {
        const isLegal = !ball.extras?.type?.match(/^(wide)$/);
        if (isLegal) {
          batStats[ball.batsmanId].balls++;
        }
        batStats[ball.batsmanId].runs += ball.batsmanRuns || 0;
        if ((ball.batsmanRuns || 0) === 4) batStats[ball.batsmanId].fours++;
        if ((ball.batsmanRuns || 0) === 6) batStats[ball.batsmanId].sixes++;

        if (batStats[ball.batsmanId].howOut === 'did not bat') {
          batStats[ball.batsmanId].howOut = 'not out';
        }
      }
      if (ball.nonStrikerId && batStats[ball.nonStrikerId]) {
        if (batStats[ball.nonStrikerId].howOut === 'did not bat') {
          batStats[ball.nonStrikerId].howOut = 'not out';
        }
      }

      if (ball.isWicket && ball.dismissedPlayerId && batStats[ball.dismissedPlayerId]) {
        batStats[ball.dismissedPlayerId].howOut = Utils.howOut(ball, players);
        batStats[ball.dismissedPlayerId].wicketBall = ball;
        dismissed[ball.dismissedPlayerId] = inn.totalRuns; // FOW
      }
    }

    // Build bowler data
    const bowlData = {};
    for (const ball of innBalls) {
      if (!bowlData[ball.bowlerId]) {
        bowlData[ball.bowlerId] = { balls: 0, runs: 0, wickets: 0, dots: 0, maidens: 0, overs: [] };
      }
      const isLegal = !ball.extras?.type?.match(/^(wide|noball)$/);
      if (isLegal) bowlData[ball.bowlerId].balls++;
      const runs = (ball.extras?.type === 'bye' || ball.extras?.type === 'legbye') ? 0 : (ball.totalRuns || 0);
      bowlData[ball.bowlerId].runs += runs;
      if (runs === 0 && isLegal) bowlData[ball.bowlerId].dots++;
      if (ball.isWicket && !['runout', 'retired', 'obstructing'].includes(ball.wicketType)) {
        bowlData[ball.bowlerId].wickets++;
      }
    }

    // Calculate maidens
    for (const pid in bowlData) {
      const bd = bowlData[pid];
      const bowlerBalls = innBalls.filter(b => b.bowlerId === Number(pid));
      let overRuns = 0;
      let overLegalBalls = 0;
      for (const ball of bowlerBalls) {
        const isLegal = !ball.extras?.type?.match(/^(wide|noball)$/);
        const runs = ball.totalRuns || 0;
        overRuns += runs;
        if (isLegal) overLegalBalls++;
        if (overLegalBalls >= 6) {
          if (overRuns === 0) bd.maidens++;
          overRuns = 0;
          overLegalBalls = 0;
        }
      }
    }

    // Build over-by-over
    const overRuns = [];
    let curOverRuns = 0;
    let curOverBalls = 0;
    for (const ball of innBalls) {
      const isLegal = !ball.extras?.type?.match(/^(wide|noball)$/);
      curOverRuns += ball.totalRuns || 0;
      if (isLegal) curOverBalls++;
      if (curOverBalls >= 6) {
        overRuns.push(curOverRuns);
        curOverRuns = 0;
        curOverBalls = 0;
      }
    }
    if (curOverBalls > 0) overRuns.push(curOverRuns);

    // Build FOW
    const fowList = [];
    let runningTotal = 0;
    let wicketNum = 0;
    let legalBallCount = 0;
    for (const ball of innBalls) {
      runningTotal += ball.totalRuns || 0;
      const isLegal = !ball.extras?.type?.match(/^(wide|noball)$/);
      if (isLegal) legalBallCount++;
      if (ball.isWicket) {
        wicketNum++;
        const p = players[ball.dismissedPlayerId];
        fowList.push({
          wicket: wicketNum,
          score: runningTotal,
          overs: Utils.ballsToOvers(legalBallCount).display,
          player: p ? Utils.shortName(p.name) : '?'
        });
      }
    }

    // HTML
    let html = `
      <div class="sc-innings-header">
        <div class="sc-team-name">${battingTeam?.name || 'Team'} — ${inn.inningsNumber === 1 ? '1st' : '2nd'} Innings</div>
        <div class="sc-team-score">${inn.totalRuns || 0}/${inn.totalWickets || 0} (${inn.totalOvers || '0.0'} ov)</div>
      </div>
    `;

    // Batting table
    html += `<table class="sc-table">
      <tr><th>Batsman</th><th>How Out</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>`;

    for (const pid of battingXI) {
      const bs = batStats[pid];
      if (bs.howOut === 'did not bat') continue;
      const p = players[pid];
      const sr = bs.balls > 0 ? (bs.runs / bs.balls * 100).toFixed(1) : '-';
      const isNotOut = bs.howOut === 'not out';

      html += `<tr>
        <td class="sc-batsman-name">${p ? Utils.shortName(p.name) : '?'}</td>
        <td class="sc-how-out">${bs.howOut}</td>
        <td class="sc-runs ${isNotOut ? 'sc-not-out' : ''} ${bs.runs >= 50 ? 'highlight' : ''}">${bs.runs}${isNotOut ? '*' : ''}</td>
        <td>${bs.balls}</td>
        <td>${bs.fours}</td>
        <td>${bs.sixes}</td>
        <td>${sr}</td>
      </tr>`;
    }
    html += `</table>`;

    // Extras
    const ext = inn.extras || {};
    const totalExtras = (ext.wides || 0) + (ext.noballs || 0) + (ext.byes || 0) + (ext.legbyes || 0);
    html += `<div class="sc-extras">
      <span>Extras: <b>${totalExtras}</b></span>
      <span class="sc-extras-detail">(Wd ${ext.wides || 0}, Nb ${ext.noballs || 0}, B ${ext.byes || 0}, Lb ${ext.legbyes || 0})</span>
    </div>`;

    html += `<div class="sc-total">
      <span>Total</span>
      <span>${inn.totalRuns || 0}/${inn.totalWickets || 0} (${inn.totalOvers || '0.0'} overs)</span>
    </div>`;

    // Fall of Wickets
    if (fowList.length > 0) {
      html += `<h4>Fall of Wickets</h4><div class="sc-fow">`;
      html += fowList.map(f => `<span>${f.wicket}-${f.score} (${f.player}, ${f.overs})</span>`).join(' • ');
      html += `</div>`;
    }

    // Bowling table
    html += `<h4>Bowling</h4><table class="sc-table">
      <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Dots</th></tr>`;

    for (const pid of bowlingXI) {
      const bd = bowlData[pid];
      if (!bd) continue;
      const p = players[pid];
      const ov = Utils.ballsToOvers(bd.balls);
      const econ = bd.balls > 0 ? (bd.runs / bd.balls * 6).toFixed(1) : '-';

      html += `<tr>
        <td class="sc-batsman-name">${p ? Utils.shortName(p.name) : '?'}</td>
        <td>${ov.display}</td>
        <td>${bd.maidens}</td>
        <td>${bd.runs}</td>
        <td class="${bd.wickets >= 3 ? 'highlight' : ''}">${bd.wickets}</td>
        <td>${econ}</td>
        <td>${bd.dots}</td>
      </tr>`;
    }
    html += `</table>`;

    // Over-by-over
    if (overRuns.length > 0) {
      html += `<h4>Over by Over</h4><div class="obo-bar">`;
      overRuns.forEach((r, i) => {
        html += `<div class="obo-over"><span class="obo-num">${i + 1}</span><span class="obo-runs">${r}</span></div>`;
      });
      html += `</div>`;
    }

    // Chart containers
    html += `
      <div class="chart-container" id="chart-manhattan-${inn.id}">
        <h4>Manhattan Chart</h4>
        <canvas id="canvas-manhattan-${inn.id}"></canvas>
      </div>
      <div class="chart-container" id="chart-worm-${inn.id}">
        <h4>Run Progression (Worm)</h4>
        <canvas id="canvas-worm-${inn.id}"></canvas>
      </div>
    `;

    return html;
  },

  _renderCharts(inn, innBalls) {
    // Manhattan Chart
    const overRuns = [];
    let curRuns = 0;
    let curBalls = 0;
    for (const ball of innBalls) {
      const isLegal = !ball.extras?.type?.match(/^(wide|noball)$/);
      curRuns += ball.totalRuns || 0;
      if (isLegal) curBalls++;
      if (curBalls >= 6) {
        overRuns.push(curRuns);
        curRuns = 0;
        curBalls = 0;
      }
    }
    if (curBalls > 0) overRuns.push(curRuns);

    const manhattanCanvas = document.getElementById(`canvas-manhattan-${inn.id}`);
    if (manhattanCanvas && overRuns.length > 0) {
      new Chart(manhattanCanvas, {
        type: 'bar',
        data: {
          labels: overRuns.map((_, i) => `${i + 1}`),
          datasets: [{
            data: overRuns,
            backgroundColor: overRuns.map(r => r >= 10 ? '#9c27b0' : r >= 7 ? '#2196f3' : '#1a73e8'),
            borderRadius: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#8899b4', font: { size: 10 } } },
            y: { grid: { color: 'rgba(36,53,85,0.5)' }, ticks: { color: '#8899b4', font: { size: 10 } } }
          }
        }
      });
    }

    // Worm Chart
    const cumulativeRuns = [];
    let total = 0;
    let legalBalls = 0;
    for (const ball of innBalls) {
      total += ball.totalRuns || 0;
      const isLegal = !ball.extras?.type?.match(/^(wide|noball)$/);
      if (isLegal) {
        legalBalls++;
        if (legalBalls % 6 === 0) {
          cumulativeRuns.push(total);
        }
      }
    }
    if (legalBalls % 6 !== 0) cumulativeRuns.push(total);

    const wormCanvas = document.getElementById(`canvas-worm-${inn.id}`);
    if (wormCanvas && cumulativeRuns.length > 0) {
      new Chart(wormCanvas, {
        type: 'line',
        data: {
          labels: cumulativeRuns.map((_, i) => `${i + 1}`),
          datasets: [{
            data: cumulativeRuns,
            borderColor: '#1a73e8',
            backgroundColor: 'rgba(26,115,232,0.1)',
            fill: true, tension: 0.3, pointRadius: 3,
            pointBackgroundColor: '#1a73e8'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: 'Overs', color: '#8899b4' }, grid: { display: false }, ticks: { color: '#8899b4', font: { size: 10 } } },
            y: { title: { display: true, text: 'Runs', color: '#8899b4' }, grid: { color: 'rgba(36,53,85,0.5)' }, ticks: { color: '#8899b4', font: { size: 10 } } }
          }
        }
      });
    }
  }
};
