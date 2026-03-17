// SuperCrick Pro - Scoring Engine
const Scoring = {
  matchId: null,
  match: null,
  inningsId: null,
  innings: null,
  currentOver: 0,
  currentBall: 0,
  legalBallsInOver: 0,
  strikerId: null,
  nonStrikerId: null,
  bowlerId: null,
  lastBowlerId: null,
  totalBalls: 0,

  // Wicket modal state
  _wicketType: null,
  _wicketRuns: 0,
  _wicketFielder: null,
  _wicketRunoutWho: null,

  // Extra modal state
  _extraType: null,
  _extraRuns: 0,

  // Track batsman stats in memory for speed
  _batStats: {},
  _bowlStats: {},
  _partnerships: [],
  _currentPartnership: { runs: 0, balls: 0 },
  _overBalls: [],
  _allBalls: [],

  async startMatch(matchId, inningsId) {
    Scoring.matchId = matchId;
    Scoring.match = await DB.getMatch(matchId);
    Scoring.inningsId = inningsId;
    Scoring.innings = await DB.getInnings(inningsId);
    Scoring.currentOver = 0;
    Scoring.currentBall = 0;
    Scoring.legalBallsInOver = 0;
    Scoring.totalBalls = 0;
    Scoring._batStats = {};
    Scoring._bowlStats = {};
    Scoring._partnerships = [];
    Scoring._currentPartnership = { runs: 0, balls: 0 };
    Scoring._overBalls = [];
    Scoring._allBalls = [];
    Scoring.strikerId = null;
    Scoring.nonStrikerId = null;
    Scoring.bowlerId = null;
    Scoring.lastBowlerId = null;

    App.navigate('scoring');
    Scoring._updateHeader();

    // Prompt for opening batsmen
    await Scoring._selectOpeners();
  },

  async resumeMatch(matchId) {
    Scoring.matchId = matchId;
    Scoring.match = await DB.getMatch(matchId);
    const innings = await DB.getMatchInnings(matchId);

    // Find current (non-completed) innings
    let currentInnings = innings.find(i => !i.isCompleted);
    if (!currentInnings) {
      // All innings completed, show scorecard
      App.navigate('scorecard', { matchId });
      return;
    }

    Scoring.inningsId = currentInnings.id;
    Scoring.innings = currentInnings;

    // Rebuild state from balls
    const balls = await DB.getInningsBalls(currentInnings.id);
    Scoring._allBalls = balls;
    Scoring.totalBalls = 0;
    Scoring.currentOver = 0;
    Scoring.legalBallsInOver = 0;
    Scoring._batStats = {};
    Scoring._bowlStats = {};
    Scoring._overBalls = [];

    // Rebuild batsman and bowler stats
    const battingXI = currentInnings.battingXI || [];
    const dismissed = new Set();

    for (const ball of balls) {
      const isLegal = !ball.extras?.type?.match(/^(wide|noball)$/);

      if (isLegal) {
        Scoring.totalBalls++;
        Scoring.legalBallsInOver++;
        if (Scoring.legalBallsInOver > 6) {
          Scoring.legalBallsInOver = 1;
          Scoring.currentOver++;
          Scoring._overBalls = [];
        }
      }

      Scoring._overBalls.push(ball);

      // Track batsman stats
      if (!Scoring._batStats[ball.batsmanId]) {
        Scoring._batStats[ball.batsmanId] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
      }
      if (ball.batsmanRuns !== undefined) {
        Scoring._batStats[ball.batsmanId].runs += ball.batsmanRuns;
        if (isLegal || ball.extras?.type === 'noball') {
          Scoring._batStats[ball.batsmanId].balls++;
        }
        if (ball.batsmanRuns === 4) Scoring._batStats[ball.batsmanId].fours++;
        if (ball.batsmanRuns === 6) Scoring._batStats[ball.batsmanId].sixes++;
      }

      // Track bowler stats
      if (!Scoring._bowlStats[ball.bowlerId]) {
        Scoring._bowlStats[ball.bowlerId] = { balls: 0, runs: 0, wickets: 0, maidenBalls: 0, dots: 0 };
      }
      if (isLegal) {
        Scoring._bowlStats[ball.bowlerId].balls++;
      }
      const bowlRuns = ball.totalRuns || 0;
      if (ball.extras?.type !== 'bye' && ball.extras?.type !== 'legbye') {
        Scoring._bowlStats[ball.bowlerId].runs += bowlRuns;
      }
      if (bowlRuns === 0 && isLegal) Scoring._bowlStats[ball.bowlerId].dots++;
      if (ball.isWicket && !['runout', 'retired', 'obstructing'].includes(ball.wicketType)) {
        Scoring._bowlStats[ball.bowlerId].wickets++;
      }

      if (ball.isWicket) dismissed.add(ball.dismissedPlayerId);
      Scoring.strikerId = ball.batsmanId;
      Scoring.nonStrikerId = ball.nonStrikerId;
      Scoring.bowlerId = ball.bowlerId;

      if (isLegal && Scoring.legalBallsInOver === 6) {
        // End of over - swap strike
        [Scoring.strikerId, Scoring.nonStrikerId] = [Scoring.nonStrikerId, Scoring.strikerId];
      }
    }

    // Check if we ended on an over boundary
    if (Scoring.legalBallsInOver >= 6) {
      Scoring.currentOver++;
      Scoring.legalBallsInOver = 0;
      Scoring._overBalls = [];
    }

    Scoring.currentBall = Scoring.legalBallsInOver;

    App.navigate('scoring');
    Scoring._updateHeader();
    Scoring._updateBatsmanPanel();
    Scoring._updateBowlerPanel();
    Scoring._updateThisOver();

    // If no batsman set, prompt
    if (!Scoring.strikerId) {
      await Scoring._selectOpeners();
    }
    // If no bowler set, prompt
    if (!Scoring.bowlerId && Scoring.strikerId) {
      await Scoring._selectBowler('Select Opening Bowler');
    }
  },

  async _selectOpeners() {
    const battingXI = Scoring.innings.battingXI || [];
    const isGully = Scoring.match?.isGully || false;
    const maxOpeners = isGully ? battingXI.length : 2;
    const listEl = document.getElementById('available-batsmen');
    listEl.innerHTML = '';

    for (const pid of battingXI) {
      const p = App._playerMap[pid] || await DB.getPlayer(pid);
      if (p) {
        listEl.innerHTML += `
          <div class="player-select-item" data-pid="${p.id}" onclick="Scoring._toggleOpener(${p.id}, this)">
            <div class="ps-avatar">${Utils.initials(p.name)}</div>
            <span class="ps-name">${p.name}</span>
            <span class="ps-role">${Utils.roleDisplay(p.role)}</span>
            <span class="ps-check material-icons-round">check_circle</span>
          </div>
        `;
      }
    }

    Scoring._selectedOpeners = [];
    document.getElementById('select-batsman-modal').classList.remove('hidden');
    document.getElementById('select-batsman-modal').querySelector('h3').textContent =
      isGully ? 'Select Batsmen (1 or 2)' : 'Select Opening Batsmen (2)';
  },

  _selectedOpeners: [],
  _toggleOpener(playerId, el) {
    const isGully = Scoring.match?.isGully || false;
    const maxSel = isGully ? 2 : 2;
    const idx = Scoring._selectedOpeners.indexOf(playerId);
    if (idx >= 0) {
      Scoring._selectedOpeners.splice(idx, 1);
      el.classList.remove('selected');
    } else {
      if (Scoring._selectedOpeners.length >= maxSel) {
        Utils.toast(`Select up to ${maxSel} openers`);
        return;
      }
      Scoring._selectedOpeners.push(playerId);
      el.classList.add('selected');
    }
  },

  async confirmNewBatsman() {
    const isGully = Scoring.match?.isGully || false;
    if (!Scoring.strikerId && !Scoring.nonStrikerId) {
      // Selecting openers — allow 1 for gully cricket
      const minOpeners = isGully ? 1 : 2;
      if (Scoring._selectedOpeners.length < minOpeners) {
        Utils.toast(`Select at least ${minOpeners} batsmen`);
        return;
      }
      Scoring.strikerId = Scoring._selectedOpeners[0];
      Scoring.nonStrikerId = Scoring._selectedOpeners[1] || null; // null = solo batting
      document.getElementById('select-batsman-modal').classList.add('hidden');
      Scoring._updateBatsmanPanel();

      // Now select opening bowler
      await Scoring._selectBowler('Select Opening Bowler');
    } else {
      // New batsman after wicket
      const selected = document.querySelector('#available-batsmen .player-select-item.selected');
      if (!selected) { Utils.toast('Select a batsman'); return; }
      const pid = Number(selected.dataset.pid);

      Scoring.strikerId = pid;
      Scoring._batStats[pid] = Scoring._batStats[pid] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
      Scoring._currentPartnership = { runs: 0, balls: 0 };

      document.getElementById('select-batsman-modal').classList.add('hidden');
      Scoring._updateBatsmanPanel();
    }
  },

  async _selectBowler(title = 'Select Bowler') {
    const bowlingXI = Scoring.innings.bowlingXI || [];
    const listEl = document.getElementById('available-bowlers');
    listEl.innerHTML = '';
    document.getElementById('bowler-modal-title').textContent = title;

    for (const pid of bowlingXI) {
      const p = App._playerMap[pid] || await DB.getPlayer(pid);
      if (!p) continue;
      // Can't bowl consecutive overs
      if (pid === Scoring.lastBowlerId && title !== 'Select Opening Bowler') continue;

      const stats = Scoring._bowlStats[pid];
      const bowlInfo = stats ? `${Utils.ballsToOvers(stats.balls).display}-${stats.runs}-${stats.wickets}` : '';

      listEl.innerHTML += `
        <div class="player-select-item" data-pid="${p.id}" onclick="Scoring._selectBowlerItem(this)">
          <div class="ps-avatar">${Utils.initials(p.name)}</div>
          <span class="ps-name">${p.name}</span>
          <span class="ps-role">${bowlInfo || Utils.roleDisplay(p.role)}</span>
          <span class="ps-check material-icons-round">check_circle</span>
        </div>
      `;
    }

    document.getElementById('select-bowler-modal').classList.remove('hidden');
  },

  _selectBowlerItem(el) {
    document.querySelectorAll('#available-bowlers .player-select-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
  },

  confirmNewBowler() {
    const selected = document.querySelector('#available-bowlers .player-select-item.selected');
    if (!selected) { Utils.toast('Select a bowler'); return; }
    const pid = Number(selected.dataset.pid);

    Scoring.lastBowlerId = Scoring.bowlerId;
    Scoring.bowlerId = pid;
    Scoring._bowlStats[pid] = Scoring._bowlStats[pid] || { balls: 0, runs: 0, wickets: 0, dots: 0 };
    Scoring._overBalls = [];

    document.getElementById('select-bowler-modal').classList.add('hidden');
    Scoring._updateBowlerPanel();
  },

  // === SCORING ===
  async score(runs) {
    if (!Scoring.strikerId || !Scoring.bowlerId) {
      Utils.toast('Select batsman and bowler first');
      return;
    }
    const isSoloBat = !Scoring.nonStrikerId;
    Utils.haptic();

    const ball = {
      inningsId: Scoring.inningsId,
      matchId: Scoring.matchId,
      over: Scoring.currentOver,
      ball: Scoring.legalBallsInOver + 1,
      batsmanId: Scoring.strikerId,
      nonStrikerId: Scoring.nonStrikerId,
      bowlerId: Scoring.bowlerId,
      batsmanRuns: runs,
      totalRuns: runs,
      extras: null,
      isWicket: false,
      editHistory: []
    };

    // Save to DB
    const ballId = await DB.addBall(ball);
    ball.id = ballId;
    Scoring._allBalls.push(ball);

    // Update stats
    Scoring._batStats[Scoring.strikerId] = Scoring._batStats[Scoring.strikerId] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
    Scoring._batStats[Scoring.strikerId].runs += runs;
    Scoring._batStats[Scoring.strikerId].balls++;
    if (runs === 4) Scoring._batStats[Scoring.strikerId].fours++;
    if (runs === 6) Scoring._batStats[Scoring.strikerId].sixes++;

    Scoring._bowlStats[Scoring.bowlerId] = Scoring._bowlStats[Scoring.bowlerId] || { balls: 0, runs: 0, wickets: 0, dots: 0 };
    Scoring._bowlStats[Scoring.bowlerId].balls++;
    Scoring._bowlStats[Scoring.bowlerId].runs += runs;
    if (runs === 0) Scoring._bowlStats[Scoring.bowlerId].dots++;

    Scoring._currentPartnership.runs += runs;
    Scoring._currentPartnership.balls++;

    Scoring.totalBalls++;
    Scoring.legalBallsInOver++;
    Scoring._overBalls.push(ball);

    // Update innings totals
    Scoring.innings.totalRuns = (Scoring.innings.totalRuns || 0) + runs;
    Scoring.innings.totalBalls = Scoring.totalBalls;
    Scoring.innings.totalOvers = Utils.ballsToOvers(Scoring.totalBalls).display;

    // Swap strike on odd runs (skip if solo batting)
    if (runs % 2 === 1 && !isSoloBat) {
      [Scoring.strikerId, Scoring.nonStrikerId] = [Scoring.nonStrikerId, Scoring.strikerId];
    }

    await Scoring._saveInnings();
    Scoring._updateUI();

    // Check end of over
    if (Scoring.legalBallsInOver >= 6) {
      await Scoring._endOver();
    }

    // Check if target chased
    await Scoring._checkMatchEnd();
  },

  // === EXTRAS ===
  extra(type) {
    if (!Scoring.strikerId || !Scoring.bowlerId) {
      Utils.toast('Select batsman and bowler first');
      return;
    }

    Scoring._extraType = type;
    Scoring._extraRuns = 0;

    const titles = { wide: 'Wide', noball: 'No Ball', bye: 'Bye', legbye: 'Leg Bye' };
    const descs = {
      wide: 'Wide ball — 1 run + any additional runs',
      noball: 'No Ball — 1 run + any additional runs off bat or overthrows',
      bye: 'Bye — runs scored without hitting the bat',
      legbye: 'Leg Bye — runs off the body'
    };

    document.getElementById('extra-modal-title').textContent = titles[type];
    document.getElementById('extra-modal-desc').textContent = descs[type];

    // Reset buttons
    document.querySelectorAll('#extra-modal .run-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.er === '0');
    });

    document.getElementById('extra-modal').classList.remove('hidden');
  },

  setExtraRuns(runs, el) {
    Scoring._extraRuns = runs;
    el.parentElement.querySelectorAll('.run-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
  },

  closeExtraModal() {
    document.getElementById('extra-modal').classList.add('hidden');
  },

  async confirmExtra() {
    const type = Scoring._extraType;
    const addRuns = Scoring._extraRuns;
    Utils.haptic();

    const wideRun = document.getElementById('setting-wide-run')?.checked !== false ? 1 : 0;
    const nbRun = document.getElementById('setting-nb-run')?.checked !== false ? 1 : 0;

    let totalRuns = addRuns;
    let batsmanRuns = 0;
    let isLegal = true;

    if (type === 'wide') {
      totalRuns = wideRun + addRuns;
      isLegal = false;
    } else if (type === 'noball') {
      totalRuns = nbRun + addRuns;
      batsmanRuns = addRuns;
      isLegal = false;
    } else if (type === 'bye' || type === 'legbye') {
      totalRuns = addRuns;
    }

    const ball = {
      inningsId: Scoring.inningsId,
      matchId: Scoring.matchId,
      over: Scoring.currentOver,
      ball: isLegal ? Scoring.legalBallsInOver + 1 : Scoring.legalBallsInOver,
      batsmanId: Scoring.strikerId,
      nonStrikerId: Scoring.nonStrikerId,
      bowlerId: Scoring.bowlerId,
      batsmanRuns,
      totalRuns,
      extras: { type, runs: totalRuns },
      isWicket: false,
      editHistory: []
    };

    const ballId = await DB.addBall(ball);
    ball.id = ballId;
    Scoring._allBalls.push(ball);

    // Update stats
    Scoring._batStats[Scoring.strikerId] = Scoring._batStats[Scoring.strikerId] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
    if (type === 'noball') {
      Scoring._batStats[Scoring.strikerId].runs += batsmanRuns;
      Scoring._batStats[Scoring.strikerId].balls++;
      if (batsmanRuns === 4) Scoring._batStats[Scoring.strikerId].fours++;
      if (batsmanRuns === 6) Scoring._batStats[Scoring.strikerId].sixes++;
    }

    Scoring._bowlStats[Scoring.bowlerId] = Scoring._bowlStats[Scoring.bowlerId] || { balls: 0, runs: 0, wickets: 0, dots: 0 };
    if (isLegal) {
      Scoring._bowlStats[Scoring.bowlerId].balls++;
      Scoring.totalBalls++;
      Scoring.legalBallsInOver++;
    }
    if (type !== 'bye' && type !== 'legbye') {
      Scoring._bowlStats[Scoring.bowlerId].runs += totalRuns;
    }

    Scoring._currentPartnership.runs += totalRuns;
    if (isLegal) Scoring._currentPartnership.balls++;

    // Update innings
    Scoring.innings.totalRuns = (Scoring.innings.totalRuns || 0) + totalRuns;
    Scoring.innings.totalBalls = Scoring.totalBalls;
    Scoring.innings.totalOvers = Utils.ballsToOvers(Scoring.totalBalls).display;

    const extras = Scoring.innings.extras || { wides: 0, noballs: 0, byes: 0, legbyes: 0 };
    if (type === 'wide') extras.wides = (extras.wides || 0) + totalRuns;
    else if (type === 'noball') extras.noballs = (extras.noballs || 0) + nbRun;
    else if (type === 'bye') extras.byes = (extras.byes || 0) + totalRuns;
    else if (type === 'legbye') extras.legbyes = (extras.legbyes || 0) + totalRuns;
    Scoring.innings.extras = extras;

    Scoring._overBalls.push(ball);

    // Swap strike on odd runs (for byes/legbyes and overthrows)
    const runsForSwap = type === 'wide' ? addRuns : (type === 'noball' ? batsmanRuns + (addRuns > batsmanRuns ? 1 : 0) : addRuns);
    if (runsForSwap % 2 === 1) {
      [Scoring.strikerId, Scoring.nonStrikerId] = [Scoring.nonStrikerId, Scoring.strikerId];
    }

    await Scoring._saveInnings();
    Scoring._updateUI();
    Scoring.closeExtraModal();

    if (isLegal && Scoring.legalBallsInOver >= 6) {
      await Scoring._endOver();
    }

    await Scoring._checkMatchEnd();
  },

  // === WICKET ===
  wicket() {
    if (!Scoring.strikerId || !Scoring.bowlerId) {
      Utils.toast('Select batsman and bowler first');
      return;
    }

    Scoring._wicketType = null;
    Scoring._wicketRuns = 0;
    Scoring._wicketFielder = null;
    Scoring._wicketRunoutWho = 'striker';

    // Reset UI
    document.querySelectorAll('.wicket-type-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('wicket-fielder-group').style.display = 'none';
    document.getElementById('wicket-runout-who').style.display = 'none';
    document.querySelectorAll('#wicket-modal .run-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.wr === '0');
    });

    document.getElementById('wicket-modal').classList.remove('hidden');
  },

  setWicketType(type, el) {
    document.querySelectorAll('.wicket-type-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    Scoring._wicketType = type;

    // Show fielder dropdown for caught, stumped, runout
    const needsFielder = ['caught', 'stumped', 'runout'].includes(type);
    document.getElementById('wicket-fielder-group').style.display = needsFielder ? 'block' : 'none';

    if (needsFielder) {
      const select = document.getElementById('wicket-fielder');
      const bowlingXI = Scoring.innings.bowlingXI || [];
      select.innerHTML = '<option value="">Select fielder</option>';
      bowlingXI.forEach(pid => {
        const p = App._playerMap[pid];
        if (p) select.innerHTML += `<option value="${pid}">${p.name}</option>`;
      });
      if (type === 'caught') {
        select.innerHTML += `<option value="${Scoring.bowlerId}">Bowler (C&B)</option>`;
      }
    }

    // Show run out who
    if (type === 'runout') {
      document.getElementById('wicket-runout-who').style.display = 'block';
      const container = document.getElementById('runout-batsman-btns');
      const strikerName = App._playerMap[Scoring.strikerId]?.name || 'Striker';
      const nonStrikerName = App._playerMap[Scoring.nonStrikerId]?.name || 'Non-striker';
      container.innerHTML = `
        <button class="toss-btn active" onclick="Scoring._setRunoutWho('striker',this)">${strikerName}</button>
        <button class="toss-btn" onclick="Scoring._setRunoutWho('nonstriker',this)">${nonStrikerName}</button>
      `;
      Scoring._wicketRunoutWho = 'striker';
    } else {
      document.getElementById('wicket-runout-who').style.display = 'none';
    }
  },

  _setRunoutWho(who, el) {
    el.parentElement.querySelectorAll('.toss-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    Scoring._wicketRunoutWho = who;
  },

  setWicketRuns(runs, el) {
    el.parentElement.querySelectorAll('.run-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    Scoring._wicketRuns = runs;
  },

  closeWicketModal() {
    document.getElementById('wicket-modal').classList.add('hidden');
  },

  async confirmWicket() {
    if (!Scoring._wicketType) { Utils.toast('Select dismissal type'); return; }
    Utils.haptic();

    const type = Scoring._wicketType;
    const runs = Scoring._wicketRuns;
    const fielderSelect = document.getElementById('wicket-fielder');
    const fielderId = fielderSelect?.value ? Number(fielderSelect.value) : null;

    let dismissedId = Scoring.strikerId;
    if (type === 'runout') {
      dismissedId = Scoring._wicketRunoutWho === 'striker' ? Scoring.strikerId : Scoring.nonStrikerId;
    }

    const ball = {
      inningsId: Scoring.inningsId,
      matchId: Scoring.matchId,
      over: Scoring.currentOver,
      ball: Scoring.legalBallsInOver + 1,
      batsmanId: Scoring.strikerId,
      nonStrikerId: Scoring.nonStrikerId,
      bowlerId: Scoring.bowlerId,
      batsmanRuns: runs,
      totalRuns: runs,
      extras: null,
      isWicket: true,
      wicketType: type,
      dismissedPlayerId: dismissedId,
      fielderId,
      editHistory: []
    };

    const ballId = await DB.addBall(ball);
    ball.id = ballId;
    Scoring._allBalls.push(ball);

    // Update stats
    Scoring._batStats[Scoring.strikerId] = Scoring._batStats[Scoring.strikerId] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
    Scoring._batStats[Scoring.strikerId].runs += runs;
    Scoring._batStats[Scoring.strikerId].balls++;

    Scoring._bowlStats[Scoring.bowlerId] = Scoring._bowlStats[Scoring.bowlerId] || { balls: 0, runs: 0, wickets: 0, dots: 0 };
    Scoring._bowlStats[Scoring.bowlerId].balls++;
    Scoring._bowlStats[Scoring.bowlerId].runs += runs;
    if (!['runout', 'retired', 'obstructing'].includes(type)) {
      Scoring._bowlStats[Scoring.bowlerId].wickets++;
    }

    Scoring.totalBalls++;
    Scoring.legalBallsInOver++;
    Scoring._overBalls.push(ball);

    // Update innings
    Scoring.innings.totalRuns = (Scoring.innings.totalRuns || 0) + runs;
    Scoring.innings.totalWickets = (Scoring.innings.totalWickets || 0) + 1;
    Scoring.innings.totalBalls = Scoring.totalBalls;
    Scoring.innings.totalOvers = Utils.ballsToOvers(Scoring.totalBalls).display;

    // Save partnership
    Scoring._partnerships.push({
      bat1: Scoring.strikerId, bat2: Scoring.nonStrikerId,
      ...Scoring._currentPartnership
    });

    // Swap strike on odd runs
    if (runs % 2 === 1) {
      [Scoring.strikerId, Scoring.nonStrikerId] = [Scoring.nonStrikerId, Scoring.strikerId];
    }

    await Scoring._saveInnings();
    Scoring._updateUI();
    Scoring.closeWicketModal();

    // Check all out
    const battingXI = Scoring.innings.battingXI || [];
    const isGully = Scoring.match?.isGully || false;
    const allOutThreshold = isGully ? battingXI.length : battingXI.length - 1;
    if (Scoring.innings.totalWickets >= allOutThreshold) {
      // All out
      await Scoring.endInnings();
      return;
    }

    // Check over end
    if (Scoring.legalBallsInOver >= 6) {
      // First select new batsman, then end over
      await Scoring._selectNewBatsman(dismissedId);
      // After batsman selected, end over will trigger bowler selection
      return;
    }

    // Select new batsman
    await Scoring._selectNewBatsman(dismissedId);
    await Scoring._checkMatchEnd();
  },

  async _selectNewBatsman(dismissedId) {
    const battingXI = Scoring.innings.battingXI || [];
    const dismissed = new Set();

    // Find all dismissed batsmen
    for (const b of Scoring._allBalls) {
      if (b.isWicket) dismissed.add(b.dismissedPlayerId);
    }

    const available = battingXI.filter(pid =>
      !dismissed.has(pid) && pid !== Scoring.strikerId && pid !== Scoring.nonStrikerId
    );

    if (available.length === 0) {
      // In gully cricket, remaining batsman continues solo
      if (Scoring.match?.isGully && (Scoring.strikerId || Scoring.nonStrikerId)) {
        if (!Scoring.strikerId) Scoring.strikerId = Scoring.nonStrikerId;
        Scoring.nonStrikerId = null;
        Scoring._updateBatsmanPanel();
      }
      return;
    }

    const listEl = document.getElementById('available-batsmen');
    listEl.innerHTML = '';
    document.getElementById('select-batsman-modal').querySelector('h3').textContent = 'Select New Batsman';

    for (const pid of available) {
      const p = App._playerMap[pid] || await DB.getPlayer(pid);
      if (p) {
        listEl.innerHTML += `
          <div class="player-select-item" data-pid="${p.id}" onclick="Scoring._selectBatsmanItem(this)">
            <div class="ps-avatar">${Utils.initials(p.name)}</div>
            <span class="ps-name">${p.name}</span>
            <span class="ps-role">${Utils.roleDisplay(p.role)}</span>
            <span class="ps-check material-icons-round">check_circle</span>
          </div>
        `;
      }
    }

    // If dismissed was striker, new batsman becomes striker
    if (dismissedId === Scoring.strikerId) {
      Scoring.strikerId = null;
    } else {
      Scoring.nonStrikerId = Scoring.strikerId;
      Scoring.strikerId = null;
    }

    document.getElementById('select-batsman-modal').classList.remove('hidden');
  },

  _selectBatsmanItem(el) {
    document.querySelectorAll('#available-batsmen .player-select-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
  },

  // === UNDO ===
  async undo() {
    if (Scoring._allBalls.length === 0) {
      Utils.toast('Nothing to undo');
      return;
    }

    const ok = await Utils.confirm('Undo Last Ball', 'Remove the last ball delivery?');
    if (!ok) return;

    const lastBall = Scoring._allBalls.pop();
    await DB.deleteBall(lastBall.id);

    // Recalculate everything from remaining balls
    const balls = Scoring._allBalls;
    Scoring.totalBalls = 0;
    Scoring.currentOver = 0;
    Scoring.legalBallsInOver = 0;
    Scoring._batStats = {};
    Scoring._bowlStats = {};
    Scoring._overBalls = [];
    Scoring.innings.totalRuns = 0;
    Scoring.innings.totalWickets = 0;
    Scoring.innings.extras = { wides: 0, noballs: 0, byes: 0, legbyes: 0 };

    for (const ball of balls) {
      const isLegal = !ball.extras?.type?.match(/^(wide|noball)$/);

      if (isLegal) {
        Scoring.totalBalls++;
        Scoring.legalBallsInOver++;
        if (Scoring.legalBallsInOver > 6) {
          Scoring.legalBallsInOver = 1;
          Scoring.currentOver++;
          Scoring._overBalls = [];
        }
      }

      Scoring._overBalls.push(ball);
      Scoring.innings.totalRuns += ball.totalRuns || 0;
      if (ball.isWicket) Scoring.innings.totalWickets++;

      if (ball.extras) {
        const ext = ball.extras;
        if (ext.type === 'wide') Scoring.innings.extras.wides += ext.runs || 0;
        else if (ext.type === 'noball') Scoring.innings.extras.noballs += 1;
        else if (ext.type === 'bye') Scoring.innings.extras.byes += ext.runs || 0;
        else if (ext.type === 'legbye') Scoring.innings.extras.legbyes += ext.runs || 0;
      }

      // Rebuild bat/bowl stats
      if (!Scoring._batStats[ball.batsmanId]) Scoring._batStats[ball.batsmanId] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
      if (ball.batsmanRuns !== undefined) {
        Scoring._batStats[ball.batsmanId].runs += ball.batsmanRuns;
        if (isLegal || ball.extras?.type === 'noball') Scoring._batStats[ball.batsmanId].balls++;
        if (ball.batsmanRuns === 4) Scoring._batStats[ball.batsmanId].fours++;
        if (ball.batsmanRuns === 6) Scoring._batStats[ball.batsmanId].sixes++;
      }

      if (!Scoring._bowlStats[ball.bowlerId]) Scoring._bowlStats[ball.bowlerId] = { balls: 0, runs: 0, wickets: 0, dots: 0 };
      if (isLegal) Scoring._bowlStats[ball.bowlerId].balls++;
      if (ball.extras?.type !== 'bye' && ball.extras?.type !== 'legbye') {
        Scoring._bowlStats[ball.bowlerId].runs += ball.totalRuns || 0;
      }
      if (ball.isWicket && !['runout', 'retired', 'obstructing'].includes(ball.wicketType)) {
        Scoring._bowlStats[ball.bowlerId].wickets++;
      }

      Scoring.strikerId = ball.batsmanId;
      Scoring.nonStrikerId = ball.nonStrikerId;
      Scoring.bowlerId = ball.bowlerId;
    }

    if (Scoring.legalBallsInOver >= 6) {
      Scoring.currentOver++;
      Scoring.legalBallsInOver = 0;
      Scoring._overBalls = [];
    }
    Scoring.currentBall = Scoring.legalBallsInOver;
    Scoring.innings.totalBalls = Scoring.totalBalls;
    Scoring.innings.totalOvers = Utils.ballsToOvers(Scoring.totalBalls).display;

    await Scoring._saveInnings();
    Scoring._updateUI();
    Utils.toast('Last ball undone');
  },

  swapStrike() {
    [Scoring.strikerId, Scoring.nonStrikerId] = [Scoring.nonStrikerId, Scoring.strikerId];
    Scoring._updateBatsmanPanel();
    Utils.haptic();
  },

  async retireBatsman() {
    if (!Scoring.strikerId) return;
    const ok = await Utils.confirm('Retire Batsman', `Retire ${App._playerMap[Scoring.strikerId]?.name || 'current striker'}?`);
    if (!ok) return;

    // Record as a wicket (retired)
    const ball = {
      inningsId: Scoring.inningsId,
      matchId: Scoring.matchId,
      over: Scoring.currentOver,
      ball: Scoring.legalBallsInOver,
      batsmanId: Scoring.strikerId,
      nonStrikerId: Scoring.nonStrikerId,
      bowlerId: Scoring.bowlerId,
      batsmanRuns: 0,
      totalRuns: 0,
      extras: null,
      isWicket: true,
      wicketType: 'retired',
      dismissedPlayerId: Scoring.strikerId,
      fielderId: null,
      editHistory: []
    };

    await DB.addBall(ball);
    Scoring._allBalls.push(ball);
    Scoring.innings.totalWickets = (Scoring.innings.totalWickets || 0) + 1;
    await Scoring._saveInnings();

    await Scoring._selectNewBatsman(Scoring.strikerId);
  },

  showFieldPositions() {
    App.navigate('field');
  },

  viewScorecard() {
    App.navigate('scorecard', { matchId: Scoring.matchId });
  },

  async endInnings() {
    const ok = await Utils.confirm('End Innings', 'Are you sure you want to end the current innings?');
    if (!ok) return;

    // Mark innings as completed
    Scoring.innings.isCompleted = true;
    await DB.updateInnings(Scoring.inningsId, { isCompleted: true });

    const matchInnings = await DB.getMatchInnings(Scoring.matchId);

    if (matchInnings.length < 2) {
      // Start second innings
      const battingTeamId = Scoring.innings.bowlingTeamId;
      const bowlingTeamId = Scoring.innings.battingTeamId;

      // Find XIs
      let battingXI, bowlingXI;
      if (battingTeamId === Scoring.match.team1Id) {
        battingXI = Scoring.match.team1XI;
        bowlingXI = Scoring.match.team2XI;
      } else {
        battingXI = Scoring.match.team2XI;
        bowlingXI = Scoring.match.team1XI;
      }

      const newInningsId = await DB.addInnings({
        matchId: Scoring.matchId,
        battingTeamId, bowlingTeamId,
        inningsNumber: 2, totalRuns: 0, totalWickets: 0,
        totalOvers: '0.0', totalBalls: 0,
        extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0 },
        isCompleted: false,
        battingXI, bowlingXI,
        target: (Scoring.innings.totalRuns || 0) + 1
      });

      Utils.toast(`Target: ${Scoring.innings.totalRuns + 1} runs`);

      // Reset and start 2nd innings
      await Scoring.startMatch(Scoring.matchId, newInningsId);
    } else {
      // Match complete
      await Scoring._finishMatch();
    }
  },

  async _endOver() {
    Scoring.currentOver++;
    Scoring.legalBallsInOver = 0;
    Scoring._overBalls = [];

    // Swap strike at end of over (skip if solo batting)
    if (Scoring.nonStrikerId) {
      [Scoring.strikerId, Scoring.nonStrikerId] = [Scoring.nonStrikerId, Scoring.strikerId];
    }

    // Check if overs completed
    if (Scoring.currentOver >= Scoring.match.overs) {
      await Scoring.endInnings();
      return;
    }

    Scoring._updateUI();

    // Select new bowler
    await Scoring._selectBowler('Select Bowler for Over ' + (Scoring.currentOver + 1));
  },

  async _checkMatchEnd() {
    // Check if second innings target chased
    if (Scoring.innings.inningsNumber === 2 && Scoring.innings.target) {
      if (Scoring.innings.totalRuns >= Scoring.innings.target) {
        await Scoring._finishMatch();
      }
    }
  },

  async _finishMatch() {
    Scoring.innings.isCompleted = true;
    await DB.updateInnings(Scoring.inningsId, { isCompleted: true });

    const matchInnings = await DB.getMatchInnings(Scoring.matchId);
    const team1 = await DB.getTeam(Scoring.match.team1Id);
    const team2 = await DB.getTeam(Scoring.match.team2Id);

    let result = '';
    if (matchInnings.length >= 2) {
      const inn1 = matchInnings[0];
      const inn2 = matchInnings[1];
      const t1Batting = inn1.battingTeamId;
      const t1Name = t1Batting === Scoring.match.team1Id ? team1?.name : team2?.name;
      const t2Name = t1Batting === Scoring.match.team1Id ? team2?.name : team1?.name;

      if (inn2.totalRuns > inn1.totalRuns) {
        const wicketsLeft = (inn2.battingXI?.length || 11) - 1 - inn2.totalWickets;
        result = `${t2Name} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`;
      } else if (inn1.totalRuns > inn2.totalRuns) {
        result = `${t1Name} won by ${inn1.totalRuns - inn2.totalRuns} runs`;
      } else {
        result = 'Match Tied';
      }
    }

    await DB.updateMatch(Scoring.matchId, { status: 'completed', result });
    await App.checkLiveMatch();
    Utils.toast(result || 'Match completed');

    // Show scorecard
    App.navigate('scorecard', { matchId: Scoring.matchId });
  },

  async _saveInnings() {
    await DB.updateInnings(Scoring.inningsId, {
      totalRuns: Scoring.innings.totalRuns,
      totalWickets: Scoring.innings.totalWickets,
      totalOvers: Scoring.innings.totalOvers,
      totalBalls: Scoring.innings.totalBalls,
      extras: Scoring.innings.extras,
      isCompleted: Scoring.innings.isCompleted
    });
  },

  // === UI UPDATES ===
  _updateUI() {
    Scoring._updateHeader();
    Scoring._updateBatsmanPanel();
    Scoring._updateBowlerPanel();
    Scoring._updateThisOver();
    Scoring._updatePartnership();
  },

  _updateHeader() {
    const team1 = App._playerMap[Scoring.match?.team1Id] ? '' : '';
    const t1 = Scoring.match?.team1Id;
    const t2 = Scoring.match?.team2Id;

    DB.getTeam(t1).then(team => {
      document.getElementById('scoring-team1').textContent = team?.name || 'Team 1';
    });
    DB.getTeam(t2).then(team => {
      document.getElementById('scoring-team2').textContent = team?.name || 'Team 2';
    });

    document.getElementById('scoring-total').textContent =
      `${Scoring.innings?.totalRuns || 0}/${Scoring.innings?.totalWickets || 0}`;
    document.getElementById('scoring-overs').textContent =
      `(${Scoring.innings?.totalOvers || '0.0'} ov)`;

    const crr = Utils.runRate(Scoring.innings?.totalRuns || 0, Scoring.totalBalls);
    document.getElementById('scoring-crr').textContent = crr;

    // Target info for 2nd innings
    if (Scoring.innings?.target) {
      const target = Scoring.innings.target;
      const needed = target - (Scoring.innings.totalRuns || 0);
      const totalMatchBalls = Scoring.match.overs * 6;
      const ballsRemaining = totalMatchBalls - Scoring.totalBalls;
      const rrr = Utils.requiredRunRate(needed, ballsRemaining);

      document.getElementById('scoring-target-info').style.display = 'block';
      document.getElementById('scoring-target-info').textContent =
        needed > 0 ? `Need ${needed} runs from ${ballsRemaining} balls` : 'Target achieved!';
      document.getElementById('scoring-rrr-wrap').style.display = 'inline';
      document.getElementById('scoring-rrr').textContent = rrr;
    } else {
      document.getElementById('scoring-target-info').style.display = 'none';
      document.getElementById('scoring-rrr-wrap').style.display = 'none';
    }

    // Innings tabs
    const innNum = Scoring.innings?.inningsNumber || 1;
    document.querySelectorAll('.innings-tab').forEach(tab => {
      tab.classList.toggle('active', Number(tab.dataset.inn) === innNum);
    });
  },

  _updateBatsmanPanel() {
    const updateRow = (elId, playerId, isStriker) => {
      const el = document.getElementById(elId);
      if (!el) return;
      if (!playerId) {
        // Solo batting — hide non-striker row
        if (!isStriker) el.style.display = 'none';
        return;
      }
      el.style.display = '';
      const p = App._playerMap[playerId];
      const stats = Scoring._batStats[playerId] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
      const sr = stats.balls > 0 ? (stats.runs / stats.balls * 100).toFixed(1) : '0.0';

      el.querySelector('.bat-indicator').textContent = isStriker ? '*' : '';
      el.querySelector('.bat-name').textContent = p ? Utils.shortName(p.name) : '-';
      el.querySelector('.bat-runs').textContent = stats.runs;
      el.querySelector('.bat-balls').textContent = `(${stats.balls})`;
      el.querySelector('.bat-fours').textContent = `${stats.fours}x4`;
      el.querySelector('.bat-sixes').textContent = `${stats.sixes}x6`;
      el.querySelector('.bat-sr').textContent = `SR ${sr}`;
    };

    updateRow('striker-info', Scoring.strikerId, true);
    updateRow('non-striker-info', Scoring.nonStrikerId, false);
  },

  _updateBowlerPanel() {
    const el = document.getElementById('bowler-info');
    if (!Scoring.bowlerId) return;
    const p = App._playerMap[Scoring.bowlerId];
    const stats = Scoring._bowlStats[Scoring.bowlerId] || { balls: 0, runs: 0, wickets: 0, dots: 0 };
    const ov = Utils.ballsToOvers(stats.balls);
    const econ = stats.balls > 0 ? (stats.runs / stats.balls * 6).toFixed(1) : '0.0';

    el.querySelector('.bowl-name').textContent = p ? Utils.shortName(p.name) : '-';
    el.querySelector('.bowl-overs').textContent = `${ov.display}-${stats.dots || 0}-${stats.runs}-${stats.wickets}`;
    el.querySelector('.bowl-econ').textContent = `Econ ${econ}`;
  },

  _updatePartnership() {
    const el = document.getElementById('partnership-info');
    el.innerHTML = `Partnership: <b>${Scoring._currentPartnership.runs}</b> (<span>${Scoring._currentPartnership.balls}</span> balls)`;
  },

  _updateThisOver() {
    const container = document.getElementById('this-over-balls');
    container.innerHTML = '';
    for (const ball of Scoring._overBalls) {
      let cls = 'ball-dot';
      let text = '';

      if (ball.isWicket) {
        cls += ' wicket';
        text = 'W';
      } else if (ball.extras?.type === 'wide') {
        cls += ' wide';
        text = `Wd${ball.extras.runs > 1 ? '+' + (ball.extras.runs - 1) : ''}`;
      } else if (ball.extras?.type === 'noball') {
        cls += ' noball';
        text = `Nb${ball.totalRuns > 1 ? '+' + (ball.totalRuns - 1) : ''}`;
      } else if (ball.extras?.type === 'bye') {
        cls += ' bye';
        text = `B${ball.totalRuns}`;
      } else if (ball.extras?.type === 'legbye') {
        cls += ' legbye';
        text = `Lb${ball.totalRuns}`;
      } else {
        cls += ` run-${ball.batsmanRuns}`;
        text = ball.batsmanRuns === 0 ? '•' : ball.batsmanRuns;
      }

      container.innerHTML += `<span class="${cls}">${text}</span>`;
    }
  },

  switchInningsView(innNum) {
    // This just switches the scorecard view in scoring mode
    Scoring.viewScorecard();
  }
};
