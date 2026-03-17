// SuperCrick Pro - App Controller
const App = {
  currentScreen: 'home',
  screenHistory: [],
  _playerMap: {},
  _appMode: 'offline',

  async init() {
    // Check if mode already selected
    const savedMode = localStorage.getItem('sc_mode');
    if (savedMode) {
      App._appMode = savedMode;
      document.getElementById('mode-selector').classList.add('hidden');
      document.getElementById('splash-screen').style.display = 'flex';
      await App._startApp();
    }
    // else: mode-selector is shown, waiting for user choice
  },

  selectMode(mode, el) {
    App._appMode = mode;
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  },

  async confirmMode() {
    localStorage.setItem('sc_mode', App._appMode);
    document.getElementById('mode-selector').classList.add('hidden');
    document.getElementById('splash-screen').style.display = 'flex';
    await App._startApp();
  },

  async _startApp() {
    // Set today's date as default
    const dateInput = document.getElementById('match-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Load player map for quick lookups
    await App.refreshPlayerMap();

    // Load home screen data
    await App.loadHome();

    // Check for live match
    await App.checkLiveMatch();

    // Hide splash, show app
    setTimeout(() => {
      document.getElementById('splash-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
    }, 1200);

    // Handle back button
    window.addEventListener('popstate', () => App.goBack());
  },

  // Coin Toss
  flipCoin() {
    const coin = document.getElementById('toss-coin');
    const resultEl = document.getElementById('toss-result');
    const btn = document.getElementById('toss-btn');

    btn.disabled = true;
    resultEl.textContent = '';
    coin.classList.remove('flipping');

    // Truly random: use crypto if available
    let rand;
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      rand = arr[0] / (0xFFFFFFFF + 1);
    } else {
      rand = Math.random();
    }

    const isHeads = rand < 0.5;
    // Random number of full rotations (5-10) + half if tails
    const fullRotations = Math.floor(Math.random() * 6 + 5);
    const endDeg = fullRotations * 360 + (isHeads ? 0 : 180);

    coin.style.setProperty('--flip-end', endDeg + 'deg');

    // Force reflow then animate
    void coin.offsetWidth;
    coin.classList.add('flipping');

    setTimeout(() => {
      resultEl.textContent = isHeads ? 'HEADS!' : 'TAILS!';
      resultEl.style.color = isHeads ? '#ffd700' : '#c0c0c0';
      btn.disabled = false;
    }, 1600);
  },

  async refreshPlayerMap() {
    const players = await DB.getAllPlayers();
    App._playerMap = {};
    players.forEach(p => App._playerMap[p.id] = p);
  },

  navigate(screen, params = {}) {
    if (screen === App.currentScreen && !params.force) return;

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Show target screen
    const el = document.getElementById(`screen-${screen}`);
    if (el) {
      el.classList.add('active');
      App.screenHistory.push(App.currentScreen);
      App.currentScreen = screen;
      history.pushState({ screen }, '', `#${screen}`);
    }

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.screen === screen);
    });

    // Update top bar
    const titles = {
      home: 'SuperCrick Pro', matches: 'Matches', players: 'Players',
      stats: 'Statistics', settings: 'More', search: 'Search',
      'new-match': 'New Match', scoring: 'Live Scoring',
      scorecard: 'Scorecard', field: 'Field Positions',
      'player-profile': 'Player Profile', 'match-detail': 'Match Details'
    };
    const title = titles[screen] || 'SuperCrick Pro';
    document.getElementById('page-title').innerHTML = screen === 'home'
      ? 'SuperCrick Pro <span class="author-badge" id="top-author-badge"><span class="material-icons-round">verified</span>Sai Kiran</span>'
      : title;

    const backBtn = document.getElementById('btn-back');
    const mainScreens = ['home', 'matches', 'players', 'stats', 'settings'];
    backBtn.classList.toggle('hidden', mainScreens.includes(screen));

    // Show/hide bottom nav on scoring screen
    const bottomNav = document.getElementById('bottom-nav');
    const hideNavScreens = ['scoring', 'new-match', 'field'];
    bottomNav.style.display = hideNavScreens.includes(screen) ? 'none' : 'flex';

    // Screen-specific init
    App.onScreenEnter(screen, params);
  },

  async onScreenEnter(screen, params) {
    switch (screen) {
      case 'home': await App.loadHome(); break;
      case 'matches': await App.loadMatches(); break;
      case 'players': await PlayerMgr.loadPlayers(); break;
      case 'stats': await Stats.init(); break;
      case 'search': document.getElementById('global-search-input')?.focus(); break;
      case 'scorecard':
        if (params.matchId) await Scorecard.render(params.matchId);
        break;
      case 'match-detail':
        if (params.matchId) await App.loadMatchDetail(params.matchId);
        break;
      case 'player-profile':
        if (params.playerId) await PlayerMgr.loadProfile(params.playerId);
        break;
      case 'field': FieldPos.init(); break;
    }
  },

  goBack() {
    if (App.screenHistory.length > 0) {
      const prev = App.screenHistory.pop();
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById(`screen-${prev}`)?.classList.add('active');
      App.currentScreen = prev;

      document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.screen === prev);
      });

      const mainScreens = ['home', 'matches', 'players', 'stats', 'settings'];
      document.getElementById('btn-back').classList.toggle('hidden', mainScreens.includes(prev));
      document.getElementById('bottom-nav').style.display =
        ['scoring', 'new-match', 'field'].includes(prev) ? 'none' : 'flex';

      const titles = {
        home: 'SuperCrick Pro', matches: 'Matches', players: 'Players',
        stats: 'Statistics', settings: 'More', search: 'Search'
      };
      const title = titles[prev] || 'SuperCrick Pro';
      document.getElementById('page-title').innerHTML = prev === 'home'
        ? 'SuperCrick Pro <span class="author-badge"><span class="material-icons-round">verified</span>Sai Kiran</span>'
        : title;
    }
  },

  async loadHome() {
    const matches = await DB.getAllMatches();
    const recent = matches.slice(0, 5);
    const container = document.getElementById('recent-matches');

    if (recent.length === 0) {
      container.innerHTML = `<div class="empty-state"><span class="material-icons-round">sports_cricket</span><p>No matches yet. Start your first match!</p></div>`;
      return;
    }

    container.innerHTML = '';
    for (const m of recent) {
      container.innerHTML += await App.renderMatchCard(m);
    }
  },

  async checkLiveMatch() {
    const live = await DB.getLiveMatch();
    const btn = document.getElementById('btn-resume-match');
    if (live) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }
  },

  async renderMatchCard(m) {
    const team1 = await DB.getTeam(m.team1Id);
    const team2 = await DB.getTeam(m.team2Id);
    const innings = await DB.getMatchInnings(m.id);

    const t1Name = team1?.name || 'Team 1';
    const t2Name = team2?.name || 'Team 2';
    let t1Score = '', t2Score = '';

    if (innings[0]) {
      t1Score = `${innings[0].totalRuns || 0}/${innings[0].totalWickets || 0}`;
      if (innings[0].totalOvers !== undefined) t1Score += ` (${innings[0].totalOvers})`;
    }
    if (innings[1]) {
      t2Score = `${innings[1].totalRuns || 0}/${innings[1].totalWickets || 0}`;
      if (innings[1].totalOvers !== undefined) t2Score += ` (${innings[1].totalOvers})`;
    }

    const statusHtml = m.status === 'live'
      ? '<span class="match-status-live">● LIVE</span>'
      : `<span class="match-date">${Utils.formatDateShort(m.date)}</span>`;

    return `
      <div class="match-card" onclick="App.openMatch(${m.id})">
        <div class="match-card-header">
          <span class="match-format">${m.format || 'T20'}</span>
          ${statusHtml}
        </div>
        <div class="match-card-teams">
          <div class="match-team-row">
            <span class="match-team-name">${t1Name}</span>
            <span class="match-team-score">${t1Score}</span>
          </div>
          <div class="match-team-row">
            <span class="match-team-name">${t2Name}</span>
            <span class="match-team-score">${t2Score}</span>
          </div>
        </div>
        ${m.result ? `<div class="match-result">${m.result}</div>` : ''}
        ${m.venue ? `<div class="match-venue">${m.venue}</div>` : ''}
      </div>
    `;
  },

  async loadMatches(filter = 'all') {
    let matches;
    if (filter === 'all') {
      matches = await DB.getAllMatches();
    } else {
      matches = await DB.getMatchesByStatus(filter);
    }

    const container = document.getElementById('matches-list');
    if (matches.length === 0) {
      container.innerHTML = `<div class="empty-state"><span class="material-icons-round">sports_cricket</span><p>No ${filter} matches found</p></div>`;
      return;
    }

    container.innerHTML = '';
    for (const m of matches) {
      container.innerHTML += await App.renderMatchCard(m);
    }

    // Filter chip handlers
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        App.loadMatches(chip.dataset.filter);
      };
    });
  },

  async openMatch(matchId) {
    const match = await DB.getMatch(matchId);
    if (!match) return;

    if (match.status === 'live') {
      await Scoring.resumeMatch(matchId);
    } else {
      App.navigate('match-detail', { matchId });
    }
  },

  async loadMatchDetail(matchId) {
    const match = await DB.getMatch(matchId);
    if (!match) return;

    const team1 = await DB.getTeam(match.team1Id);
    const team2 = await DB.getTeam(match.team2Id);
    const container = document.getElementById('match-detail-content');

    container.innerHTML = `
      <div class="match-detail-header">
        <div class="md-format">${match.format || 'T20'} Match</div>
        <div class="md-teams">${team1?.name || 'Team 1'} vs ${team2?.name || 'Team 2'}</div>
        <div class="md-venue">${match.venue || ''} • ${Utils.formatDate(match.date)}</div>
        ${match.result ? `<div class="md-result">${match.result}</div>` : ''}
      </div>
      <div class="match-detail-actions">
        <button class="btn-primary" onclick="App.navigate('scorecard',{matchId:${matchId}})">
          <span class="material-icons-round">table_chart</span> Full Scorecard
        </button>
        <button class="btn-secondary" onclick="ExportDoc.exportScorecard(${matchId})">
          <span class="material-icons-round">description</span> Export
        </button>
      </div>
      <div id="match-detail-scorecard"></div>
    `;

    await Scorecard.renderMini(matchId, document.getElementById('match-detail-scorecard'));
  },

  showMenu() {
    document.getElementById('overflow-menu').classList.remove('hidden');
  },
  hideMenu() {
    document.getElementById('overflow-menu').classList.add('hidden');
  },

  showAbout() {
    App.navigate('settings');
  },

  async exportAll() {
    try {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      saveAs(blob, `supercrick-pro-backup-${new Date().toISOString().split('T')[0]}.json`);
      Utils.toast('Backup exported successfully');
    } catch (e) {
      Utils.toast('Export failed: ' + e.message);
    }
  },

  importData() {
    document.getElementById('import-file').click();
  },

  async handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.players && !data.matches) {
        Utils.toast('Invalid backup file');
        return;
      }
      const ok = await Utils.confirm('Import Data', 'This will replace all existing data. Continue?');
      if (!ok) return;
      await DB.importAll(data);
      await App.refreshPlayerMap();
      Utils.toast('Data imported successfully');
      App.navigate('home', { force: true });
    } catch (e) {
      Utils.toast('Import failed: ' + e.message);
    }
    event.target.value = '';
  },

  async clearAllData() {
    const ok = await Utils.confirm('Clear All Data', 'This will permanently delete all matches, players, and teams. This cannot be undone!');
    if (!ok) return;
    await DB.clearAll();
    App._playerMap = {};
    Utils.toast('All data cleared');
    App.navigate('home', { force: true });
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
