// SuperCrick Pro - Utilities
const Utils = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  },
  formatOvers(overs, balls) { return `${overs}.${balls}`; },
  ballsToOvers(totalBalls) {
    const overs = Math.floor(totalBalls / 6);
    const balls = totalBalls % 6;
    return { overs, balls, display: `${overs}.${balls}` };
  },
  strikeRate(runs, balls) {
    if (balls === 0) return '0.00';
    return (runs / balls * 100).toFixed(2);
  },
  economy(runs, totalBalls) {
    if (totalBalls === 0) return '0.00';
    return (runs / totalBalls * 6).toFixed(2);
  },
  average(runs, dismissals) {
    if (dismissals === 0) return runs > 0 ? '∞' : '0.00';
    return (runs / dismissals).toFixed(2);
  },
  runRate(runs, totalBalls) {
    if (totalBalls === 0) return '0.00';
    return (runs / totalBalls * 6).toFixed(2);
  },
  requiredRunRate(runsNeeded, ballsRemaining) {
    if (ballsRemaining <= 0) return '0.00';
    return (runsNeeded / ballsRemaining * 6).toFixed(2);
  },
  initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },
  shortName(name) {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return parts[0][0] + '. ' + parts[parts.length - 1];
  },
  roleDisplay(role) {
    const map = { 'batsman': 'Batsman', 'bowler': 'Bowler', 'all-rounder': 'All-rounder', 'wk': 'Wicket Keeper' };
    return map[role] || role;
  },
  bowlStyleDisplay(style) {
    const map = { 'none': 'None', 'rf': 'Right Arm Fast', 'rmf': 'Right Arm Medium Fast', 'rm': 'Right Arm Medium', 'rob': 'Right Arm Off Break', 'rlb': 'Right Arm Leg Break', 'lf': 'Left Arm Fast', 'lmf': 'Left Arm Medium Fast', 'lm': 'Left Arm Medium', 'sla': 'SLA Orthodox', 'slc': 'SLA Chinaman' };
    return map[style] || style;
  },
  toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), duration);
  },
  confirm(title, message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `<div class="confirm-dialog"><h3>${title}</h3><p>${message}</p><div class="confirm-actions"><button class="btn-secondary" id="confirm-no">Cancel</button><button class="btn-primary" id="confirm-yes">Confirm</button></div></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
      overlay.querySelector('#confirm-no').onclick = () => { overlay.remove(); resolve(false); };
    });
  },
  dismissalDisplay(type) {
    const map = { 'bowled': 'b', 'caught': 'c', 'lbw': 'lbw', 'runout': 'run out', 'stumped': 'st', 'hitwicket': 'hit wicket', 'retired': 'retired', 'obstructing': 'obstructing field', 'timedout': 'timed out' };
    return map[type] || type;
  },
  howOut(ball, players) {
    if (!ball.isWicket) return 'not out';
    const type = ball.wicketType;
    const bowler = players[ball.bowlerId];
    const fielder = ball.fielderId ? players[ball.fielderId] : null;
    const bowlerName = bowler ? Utils.shortName(bowler.name) : '';
    const fielderName = fielder ? Utils.shortName(fielder.name) : '';
    switch (type) {
      case 'bowled': return `b ${bowlerName}`;
      case 'caught': return fielder ? `c ${fielderName} b ${bowlerName}` : `c & b ${bowlerName}`;
      case 'lbw': return `lbw b ${bowlerName}`;
      case 'runout': return fielder ? `run out (${fielderName})` : 'run out';
      case 'stumped': return fielder ? `st ${fielderName} b ${bowlerName}` : `st b ${bowlerName}`;
      case 'hitwicket': return `hit wicket b ${bowlerName}`;
      case 'retired': return 'retired';
      case 'obstructing': return 'obstructing field';
      default: return type;
    }
  },
  clone(obj) { return JSON.parse(JSON.stringify(obj)); },
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  },
  haptic() { if (navigator.vibrate) navigator.vibrate(10); }
};
