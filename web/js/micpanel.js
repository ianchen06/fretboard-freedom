// The "Hearing" card: the input (a microphone or a USB audio interface such as a BOSS KATANA:GO),
// which channel of it to listen to, the output device, sensitivity (the noise gate) with Auto-set,
// and the live readout (note, tuner, level meter). These settings are kept in ff.settings, so every
// practice page shares them.
(function (root) {
  'use strict';
  const T = root.Theory;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Sensitivity 0–100 ↔ noise gate −25…−70 dBFS.
  const sensToGate = (v) => -25 - 0.45 * v;
  const gateToSens = (db) => Math.round(Math.min(100, Math.max(0, (-25 - db) / 0.45)));
  const dbToPct = (db) => Math.min(100, Math.max(0, ((db + 80) / 80) * 100));
  const NOTE_MIC = 'The app hears pitch, not which string you used. It catches wrong notes and wrong octaves; using the right string is up to you.';
  const STRING_NAMES = { 1: 'high E (1st)', 2: 'B (2nd)', 3: 'G (3rd)', 4: 'D (4th)', 5: 'A (5th)', 6: 'low E (6th)' };
  const MIC_WORDS = /microphone|\bmic\b|built-in|macbook|airpods|headset|webcam|camera/i;

  // What kind of input a device label is: 'katana' | 'interface' | 'mic'.
  function kindOf(label) {
    const l = String(label || '').replace(/^default\s*-\s*/i, '');
    if (/katana/i.test(l)) return 'katana';
    return l && !MIC_WORDS.test(l) ? 'interface' : 'mic';
  }

  function setup(engine, { store, preferFlat = () => false, onInputChange = () => {} }) {
    const $ = (id) => document.getElementById(id);
    const has = (id) => !!document.getElementById(id);
    const shared = { sensitivity: 58, deviceId: '', channel: 'both', outputId: '', ...store.get('ff.settings', {}) };
    const save = () => store.set('ff.settings', {
      ...store.get('ff.settings', {}),
      sensitivity: shared.sensitivity, deviceId: shared.deviceId, channel: shared.channel, outputId: shared.outputId,
    });
    engine.channel = shared.channel;
    engine.outputId = engine.canPickOutput ? shared.outputId : '';

    const applySensitivity = () => {
      if (engine.tracker) engine.tracker.setGateDb(sensToGate(shared.sensitivity));
      $('meterGate').style.left = `${dbToPct(sensToGate(shared.sensitivity))}%`;
    };
    $('sens').value = shared.sensitivity;
    applySensitivity();
    $('sens').addEventListener('input', (e) => { shared.sensitivity = Number(e.target.value); save(); applySensitivity(); });

    function setPill(state, text) {
      $('micPill').dataset.state = state;
      $('micPillText').textContent = text;
    }

    let kind = null;
    const inputKind = () => kind;

    async function enable({ recalibrate = false } = {}) {
      try {
        setPill('off', 'Starting…');
        await engine.enableMic(shared.deviceId || undefined);
        applySensitivity();
        const info = engine.inputInfo() || { label: '' };
        kind = kindOf(info.label);
        setPill('on', kind === 'mic' ? 'Listening' : 'Interface');
        $('micBtn').textContent = kind === 'mic' ? 'Turn microphone off' : 'Turn input off';
        $('micBtn').classList.add('on');
        if (!has('strCal') || !root.StringId) $('micNote').textContent = NOTE_MIC;
        await refreshDevices();
        await refreshOutputs();
        await suggestOutput();
        showTips();
        onInputChange(kind);
        if (recalibrate || !store.get('ff.calibrated', false)) {
          await autoCalibrate();
          store.set('ff.calibrated', true);
        }
      } catch (err) {
        engine.disableMic();
        const name = err && err.name;
        const msg = name === 'NotAllowedError' ? 'Microphone access is blocked. Allow it from the icon in the address bar, then try again.'
          : name === 'NotFoundError' ? 'No microphone found. Plug one in (or an audio interface) and try again.'
            : name === 'OverconstrainedError' ? 'That input device is gone. Pick another one.'
              : (err && err.message) || String(err);
        setPill('error', 'Mic error');
        $('micNote').textContent = msg;
        if (name === 'OverconstrainedError') { shared.deviceId = ''; save(); }
      }
    }

    function disable() {
      engine.disableMic();
      kind = null;
      setPill('off', 'Mic off');
      $('micBtn').textContent = 'Enable microphone';
      $('micBtn').classList.remove('on');
      if (has('channelRow')) $('channelRow').hidden = true;
      if (has('ioTip')) $('ioTip').hidden = true;
      show(null);
      onInputChange(null);
    }

    async function refreshDevices() {
      const inputs = await engine.listInputs();
      const sel = $('deviceSelect');
      if (inputs.length < 2) { sel.hidden = true; } else {
        const current = engine.currentDeviceId();
        sel.innerHTML = inputs.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || `Input ${i + 1}`)}</option>`).join('');
        sel.value = current || shared.deviceId || inputs[0].deviceId;
        sel.hidden = false;
      }
      // The channel picker only matters for a stereo input.
      if (has('channelRow')) {
        const info = engine.inputInfo();
        $('channelRow').hidden = !(info && (info.channels || 0) >= 2);
        syncChannel();
      }
    }
    $('deviceSelect').addEventListener('change', async (e) => {
      shared.deviceId = e.target.value;
      save();
      await enable({ recalibrate: true }); // a new device has a different noise floor
    });

    // ---------- channel ----------
    function syncChannel() {
      if (!has('channelSeg')) return;
      $('channelSeg').querySelectorAll('button').forEach((b) => {
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(b.dataset.value === shared.channel));
      });
    }
    if (has('channelSeg')) {
      $('channelSeg').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        shared.channel = b.dataset.value;
        save();
        engine.routeInput(shared.channel);
        engine.tracker && engine.tracker.reset();
        syncChannel();
        b.blur();
      });
      syncChannel();
    }

    // ---------- output ----------
    async function refreshOutputs() {
      if (!has('outputRow')) return;
      if (!engine.canPickOutput) { $('outputRow').hidden = true; return; }
      const outs = await engine.listOutputs();
      if (!outs.length) { $('outputRow').hidden = true; return; }
      const sel = $('outputSelect');
      sel.innerHTML = `<option value="">System default</option>${outs.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || `Output ${i + 1}`)}</option>`).join('')}`;
      sel.value = outs.some((d) => d.deviceId === shared.outputId) ? shared.outputId : '';
      $('outputRow').hidden = false;
    }
    async function setOutput(id) {
      try {
        await engine.setOutput(id);
        shared.outputId = id;
        save();
        if (has('outputSelect')) $('outputSelect').value = id;
      } catch (err) {
        if (has('ioTip')) { $('ioTip').hidden = false; $('ioTip').textContent = `Couldn’t switch the output: ${err.message}`; }
      }
    }
    if (has('outputSelect')) $('outputSelect').addEventListener('change', (e) => setOutput(e.target.value));

    // Picking an interface as the input: play through it too (once), so its headphones get the band.
    async function suggestOutput() {
      if (!engine.canPickOutput || shared.outputId || kind === 'mic') return;
      const info = engine.inputInfo();
      if (!info) return;
      const base = info.label.replace(/\s*\(.*\)\s*$/, '').toLowerCase();
      const outs = await engine.listOutputs();
      const match = outs.find((d) => d.label && d.label.toLowerCase().includes(base));
      if (match) await setOutput(match.deviceId);
    }

    function showTips() {
      if (!has('ioTip')) return;
      const tip = $('ioTip');
      const out = engine.canPickOutput ? '' : ' Set your computer’s sound output to it as well, so the band plays in its headphones.';
      if (kind === 'katana') {
        tip.innerHTML = '<b>KATANA:GO.</b> Turn on its <b>tuner</b> to send your dry guitar: notes are detected best that way, and you still hear the band. '
          + 'With the tuner off it sends your amp tone; keep delay and reverb low. '
          + 'Turn <b>Loopback</b> off in BOSS TONE STUDIO, or the band leaks into the input.' + esc(out);
      } else if (kind === 'interface') {
        tip.innerHTML = '<b>Audio interface.</b> If your guitar is on input 1 or 2 only, pick that channel. Turn off any loopback, or the band leaks into the input.' + esc(out);
      } else {
        tip.textContent = '';
      }
      tip.hidden = !tip.textContent;
    }

    // ---------- calibration ----------
    async function autoCalibrate() {
      if (!engine.micOn) return;
      const btn = $('calBtn');
      btn.textContent = 'Listening… stay quiet';
      btn.disabled = true;
      const noise = await engine.measureNoise(0.8);
      const gate = Math.min(-32, Math.max(-68, noise + 12));
      shared.sensitivity = gateToSens(gate);
      $('sens').value = shared.sensitivity;
      save();
      applySensitivity();
      btn.textContent = 'Auto-set';
      btn.disabled = false;
    }

    // ---------- string detection: teach it your guitar ----------
    // Pages that load js/stringid.js can tell strings apart from each note's stiffness (see that
    // file). The default model is a typical string set; 12 notes fit it to this guitar. Each note
    // must be the asked-for pitch and measure clearly, or it's asked for again.
    let teaching = null;
    function renderStrings() {
      if (!has('strCal')) return;
      if (!root.StringId) { $('strCal').hidden = true; return; }
      const saved = store.get('ff.strings', null);
      const on = !!(saved && saved.calibrated);
      $('strCalStatus').textContent = teaching ? 'Learning your strings…'
        : on ? `From the sound, fitted to your guitar${saved.date ? ` (${saved.date})` : ''}`
          : 'From the sound and your hand position (typical strings)';
      $('strCalStatus').classList.toggle('on', on && !teaching);
      $('strCalBtn').hidden = !!teaching;
      $('strCalBtn').textContent = on ? 'Teach it again' : 'Teach it your guitar';
      $('strCalCancel').hidden = !teaching;
      $('strCalForget').hidden = !!teaching || !on;
      $('strCalStep').hidden = !teaching;
      if (teaching) {
        const st = root.StringId.CALIBRATION[teaching.i];
        const fret = st.f === 0 ? `the open ${STRING_NAMES[st.s]} string` : `the ${STRING_NAMES[st.s]} string at the 7th fret`;
        $('strCalStep').innerHTML = `${teaching.retry ? `${esc(teaching.retry)} ` : ''}Pick <b>${esc(fret)}</b> and let it ring. Mute the other strings.<span class="str-cal-step-n">${teaching.i + 1} / ${root.StringId.CALIBRATION.length}</span>`;
      }
    }
    function stopTeaching() {
      if (teaching) teaching.off();
      teaching = null;
      renderStrings();
    }
    async function teach() {
      if (!root.StringId) return;
      if (!engine.micOn) await enable();
      if (!engine.micOn) return;
      const SI = root.StringId;
      const open = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
      teaching = { i: 0, got: [], retry: '', off: () => {} };
      teaching.off = engine.on('timbre', ({ midi, feat }) => {
        const t = teaching;
        const st = SI.CALIBRATION[t.i];
        const want = open[st.s] + st.f;
        const nm = (m) => `${T.noteName(m)}${Math.floor(m / 12) - 1}`;
        if (midi !== want) {
          t.retry = T.noteName(midi) === T.noteName(want) ? `Heard ${nm(midi)}, an octave off from ${nm(want)}: check the string.` : `Heard ${nm(midi)}, not ${nm(want)}: is it the right string, and in tune?`;
          renderStrings();
          return;
        }
        if (!feat || feat.sigma > 0.6) { t.retry = 'Didn’t catch that clearly. Once more, a little harder.'; renderStrings(); return; }
        t.got.push({ s: st.s, f: st.f, lnB: feat.lnB, sigma: feat.sigma });
        t.retry = '';
        t.i++;
        if (t.i < SI.CALIBRATION.length) { renderStrings(); return; }
        const model = SI.StringModel.fit(t.got);
        store.set('ff.strings', { ...model.toJSON(), date: new Date().toISOString().slice(0, 10) });
        stopTeaching();
        root.dispatchEvent(new Event('ff:strings'));
      });
      renderStrings();
    }
    if (has('strCal')) {
      $('strCalBtn').addEventListener('click', teach);
      $('strCalCancel').addEventListener('click', stopTeaching);
      $('strCalForget').addEventListener('click', () => {
        store.set('ff.strings', null);
        renderStrings();
        root.dispatchEvent(new Event('ff:strings'));
      });
      renderStrings();
    }

    $('micBtn').addEventListener('click', (e) => { e.currentTarget.blur(); engine.micOn ? disable() : enable(); });
    $('micPill').addEventListener('click', () => (engine.micOn ? disable() : enable()));
    $('calBtn').addEventListener('click', () => (engine.micOn ? autoCalibrate() : enable()));

    // ---------- live readout: the note, the tuner needle and the level meter ----------
    let heldUntil = 0;
    function show(info) {
      const now = performance.now();
      const needle = $('tunerNeedle');
      if (info && info.midi != null) {
        $('heardNote').textContent = T.noteName(info.midi, preferFlat());
        $('heardOct').textContent = Math.floor(info.midi / 12) - 1;
        $('heard').dataset.on = 'true';
        const c = info.cents;
        needle.style.left = `${50 + Math.max(-50, Math.min(50, c))}%`;
        needle.className = `tuner-needle live ${Math.abs(c) < 8 ? 'good' : Math.abs(c) < 20 ? 'close' : 'off'}`;
        const cr = Math.round(c);
        $('tunerText').textContent = Math.abs(cr) < 4 ? `In tune · ${info.freq.toFixed(1)} Hz` : `${cr > 0 ? '+' : ''}${cr}¢ · ${cr > 0 ? 'sharp' : 'flat'}`;
        heldUntil = now + 350;
      } else if (now > heldUntil) {
        $('heard').dataset.on = 'false';
        needle.className = 'tuner-needle';
        if (!info) { $('heardNote').textContent = '–'; $('heardOct').textContent = ''; }
      }
    }
    engine.on('frame', (info) => {
      $('meterFill').style.width = `${dbToPct(info.db)}%`;
      show(info);
    });

    return { enable, disable, inputKind, show };
  }

  root.MicPanel = { setup, kindOf };
})(window);
