// Sai-Crick Pro — Tournament Mode
const Tournament = {
  _wiz: { step: 1, data: {} },
  _viewId: null,
  _viewTab: 'fixtures',

  // ── Wizard ──────────────────────────────────────
  startCreate() {
    Tournament._wiz = {
      step: 1,
      data: {
        name: '', type: 'roundrobin', startDate: new Date().toISOString().split('T')[0],
        dayPref: 'weekends', matchType: 'day', overs: 20, format: 'T20',
        matchesPerDay: 1, teams: [], fixtures: []
      }
    };
    Tournament._renderWizStep(1);
    document.getElementById('screen-tournament-create').classList.add('active');
    document.querySelectorAll('.screen').forEach(s => { if (s.id !== 'screen-tournament-create') s.classList.remove('active'); });
    App.currentScreen = 'tournament-create';
    document.getElementById('page-title').textContent = 'New Tournament';
    document.getElementById('btn-back').classList.remove('hidden');
    document.getElementById('bottom-nav').style.display = 'none';
  },

  _renderWizStep(step) {
    Tournament._wiz.step = step;
    document.querySelectorAll('.tw-step').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`tw-step-${step}`);
    if (el) el.classList.add('active');
    document.querySelectorAll('.tw-indicator .step').forEach(s => {
      const n = Number(s.dataset.step);
      s.classList.toggle('active', n === step);
      s.classList.toggle('done', n < step);
    });
  },

  wizNext() {
    const d = Tournament._wiz.data;
    const step = Tournament._wiz.step;

    if (step === 1) {
      d.name = document.getElementById('tw-name').value.trim();
      if (!d.name) { Utils.toast('Enter tournament name'); return; }
      d.type = document.querySelector('.tw-type-btn.active')?.dataset.type || 'roundrobin';
      d.format = document.getElementById('tw-format').value;
      d.overs = Number(document.getElementById('tw-overs').value) || 20;
      Tournament._renderWizStep(2);
    } else if (step === 2) {
      if (d.teams.length < 2) { Utils.toast('Add at least 2 teams'); return; }
      d.startDate = document.getElementById('tw-start-date').value;
      d.dayPref = document.getElementById('tw-day-pref').value;
      d.matchType = document.getElementById('tw-match-type').value;
      d.matchesPerDay = Number(document.getElementById('tw-per-day').value) || 1;
      // Generate fixtures
      d.fixtures = Tournament._generateFixtures(d);
      Tournament._renderFixturePreview(d.fixtures, d.teams);
      Tournament._renderWizStep(3);
    }
  },

  wizBack() {
    if (Tournament._wiz.step > 1) Tournament._renderWizStep(Tournament._wiz.step - 1);
    else App.navigate('tournaments');
  },

  setType(type, el) {
    document.querySelectorAll('.tw-type-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    Tournament._wiz.data.type = type;
    Tournament._updateRecommendation();
  },

  _updateRecommendation() {
    const n = Tournament._wiz.data.teams.length;
    const type = Tournament._wiz.data.type;
    const rec = document.getElementById('tw-recommendation');
    if (!rec) return;
    if (n < 2) { rec.textContent = ''; return; }
    const totalMatches = type === 'roundrobin' ? n*(n-1)/2 : type === 'knockout' ? n-1 : Math.ceil(n*(n-1)/2);
    rec.textContent = `${n} teams → ${totalMatches} matches recommended`;
  },

  addTeamToWiz() {
    const nameEl = document.getElementById('tw-team-name');
    const name = nameEl.value.trim();
    if (!name) { Utils.toast('Enter team name'); return; }
    if (Tournament._wiz.data.teams.find(t => t.name.toLowerCase() === name.toLowerCase())) {
      Utils.toast('Team already added'); return;
    }
    const id = 'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2,4);
    Tournament._wiz.data.teams.push({ id, name });
    nameEl.value = '';
    Tournament._renderTeamList();
    Tournament._updateRecommendation();
  },

  async addExistingTeamToWiz() {
    const sel = document.getElementById('tw-existing-team-sel');
    const teamId = Number(sel.value);
    if (!teamId) { Utils.toast('Select a team'); return; }
    const team = await DB.getTeam(teamId);
    if (!team) return;
    if (Tournament._wiz.data.teams.find(t => t.id === teamId || t.id === String(teamId))) {
      Utils.toast('Team already added'); return;
    }
    Tournament._wiz.data.teams.push({ id: teamId, name: team.name, existingId: teamId });
    sel.value = '';
    Tournament._renderTeamList();
    Tournament._updateRecommendation();
  },

  removeTeamFromWiz(id) {
    Tournament._wiz.data.teams = Tournament._wiz.data.teams.filter(t => String(t.id) !== String(id));
    Tournament._renderTeamList();
    Tournament._updateRecommendation();
  },

  _renderTeamList() {
    const el = document.getElementById('tw-teams-list');
    const teams = Tournament._wiz.data.teams;
    if (teams.length === 0) {
      el.innerHTML = '<p class="hint-text">No teams added yet</p>';
      return;
    }
    el.innerHTML = teams.map((t, i) => `
      <div class="tw-team-chip">
        <span class="tw-team-num">${i+1}</span>
        <span>${t.name}</span>
        <button class="icon-btn" onclick="Tournament.removeTeamFromWiz('${t.id}')">
          <span class="material-icons-round" style="font-size:16px;color:var(--danger)">close</span>
        </button>
      </div>
    `).join('');
  },

  async _loadExistingTeams() {
    const teams = await DB.getAllTeams();
    const sel = document.getElementById('tw-existing-team-sel');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Pick existing team —</option>' +
      teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  },

  _generateFixtures(data) {
    const { type, teams, startDate, dayPref, matchType, matchesPerDay } = data;
    let rawFixtures = [];

    if (type === 'roundrobin') {
      rawFixtures = Tournament._roundRobin(teams);
    } else if (type === 'knockout') {
      rawFixtures = Tournament._knockout(teams);
    } else if (type === 'groups') {
      rawFixtures = Tournament._groupsKnockout(teams);
    }

    // Schedule dates
    const dates = Tournament._scheduleDates(startDate, rawFixtures.length, dayPref, matchType, matchesPerDay);
    return rawFixtures.map((f, i) => ({
      ...f,
      scheduledDate: dates[i]?.date || startDate,
      scheduledTime: dates[i]?.time || '10:00',
      status: 'pending',
      result: null,
      homeScore: '', awayScore: ''
    }));
  },

  _roundRobin(teams) {
    const t = [...teams];
    if (t.length % 2 !== 0) t.push({ id: 'bye', name: 'BYE' });
    const rounds = t.length - 1;
    const half = t.length / 2;
    const fixtures = [];
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < half; i++) {
        const home = t[i];
        const away = t[t.length - 1 - i];
        if (home.id !== 'bye' && away.id !== 'bye') {
          fixtures.push({ round: r + 1, roundName: `Round ${r+1}`, homeTeamId: home.id, homeTeamName: home.name, awayTeamId: away.id, awayTeamName: away.name });
        }
      }
      t.splice(1, 0, t.pop());
    }
    return fixtures;
  },

  _knockout(teams) {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const fixtures = [];
    let round = 1;
    let current = shuffled;
    while (current.length > 1) {
      const next = [];
      for (let i = 0; i < current.length; i += 2) {
        if (current[i+1]) {
          fixtures.push({ round, roundName: Tournament._knockoutRoundName(current.length), homeTeamId: current[i].id, homeTeamName: current[i].name, awayTeamId: current[i+1].id, awayTeamName: current[i+1].name, isKnockout: true });
          next.push({ id: `tbd_${round}_${i}`, name: `Winner Match ${fixtures.length}` });
        } else {
          next.push(current[i]);
        }
      }
      round++;
      current = next;
    }
    return fixtures;
  },

  _knockoutRoundName(n) {
    if (n <= 2) return 'Final';
    if (n <= 4) return 'Semi-Final';
    if (n <= 8) return 'Quarter-Final';
    return `Round of ${n}`;
  },

  _groupsKnockout(teams) {
    const mid = Math.ceil(teams.length / 2);
    const groupA = teams.slice(0, mid);
    const groupB = teams.slice(mid);
    const groupFixtures = [
      ...Tournament._roundRobin(groupA).map(f => ({...f, group: 'A', roundName: 'Group A - ' + f.roundName})),
      ...Tournament._roundRobin(groupB).map(f => ({...f, group: 'B', roundName: 'Group B - ' + f.roundName}))
    ];
    const sfRound = (groupFixtures[groupFixtures.length-1]?.round || 0) + 1;
    const semis = [
      { round: sfRound, roundName: 'Semi-Final 1', homeTeamId: 'A1', homeTeamName: 'Group A Winner', awayTeamId: 'B2', awayTeamName: 'Group B Runner-up', isKnockout: true },
      { round: sfRound, roundName: 'Semi-Final 2', homeTeamId: 'B1', homeTeamName: 'Group B Winner', awayTeamId: 'A2', awayTeamName: 'Group A Runner-up', isKnockout: true },
    ];
    const fin = { round: sfRound + 1, roundName: 'Final', homeTeamId: 'SF1W', homeTeamName: 'Winner SF1', awayTeamId: 'SF2W', awayTeamName: 'Winner SF2', isKnockout: true };
    return [...groupFixtures, ...semis, fin];
  },

  _scheduleDates(startDate, count, dayPref, matchType, perDay) {
    const dates = [];
    let cur = new Date(startDate);
    const timeMap = { day: '10:00', daynight: '14:00', night: '18:00' };
    const time = timeMap[matchType] || '10:00';

    while (dates.length < count) {
      const day = cur.getDay();
      const isWeekend = day === 0 || day === 6;
      const isSunday = day === 0;
      let include = false;
      if (dayPref === 'weekends' && isWeekend) include = true;
      else if (dayPref === 'weekdays' && !isWeekend && day !== 0) include = true;
      else if (dayPref === 'sundays' && isSunday) include = true;
      else if (dayPref === 'any') include = true;

      if (include) {
        for (let i = 0; i < perDay && dates.length < count; i++) {
          const slotTime = i === 0 ? time : (matchType === 'day' ? '14:00' : '20:00');
          dates.push({ date: cur.toISOString().split('T')[0], time: slotTime });
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  },

  _renderFixturePreview(fixtures, teams) {
    const el = document.getElementById('tw-fixture-preview');
    if (!el) return;
    let html = `<p class="hint-text">${fixtures.length} matches generated. You can adjust dates below.</p>`;
    let lastRound = '';
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];
      if (f.roundName !== lastRound) {
        html += `<div class="tw-round-header">${f.roundName}</div>`;
        lastRound = f.roundName;
      }
      html += `
        <div class="tw-fixture-row">
          <span class="tw-fixture-teams">${f.homeTeamName} vs ${f.awayTeamName}</span>
          <div class="tw-fixture-meta">
            <input type="date" value="${f.scheduledDate}" onchange="Tournament._updateFixtureDate(${i}, this.value)">
            <input type="time" value="${f.scheduledTime}" onchange="Tournament._updateFixtureTime(${i}, this.value)">
          </div>
        </div>
      `;
    }
    el.innerHTML = html;
  },

  _updateFixtureDate(idx, val) { if (Tournament._wiz.data.fixtures[idx]) Tournament._wiz.data.fixtures[idx].scheduledDate = val; },
  _updateFixtureTime(idx, val) { if (Tournament._wiz.data.fixtures[idx]) Tournament._wiz.data.fixtures[idx].scheduledTime = val; },

  async confirmCreate() {
    const d = Tournament._wiz.data;
    if (!d.name) { Utils.toast('Tournament name required'); return; }

    const tid = await DB.addTournament({
      name: d.name, type: d.type, format: d.format, overs: d.overs,
      startDate: d.startDate, dayPref: d.dayPref, matchType: d.matchType,
      status: 'active', teams: d.teams, teamsCount: d.teams.length
    });

    for (const team of d.teams) {
      await DB.addTournamentTeam({ tournamentId: tid, teamId: team.id, teamName: team.name, existingId: team.existingId || null });
    }

    for (const f of d.fixtures) {
      await DB.addTournamentFixture({ tournamentId: tid, ...f });
    }

    Utils.toast(`Tournament "${d.name}" created!`);
    await Tournament.loadDetail(tid);
  },

  // ── List ────────────────────────────────────────
  async loadList() {
    const tournaments = await DB.getAllTournaments();
    const el = document.getElementById('tournament-list');
    if (!el) return;
    if (tournaments.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="material-icons-round">emoji_events</span><p>No tournaments yet. Create your first!</p></div>`;
      return;
    }
    el.innerHTML = tournaments.map(t => `
      <div class="tournament-card" onclick="Tournament.loadDetail(${t.id})">
        <div class="tc-header">
          <span class="tc-type-badge">${Tournament._typeLabel(t.type)}</span>
          <span class="tc-status ${t.status}">${t.status === 'active' ? '● Active' : t.status === 'completed' ? '✓ Completed' : 'Upcoming'}</span>
        </div>
        <div class="tc-name">${t.name}</div>
        <div class="tc-meta">${t.format || 'T20'} · ${t.teamsCount || 0} teams · ${t.startDate || ''}</div>
        <div class="tc-actions">
          <button class="btn-small-action" onclick="event.stopPropagation();Tournament.exportPDF(${t.id},'pre')">📄 PDF</button>
          <button class="btn-small-action danger" onclick="event.stopPropagation();Tournament.deleteTournament(${t.id})">🗑 Delete</button>
        </div>
      </div>
    `).join('');
  },

  _typeLabel(type) {
    return { roundrobin: 'Round Robin', knockout: 'Knockout', groups: 'Groups+KO' }[type] || type;
  },

  async deleteTournament(id) {
    const ok = await Utils.confirm('Delete Tournament', 'Delete this tournament and all its data?');
    if (!ok) return;
    await DB.deleteTournament(id);
    Utils.toast('Tournament deleted');
    await Tournament.loadList();
  },

  // ── Detail ──────────────────────────────────────
  async loadDetail(tournamentId) {
    Tournament._viewId = tournamentId;
    const t = await DB.getTournament(tournamentId);
    if (!t) return;

    // Switch screen
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-tournament-detail').classList.add('active');
    App.currentScreen = 'tournament-detail';
    document.getElementById('page-title').textContent = t.name;
    document.getElementById('btn-back').classList.remove('hidden');
    document.getElementById('bottom-nav').style.display = 'none';

    document.getElementById('td-name').textContent = t.name;
    document.getElementById('td-meta').textContent = `${Tournament._typeLabel(t.type)} · ${t.format || 'T20'} · ${t.teamsCount || 0} teams`;

    Tournament.showTab('fixtures');
  },

  async showTab(tab) {
    Tournament._viewTab = tab;
    document.querySelectorAll('.td-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.td-tab-content').forEach(c => c.classList.toggle('active', c.dataset.tab === tab));

    if (tab === 'fixtures') await Tournament._renderFixtures();
    else if (tab === 'standings') await Tournament._renderStandings();
    else if (tab === 'teams') await Tournament._renderTeams();
  },

  async _renderFixtures() {
    const fixtures = await DB.getTournamentFixtures(Tournament._viewId);
    const el = document.getElementById('td-fixtures');
    if (!el) return;
    if (fixtures.length === 0) { el.innerHTML = '<div class="empty-state"><p>No fixtures yet</p></div>'; return; }

    let html = '';
    let lastRound = '';
    for (const f of fixtures) {
      if (f.roundName !== lastRound) {
        html += `<div class="tw-round-header">${f.roundName || 'Round ' + f.round}</div>`;
        lastRound = f.roundName;
      }
      const statusClass = f.status === 'completed' ? 'completed' : f.status === 'live' ? 'live-badge' : '';
      const resultHtml = f.status === 'completed' && f.result
        ? `<div class="tf-result">${f.result}</div>` : '';
      html += `
        <div class="tf-card ${statusClass}">
          <div class="tf-header">
            <span class="tf-date">${f.scheduledDate || ''} ${f.scheduledTime || ''}</span>
            <span class="tf-status">${f.status === 'completed' ? '✓ Done' : f.status === 'live' ? '● Live' : 'Upcoming'}</span>
          </div>
          <div class="tf-teams">
            <span class="tf-team">${f.homeTeamName}</span>
            <span class="tf-vs">vs</span>
            <span class="tf-team">${f.awayTeamName}</span>
          </div>
          ${resultHtml}
          ${f.status !== 'completed' ? `<button class="btn-small-action" onclick="Tournament.recordResult(${f.id})">Record Result</button>` : ''}
        </div>
      `;
    }
    el.innerHTML = html;
  },

  async _renderStandings() {
    const el = document.getElementById('td-standings');
    if (!el) return;
    const tData = await DB.getTournament(Tournament._viewId);
    const fixtures = await DB.getTournamentFixtures(Tournament._viewId);
    const teams = tData.teams || [];

    const table = {};
    for (const team of teams) {
      table[String(team.id)] = { name: team.name, p: 0, w: 0, l: 0, t: 0, pts: 0, nf: 0 };
    }

    for (const f of fixtures) {
      if (f.status !== 'completed') continue;
      const h = String(f.homeTeamId), a = String(f.awayTeamId);
      if (table[h]) table[h].p++;
      if (table[a]) table[a].p++;
      if (f.result === 'home') {
        if (table[h]) { table[h].w++; table[h].pts += 2; }
        if (table[a]) table[a].l++;
      } else if (f.result === 'away') {
        if (table[a]) { table[a].w++; table[a].pts += 2; }
        if (table[h]) table[h].l++;
      } else if (f.result === 'tie') {
        if (table[h]) { table[h].t++; table[h].pts += 1; }
        if (table[a]) { table[a].t++; table[a].pts += 1; }
      } else if (f.result === 'noresult') {
        if (table[h]) { table[h].nf++; table[h].pts += 1; }
        if (table[a]) { table[a].nf++; table[a].pts += 1; }
      }
    }

    const sorted = Object.values(table).sort((a,b) => b.pts - a.pts || b.w - a.w);
    if (sorted.length === 0) { el.innerHTML = '<div class="empty-state"><p>No results recorded yet</p></div>'; return; }

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table class="sc-table standings-table">
          <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>Pts</th></tr>
          ${sorted.map((s,i) => `
            <tr class="${i===0?'standings-top':''}">
              <td>${i+1}</td>
              <td style="text-align:left;font-weight:600">${s.name}</td>
              <td>${s.p}</td>
              <td style="color:var(--accent);font-weight:700">${s.w}</td>
              <td style="color:var(--danger)">${s.l}</td>
              <td>${s.t}</td>
              <td style="font-weight:800;color:var(--primary)">${s.pts}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  },

  async _renderTeams() {
    const el = document.getElementById('td-teams');
    if (!el) return;
    const tData = await DB.getTournament(Tournament._viewId);
    const teams = tData.teams || [];
    el.innerHTML = teams.map((t,i) => `
      <div class="tw-team-chip" style="margin-bottom:8px">
        <span class="tw-team-num">${i+1}</span>
        <span style="font-weight:600">${t.name}</span>
      </div>
    `).join('');
  },

  async recordResult(fixtureId) {
    const fixtures = await DB.getTournamentFixtures(Tournament._viewId);
    const f = fixtures.find(x => x.id === fixtureId);
    if (!f) return;

    const modal = document.getElementById('record-result-modal');
    document.getElementById('rr-match-label').textContent = `${f.homeTeamName} vs ${f.awayTeamName}`;
    document.getElementById('rr-fixture-id').value = fixtureId;
    document.getElementById('rr-home-name').textContent = f.homeTeamName;
    document.getElementById('rr-away-name').textContent = f.awayTeamName;
    document.getElementById('rr-home-score').value = f.homeScore || '';
    document.getElementById('rr-away-score').value = f.awayScore || '';
    document.getElementById('rr-result-desc').value = f.result_desc || '';

    // Pre-select result
    document.querySelectorAll('.rr-result-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.result === (f.result || ''));
    });
    Tournament._rrResult = f.result || '';
    modal.classList.remove('hidden');
  },

  _rrResult: '',
  setRRResult(result, el) {
    document.querySelectorAll('.rr-result-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    Tournament._rrResult = result;
  },

  async confirmResult() {
    const fixtureId = Number(document.getElementById('rr-fixture-id').value);
    const homeScore = document.getElementById('rr-home-score').value;
    const awayScore = document.getElementById('rr-away-score').value;
    const desc = document.getElementById('rr-result-desc').value;

    if (!Tournament._rrResult) { Utils.toast('Select match result'); return; }

    await DB.updateTournamentFixture(fixtureId, {
      status: 'completed',
      result: Tournament._rrResult,
      homeScore, awayScore,
      result_desc: desc
    });

    document.getElementById('record-result-modal').classList.add('hidden');
    Utils.toast('Result recorded!');
    await Tournament._renderFixtures();
    if (Tournament._viewTab === 'standings') await Tournament._renderStandings();
  },

  closeResultModal() {
    document.getElementById('record-result-modal').classList.add('hidden');
  },

  // ── PDF Export ──────────────────────────────────
  async exportPDF(tournamentId, type) {
    const t = await DB.getTournament(tournamentId || Tournament._viewId);
    if (!t) return;
    const fixtures = await DB.getTournamentFixtures(tournamentId || Tournament._viewId);

    let jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDF) { Utils.toast('PDF library not ready. Be online for first load.'); return; }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const purple = [108, 92, 231], white = [255,255,255], gray = [120,120,140], gold = [255,193,7];
    let y = 0;

    // Header
    doc.setFillColor(...purple);
    doc.rect(0, 0, W, 32, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('SAI-CRICK PRO', W/2, 10, {align:'center'});
    doc.setFontSize(11);
    doc.text('TOURNAMENT ' + (type === 'post' ? 'RESULTS' : 'SCHEDULE'), W/2, 18, {align:'center'});
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('by D. Sai Kiran Varma', W/2, 25, {align:'center'});
    y = 40;

    // Tournament info
    doc.setTextColor(30,30,50);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(t.name, W/2, y, {align:'center'}); y += 8;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    doc.text(`${Tournament._typeLabel(t.type)}  •  ${t.format || 'T20'}  •  Started: ${t.startDate || 'N/A'}`, W/2, y, {align:'center'}); y += 6;

    // Teams
    doc.setTextColor(30,30,50);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Participating Teams', 12, y); y += 5;
    const teams = t.teams || [];
    doc.autoTable({
      startY: y,
      head: [['#', 'Team Name']],
      body: teams.map((tm, i) => [i+1, tm.name]),
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: purple, textColor: white },
      margin: { left: 12, right: 12 }
    });
    y = doc.lastAutoTable.finalY + 8;

    // Fixtures / Results
    const grouped = {};
    for (const f of fixtures) {
      const rn = f.roundName || `Round ${f.round}`;
      if (!grouped[rn]) grouped[rn] = [];
      grouped[rn].push(f);
    }

    for (const [roundName, rFixtures] of Object.entries(grouped)) {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.setFillColor(...purple); doc.rect(12, y, W-24, 7, 'F');
      doc.setTextColor(...white);
      doc.text(roundName, W/2, y+5, {align:'center'}); y += 10;

      doc.autoTable({
        startY: y,
        head: type === 'post'
          ? [['Home', 'Score', 'Result', 'Score', 'Away', 'Date']]
          : [['Home Team', 'Away Team', 'Date', 'Time']],
        body: rFixtures.map(f => type === 'post'
          ? [f.homeTeamName, f.homeScore||'-', f.result_desc||Tournament._resultText(f.result, f.homeTeamName, f.awayTeamName), f.awayScore||'-', f.awayTeamName, f.scheduledDate||'']
          : [f.homeTeamName, f.awayTeamName, f.scheduledDate||'TBD', f.scheduledTime||'']),
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [40,40,70], textColor: white },
        margin: { left: 12, right: 12 }
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    // Post-tournament standings
    if (type === 'post') {
      if (y > 200) { doc.addPage(); y = 15; }
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30,30,50);
      doc.text('Final Standings', 12, y); y += 4;
      const standingsEl = document.getElementById('td-standings');
      // Recalculate standings
      const standingsData = Tournament._calcStandingsData(teams, fixtures);
      doc.autoTable({
        startY: y,
        head: [['#', 'Team', 'P', 'W', 'L', 'T', 'Pts']],
        body: standingsData.map((s,i) => [i+1, s.name, s.p, s.w, s.l, s.t, s.pts]),
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: purple, textColor: white },
        margin: { left: 12, right: 12 }
      });
      y = doc.lastAutoTable.finalY + 8;

      // Winner
      if (standingsData[0]) {
        doc.setFillColor(...gold); doc.rect(20, y, W-40, 14, 'F');
        doc.setTextColor(30,30,50);
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text(`🏆 Champion: ${standingsData[0].name}`, W/2, y+9, {align:'center'});
        y += 18;
      }
    }

    // Footer
    const pc = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pc; i++) {
      doc.setPage(i);
      doc.setFillColor(...purple);
      doc.rect(0, doc.internal.pageSize.getHeight()-10, W, 10, 'F');
      doc.setTextColor(...white); doc.setFontSize(7); doc.setFont('helvetica', 'italic');
      doc.text('Sai-Crick Pro  •  Made with ❤ by D. Sai Kiran Varma  •  Enjoy Free Cricket!', W/2, doc.internal.pageSize.getHeight()-3.5, {align:'center'});
    }

    const fname = `${t.name.replace(/\s+/g,'_')}_${type==='post'?'Results':'Schedule'}.pdf`;
    doc.save(fname);
    Utils.toast('PDF saved!');
  },

  _resultText(result, home, away) {
    if (result === 'home') return `${home} won`;
    if (result === 'away') return `${away} won`;
    if (result === 'tie') return 'Tie';
    if (result === 'noresult') return 'No Result';
    return '-';
  },

  _calcStandingsData(teams, fixtures) {
    const table = {};
    for (const t of teams) table[String(t.id)] = { name: t.name, p:0, w:0, l:0, t:0, pts:0 };
    for (const f of fixtures) {
      if (f.status !== 'completed') continue;
      const h = String(f.homeTeamId), a = String(f.awayTeamId);
      if (table[h]) table[h].p++;
      if (table[a]) table[a].p++;
      if (f.result === 'home') { if(table[h]){table[h].w++;table[h].pts+=2;} if(table[a])table[a].l++; }
      else if (f.result === 'away') { if(table[a]){table[a].w++;table[a].pts+=2;} if(table[h])table[h].l++; }
      else if (f.result === 'tie') { if(table[h]){table[h].t++;table[h].pts++;} if(table[a]){table[a].t++;table[a].pts++;} }
    }
    return Object.values(table).sort((a,b)=>b.pts-a.pts||b.w-a.w);
  }
};
