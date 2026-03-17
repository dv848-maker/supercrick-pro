// SuperCrick Pro - Global Search
const Search = {
  query: Utils.debounce(async (q) => {
    const container = document.getElementById('search-results');
    if (!q || q.length < 2) {
      container.innerHTML = `<div class="empty-state"><span class="material-icons-round">search</span><p>Search across all matches, players and teams</p></div>`;
      return;
    }

    const query = q.toLowerCase();
    let html = '';

    // Search Players
    const players = await DB.searchPlayers(q);
    if (players.length > 0) {
      html += `<div class="search-section-title">Players</div>`;
      html += players.slice(0, 5).map(p => `
        <div class="player-card" onclick="PlayerMgr.openProfile(${p.id})">
          <div class="player-avatar">${p.photo ? `<img src="${p.photo}">` : Utils.initials(p.name)}</div>
          <div class="player-info">
            <h4>${p.name}</h4>
            <p>${Utils.roleDisplay(p.role)}${p.teamName ? ' • ' + p.teamName : ''}</p>
          </div>
        </div>
      `).join('');
    }

    // Search Teams
    const allTeams = await DB.getAllTeams();
    const teams = allTeams.filter(t => t.name.toLowerCase().includes(query));
    if (teams.length > 0) {
      html += `<div class="search-section-title">Teams</div>`;
      html += teams.slice(0, 5).map(t => `
        <div class="team-select-card" onclick="Search._showTeamMatches(${t.id})">
          <div class="team-avatar">${Utils.initials(t.name)}</div>
          <div class="team-details">
            <h4>${t.name}</h4>
            <p>${(t.players || []).length} players</p>
          </div>
        </div>
      `).join('');
    }

    // Search Matches
    const allMatches = await DB.getAllMatches();
    const matchResults = [];
    for (const m of allMatches) {
      const t1 = await DB.getTeam(m.team1Id);
      const t2 = await DB.getTeam(m.team2Id);
      const t1Name = t1?.name || '';
      const t2Name = t2?.name || '';
      const searchStr = `${t1Name} ${t2Name} ${m.venue || ''} ${m.result || ''} ${m.format || ''}`.toLowerCase();
      if (searchStr.includes(query)) {
        matchResults.push({ match: m, t1Name, t2Name });
      }
    }

    if (matchResults.length > 0) {
      html += `<div class="search-section-title">Matches</div>`;
      for (const { match: m, t1Name, t2Name } of matchResults.slice(0, 5)) {
        html += `
          <div class="match-card" onclick="App.openMatch(${m.id})">
            <div class="match-card-header">
              <span class="match-format">${m.format || 'T20'}</span>
              <span class="match-date">${Utils.formatDateShort(m.date)}</span>
            </div>
            <div class="match-card-teams">
              <div class="match-team-row">
                <span class="match-team-name">${t1Name}</span>
              </div>
              <div class="match-team-row">
                <span class="match-team-name">${t2Name}</span>
              </div>
            </div>
            ${m.result ? `<div class="match-result">${m.result}</div>` : ''}
          </div>
        `;
      }
    }

    if (!html) {
      html = `<div class="empty-state"><span class="material-icons-round">search_off</span><p>No results found for "${q}"</p></div>`;
    }

    container.innerHTML = html;
  }, 300),

  async _showTeamMatches(teamId) {
    const matches = await DB.getAllMatches();
    const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);

    if (teamMatches.length > 0) {
      App.navigate('matches');
      // Show filtered
      const container = document.getElementById('matches-list');
      container.innerHTML = '';
      for (const m of teamMatches) {
        container.innerHTML += await App.renderMatchCard(m);
      }
    } else {
      Utils.toast('No matches found for this team');
    }
  }
};
