// SuperCrick Pro - Match Setup & Management
const Match = {
  _currentStep: 1,
  _matchData: {},
  _teamBuilderFor: 0,
  _newTeamPlayers: [],
  _selectedXI: [],
  _selectedTeamId: null,
  _pendingRoleTeamNum: 0,

  startNew() {
    Match._currentStep = 1;
    Match._matchData = {
      format: 'T20', overs: 20, venue: '', date: new Date().toISOString().split('T')[0],
      ballType: 'leather', team1Id: null, team2Id: null, team1Name: '', team2Name: '',
      team1XI: [], team2XI: [], tossWonBy: null, tossDecision: 'bat',
      isGully: false,
      team1Captain: null, team1VC: null, team1WK: null,
      team2Captain: null, team2VC: null, team2WK: null
    };

    // Reset form
    document.querySelectorAll('.format-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.format === 'T20');
    });
    document.getElementById('custom-overs-group').style.display = 'none';
    document.getElementById('match-venue').value = '';
    document.getElementById('match-date').value = Match._matchData.date;
    document.getElementById('team1-selector').style.display = 'block';
    document.getElementById('team1-info').style.display = 'none';
    document.getElementById('team2-selector').style.display = 'block';
    document.getElementById('team2-info').style.display = 'none';

    // Format button handlers
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Match._matchData.format = btn.dataset.format;
        Match._matchData.isGully = btn.dataset.format === 'Gully';
        if (btn.dataset.overs) {
          Match._matchData.overs = Number(btn.dataset.overs);
          document.getElementById('custom-overs-group').style.display = 'none';
        } else {
          document.getElementById('custom-overs-group').style.display = 'block';
        }
      };
    });

    App.navigate('new-match');
  },

  nextStep(step) {
    // Validate current step
    if (step === 2 && Match._currentStep === 1) {
      Match._matchData.venue = document.getElementById('match-venue').value.trim();
      Match._matchData.date = document.getElementById('match-date').value;
      Match._matchData.ballType = document.querySelector('input[name="ball-type"]:checked')?.value || 'leather';
      if (Match._matchData.format === 'Custom') {
        const overs = Number(document.getElementById('custom-overs').value);
        if (!overs || overs < 1) { Utils.toast('Enter number of overs'); return; }
        Match._matchData.overs = overs;
      }
    }

    if (step === 3 && Match._currentStep === 2) {
      if (!Match._matchData.team1Id || !Match._matchData.team2Id) {
        Utils.toast('Please select both teams');
        return;
      }
      if (Match._matchData.team1XI.length === 0 || Match._matchData.team2XI.length === 0) {
        Utils.toast('Please set playing squad for both teams');
        return;
      }
      // Setup toss buttons
      Match._setupTossButtons();
    }

    Match._currentStep = step;
    document.querySelectorAll('.match-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`match-step-${step}`).classList.add('active');

    document.querySelectorAll('.step-indicator .step').forEach(s => {
      const sNum = Number(s.dataset.step);
      s.classList.remove('active', 'done');
      if (sNum === step) s.classList.add('active');
      else if (sNum < step) s.classList.add('done');
    });
  },

  _setupTossButtons() {
    const container = document.getElementById('toss-team-btns');
    container.innerHTML = `
      <button class="toss-btn active" data-team="1" onclick="Match.setTossWinner(1,this)">
        ${Match._matchData.team1Name}
      </button>
      <button class="toss-btn" data-team="2" onclick="Match.setTossWinner(2,this)">
        ${Match._matchData.team2Name}
      </button>
    `;
    Match._matchData.tossWonBy = 1;
  },

  setTossWinner(teamNum, el) {
    document.querySelectorAll('#toss-team-btns .toss-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    Match._matchData.tossWonBy = teamNum;
  },

  setTossDecision(decision, el) {
    el.parentElement.querySelectorAll('.toss-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    Match._matchData.tossDecision = decision;
  },

  // Team Builder
  async selectTeam(teamNum) {
    Match._teamBuilderFor = teamNum;
    Match._newTeamPlayers = [];
    document.getElementById('new-team-name').value = '';
    document.getElementById('new-team-players').innerHTML = '';
    document.getElementById('team-builder-title').textContent = `Select Team ${teamNum}`;

    // Load existing teams
    const teams = await DB.getAllTeams();
    const listEl = document.getElementById('existing-teams-list');

    if (teams.length === 0) {
      listEl.innerHTML = '<div class="no-data"><span class="material-icons-round">group_add</span>No teams yet. Create one!</div>';
    } else {
      listEl.innerHTML = teams.map(t => `
        <div class="team-select-card" onclick="Match.pickTeam(${t.id})">
          <div class="team-avatar">${Utils.initials(t.name)}</div>
          <div class="team-details">
            <h4>${t.name}</h4>
            <p>${(t.players || []).length} players</p>
          </div>
          <span class="material-icons-round" style="color:var(--text-muted)">chevron_right</span>
        </div>
      `).join('');
    }

    Match.showTeamTab('existing', document.querySelector('#team-builder-modal .tab'));
    document.getElementById('team-builder-modal').classList.remove('hidden');
  },

  showTeamTab(tab, el) {
    document.querySelectorAll('#team-builder-modal .tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    else document.querySelectorAll('#team-builder-modal .tab')[tab === 'existing' ? 0 : 1].classList.add('active');

    document.getElementById('tab-existing-teams').classList.toggle('active', tab === 'existing');
    document.getElementById('tab-create-team').classList.toggle('active', tab === 'create');
  },

  closeTeamBuilder() {
    document.getElementById('team-builder-modal').classList.add('hidden');
  },

  addQuickPlayer() {
    const name = document.getElementById('quick-player-name').value.trim();
    const role = document.getElementById('quick-player-role').value;
    if (!name) { Utils.toast('Enter player name'); return; }

    Match._newTeamPlayers.push({ name, role, tempId: Utils.uid() });
    document.getElementById('quick-player-name').value = '';
    Match._renderNewTeamPlayers();
  },

  _renderNewTeamPlayers() {
    const container = document.getElementById('new-team-players');
    container.innerHTML = Match._newTeamPlayers.map(p => `
      <div class="player-chip">
        <span>${p.name}</span>
        <span class="role-badge">${p.role === 'wk' ? 'WK' : p.role === 'all-rounder' ? 'AR' : p.role === 'batsman' ? 'BAT' : 'BOWL'}</span>
        <button class="remove-chip" onclick="Match.removeNewPlayer('${p.tempId}')">&times;</button>
      </div>
    `).join('');
  },

  removeNewPlayer(tempId) {
    Match._newTeamPlayers = Match._newTeamPlayers.filter(p => p.tempId !== tempId);
    Match._renderNewTeamPlayers();
  },

  async createTeam() {
    const name = document.getElementById('new-team-name').value.trim();
    if (!name) { Utils.toast('Enter team name'); return; }
    if (Match._newTeamPlayers.length < 2) { Utils.toast('Add at least 2 players'); return; }

    // Create players in DB
    const playerIds = [];
    for (const p of Match._newTeamPlayers) {
      const id = await DB.addPlayer({
        name: p.name, role: p.role, battingStyle: 'right',
        bowlingStyle: p.role === 'bowler' || p.role === 'all-rounder' ? 'rm' : 'none',
        photo: '', teamName: name
      });
      playerIds.push(id);
    }

    // Create team
    const teamId = await DB.addTeam({
      name, players: playerIds, logo: ''
    });

    // Update players with teamId
    for (const pid of playerIds) {
      await DB.updatePlayer(pid, { teamId });
    }

    await App.refreshPlayerMap();
    Utils.toast(`Team "${name}" created`);

    // Auto-select this team with all players as XI
    Match._assignTeam(teamId, name, playerIds);
    Match.closeTeamBuilder();
  },

  async pickTeam(teamId) {
    const team = await DB.getTeam(teamId);
    if (!team) return;

    Match._selectedTeamId = teamId;
    Match.closeTeamBuilder();

    // Show playing XI selection
    await Match._showPlayingXISelector(teamId, team);
  },

  async _showPlayingXISelector(teamId, team) {
    Match._selectedXI = [];
    const players = [];

    // Get team players
    if (team.players && team.players.length > 0) {
      for (const pid of team.players) {
        const p = await DB.getPlayer(pid);
        if (p) players.push(p);
      }
    }

    // Also get players assigned to this team
    const allPlayers = await DB.getAllPlayers();
    for (const p of allPlayers) {
      if (p.teamId === teamId && !players.find(x => x.id === p.id)) {
        players.push(p);
      }
    }

    const listEl = document.getElementById('playing-xi-list');
    listEl.innerHTML = players.map(p => `
      <div class="player-select-item" data-pid="${p.id}" onclick="Match.toggleXIPlayer(${p.id}, this)">
        <div class="ps-avatar">${Utils.initials(p.name)}</div>
        <span class="ps-name">${p.name}</span>
        <span class="ps-role">${Utils.roleDisplay(p.role)}</span>
        <span class="ps-check material-icons-round">check_circle</span>
      </div>
    `).join('');

    // Pre-select all if <=11
    if (players.length <= 11) {
      players.forEach(p => {
        Match._selectedXI.push(p.id);
        listEl.querySelector(`[data-pid="${p.id}"]`)?.classList.add('selected');
      });
    }

    document.getElementById('xi-count-num').textContent = Match._selectedXI.length;
    document.getElementById('playing-xi-modal').classList.remove('hidden');
  },

  toggleXIPlayer(playerId, el) {
    const idx = Match._selectedXI.indexOf(playerId);
    if (idx >= 0) {
      Match._selectedXI.splice(idx, 1);
      el.classList.remove('selected');
    } else {
      Match._selectedXI.push(playerId);
      el.classList.add('selected');
    }
    document.getElementById('xi-count-num').textContent = Match._selectedXI.length;
  },

  addPlayerToXI() {
    const name = document.getElementById('xi-add-name').value.trim();
    const role = document.getElementById('xi-add-role').value;
    if (!name) return;

    // Create player on the fly
    (async () => {
      const teamId = Match._selectedTeamId;
      const team = await DB.getTeam(teamId);
      const pid = await DB.addPlayer({
        name, role, battingStyle: 'right',
        bowlingStyle: role === 'bowler' || role === 'all-rounder' ? 'rm' : 'none',
        photo: '', teamId, teamName: team?.name || ''
      });

      // Add to team
      if (team) {
        const players = team.players || [];
        players.push(pid);
        await DB.updateTeam(teamId, { players });
      }

      await App.refreshPlayerMap();

      // Add to list
      const listEl = document.getElementById('playing-xi-list');
      listEl.innerHTML += `
        <div class="player-select-item selected" data-pid="${pid}" onclick="Match.toggleXIPlayer(${pid}, this)">
          <div class="ps-avatar">${Utils.initials(name)}</div>
          <span class="ps-name">${name}</span>
          <span class="ps-role">${Utils.roleDisplay(role)}</span>
          <span class="ps-check material-icons-round">check_circle</span>
        </div>
      `;
      Match._selectedXI.push(pid);
      document.getElementById('xi-count-num').textContent = Match._selectedXI.length;
      document.getElementById('xi-add-name').value = '';
    })();
  },

  async confirmPlayingXI() {
    if (Match._selectedXI.length < 2) {
      Utils.toast('Select at least 2 players');
      return;
    }

    // Apply solo batting mode toggle
    const soloToggle = document.getElementById('xi-solo-batting');
    if (soloToggle?.checked) {
      Match._matchData.isGully = true;
    }

    const team = await DB.getTeam(Match._selectedTeamId);
    Match._assignTeam(Match._selectedTeamId, team.name, Match._selectedXI);
    document.getElementById('playing-xi-modal').classList.add('hidden');

    // Show optional captain/VC/WK assignment
    await Match._showRoleAssignModal(team.name, Match._selectedXI, Match._teamBuilderFor);
  },

  async _showRoleAssignModal(teamName, playerIds, teamNum) {
    Match._pendingRoleTeamNum = teamNum;

    const modal = document.getElementById('role-assign-modal');
    const title = document.getElementById('role-assign-title');
    title.innerHTML = `${teamName} — Assign Roles <span style="font-size:11px;color:var(--text-muted)">(Optional)</span>`;

    // Build player options
    const options = ['<option value="">— None —</option>'];
    for (const pid of playerIds) {
      const p = App._playerMap[pid] || await DB.getPlayer(pid);
      if (p) options.push(`<option value="${pid}">${p.name}</option>`);
    }
    const optHtml = options.join('');

    document.getElementById('role-captain').innerHTML = optHtml;
    document.getElementById('role-vc').innerHTML = optHtml;
    document.getElementById('role-wk').innerHTML = optHtml;

    // Pre-fill from WK role
    const wkPlayer = playerIds.find(async pid => {
      const p = App._playerMap[pid];
      return p?.role === 'wk';
    });
    // Simple check from cached playerMap
    for (const pid of playerIds) {
      const p = App._playerMap[pid];
      if (p?.role === 'wk') {
        document.getElementById('role-wk').value = pid;
        break;
      }
    }

    modal.classList.remove('hidden');
  },

  confirmRoleAssign() {
    const num = Match._pendingRoleTeamNum;
    const captain = document.getElementById('role-captain').value;
    const vc = document.getElementById('role-vc').value;
    const wk = document.getElementById('role-wk').value;

    Match._matchData[`team${num}Captain`] = captain ? Number(captain) : null;
    Match._matchData[`team${num}VC`] = vc ? Number(vc) : null;
    Match._matchData[`team${num}WK`] = wk ? Number(wk) : null;

    document.getElementById('role-assign-modal').classList.add('hidden');
    Utils.toast(captain || vc || wk ? 'Roles assigned!' : 'Roles skipped');
  },

  skipRoleAssign() {
    document.getElementById('role-assign-modal').classList.add('hidden');
  },

  closePlayingXI() {
    document.getElementById('playing-xi-modal').classList.add('hidden');
  },

  _assignTeam(teamId, teamName, playerIds) {
    const num = Match._teamBuilderFor;
    Match._matchData[`team${num}Id`] = teamId;
    Match._matchData[`team${num}Name`] = teamName;
    Match._matchData[`team${num}XI`] = playerIds;

    // Update UI
    document.getElementById(`team${num}-selector`).style.display = 'none';
    const infoEl = document.getElementById(`team${num}-info`);
    infoEl.style.display = 'block';
    infoEl.innerHTML = `
      <h4>${teamName}</h4>
      <div class="player-list-mini">${playerIds.length} players selected</div>
      <button class="change-team-btn" onclick="Match.selectTeam(${num})">Change</button>
    `;
  },

  async create() {
    const md = Match._matchData;

    // Determine batting/bowling teams based on toss
    let battingTeamNum, bowlingTeamNum;
    if (md.tossDecision === 'bat') {
      battingTeamNum = md.tossWonBy;
      bowlingTeamNum = md.tossWonBy === 1 ? 2 : 1;
    } else {
      bowlingTeamNum = md.tossWonBy;
      battingTeamNum = md.tossWonBy === 1 ? 2 : 1;
    }

    const battingTeamId = md[`team${battingTeamNum}Id`];
    const bowlingTeamId = md[`team${bowlingTeamNum}Id`];
    const battingXI = md[`team${battingTeamNum}XI`];
    const bowlingXI = md[`team${bowlingTeamNum}XI`];

    // Create match
    const matchId = await DB.addMatch({
      team1Id: md.team1Id, team2Id: md.team2Id,
      overs: md.overs, format: md.format,
      date: md.date, venue: md.venue, ballType: md.ballType,
      tossWonBy: md[`team${md.tossWonBy}Id`],
      tossDecision: md.tossDecision,
      status: 'live',
      team1XI: md.team1XI, team2XI: md.team2XI,
      battingFirst: battingTeamId, bowlingFirst: bowlingTeamId,
      isGully: md.isGully || false,
      result: '',
      team1Captain: md.team1Captain || null,
      team1VC: md.team1VC || null,
      team1WK: md.team1WK || null,
      team2Captain: md.team2Captain || null,
      team2VC: md.team2VC || null,
      team2WK: md.team2WK || null
    });

    // Create first innings
    const inningsId = await DB.addInnings({
      matchId, battingTeamId: battingTeamId, bowlingTeamId: bowlingTeamId,
      inningsNumber: 1, totalRuns: 0, totalWickets: 0,
      totalOvers: '0.0', totalBalls: 0,
      extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0, penalty: 0 },
      isCompleted: false, battingXI: battingXI, bowlingXI: bowlingXI
    });

    Utils.toast('Match started!');
    await App.checkLiveMatch();

    // Launch scoring
    await Scoring.startMatch(matchId, inningsId);
  },

  async resumeLive() {
    const match = await DB.getLiveMatch();
    if (!match) { Utils.toast('No live match found'); return; }
    await Scoring.resumeMatch(match.id);
  }
};
