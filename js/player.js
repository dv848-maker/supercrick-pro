// SuperCrick Pro - Player Management
const PlayerMgr = {
  _editingId: null,

  async loadPlayers() {
    const players = await DB.getAllPlayers();
    const container = document.getElementById('players-list');

    if (players.length === 0) {
      container.innerHTML = `<div class="empty-state"><span class="material-icons-round">group</span><p>No players yet. Add your first player!</p></div>`;
      return;
    }

    container.innerHTML = players.map(p => `
      <div class="player-card" onclick="PlayerMgr.openProfile(${p.id})">
        <div class="player-avatar">
          ${p.photo ? `<img src="${p.photo}" alt="">` : Utils.initials(p.name)}
        </div>
        <div class="player-info">
          <h4>${p.name}</h4>
          <p>${Utils.roleDisplay(p.role)}${p.teamName ? ' • ' + p.teamName : ''}</p>
        </div>
        <span class="player-role-badge">${p.role === 'wk' ? 'WK' : p.role === 'all-rounder' ? 'AR' : p.role === 'batsman' ? 'BAT' : 'BOWL'}</span>
      </div>
    `).join('');
  },

  filterPlayers(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('#players-list .player-card').forEach(card => {
      const name = card.querySelector('h4').textContent.toLowerCase();
      card.style.display = name.includes(q) ? 'flex' : 'none';
    });
  },

  showAddPlayer() {
    PlayerMgr._editingId = null;
    document.getElementById('player-modal-title').textContent = 'Add Player';
    document.getElementById('player-name-input').value = '';
    document.getElementById('player-role-input').value = 'batsman';
    document.getElementById('player-bat-style').value = 'right';
    document.getElementById('player-bowl-style').value = 'none';
    document.getElementById('player-photo-preview').style.display = 'none';
    document.getElementById('player-photo-icon').style.display = 'block';
    PlayerMgr._loadTeamDropdown();
    document.getElementById('player-modal').classList.remove('hidden');
  },

  async showEditPlayer(id) {
    const player = await DB.getPlayer(id);
    if (!player) return;

    PlayerMgr._editingId = id;
    document.getElementById('player-modal-title').textContent = 'Edit Player';
    document.getElementById('player-name-input').value = player.name;
    document.getElementById('player-role-input').value = player.role;
    document.getElementById('player-bat-style').value = player.battingStyle || 'right';
    document.getElementById('player-bowl-style').value = player.bowlingStyle || 'none';

    if (player.photo) {
      document.getElementById('player-photo-preview').src = player.photo;
      document.getElementById('player-photo-preview').style.display = 'block';
      document.getElementById('player-photo-icon').style.display = 'none';
    } else {
      document.getElementById('player-photo-preview').style.display = 'none';
      document.getElementById('player-photo-icon').style.display = 'block';
    }

    await PlayerMgr._loadTeamDropdown();
    document.getElementById('player-team-input').value = player.teamId || '';
    document.getElementById('player-modal').classList.remove('hidden');
  },

  closePlayerModal() {
    document.getElementById('player-modal').classList.add('hidden');
  },

  async _loadTeamDropdown() {
    const teams = await DB.getAllTeams();
    const select = document.getElementById('player-team-input');
    select.innerHTML = '<option value="">No team</option>';
    teams.forEach(t => {
      select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
  },

  uploadPhoto() {
    document.getElementById('player-photo-input').click();
  },

  handlePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      // Resize image
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        document.getElementById('player-photo-preview').src = dataUrl;
        document.getElementById('player-photo-preview').style.display = 'block';
        document.getElementById('player-photo-icon').style.display = 'none';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  async savePlayer() {
    const name = document.getElementById('player-name-input').value.trim();
    if (!name) { Utils.toast('Player name is required'); return; }

    const photoEl = document.getElementById('player-photo-preview');
    const photo = photoEl.style.display !== 'none' ? photoEl.src : '';
    const teamId = document.getElementById('player-team-input').value;
    let teamName = '';
    if (teamId) {
      const team = await DB.getTeam(Number(teamId));
      teamName = team?.name || '';
    }

    const playerData = {
      name,
      role: document.getElementById('player-role-input').value,
      battingStyle: document.getElementById('player-bat-style').value,
      bowlingStyle: document.getElementById('player-bowl-style').value,
      photo,
      teamId: teamId ? Number(teamId) : null,
      teamName
    };

    if (PlayerMgr._editingId) {
      await DB.updatePlayer(PlayerMgr._editingId, playerData);
      Utils.toast('Player updated');
    } else {
      await DB.addPlayer(playerData);
      Utils.toast('Player added');
    }

    await App.refreshPlayerMap();
    PlayerMgr.closePlayerModal();
    await PlayerMgr.loadPlayers();
  },

  async openProfile(playerId) {
    App.navigate('player-profile', { playerId });
  },

  async loadProfile(playerId) {
    const player = await DB.getPlayer(playerId);
    if (!player) return;

    const { battingStats, bowlingStats } = await DB.getPlayerMatchStats(playerId);
    const container = document.getElementById('player-profile-content');

    // Calculate career batting stats
    const totalInnings = battingStats.length;
    const totalRuns = battingStats.reduce((s, b) => s + b.runs, 0);
    const totalBalls = battingStats.reduce((s, b) => s + b.balls, 0);
    const totalOuts = battingStats.filter(b => b.isOut).length;
    const totalFours = battingStats.reduce((s, b) => s + b.fours, 0);
    const totalSixes = battingStats.reduce((s, b) => s + b.sixes, 0);
    const highScore = battingStats.length > 0 ? Math.max(...battingStats.map(b => b.runs)) : 0;
    const fifties = battingStats.filter(b => b.runs >= 50 && b.runs < 100).length;
    const hundreds = battingStats.filter(b => b.runs >= 100).length;
    const batAvg = Utils.average(totalRuns, totalOuts);
    const batSR = totalBalls > 0 ? (totalRuns / totalBalls * 100).toFixed(2) : '0.00';

    // Career bowling stats
    const bowlInnings = bowlingStats.length;
    const totalWickets = bowlingStats.reduce((s, b) => s + b.wickets, 0);
    const totalBowlBalls = bowlingStats.reduce((s, b) => s + b.balls, 0);
    const totalRunsConceded = bowlingStats.reduce((s, b) => s + b.runsConceded, 0);
    const bowlAvg = Utils.average(totalRunsConceded, totalWickets);
    const bowlEcon = totalBowlBalls > 0 ? (totalRunsConceded / totalBowlBalls * 6).toFixed(2) : '0.00';
    const bowlSR = totalWickets > 0 ? (totalBowlBalls / totalWickets).toFixed(1) : '-';
    const bestBowl = bowlingStats.length > 0
      ? bowlingStats.reduce((best, b) => (b.wickets > best.wickets || (b.wickets === best.wickets && b.runsConceded < best.runsConceded)) ? b : best, bowlingStats[0])
      : null;

    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">
          ${player.photo ? `<img src="${player.photo}" alt="">` : Utils.initials(player.name)}
        </div>
        <div class="profile-name">${player.name}</div>
        <div class="profile-role">${Utils.roleDisplay(player.role)}</div>
        ${player.teamName ? `<div class="profile-team">${player.teamName}</div>` : ''}
        <div style="margin-top:8px;font-size:12px;color:var(--text-muted)">
          ${player.battingStyle === 'left' ? 'Left' : 'Right'} Hand Bat
          ${player.bowlingStyle && player.bowlingStyle !== 'none' ? ' • ' + Utils.bowlStyleDisplay(player.bowlingStyle) : ''}
        </div>
        <button class="btn-outline" style="margin-top:12px;padding:8px 20px" onclick="PlayerMgr.showEditPlayer(${player.id})">
          <span class="material-icons-round" style="font-size:16px">edit</span> Edit
        </button>
      </div>

      <h4 style="font-size:14px;color:var(--text-secondary);margin-bottom:8px">BATTING CAREER</h4>
      <div class="profile-stats-grid">
        <div class="profile-stat-box"><div class="num">${totalInnings}</div><div class="lbl">Innings</div></div>
        <div class="profile-stat-box"><div class="num">${totalRuns}</div><div class="lbl">Runs</div></div>
        <div class="profile-stat-box"><div class="num">${batAvg}</div><div class="lbl">Average</div></div>
        <div class="profile-stat-box"><div class="num">${batSR}</div><div class="lbl">SR</div></div>
        <div class="profile-stat-box"><div class="num">${highScore}${battingStats.length > 0 && !battingStats.find(b => b.runs === highScore && b.isOut) ? '*' : ''}</div><div class="lbl">HS</div></div>
        <div class="profile-stat-box"><div class="num">${totalFours}/${totalSixes}</div><div class="lbl">4s/6s</div></div>
        <div class="profile-stat-box"><div class="num">${fifties}</div><div class="lbl">50s</div></div>
        <div class="profile-stat-box"><div class="num">${hundreds}</div><div class="lbl">100s</div></div>
        <div class="profile-stat-box"><div class="num">${totalOuts > 0 ? totalOuts : '-'}</div><div class="lbl">Outs</div></div>
      </div>

      ${bowlInnings > 0 ? `
      <h4 style="font-size:14px;color:var(--text-secondary);margin:12px 0 8px">BOWLING CAREER</h4>
      <div class="profile-stats-grid">
        <div class="profile-stat-box"><div class="num">${bowlInnings}</div><div class="lbl">Innings</div></div>
        <div class="profile-stat-box"><div class="num">${totalWickets}</div><div class="lbl">Wickets</div></div>
        <div class="profile-stat-box"><div class="num">${bowlAvg}</div><div class="lbl">Average</div></div>
        <div class="profile-stat-box"><div class="num">${bowlEcon}</div><div class="lbl">Economy</div></div>
        <div class="profile-stat-box"><div class="num">${bowlSR}</div><div class="lbl">SR</div></div>
        <div class="profile-stat-box"><div class="num">${bestBowl ? bestBowl.wickets + '/' + bestBowl.runsConceded : '-'}</div><div class="lbl">Best</div></div>
      </div>
      ` : ''}

      <h4 style="font-size:14px;color:var(--text-secondary);margin:12px 0 8px">RECENT FORM (Last 5)</h4>
      <div class="stat-card">
        ${battingStats.slice(-5).reverse().map(b => `
          <div class="stat-row">
            <span class="stat-label">${Utils.formatDateShort(b.date)}</span>
            <span class="stat-value ${b.runs >= 50 ? 'stat-highlight' : ''}">${b.runs}${b.isOut ? '' : '*'} (${b.balls})</span>
          </div>
        `).join('') || '<div class="no-data">No matches played yet</div>'}
      </div>
    `;
  }
};
