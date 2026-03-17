// SuperCrick Pro - Edit History & Undo
const History = {
  // Record an edit to a ball
  async recordEdit(ballId, oldData, newData, reason = '') {
    const ball = await DB.getBall(ballId);
    if (!ball) return;

    const editEntry = {
      timestamp: new Date().toISOString(),
      oldData: Utils.clone(oldData),
      newData: Utils.clone(newData),
      reason
    };

    const editHistory = ball.editHistory || [];
    editHistory.push(editEntry);
    await DB.updateBall(ballId, { ...newData, isEdited: true, editHistory });
  },

  // Get edit history for a ball
  async getBallHistory(ballId) {
    const ball = await DB.getBall(ballId);
    return ball?.editHistory || [];
  },

  // Get all edits for an innings
  async getInningsEdits(inningsId) {
    const balls = await DB.getInningsBalls(inningsId);
    const edits = [];
    for (const ball of balls) {
      if (ball.isEdited && ball.editHistory) {
        for (const edit of ball.editHistory) {
          edits.push({
            ballId: ball.id,
            over: ball.over,
            ballNum: ball.ball,
            ...edit
          });
        }
      }
    }
    return edits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
};
