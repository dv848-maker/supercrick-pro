// Sai-Crick Pro - PDF Export
const ExportDoc = {
  async exportScorecard(matchId) {
    if (!matchId) matchId = Scoring?.matchId;
    if (!matchId) { Utils.toast('No match to export'); return; }
    try {
      Utils.toast('Generating PDF...');
      const filename = await ExportDoc._buildAndSavePDF(matchId, false);
      Utils.toast('PDF saved: ' + filename);
    } catch(e) {
      console.error('Export error:', e);
      Utils.toast('Export failed: ' + e.message);
    }
  },

  async shareScorecard(matchId) {
    if (!matchId) matchId = Scoring?.matchId;
    if (!matchId) { Utils.toast('No match to share'); return; }
    try {
      await ExportDoc._buildAndSavePDF(matchId, true);
    } catch(e) {
      if (e.name !== 'AbortError') Utils.toast('Share failed: ' + e.message);
    }
  },

  async _buildAndSavePDF(matchId, share) {
    // Try multiple ways to access jsPDF
    let jsPDF = (window.jspdf && window.jspdf.jsPDF)
      || (window.jsPDF)
      || (typeof jspdf !== 'undefined' && jspdf.jsPDF);
    if (!jsPDF) {
      Utils.toast('PDF library not ready. Please ensure you are online for first load.');
      return;
    }

    const match = await DB.getMatch(matchId);
    const team1 = await DB.getTeam(match.team1Id);
    const team2 = await DB.getTeam(match.team2Id);
    const innings = await DB.getMatchInnings(matchId);
    const allBalls = await DB.getMatchBalls(matchId);
    await App.refreshPlayerMap();
    const players = App._playerMap;

    const t1Name = team1?.name || 'Team 1';
    const t2Name = team2?.name || 'Team 2';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    let y = 15;

    const purple = [108, 92, 231];
    const dark = [15, 15, 26];
    const white = [255, 255, 255];
    const green = [0, 230, 118];
    const gray = [120, 120, 140];

    // ── Header ──
    doc.setFillColor(...purple);
    doc.rect(0, 0, W, 30, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('SAI-CRICK PRO', W / 2, 12, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('by D. Sai Kiran Varma', W / 2, 19, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('MATCH SCORECARD', W / 2, 26, { align: 'center' });
    y = 38;

    // ── Match Info ──
    doc.setTextColor(30, 30, 50);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${t1Name}  vs  ${t2Name}`, W / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    const infoLine = `${match.format || 'T20'}  •  ${match.venue || 'N/A'}  •  ${Utils.formatDate(match.date)}`;
    doc.text(infoLine, W / 2, y, { align: 'center' }); y += 5;
    if (match.result) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...green);
      doc.text(match.result, W / 2, y, { align: 'center' }); y += 5;
    }

    // Roles (Captain, VC, WK) helper
    const getRoleLabel = (matchData, teamNum, pid) => {
      const labels = [];
      if (matchData[`team${teamNum}Captain`] === pid) labels.push('(C)');
      if (matchData[`team${teamNum}VC`] === pid) labels.push('(VC)');
      if (matchData[`team${teamNum}WK`] === pid) labels.push('(WK)');
      return labels.join(' ');
    };
    // Determine which team is 1 or 2
    const getTeamNum = (teamId) => teamId === match.team1Id ? 1 : 2;

    // ── Each Innings ──
    for (const inn of innings) {
      y += 4;
      const battingTeam = inn.battingTeamId === match.team1Id ? team1 : team2;
      const bowlingTeam = inn.bowlingTeamId === match.team1Id ? team1 : team2;
      const innBalls = allBalls.filter(b => b.inningsId === inn.id);
      const teamNum = getTeamNum(inn.battingTeamId);

      // Innings header
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFillColor(...purple);
      doc.roundedRect(10, y, W - 20, 8, 2, 2, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(
        `${battingTeam?.name || 'Team'} — ${inn.inningsNumber === 1 ? '1st' : '2nd'} Innings: ${inn.totalRuns || 0}/${inn.totalWickets || 0} (${inn.totalOvers || '0.0'} ov)`,
        W / 2, y + 5.5, { align: 'center' }
      );
      y += 12;

      // Build bat stats
      const battingXI = inn.battingXI || [];
      const batStats = {};
      for (const pid of battingXI) batStats[pid] = { runs: 0, balls: 0, fours: 0, sixes: 0, howOut: 'did not bat' };
      for (const ball of innBalls) {
        if (batStats[ball.batsmanId]) {
          const legal = !ball.extras?.type?.match(/^(wide)$/);
          if (legal) batStats[ball.batsmanId].balls++;
          batStats[ball.batsmanId].runs += ball.batsmanRuns || 0;
          if ((ball.batsmanRuns || 0) === 4) batStats[ball.batsmanId].fours++;
          if ((ball.batsmanRuns || 0) === 6) batStats[ball.batsmanId].sixes++;
          if (batStats[ball.batsmanId].howOut === 'did not bat') batStats[ball.batsmanId].howOut = 'not out';
        }
        if (ball.nonStrikerId && batStats[ball.nonStrikerId]) {
          if (batStats[ball.nonStrikerId].howOut === 'did not bat') batStats[ball.nonStrikerId].howOut = 'not out';
        }
        if (ball.isWicket && ball.dismissedPlayerId && batStats[ball.dismissedPlayerId]) {
          batStats[ball.dismissedPlayerId].howOut = Utils.howOut(ball, players);
        }
      }

      // Batting table
      const batRows = [];
      for (const pid of battingXI) {
        const bs = batStats[pid];
        if (bs.howOut === 'did not bat') continue;
        const p = players[pid];
        const role = getRoleLabel(match, teamNum, pid);
        const sr = bs.balls > 0 ? (bs.runs / bs.balls * 100).toFixed(1) : '-';
        const isNotOut = bs.howOut === 'not out';
        batRows.push([
          (p ? Utils.shortName(p.name) : '?') + (role ? ' ' + role : ''),
          bs.howOut,
          `${bs.runs}${isNotOut ? '*' : ''}`,
          bs.balls, bs.fours, bs.sixes, sr
        ]);
      }

      if (y > 240) { doc.addPage(); y = 15; }
      doc.autoTable({
        startY: y,
        head: [['Batsman', 'How Out', 'R', 'B', '4s', '6s', 'SR']],
        body: batRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, textColor: [30,30,50] },
        headStyles: { fillColor: [40, 40, 70], textColor: white, fontStyle: 'bold', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 38 }, 1: { cellWidth: 45 },
          2: { cellWidth: 12, fontStyle: 'bold' },
          3: { cellWidth: 12 }, 4: { cellWidth: 12 }, 5: { cellWidth: 12 }, 6: { cellWidth: 18 }
        },
        margin: { left: 10, right: 10 },
        didDrawPage: (d) => { y = d.cursor.y; }
      });
      y = doc.lastAutoTable.finalY + 2;

      // Extras
      const ext = inn.extras || {};
      const totalExt = (ext.wides||0)+(ext.noballs||0)+(ext.byes||0)+(ext.legbyes||0);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray);
      doc.text(`Extras: ${totalExt}  (Wd ${ext.wides||0}, Nb ${ext.noballs||0}, B ${ext.byes||0}, Lb ${ext.legbyes||0})`, 12, y + 4);
      y += 8;

      // Build bowl stats
      const bowlingXI = inn.bowlingXI || [];
      const bowlData = {};
      for (const ball of innBalls) {
        if (!bowlData[ball.bowlerId]) bowlData[ball.bowlerId] = { balls: 0, runs: 0, wickets: 0, dots: 0, maidens: 0 };
        const legal = !ball.extras?.type?.match(/^(wide|noball)$/);
        if (legal) bowlData[ball.bowlerId].balls++;
        const r = (ball.extras?.type === 'bye' || ball.extras?.type === 'legbye') ? 0 : (ball.totalRuns || 0);
        bowlData[ball.bowlerId].runs += r;
        if (r === 0 && legal) bowlData[ball.bowlerId].dots++;
        if (ball.isWicket && !['runout','retired','obstructing'].includes(ball.wicketType)) bowlData[ball.bowlerId].wickets++;
      }

      const bowlTeamNum = getTeamNum(inn.bowlingTeamId);
      const bowlRows = [];
      for (const pid of bowlingXI) {
        const bd = bowlData[pid];
        if (!bd) continue;
        const p = players[pid];
        const role = getRoleLabel(match, bowlTeamNum, pid);
        const ov = Utils.ballsToOvers(bd.balls);
        const econ = bd.balls > 0 ? (bd.runs / bd.balls * 6).toFixed(1) : '-';
        bowlRows.push([(p ? Utils.shortName(p.name) : '?') + (role ? ' ' + role : ''), ov.display, bd.runs, bd.wickets, econ, bd.dots]);
      }

      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50);
      doc.text('Bowling', 12, y); y += 2;
      doc.autoTable({
        startY: y,
        head: [['Bowler', 'O', 'R', 'W', 'Econ', 'Dots']],
        body: bowlRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, textColor: [30,30,50] },
        headStyles: { fillColor: [40, 40, 70], textColor: white, fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 0: { cellWidth: 50 } },
        margin: { left: 10, right: 10 }
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // ── Footer ──
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(...purple);
      doc.rect(0, doc.internal.pageSize.getHeight() - 10, W, 10, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(7); doc.setFont('helvetica', 'italic');
      doc.text('Generated by Sai-Crick Pro  •  Made with ❤ by D. Sai Kiran Varma  •  Enjoy Free Cricket!', W / 2, doc.internal.pageSize.getHeight() - 3.5, { align: 'center' });
      doc.text(`Page ${i}/${pageCount}`, W - 12, doc.internal.pageSize.getHeight() - 3.5);
    }

    const filename = `${t1Name}_vs_${t2Name}_${Utils.formatDate(match.date)}.pdf`.replace(/\s+/g, '_');

    if (share && navigator.share) {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${t1Name} vs ${t2Name} Scorecard`, files: [file] });
        return filename;
      }
    }

    doc.save(filename);
    return filename;
  }
};
