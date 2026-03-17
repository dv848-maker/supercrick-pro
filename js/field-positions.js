// SuperCrick Pro - Field Positions
const FieldPos = {
  _activePositions: new Set(),
  _svg: null,

  POSITIONS: [
    // Close catching
    { id: 'slip1', name: '1st Slip', x: 215, y: 155, zone: 'close' },
    { id: 'slip2', name: '2nd Slip', x: 225, y: 145, zone: 'close' },
    { id: 'slip3', name: '3rd Slip', x: 235, y: 137, zone: 'close' },
    { id: 'gully', name: 'Gully', x: 245, y: 130, zone: 'close' },
    { id: 'legslip', name: 'Leg Slip', x: 175, y: 155, zone: 'close' },
    { id: 'shortleg', name: 'Short Leg', x: 165, y: 170, zone: 'close' },
    { id: 'sillypoint', name: 'Silly Point', x: 230, y: 170, zone: 'close' },
    { id: 'sillymidoff', name: 'Silly Mid Off', x: 215, y: 190, zone: 'close' },
    { id: 'sillymidon', name: 'Silly Mid On', x: 180, y: 190, zone: 'close' },

    // Inner ring - off side
    { id: 'point', name: 'Point', x: 270, y: 140, zone: 'inner' },
    { id: 'cover', name: 'Cover', x: 280, y: 180, zone: 'inner' },
    { id: 'extracover', name: 'Extra Cover', x: 270, y: 210, zone: 'inner' },
    { id: 'midoff', name: 'Mid Off', x: 230, y: 245, zone: 'inner' },
    { id: 'thirdman', name: 'Third Man', x: 260, y: 110, zone: 'inner' },

    // Inner ring - leg side
    { id: 'midon', name: 'Mid On', x: 168, y: 245, zone: 'inner' },
    { id: 'midwicket', name: 'Mid Wicket', x: 130, y: 210, zone: 'inner' },
    { id: 'squareleg', name: 'Square Leg', x: 120, y: 170, zone: 'inner' },
    { id: 'fineleg', name: 'Fine Leg', x: 140, y: 120, zone: 'inner' },
    { id: 'forwardsquareleg', name: 'Fwd Square Leg', x: 125, y: 195, zone: 'inner' },

    // Boundary - off side
    { id: 'deeppoint', name: 'Deep Point', x: 330, y: 130, zone: 'boundary' },
    { id: 'deepcover', name: 'Deep Cover', x: 340, y: 190, zone: 'boundary' },
    { id: 'deepextracover', name: 'Deep Extra Cover', x: 330, y: 230, zone: 'boundary' },
    { id: 'longoff', name: 'Long Off', x: 260, y: 310, zone: 'boundary' },
    { id: 'deepthirdman', name: 'Deep Third Man', x: 310, y: 80, zone: 'boundary' },
    { id: 'sweepercoveroff', name: 'Sweeper (Off)', x: 340, y: 160, zone: 'boundary' },

    // Boundary - leg side
    { id: 'longon', name: 'Long On', x: 140, y: 310, zone: 'boundary' },
    { id: 'deepmidwicket', name: 'Deep Mid Wicket', x: 75, y: 230, zone: 'boundary' },
    { id: 'deepsquareleg', name: 'Deep Square Leg', x: 65, y: 170, zone: 'boundary' },
    { id: 'deepfineleg', name: 'Deep Fine Leg', x: 95, y: 85, zone: 'boundary' },
    { id: 'cowcorner', name: 'Cow Corner', x: 100, y: 280, zone: 'boundary' },
    { id: 'sweeperleg', name: 'Sweeper (Leg)', x: 60, y: 140, zone: 'boundary' },
    { id: 'longleg', name: 'Long Leg', x: 75, y: 110, zone: 'boundary' }
  ],

  init() {
    const container = document.getElementById('field-container');
    container.innerHTML = '';
    FieldPos._activePositions = new Set();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 400');
    svg.classList.add('field-svg');

    // Ground oval
    const ground = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ground.setAttribute('cx', '200');
    ground.setAttribute('cy', '195');
    ground.setAttribute('rx', '180');
    ground.setAttribute('ry', '175');
    ground.classList.add('field-ground');
    svg.appendChild(ground);

    // 30-yard circle
    const innerRing = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    innerRing.setAttribute('cx', '200');
    innerRing.setAttribute('cy', '190');
    innerRing.setAttribute('rx', '95');
    innerRing.setAttribute('ry', '90');
    innerRing.classList.add('field-inner-ring');
    svg.appendChild(innerRing);

    // Pitch rectangle
    const pitch = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pitch.setAttribute('x', '193');
    pitch.setAttribute('y', '155');
    pitch.setAttribute('width', '14');
    pitch.setAttribute('height', '65');
    pitch.setAttribute('rx', '2');
    pitch.classList.add('field-pitch');
    svg.appendChild(pitch);

    // Crease lines
    const crease1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    crease1.setAttribute('x1', '188'); crease1.setAttribute('y1', '162');
    crease1.setAttribute('x2', '212'); crease1.setAttribute('y2', '162');
    crease1.classList.add('field-crease');
    svg.appendChild(crease1);

    const crease2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    crease2.setAttribute('x1', '188'); crease2.setAttribute('y1', '213');
    crease2.setAttribute('x2', '212'); crease2.setAttribute('y2', '213');
    crease2.classList.add('field-crease');
    svg.appendChild(crease2);

    // "OFF" and "LEG" labels
    const offLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    offLabel.setAttribute('x', '310'); offLabel.setAttribute('y', '195');
    offLabel.setAttribute('fill', 'rgba(255,255,255,0.2)');
    offLabel.setAttribute('font-size', '12');
    offLabel.setAttribute('font-family', 'Inter, sans-serif');
    offLabel.setAttribute('font-weight', '700');
    offLabel.textContent = 'OFF';
    svg.appendChild(offLabel);

    const legLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    legLabel.setAttribute('x', '70'); legLabel.setAttribute('y', '195');
    legLabel.setAttribute('fill', 'rgba(255,255,255,0.2)');
    legLabel.setAttribute('font-size', '12');
    legLabel.setAttribute('font-family', 'Inter, sans-serif');
    legLabel.setAttribute('font-weight', '700');
    legLabel.textContent = 'LEG';
    svg.appendChild(legLabel);

    // Field positions
    for (const pos of FieldPos.POSITIONS) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('field-position');
      g.setAttribute('data-id', pos.id);
      g.setAttribute('data-name', pos.name);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.classList.add('fp-dot');
      g.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y - 12);
      text.classList.add('fp-label');
      text.textContent = pos.name;
      g.appendChild(text);

      g.addEventListener('click', () => FieldPos.togglePosition(pos));
      svg.appendChild(g);
    }

    container.appendChild(svg);
    FieldPos._svg = svg;

    // Load saved setups
    FieldPos._loadSavedSetups();
  },

  togglePosition(pos) {
    const el = FieldPos._svg.querySelector(`[data-id="${pos.id}"]`);
    if (FieldPos._activePositions.has(pos.id)) {
      FieldPos._activePositions.delete(pos.id);
      el.classList.remove('active');
    } else {
      if (FieldPos._activePositions.size >= 11) {
        Utils.toast('Maximum 11 fielders (including bowler & keeper)');
        return;
      }
      FieldPos._activePositions.add(pos.id);
      el.classList.add('active');
    }

    document.getElementById('field-position-label').textContent =
      FieldPos._activePositions.size > 0
        ? `${FieldPos._activePositions.size} fielders placed`
        : 'Tap positions to place fielders';

    Utils.haptic();
  },

  clearAll() {
    FieldPos._activePositions.clear();
    FieldPos._svg?.querySelectorAll('.field-position').forEach(g => g.classList.remove('active'));
    document.getElementById('field-position-label').textContent = 'Tap positions to place fielders';
  },

  async saveSetup() {
    if (FieldPos._activePositions.size === 0) {
      Utils.toast('Place some fielders first');
      return;
    }

    const name = prompt('Setup name (e.g., "Pace attack", "Spin setting"):');
    if (!name) return;

    await DB.addFieldSetup({
      name,
      positions: [...FieldPos._activePositions]
    });

    Utils.toast('Field setup saved');
    FieldPos._loadSavedSetups();
  },

  async _loadSavedSetups() {
    const setups = await DB.getAllFieldSetups();
    const container = document.getElementById('field-saved-setups');

    if (setups.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '<h4 style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">Saved Setups</h4>';
    container.innerHTML += setups.map(s => `
      <div class="setup-card" onclick="FieldPos.loadSetup(${s.id})">
        <div>
          <h4>${s.name}</h4>
          <p>${(s.positions || []).length} positions</p>
        </div>
        <div class="setup-actions">
          <button class="icon-btn" onclick="event.stopPropagation();FieldPos.deleteSetup(${s.id})" style="width:32px;height:32px">
            <span class="material-icons-round" style="font-size:18px;color:var(--danger)">delete</span>
          </button>
        </div>
      </div>
    `).join('');
  },

  async loadSetup(id) {
    const setup = await DB.fieldSetups.get(id);
    if (!setup) return;

    FieldPos.clearAll();
    for (const posId of setup.positions) {
      const el = FieldPos._svg?.querySelector(`[data-id="${posId}"]`);
      if (el) {
        FieldPos._activePositions.add(posId);
        el.classList.add('active');
      }
    }

    document.getElementById('field-position-label').textContent =
      `${FieldPos._activePositions.size} fielders (${setup.name})`;
  },

  async deleteSetup(id) {
    const ok = await Utils.confirm('Delete Setup', 'Remove this saved field setup?');
    if (!ok) return;
    await DB.deleteFieldSetup(id);
    FieldPos._loadSavedSetups();
  }
};
