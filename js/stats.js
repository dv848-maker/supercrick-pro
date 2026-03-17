// SuperCrick Pro - Advanced Statistics
const Stats = {
  _chartInstances: [],

  async init() {
    Stats.showTab('batting', document.querySelector('.stats-tab'));
  },

  async showTab(tab, el) {
    document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');

    // Destroy old charts
    Stats._chartInstances.forEach(c => c.destroy());
    Stats._chartInstances = [];

    const container = document.getElementById('stats-content');

    switch (tab) {
      case 'batting': await Stats._renderBatting(container); break;
      case 'bowling': await Stats._renderBowling(container); break;
      case 'teams': await Stats._renderTeams(container); break;
    }
  },

  async _renderBatting(container) {
    const players = await DB.getAllPlayers();
    const allBalls = await db.balls.toArray();
    const allInnings = await db.innings.toArray();

    // Compute batting stats per player
    const statsList = [];

    for (const player of players) {
      let innings = 0, runs = 0, balls = 0, fours = 0, sixes = 0, outs = 0, hs = 0;
      const innScores = [];

      for (const inn of allInnings) {
        const innBalls = allBalls.filter(b => b.inningsId === inn.id);
        const batBalls = innBalls.filter(b => b.batsmanId === player.id);
        const wasInInn = batBalls.length > 0 || innBalls.some(b => b.nonStrikerId === player.id);
        if (!wasInInn) continue;

        innings++;
        let innRuns = 0, innBallsFaced = 0, innFours = 0, innSixes = 0;
        let wasOut = false;

        for (const b of batBalls) {
          const isLegal = !b.extras?.type?.match(/^(wide)$/);
          innRuns += b.batsmanRuns || 0;
          if (isLegal) innBallsFaced++;
          if ((b.batsmanRuns || 0) === 4) innFours++;
          if ((b.batsmanRuns || 0) === 6) innSixes++;
        }

        if (innBalls.some(b => b.isWicket && b.dismissedPlayerId === player.id)) {
          wasOut = true;
          outs++;
        }

        runs += innRuns;
        balls += innBallsFaced;
        fours += innFours;
        sixes += innSixes;
        if (innRuns > hs) hs = innRuns;
        innScores.push({ runs: innRuns, out: wasOut });
      }

      if (innings > 0) {
        statsList.push({
          id: player.id, name: player.name, innings, runs, balls, fours, sixes, outs, hs,
          avg: outs > 0 ? (runs / outs).toFixed(2) : (runs > 0 ? '∞' : '0'),
          sr: balls > 0 ? (runs / balls * 100).toFixed(1) : '0',
          fifties: innScores.filter(s => s.runs >= 50 && s.runs < 100).length,
          hundreds: innScores.filter(s => s.runs >= 100).length
        });
      }
    }

    statsList.sort((a, b) => b.runs - a.runs);

    if (statsList.length === 0) {
      container.innerHTML = '<div class="no-data"><span class="material-icons-round">bar_chart</span>No batting data yet. Play some matches!</div>';
      return;
    }

    // Leaderboard
    let html = '<h4 style="font-size:14px;color:var(--text-secondary);margin-bottom:10px">TOP RUN SCORERS</h4>';

    statsList.slice(0, 10).forEach((s, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      html += `
        <div class="leaderboard-row" onclick="PlayerMgr.openProfile(${s.id})">
          <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
          <div class="leaderboard-info">
            <h4>${s.name}</h4>
            <p>${s.innings} inn • Avg ${s.avg} • SR ${s.sr} • HS ${s.hs}</p>
          </div>
          <div class="leaderboard-stat">${s.runs}</div>
        </div>
      `;
    });

    // Detailed table
    html += `
      <div class="stat-card" style="margin-top:16px;overflow-x:auto">
        <h4>Detailed Batting Stats</h4>
        <table class="sc-table">
          <tr><th>Player</th><th>Inn</th><th>R</th><th>Avg</th><th>SR</th><th>HS</th><th>4s</th><th>6s</th><th>50</th><th>100</th></tr>
          ${statsList.map(s => `
            <tr onclick="PlayerMgr.openProfile(${s.id})" style="cursor:pointer">
              <td class="sc-batsman-name">${Utils.shortName(s.name)}</td>
              <td>${s.innings}</td>
              <td class="sc-runs">${s.runs}</td>
              <td>${s.avg}</td>
              <td>${s.sr}</td>
              <td>${s.hs}</td>
              <td>${s.fours}</td>
              <td>${s.sixes}</td>
              <td>${s.fifties}</td>
              <td>${s.hundreds}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;

    // Top 5 bar chart
    html += `<div class="chart-container" style="margin-top:12px"><h4>Top Scorers</h4><canvas id="chart-top-batters"></canvas></div>`;

    container.innerHTML = html;

    // Render chart
    const top5 = statsList.slice(0, 5);
    const canvas = document.getElementById('chart-top-batters');
    if (canvas && top5.length > 0) {
      const chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: top5.map(s => Utils.shortName(s.name)),
          datasets: [{
            label: 'Runs',
            data: top5.map(s => s.runs),
            backgroundColor: ['#ffd700', '#c0c0c0', '#cd7f32', '#1a73e8', '#1a73e8'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(36,53,85,0.5)' }, ticks: { color: '#8899b4' } },
            y: { grid: { display: false }, ticks: { color: '#fff', font: { size: 11 } } }
          }
        }
      });
      Stats._chartInstances.push(chart);
    }
  },

  async _renderBowling(container) {
    const players = await DB.getAllPlayers();
    const allBalls = await db.balls.toArray();
    const allInnings = await db.innings.toArray();

    const statsList = [];

    for (const player of players) {
      let innings = 0, totalBalls = 0, runs = 0, wickets = 0, dots = 0;
      let bestW = 0, bestR = 999;
      const innStats = [];

      for (const inn of allInnings) {
        const innBalls = allBalls.filter(b => b.inningsId === inn.id && b.bowlerId === player.id);
        if (innBalls.length === 0) continue;

        innings++;
        let innBallsLegal = 0, innRuns = 0, innWickets = 0, innDots = 0;

        for (const b of innBalls) {
          const isLegal = !b.extras?.type?.match(/^(wide|noball)$/);
          if (isLegal) { innBallsLegal++; totalBalls++; }
          const r = (b.extras?.type === 'bye' || b.extras?.type === 'legbye') ? 0 : (b.totalRuns || 0);
          innRuns += r; runs += r;
          if (r === 0 && isLegal) { innDots++; dots++; }
          if (b.isWicket && !['runout', 'retired', 'obstructing'].includes(b.wicketType)) {
            innWickets++; wickets++;
          }
        }

        if (innWickets > bestW || (innWickets === bestW && innRuns < bestR)) {
          bestW = innWickets; bestR = innRuns;
        }
        innStats.push({ balls: innBallsLegal, runs: innRuns, wickets: innWickets });
      }

      if (innings > 0) {
        statsList.push({
          id: player.id, name: player.name, innings, balls: totalBalls, runs, wickets, dots,
          avg: wickets > 0 ? (runs / wickets).toFixed(2) : '-',
          econ: totalBalls > 0 ? (runs / totalBalls * 6).toFixed(2) : '0',
          sr: wickets > 0 ? (totalBalls / wickets).toFixed(1) : '-',
          best: bestW > 0 ? `${bestW}/${bestR}` : '-',
          fiveW: innStats.filter(s => s.wickets >= 5).length
        });
      }
    }

    statsList.sort((a, b) => b.wickets - a.wickets);

    if (statsList.length === 0) {
      container.innerHTML = '<div class="no-data"><span class="material-icons-round">bar_chart</span>No bowling data yet. Play some matches!</div>';
      return;
    }

    let html = '<h4 style="font-size:14px;color:var(--text-secondary);margin-bottom:10px">TOP WICKET TAKERS</h4>';

    statsList.slice(0, 10).forEach((s, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      html += `
        <div class="leaderboard-row" onclick="PlayerMgr.openProfile(${s.id})">
          <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
          <div class="leaderboard-info">
            <h4>${s.name}</h4>
            <p>${s.innings} inn • Avg ${s.avg} • Econ ${s.econ} • Best ${s.best}</p>
          </div>
          <div class="leaderboard-stat">${s.wickets}</div>
        </div>
      `;
    });

    html += `
      <div class="stat-card" style="margin-top:16px;overflow-x:auto">
        <h4>Detailed Bowling Stats</h4>
        <table class="sc-table">
          <tr><th>Player</th><th>Inn</th><th>O</th><th>W</th><th>R</th><th>Avg</th><th>Econ</th><th>Best</th></tr>
          ${statsList.map(s => `
            <tr onclick="PlayerMgr.openProfile(${s.id})" style="cursor:pointer">
              <td class="sc-batsman-name">${Utils.shortName(s.name)}</td>
              <td>${s.innings}</td>
              <td>${Utils.ballsToOvers(s.balls).display}</td>
              <td class="${s.wickets >= 5 ? 'highlight' : ''}">${s.wickets}</td>
              <td>${s.runs}</td>
              <td>${s.avg}</td>
              <td>${s.econ}</td>
              <td>${s.best}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;

    container.innerHTML = html;
  },

  async _renderTeams(container) {
    const teams = await DB.getAllTeams();
    const matches = await DB.getAllMatches();
    const innings = await db.innings.toArray();

    if (teams.length === 0 || matches.length === 0) {
      container.innerHTML = '<div class="no-data"><span class="material-icons-round">bar_chart</span>No team data yet. Play some matches!</div>';
      return;
    }

    let html = '';

    for (const team of teams) {
      const teamMatches = matches.filter(m =>
        (m.team1Id === team.id || m.team2Id === team.id) && m.status === 'completed'
      );

      if (teamMatches.length === 0) continue;

      let wins = 0, losses = 0, ties = 0;
      let highScore = 0, lowScore = 999;

      for (const match of teamMatches) {
        const matchInnings = innings.filter(i => i.matchId === match.id);
        const teamInn = matchInnings.find(i => i.battingTeamId === team.id);
        if (teamInn) {
          const score = teamInn.totalRuns || 0;
          if (score > highScore) highScore = score;
          if (score < lowScore) lowScore = score;
        }

        if (match.result) {
          if (match.result.includes(team.name) && match.result.includes('won')) wins++;
          else if (match.result === 'Match Tied') ties++;
          else losses++;
        }
      }

      const played = teamMatches.length;
      const winPct = played > 0 ? ((wins / played) * 100).toFixed(0) : 0;

      html += `
        <div class="stat-card">
          <h4>${team.name}</h4>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
            <div class="profile-stat-box"><div class="num">${played}</div><div class="lbl">Played</div></div>
            <div class="profile-stat-box"><div class="num" style="color:var(--accent)">${wins}</div><div class="lbl">Won</div></div>
            <div class="profile-stat-box"><div class="num" style="color:var(--danger)">${losses}</div><div class="lbl">Lost</div></div>
            <div class="profile-stat-box"><div class="num">${ties}</div><div class="lbl">Tied</div></div>
            <div class="profile-stat-box"><div class="num">${winPct}%</div><div class="lbl">Win Rate</div></div>
            <div class="profile-stat-box"><div class="num">${highScore}</div><div class="lbl">Highest</div></div>
          </div>
        </div>
      `;
    }

    if (!html) {
      html = '<div class="no-data"><span class="material-icons-round">bar_chart</span>No completed matches yet</div>';
    }

    container.innerHTML = html;
  }
};
