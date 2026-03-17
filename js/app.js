// Sai-Crick Pro - App Controller
const App = {
  currentScreen: 'home',
  screenHistory: [],
  _playerMap: {},
  _deferredInstallPrompt: null,

  async init() {
    // Auto-start, no mode selector needed
    document.getElementById('splash-screen').style.display = 'flex';
    await App._startApp();
    // Listen for connectivity changes
    window.addEventListener('online', () => App._updateNetworkBadge(true));
    window.addEventListener('offline', () => App._updateNetworkBadge(false));
    App._updateNetworkBadge(navigator.onLine);

    // Auto-detect modal open/close to lock body scroll
    const obs = new MutationObserver(() => {
      const anyOpen = document.querySelector('.modal:not(.hidden)');
      document.body.classList.toggle('modal-open', !!anyOpen);
    });
    document.querySelectorAll('.modal').forEach(m => {
      obs.observe(m, { attributes: true, attributeFilter: ['class'] });
    });

    // ── Check if already installed as PWA ──
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);

    // ── Install Prompt (Android Chrome) ──
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      App._deferredInstallPrompt = e;
      // Show install banner (uses sessionStorage so it shows each fresh visit)
      if (!sessionStorage.getItem('scp_install_dismissed')) {
        setTimeout(() => App._showInstallBanner('android'), 2000);
      }
    });

    // ── Listen for successful install ──
    window.addEventListener('appinstalled', () => {
      Utils.toast('App installed successfully!');
      App._deferredInstallPrompt = null;
      document.getElementById('install-banner')?.classList.add('hidden');
    });

    // ── iOS Safari: show Add to Home Screen instructions ──
    if (isIOS && !isStandalone && !sessionStorage.getItem('scp_install_dismissed')) {
      setTimeout(() => App._showInstallBanner('ios'), 2500);
    }

    // ── Android: if no beforeinstallprompt fires within 4s, show manual instructions ──
    if (isAndroid && !isStandalone && !sessionStorage.getItem('scp_install_dismissed')) {
      setTimeout(() => {
        if (!App._deferredInstallPrompt) {
          App._showInstallBanner('android-manual');
        }
      }, 4000);
    }
  },

  _showInstallBanner(platform) {
    const banner = document.getElementById('install-banner');
    const hint = document.getElementById('install-banner-hint');
    const btn = document.getElementById('install-banner-btn');
    if (!banner || !hint || !btn) return;

    if (platform === 'ios') {
      hint.innerHTML = 'Tap <b>Share</b> ⎋ → <b>"Add to Home Screen"</b>';
      btn.textContent = 'Got it';
      btn.onclick = () => App.dismissInstall();
    } else if (platform === 'android-manual') {
      hint.innerHTML = 'Tap <b>⋮ Menu</b> → <b>"Add to Home screen"</b> or <b>"Install app"</b>';
      btn.textContent = 'Got it';
      btn.onclick = () => App.dismissInstall();
    } else {
      hint.textContent = 'Add to home screen for the best experience!';
      btn.textContent = 'Install';
      btn.onclick = () => App.installApp();
    }
    banner.classList.remove('hidden');
  },

  async installApp() {
    const banner = document.getElementById('install-banner');
    if (App._deferredInstallPrompt) {
      App._deferredInstallPrompt.prompt();
      const result = await App._deferredInstallPrompt.userChoice;
      if (result.outcome === 'accepted') {
        Utils.toast('App installed! Find it on your home screen');
      }
      App._deferredInstallPrompt = null;
    }
    banner.classList.add('hidden');
  },

  dismissInstall() {
    document.getElementById('install-banner')?.classList.add('hidden');
    sessionStorage.setItem('scp_install_dismissed', '1');
  },

  _updateNetworkBadge(isOnline) {
    const badge = document.getElementById('network-badge');
    if (!badge) return;
    badge.textContent = isOnline ? '● Online' : '● Offline';
    badge.style.color = isOnline ? '#00e676' : '#ff7675';
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
      home: 'Sai-Crick Pro', matches: 'Matches', players: 'Players',
      stats: 'Statistics', settings: 'More', search: 'Search',
      'new-match': 'New Match', scoring: 'Live Scoring',
      scorecard: 'Scorecard', field: 'Field Positions',
      'player-profile': 'Player Profile', 'match-detail': 'Match Details',
      tournaments: '🏆 Tournaments', 'tournament-create': 'New Tournament',
      'tournament-detail': 'Tournament'
    };
    const title = titles[screen] || 'Sai-Crick Pro';
    document.getElementById('page-title').innerHTML = screen === 'home'
      ? 'Sai-Crick Pro <span class="author-badge" id="top-author-badge"><span class="material-icons-round">verified</span>Sai Kiran</span>'
      : title;

    const backBtn = document.getElementById('btn-back');
    const mainScreens = ['home', 'matches', 'players', 'stats', 'settings', 'tournaments'];
    backBtn.classList.toggle('hidden', mainScreens.includes(screen));

    // Show/hide bottom nav on scoring screen
    const bottomNav = document.getElementById('bottom-nav');
    const hideNavScreens = ['scoring', 'new-match', 'field', 'tournament-create', 'tournament-detail'];
    bottomNav.style.display = hideNavScreens.includes(screen) ? 'none' : 'flex';

    // Screen-specific init
    App.onScreenEnter(screen, params);
  },

  async onScreenEnter(screen, params) {
    switch (screen) {
      case 'home': await App.loadHome(); break;
      case 'settings': App._initSettings(); break;
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
      case 'tournaments':
        Tournament.loadList();
        Tournament._loadExistingTeams();
        break;
    }
  },

  _initSettings() {
    // Update network badge in settings
    const badge = document.getElementById('settings-online-badge');
    if (badge) {
      badge.textContent = navigator.onLine ? '● Online' : '● Offline';
      badge.style.color = navigator.onLine ? '#00e676' : '#ff7675';
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

      const mainScreens = ['home', 'matches', 'players', 'stats', 'settings', 'tournaments'];
      document.getElementById('btn-back').classList.toggle('hidden', mainScreens.includes(prev));
      document.getElementById('bottom-nav').style.display =
        ['scoring', 'new-match', 'field', 'tournament-create', 'tournament-detail'].includes(prev) ? 'none' : 'flex';

      const titles = {
        home: 'Sai-Crick Pro', matches: 'Matches', players: 'Players',
        stats: 'Statistics', settings: 'More', search: 'Search'
      };
      const title = titles[prev] || 'Sai-Crick Pro';
      document.getElementById('page-title').innerHTML = prev === 'home'
        ? 'Sai-Crick Pro <span class="author-badge"><span class="material-icons-round">verified</span>Sai Kiran</span>'
        : title;
    }
  },

  async loadHome() {
    App.loadWeather(); // non-blocking
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
      <div class="match-card" onclick="App.openMatch(${m.id})" oncontextmenu="App.matchLongPress(event,${m.id})">
        <div class="match-card-header">
          <span class="match-format">${m.format || 'T20'}</span>
          ${statusHtml}
          <button class="match-more-btn icon-btn" onclick="event.stopPropagation();App.showMatchOptions(${m.id})" style="margin-left:auto">
            <span class="material-icons-round" style="font-size:18px">more_vert</span>
          </button>
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

  matchLongPress(event, matchId) {
    event.preventDefault();
    App.showMatchOptions(matchId);
  },

  async showMatchOptions(matchId) {
    const ok = await Utils.confirm('Match Options', 'Delete this match and all its data?');
    if (ok) await App.deleteMatch(matchId);
  },

  async deleteMatch(matchId) {
    try {
      // Delete all balls and innings for this match
      const innings = await DB.getMatchInnings(matchId);
      for (const inn of innings) {
        const balls = await DB.getInningsBalls(inn.id);
        for (const b of balls) await DB.deleteBall(b.id);
        await db.innings.delete(inn.id);
      }
      await db.matches.delete(matchId);
      Utils.toast('Match deleted');
      await App.loadHome();
      await App.loadMatches();
      await App.checkLiveMatch();
    } catch(e) {
      Utils.toast('Delete failed: ' + e.message);
    }
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
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supercrick-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  switchMode(isOnline) {
    // Not used - mode is auto-detected
    Utils.toast(isOnline ? 'Switched to Online mode' : 'Switched to Offline mode');
  },

  async clearAllData() {
    const ok = await Utils.confirm('Clear All Data', 'This will permanently delete all matches, players, and teams. This cannot be undone!');
    if (!ok) return;
    await DB.clearAll();
    App._playerMap = {};
    Utils.toast('All data cleared');
    App.navigate('home', { force: true });
  },

  // Weather
  _weatherForecastData: null,
  _weatherPlaceName: '',

  async loadWeather() {
    const el = document.getElementById('weather-widget');
    if (!el) return;
    if (!navigator.geolocation) {
      el.innerHTML = '<div class="weather-na"><span class="material-icons-round">location_off</span> Location not available</div>';
      return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        // Fetch current + hourly forecast
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,weathercode,precipitation_probability,relativehumidity_2m&hourly=temperature_2m,weathercode,precipitation_probability&timezone=auto&forecast_days=2`;
        const res = await fetch(url);
        const data = await res.json();
        App._weatherForecastData = data.hourly || null;
        // Reverse geocode for place name
        App._weatherPlaceName = '';
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`);
          const geoData = await geoRes.json();
          App._weatherPlaceName = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.county || geoData.display_name?.split(',')[0] || '';
        } catch(ge) {}
        App._renderWeather(data.current, lat, lon);
      } catch(e) {
        el.innerHTML = '<div class="weather-na"><span class="material-icons-round">cloud_off</span> Weather unavailable</div>';
      }
    }, () => {
      el.innerHTML = '<div class="weather-na"><span class="material-icons-round">location_off</span> Allow location for weather</div>';
    });
  },

  async refreshWeather() {
    const el = document.getElementById('weather-widget');
    if (el) el.innerHTML = '<div class="weather-loading"><span class="material-icons-round">wb_sunny</span><span>Fetching weather...</span></div>';
    await App.loadWeather();
    Utils.toast('Weather refreshed');
  },

  _getWeatherIcon(code) {
    if (code >= 95) return '⛈️';
    if (code >= 80) return '🌧️';
    if (code >= 61) return '🌧️';
    if (code >= 51) return '🌦️';
    if (code >= 45) return '🌫️';
    if (code >= 3) return '⛅';
    if (code >= 1) return '🌤️';
    return '☀️';
  },

  _getWeatherCond(code) {
    if (code >= 95) return 'Thunderstorm';
    if (code >= 80) return 'Heavy Rain';
    if (code >= 61) return 'Rain';
    if (code >= 51) return 'Drizzle';
    if (code >= 45) return 'Foggy';
    if (code >= 3) return 'Cloudy';
    if (code >= 1) return 'Partly Cloudy';
    return 'Clear';
  },

  toggleForecast() {
    const panel = document.getElementById('weather-forecast-panel');
    if (panel) panel.classList.toggle('open');
  },

  _renderWeather(cur, lat, lon) {
    const el = document.getElementById('weather-widget');
    if (!el) return;
    const code = cur.weathercode || 0;
    const temp = Math.round(cur.temperature_2m || 0);
    const wind = Math.round(cur.windspeed_10m || 0);
    const rain = cur.precipitation_probability || 0;
    const hum = cur.relativehumidity_2m || 0;

    const icon = App._getWeatherIcon(code);
    const cond = App._getWeatherCond(code);

    let cricketMsg, cricketClass;
    if (rain >= 60 || code >= 61) {
      cricketMsg = '🚫 Rain likely — Match may be affected'; cricketClass = 'weather-bad';
    } else if (wind >= 35) {
      cricketMsg = '💨 Strong wind — Tough bowling conditions'; cricketClass = 'weather-warn';
    } else if (code <= 2 && wind < 20 && rain < 20) {
      cricketMsg = '✅ Perfect for cricket!'; cricketClass = 'weather-good';
    } else {
      cricketMsg = '🏏 Playable conditions'; cricketClass = 'weather-ok';
    }

    // Build 24h forecast HTML
    let forecastHtml = '';
    if (App._weatherForecastData && App._weatherForecastData.time) {
      const now = new Date();
      const nowHour = now.getHours();
      const hourly = App._weatherForecastData;
      let cards = '';
      let count = 0;
      for (let i = 0; i < hourly.time.length && count < 24; i++) {
        const hDate = new Date(hourly.time[i]);
        if (hDate <= now) continue;
        const hIcon = App._getWeatherIcon(hourly.weathercode[i] || 0);
        const hTemp = Math.round(hourly.temperature_2m[i] || 0);
        const hRain = hourly.precipitation_probability?.[i] || 0;
        const hTime = hDate.getHours();
        const timeStr = hTime === 0 ? '12 AM' : hTime < 12 ? `${hTime} AM` : hTime === 12 ? '12 PM' : `${hTime-12} PM`;
        cards += `<div class="weather-hour-card">
          <div class="weather-hour-time">${timeStr}</div>
          <div class="weather-hour-icon">${hIcon}</div>
          <div class="weather-hour-temp">${hTemp}°</div>
          ${hRain > 0 ? `<div class="weather-hour-rain">${hRain}%💧</div>` : ''}
        </div>`;
        count++;
      }
      forecastHtml = `<div id="weather-forecast-panel" class="weather-forecast">
        <div class="weather-forecast-title">Next 24 Hours</div>
        <div class="weather-forecast-scroll">${cards}</div>
      </div>`;
    }

    const placeHtml = App._weatherPlaceName
      ? `<div class="weather-place"><span class="material-icons-round">location_on</span>${App._weatherPlaceName}</div>`
      : '';

    el.innerHTML = `
      <div class="weather-card" onclick="App.toggleForecast()">
        ${placeHtml}
        <div class="weather-main">
          <div class="weather-icon-temp">
            <span class="weather-emoji">${icon}</span>
            <div>
              <div class="weather-temp">${temp}°C</div>
              <div class="weather-cond">${cond}</div>
            </div>
          </div>
          <div class="weather-stats">
            <div class="weather-stat"><span class="material-icons-round">air</span> ${wind} km/h</div>
            <div class="weather-stat"><span class="material-icons-round">water_drop</span> ${rain}% rain</div>
            <div class="weather-stat"><span class="material-icons-round">opacity</span> ${hum}% hum</div>
          </div>
        </div>
        <div class="weather-cricket-msg ${cricketClass}">${cricketMsg}</div>
        ${forecastHtml}
        <div class="weather-tap-hint">Tap for 24h forecast</div>
      </div>
    `;
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
