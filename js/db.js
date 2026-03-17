// SuperCrick Pro - Database Layer (Dexie.js)
const db = new Dexie('SuperCrickProDB');

db.version(1).stores({
  players: '++id, name, team, role, createdAt',
  teams: '++id, name, createdAt',
  matches: '++id, team1Id, team2Id, status, date, createdAt',
  innings: '++id, matchId, battingTeamId, bowlingTeamId, inningsNumber',
  balls: '++id, inningsId, matchId, [inningsId+over+ball], timestamp',
  fieldSetups: '++id, name, createdAt'
});

db.version(2).stores({
  tournaments: '++id, name, type, status, createdAt',
  tournamentTeams: '++id, tournamentId, teamId',
  tournamentFixtures: '++id, tournamentId, round, homeTeamId, awayTeamId, status'
});

const DB = {
  // === PLAYERS ===
  async addPlayer(player) {
    player.createdAt = new Date().toISOString();
    return await db.players.add(player);
  },
  async updatePlayer(id, data) {
    return await db.players.update(id, data);
  },
  async deletePlayer(id) {
    return await db.players.delete(id);
  },
  async getPlayer(id) {
    return await db.players.get(id);
  },
  async getAllPlayers() {
    return await db.players.orderBy('name').toArray();
  },
  async searchPlayers(query) {
    const q = query.toLowerCase();
    return (await db.players.toArray()).filter(p =>
      p.name.toLowerCase().includes(q)
    );
  },

  // === TEAMS ===
  async addTeam(team) {
    team.createdAt = new Date().toISOString();
    return await db.teams.add(team);
  },
  async updateTeam(id, data) {
    return await db.teams.update(id, data);
  },
  async deleteTeam(id) {
    return await db.teams.delete(id);
  },
  async getTeam(id) {
    return await db.teams.get(id);
  },
  async getAllTeams() {
    return await db.teams.orderBy('name').toArray();
  },

  // === MATCHES ===
  async addMatch(match) {
    match.createdAt = new Date().toISOString();
    return await db.matches.add(match);
  },
  async updateMatch(id, data) {
    return await db.matches.update(id, data);
  },
  async getMatch(id) {
    return await db.matches.get(id);
  },
  async getAllMatches() {
    return (await db.matches.toArray()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  async getMatchesByStatus(status) {
    return (await db.matches.where('status').equals(status).toArray())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  async getLiveMatch() {
    const matches = await db.matches.where('status').equals('live').toArray();
    return matches.length > 0 ? matches[0] : null;
  },

  // === INNINGS ===
  async addInnings(innings) {
    return await db.innings.add(innings);
  },
  async updateInnings(id, data) {
    return await db.innings.update(id, data);
  },
  async getInnings(id) {
    return await db.innings.get(id);
  },
  async getMatchInnings(matchId) {
    return await db.innings.where('matchId').equals(matchId).sortBy('inningsNumber');
  },

  // === BALLS ===
  async addBall(ball) {
    ball.timestamp = new Date().toISOString();
    return await db.balls.add(ball);
  },
  async updateBall(id, data) {
    return await db.balls.update(id, data);
  },
  async deleteBall(id) {
    return await db.balls.delete(id);
  },
  async getBall(id) {
    return await db.balls.get(id);
  },
  async getInningsBalls(inningsId) {
    return await db.balls.where('inningsId').equals(inningsId).sortBy('timestamp');
  },
  async getLastBall(inningsId) {
    const balls = await db.balls.where('inningsId').equals(inningsId).sortBy('timestamp');
    return balls.length > 0 ? balls[balls.length - 1] : null;
  },
  async getMatchBalls(matchId) {
    return await db.balls.where('matchId').equals(matchId).sortBy('timestamp');
  },

  // === FIELD SETUPS ===
  async addFieldSetup(setup) {
    setup.createdAt = new Date().toISOString();
    return await db.fieldSetups.add(setup);
  },
  async getAllFieldSetups() {
    return await db.fieldSetups.toArray();
  },
  async deleteFieldSetup(id) {
    return await db.fieldSetups.delete(id);
  },

  // === BULK OPERATIONS ===
  async exportAll() {
    return {
      players: await db.players.toArray(),
      teams: await db.teams.toArray(),
      matches: await db.matches.toArray(),
      innings: await db.innings.toArray(),
      balls: await db.balls.toArray(),
      fieldSetups: await db.fieldSetups.toArray(),
      tournaments: await db.tournaments.toArray(),
      tournamentTeams: await db.tournamentTeams.toArray(),
      tournamentFixtures: await db.tournamentFixtures.toArray(),
      exportedAt: new Date().toISOString(),
      version: '2.0.0'
    };
  },

  async importAll(data) {
    await db.transaction('rw', db.players, db.teams, db.matches, db.innings, db.balls, db.fieldSetups, db.tournaments, db.tournamentTeams, db.tournamentFixtures, async () => {
      if (data.players) { await db.players.clear(); await db.players.bulkAdd(data.players); }
      if (data.teams) { await db.teams.clear(); await db.teams.bulkAdd(data.teams); }
      if (data.matches) { await db.matches.clear(); await db.matches.bulkAdd(data.matches); }
      if (data.innings) { await db.innings.clear(); await db.innings.bulkAdd(data.innings); }
      if (data.balls) { await db.balls.clear(); await db.balls.bulkAdd(data.balls); }
      if (data.fieldSetups) { await db.fieldSetups.clear(); await db.fieldSetups.bulkAdd(data.fieldSetups); }
      if (data.tournaments) { await db.tournaments.clear(); await db.tournaments.bulkAdd(data.tournaments); }
      if (data.tournamentTeams) { await db.tournamentTeams.clear(); await db.tournamentTeams.bulkAdd(data.tournamentTeams); }
      if (data.tournamentFixtures) { await db.tournamentFixtures.clear(); await db.tournamentFixtures.bulkAdd(data.tournamentFixtures); }
    });
  },

  async clearAll() {
    await db.players.clear();
    await db.teams.clear();
    await db.matches.clear();
    await db.innings.clear();
    await db.balls.clear();
    await db.fieldSetups.clear();
    await db.tournaments.clear();
    await db.tournamentTeams.clear();
    await db.tournamentFixtures.clear();
  },

  // === TOURNAMENTS ===
  async addTournament(t) { t.createdAt = new Date().toISOString(); return await db.tournaments.add(t); },
  async updateTournament(id, data) { return await db.tournaments.update(id, data); },
  async getTournament(id) { return await db.tournaments.get(id); },
  async getAllTournaments() { return (await db.tournaments.toArray()).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)); },
  async deleteTournament(id) {
    const fixtures = await db.tournamentFixtures.where('tournamentId').equals(id).toArray();
    for (const f of fixtures) await db.tournamentFixtures.delete(f.id);
    await db.tournamentTeams.where('tournamentId').equals(id).delete();
    return await db.tournaments.delete(id);
  },
  async addTournamentTeam(t) { return await db.tournamentTeams.add(t); },
  async getTournamentTeams(tournamentId) { return await db.tournamentTeams.where('tournamentId').equals(tournamentId).toArray(); },
  async addTournamentFixture(f) { return await db.tournamentFixtures.add(f); },
  async getTournamentFixtures(tournamentId) { return await db.tournamentFixtures.where('tournamentId').equals(tournamentId).sortBy('round'); },
  async updateTournamentFixture(id, data) { return await db.tournamentFixtures.update(id, data); },

  // === STATS HELPERS ===
  async getPlayerMatchStats(playerId) {
    const allBalls = await db.balls.toArray();
    const allInnings = await db.innings.toArray();
    const allMatches = await db.matches.toArray();

    const battingStats = [];
    const bowlingStats = [];

    for (const match of allMatches) {
      if (match.status !== 'completed' && match.status !== 'live') continue;
      const matchInnings = allInnings.filter(i => i.matchId === match.id);

      for (const inn of matchInnings) {
        const innBalls = allBalls.filter(b => b.inningsId === inn.id);

        // Batting
        const batBalls = innBalls.filter(b => b.batsmanId === playerId || b.nonStrikerId === playerId);
        if (batBalls.length > 0) {
          const faced = innBalls.filter(b => b.batsmanId === playerId && !b.extras?.type?.match(/^(wide)$/));
          const runs = faced.reduce((s, b) => s + (b.batsmanRuns || 0), 0);
          const balls = faced.length;
          const fours = faced.filter(b => (b.batsmanRuns || 0) === 4).length;
          const sixes = faced.filter(b => (b.batsmanRuns || 0) === 6).length;
          const isOut = innBalls.some(b => b.isWicket && b.dismissedPlayerId === playerId);

          battingStats.push({
            matchId: match.id, inningsId: inn.id,
            runs, balls, fours, sixes, isOut,
            sr: balls > 0 ? (runs / balls * 100) : 0,
            date: match.date,
            vs: inn.bowlingTeamId
          });
        }

        // Bowling
        const bowlBalls = innBalls.filter(b => b.bowlerId === playerId);
        if (bowlBalls.length > 0) {
          const legalBalls = bowlBalls.filter(b => !b.extras?.type?.match(/^(wide|noball)$/));
          const runsConceded = bowlBalls.reduce((s, b) => {
            let r = b.totalRuns || 0;
            if (b.extras?.type === 'bye' || b.extras?.type === 'legbye') r = 0;
            return s + r;
          }, 0);
          const wickets = bowlBalls.filter(b => b.isWicket && !['runout', 'retired', 'obstructing'].includes(b.wicketType)).length;

          bowlingStats.push({
            matchId: match.id, inningsId: inn.id,
            balls: legalBalls.length, runsConceded, wickets,
            economy: legalBalls.length > 0 ? (runsConceded / legalBalls.length * 6) : 0,
            date: match.date,
            vs: inn.battingTeamId
          });
        }
      }
    }

    return { battingStats, bowlingStats };
  }
};
