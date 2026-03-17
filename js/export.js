// SuperCrick Pro - Export & Share
const ExportDoc = {
  async exportScorecard(matchId) {
    if (!matchId) matchId = Scoring.matchId;
    if (!matchId) { Utils.toast('No match to export'); return; }

    try {
      Utils.toast('Generating scorecard...');
      const doc = await ExportDoc._buildDocx(matchId);
      const blob = await docx.Packer.toBlob(doc);

      const match = await DB.getMatch(matchId);
      const team1 = await DB.getTeam(match.team1Id);
      const team2 = await DB.getTeam(match.team2Id);
      const filename = `${team1?.name || 'Team1'}_vs_${team2?.name || 'Team2'}_${Utils.formatDate(match.date)}.docx`.replace(/\s+/g, '_');

      saveAs(blob, filename);
      Utils.toast('Scorecard exported!');
    } catch (e) {
      console.error('Export error:', e);
      Utils.toast('Export failed: ' + e.message);
    }
  },

  async shareScorecard(matchId) {
    if (!matchId) matchId = Scoring.matchId;
    if (!matchId) { Utils.toast('No match to share'); return; }

    try {
      const doc = await ExportDoc._buildDocx(matchId);
      const blob = await docx.Packer.toBlob(doc);

      const match = await DB.getMatch(matchId);
      const team1 = await DB.getTeam(match.team1Id);
      const team2 = await DB.getTeam(match.team2Id);
      const filename = `${team1?.name || 'Team1'}_vs_${team2?.name || 'Team2'}_Scorecard.docx`.replace(/\s+/g, '_');

      const file = new File([blob], filename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${team1?.name} vs ${team2?.name} - Scorecard`,
          text: match.result || 'Cricket Scorecard',
          files: [file]
        });
      } else {
        // Fallback: download
        saveAs(blob, filename);
        Utils.toast('File downloaded (sharing not supported on this browser)');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Share error:', e);
        Utils.toast('Share failed: ' + e.message);
      }
    }
  },

  async _buildDocx(matchId) {
    const { Document, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType,
      HeadingLevel, BorderStyle, WidthType, ShadingType, TableLayoutType } = docx;

    const match = await DB.getMatch(matchId);
    const team1 = await DB.getTeam(match.team1Id);
    const team2 = await DB.getTeam(match.team2Id);
    const innings = await DB.getMatchInnings(matchId);
    const allBalls = await DB.getMatchBalls(matchId);
    await App.refreshPlayerMap();
    const players = App._playerMap;

    const sections = [];

    // Title
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({ text: 'SUPERCRICK PRO', bold: true, size: 28, color: '6C5CE7', font: 'Arial' })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: 'Match Scorecard', size: 20, color: '555555', font: 'Arial' })
        ]
      })
    );

    // Match Info
    const t1Name = team1?.name || 'Team 1';
    const t2Name = team2?.name || 'Team 2';

    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${t1Name}  vs  ${t2Name}`, bold: true, size: 26, font: 'Arial' })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${match.format || 'T20'} Match`, size: 20, color: '6C5CE7', font: 'Arial' }),
          new TextRun({ text: `  •  ${match.venue || ''}  •  ${Utils.formatDate(match.date)}`, size: 18, color: '777777', font: 'Arial' })
        ]
      })
    );

    if (match.result) {
      sections.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: match.result, bold: true, size: 22, color: '00a844', font: 'Arial' })
          ]
        })
      );
    }

    // Each innings
    for (const inn of innings) {
      const battingTeam = inn.battingTeamId === match.team1Id ? team1 : team2;
      const bowlingTeam = inn.bowlingTeamId === match.team1Id ? team1 : team2;
      const innBalls = allBalls.filter(b => b.inningsId === inn.id);

      // Innings header
      sections.push(
        new Paragraph({
          spacing: { before: 300, after: 100 },
          children: [
            new TextRun({
              text: `${battingTeam?.name || 'Team'} — ${inn.inningsNumber === 1 ? '1st' : '2nd'} Innings: ${inn.totalRuns || 0}/${inn.totalWickets || 0} (${inn.totalOvers || '0.0'} ov)`,
              bold: true, size: 22, font: 'Arial'
            })
          ]
        })
      );

      // Batting table
      const battingXI = inn.battingXI || [];
      const batStats = {};
      for (const pid of battingXI) {
        batStats[pid] = { runs: 0, balls: 0, fours: 0, sixes: 0, howOut: 'did not bat' };
      }

      for (const ball of innBalls) {
        if (batStats[ball.batsmanId]) {
          const isLegal = !ball.extras?.type?.match(/^(wide)$/);
          if (isLegal) batStats[ball.batsmanId].balls++;
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

      // Create batting table
      const batHeaderRow = new TableRow({
        tableHeader: true,
        children: ['Batsman', 'How Out', 'R', 'B', '4s', '6s', 'SR'].map(h =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, font: 'Arial', color: 'ffffff' })] })],
            shading: { fill: '6C5CE7', type: ShadingType.SOLID },
            width: { size: h === 'Batsman' || h === 'How Out' ? 2500 : 800, type: WidthType.DXA }
          })
        )
      });

      const batRows = [batHeaderRow];
      for (const pid of battingXI) {
        const bs = batStats[pid];
        if (bs.howOut === 'did not bat') continue;
        const p = players[pid];
        const sr = bs.balls > 0 ? (bs.runs / bs.balls * 100).toFixed(1) : '-';
        const isNotOut = bs.howOut === 'not out';

        batRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p?.name || '?', bold: true, size: 16, font: 'Arial' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: bs.howOut, size: 14, color: '777777', font: 'Arial' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${bs.runs}${isNotOut ? '*' : ''}`, bold: true, size: 16, font: 'Arial', color: bs.runs >= 50 ? '1a73e8' : '000000' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${bs.balls}`, size: 16, font: 'Arial' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${bs.fours}`, size: 16, font: 'Arial' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${bs.sixes}`, size: 16, font: 'Arial' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sr, size: 16, font: 'Arial' })] })] })
          ]
        }));
      }

      sections.push(new Table({
        rows: batRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED
      }));

      // Extras
      const ext = inn.extras || {};
      const totalExtras = (ext.wides || 0) + (ext.noballs || 0) + (ext.byes || 0) + (ext.legbyes || 0);
      sections.push(
        new Paragraph({
          spacing: { before: 100 },
          children: [
            new TextRun({ text: `Extras: ${totalExtras}  `, bold: true, size: 16, font: 'Arial' }),
            new TextRun({ text: `(Wd ${ext.wides || 0}, Nb ${ext.noballs || 0}, B ${ext.byes || 0}, Lb ${ext.legbyes || 0})`, size: 14, color: '777777', font: 'Arial' })
          ]
        })
      );

      // Bowling table
      const bowlData = {};
      for (const ball of innBalls) {
        if (!bowlData[ball.bowlerId]) bowlData[ball.bowlerId] = { balls: 0, runs: 0, wickets: 0, dots: 0 };
        const isLegal = !ball.extras?.type?.match(/^(wide|noball)$/);
        if (isLegal) bowlData[ball.bowlerId].balls++;
        const r = (ball.extras?.type === 'bye' || ball.extras?.type === 'legbye') ? 0 : (ball.totalRuns || 0);
        bowlData[ball.bowlerId].runs += r;
        if (r === 0 && isLegal) bowlData[ball.bowlerId].dots++;
        if (ball.isWicket && !['runout', 'retired', 'obstructing'].includes(ball.wicketType)) {
          bowlData[ball.bowlerId].wickets++;
        }
      }

      sections.push(
        new Paragraph({
          spacing: { before: 200, after: 50 },
          children: [new TextRun({ text: 'Bowling', bold: true, size: 20, font: 'Arial' })]
        })
      );

      const bowlHeaderRow = new TableRow({
        tableHeader: true,
        children: ['Bowler', 'O', 'R', 'W', 'Econ', 'Dots'].map(h =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, font: 'Arial', color: 'ffffff' })] })],
            shading: { fill: '162240', type: ShadingType.SOLID },
            width: { size: h === 'Bowler' ? 3000 : 1000, type: WidthType.DXA }
          })
        )
      });

      const bowlRows = [bowlHeaderRow];
      const bowlingXI = inn.bowlingXI || [];
      for (const pid of bowlingXI) {
        const bd = bowlData[pid];
        if (!bd) continue;
        const p = players[pid];
        const ov = Utils.ballsToOvers(bd.balls);
        const econ = bd.balls > 0 ? (bd.runs / bd.balls * 6).toFixed(1) : '-';

        bowlRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p?.name || '?', bold: true, size: 16, font: 'Arial' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ov.display, size: 16, font: 'Arial' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${bd.runs}`, size: 16, font: 'Arial' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${bd.wickets}`, bold: bd.wickets >= 3, size: 16, font: 'Arial', color: bd.wickets >= 3 ? '1a73e8' : '000000' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: econ, size: 16, font: 'Arial' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${bd.dots}`, size: 16, font: 'Arial' })] })] })
          ]
        }));
      }

      if (bowlRows.length > 1) {
        sections.push(new Table({
          rows: bowlRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED
        }));
      }
    }

    // Footer
    sections.push(
      new Paragraph({ spacing: { before: 400 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: '───────────────────────────────────', color: 'cccccc', size: 14, font: 'Arial' })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 50 },
        children: [
          new TextRun({ text: 'Generated by SuperCrick Pro', size: 16, color: '6C5CE7', bold: true, font: 'Arial' })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Made by Sai Kiran', size: 14, color: '999999', font: 'Arial' })
        ]
      })
    );

    return new Document({
      sections: [{
        properties: {},
        children: sections
      }]
    });
  }
};
