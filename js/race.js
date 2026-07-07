/* SUPER SLOT CAR '98 — hero canvas: a tiny emulated race.
   Toy-like, not physical: 4 chunky pixel cars lap a rounded plastic track,
   overtake, occasionally wreck (TAKEDOWN!) and respawn, while card pickups
   pop up beside the player car in slow motion — the deck driving the car.
   Internal resolution 360x200, upscaled by CSS with image-rendering:pixelated. */
(function () {
  'use strict';

  var canvas = document.getElementById('race');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;

  // ---------------------------------------------------------- palette
  var INK = '#0e141c', INK2 = '#0a0a14';
  var ROAD = '#2a3140', EDGE = '#4a5468', LANE = '#3c465a';
  var AMBER = '#ffb300', RED = '#ff4b3e', CYAN = '#35c4ee';
  var WHITE = '#f2f5f7', STEEL = '#8a97a8', GOLD = '#ffd454';
  var PANEL = '#17202c';

  // ------------------------------------------------------------ track
  // Centerline rounded rect, clockwise. Road is 34 wide; lanes sit +/-7.
  var X0 = 33, Y0 = 39, X1 = 327, Y1 = 161, R = 42, HW = 17;
  var PI = Math.PI, TAU = PI * 2;

  var segs = (function () {
    var sw = X1 - X0 - 2 * R, sh = Y1 - Y0 - 2 * R, arc = PI * R / 2;
    return [
      { t: 'line', len: sw, x: X0 + R, y: Y0, dx: 1, dy: 0 },
      { t: 'arc', len: arc, cx: X1 - R, cy: Y0 + R, a0: -PI / 2 },
      { t: 'line', len: sh, x: X1, y: Y0 + R, dx: 0, dy: 1 },
      { t: 'arc', len: arc, cx: X1 - R, cy: Y1 - R, a0: 0 },
      { t: 'line', len: sw, x: X1 - R, y: Y1, dx: -1, dy: 0 },
      { t: 'arc', len: arc, cx: X0 + R, cy: Y1 - R, a0: PI / 2 },
      { t: 'line', len: sh, x: X0, y: Y1 - R, dx: 0, dy: -1 },
      { t: 'arc', len: arc, cx: X0 + R, cy: Y0 + R, a0: PI }
    ];
  })();
  var TRACK_LEN = 0;
  for (var s = 0; s < segs.length; s++) TRACK_LEN += segs[s].len;

  // Position on centerline at distance d, offset off px toward the infield.
  function posAt(d, off, out) {
    d = ((d % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
    for (var i = 0; i < segs.length; i++) {
      var sg = segs[i];
      if (d > sg.len) { d -= sg.len; continue; }
      var ang, x, y;
      if (sg.t === 'line') {
        x = sg.x + sg.dx * d;
        y = sg.y + sg.dy * d;
        ang = Math.atan2(sg.dy, sg.dx);
      } else {
        var a = sg.a0 + (d / sg.len) * (PI / 2);
        x = sg.cx + Math.cos(a) * R;
        y = sg.cy + Math.sin(a) * R;
        ang = a + PI / 2;
      }
      out.x = x + Math.cos(ang + PI / 2) * off;
      out.y = y + Math.sin(ang + PI / 2) * off;
      out.ang = ang;
      out.curve = sg.t === 'arc';
      return out;
    }
    out.x = X0; out.y = Y0; out.ang = 0; out.curve = false;
    return out;
  }
  var START_D = (X1 - X0 - 2 * R) / 2; // middle of the top straight

  // ------------------------------------------------- prerendered track
  var trackCv = document.createElement('canvas');
  trackCv.width = W; trackCv.height = H;
  (function paintTrack() {
    var g = trackCv.getContext('2d');
    g.fillStyle = INK;
    g.fillRect(0, 0, W, H);

    function ringPath(x0, y0, x1, y1, r) {
      g.beginPath();
      g.moveTo(x0 + r, y0);
      g.arcTo(x1, y0, x1, y1, r);
      g.arcTo(x1, y1, x0, y1, r);
      g.arcTo(x0, y1, x0, y0, r);
      g.arcTo(x0, y0, x1, y0, r);
      g.closePath();
    }
    function ring(x0, y0, x1, y1, r, w, style) {
      g.strokeStyle = style;
      g.lineWidth = w;
      ringPath(x0, y0, x1, y1, r);
      g.stroke();
    }
    ring(X0, Y0, X1, Y1, R, HW * 2, ROAD);  // asphalt
    ring(X0, Y0, X1, Y1, R, 2, LANE);       // centerline (dashes stamped over)

    // Dashed centerline: stamp road-colored gaps along the line.
    var st = { x: 0, y: 0, ang: 0, curve: false };
    g.fillStyle = ROAD;
    for (var d = 0; d < TRACK_LEN; d += 9) {
      posAt(d, 0, st);
      g.fillRect(Math.round(st.x) - 2, Math.round(st.y) - 2, 4, 4);
    }

    // Edges.
    g.save();
    g.setLineDash([]);
    g.strokeStyle = EDGE; g.lineWidth = 2;
    g.beginPath(); g.roundRect ? g.roundRect(X0 - HW, Y0 - HW, X1 - X0 + HW * 2, Y1 - Y0 + HW * 2, R + HW) : 0; g.stroke();
    g.beginPath(); g.roundRect ? g.roundRect(X0 + HW, Y0 + HW, X1 - X0 - HW * 2, Y1 - Y0 - HW * 2, R - HW) : 0; g.stroke();
    g.restore();

    // Kerb stripes on the four corner arcs (outer edge).
    for (var i = 0; i < segs.length; i++) {
      var sg = segs[i];
      if (sg.t !== 'arc') continue;
      var steps = 6;
      for (var k = 0; k < steps; k++) {
        g.strokeStyle = (k % 2 === 0) ? RED : WHITE;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(sg.cx, sg.cy, R + HW - 1, sg.a0 + (k / steps) * PI / 2,
              sg.a0 + ((k + 1) / steps) * PI / 2);
        g.stroke();
      }
    }

    // Start / finish checker across the top straight.
    var sx = Math.round(X0 + R + START_D);
    for (var row = 0; row < Math.ceil(HW * 2 / 4); row++) {
      for (var col = 0; col < 2; col++) {
        g.fillStyle = ((row + col) % 2 === 0) ? WHITE : INK2;
        g.fillRect(sx - 4 + col * 4, Y0 - HW + row * 4, 4,
                   Math.min(4, HW * 2 - row * 4));
      }
    }

    // Infield: faint tyre-dot texture.
    g.fillStyle = 'rgba(74,84,104,0.18)';
    for (var ty = Y0 + HW + 10; ty < Y1 - HW - 6; ty += 12) {
      for (var tx = X0 + HW + 12 + ((ty / 12) % 2) * 6; tx < X1 - HW - 8; tx += 12) {
        g.fillRect(tx, ty, 2, 2);
      }
    }
  })();

  // ------------------------------------------------------------- cars
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function makeCar(o) {
    return {
      name: o.name, body: o.body, dark: o.dark, stripe: o.stripe || null,
      player: !!o.player,
      dist: o.dist, lane: o.lane, laneF: o.lane,
      base: o.base, phase: rnd(0, TAU), wave: rnd(0.25, 0.45),
      boost: 0, ghost: 0,
      state: 'race', stT: 0,          // state timer
      // crash tumble scratch:
      cx: 0, cy: 0, cang: 0, vx: 0, vy: 0, spin: 0,
      p: { x: 0, y: 0, ang: 0, curve: false }
    };
  }

  var cars = [
    makeCar({ name: 'player', body: RED, dark: '#a82420', stripe: GOLD, player: true, dist: START_D - 26, lane: -1, base: 56 }),
    makeCar({ name: 'green', body: '#69d84f', dark: '#3d8f2c', dist: START_D - 68, lane: 1, base: 55 }),
    makeCar({ name: 'orange', body: '#ff8c28', dark: '#b25a12', dist: START_D - 110, lane: -1, base: 54.5 }),
    makeCar({ name: 'purple', body: '#b06ceb', dark: '#6f3fa3', dist: START_D - 152, lane: 1, base: 55.5 })
  ];
  var player = cars[0];

  // ------------------------------------------------------- fx buffers
  var skids = [];      // {x, y, a}
  var parts = [];      // {x, y, vx, vy, life, max, c, s}
  var floaters = [];   // {x, y, text, life, max, c}

  function addSkid(x, y) {
    if (skids.length > 300) skids.splice(0, skids.length - 300);
    skids.push({ x: x, y: y, a: 0.6 });
  }
  function boomAt(x, y) {
    var colors = [AMBER, RED, WHITE, GOLD, STEEL];
    for (var i = 0; i < 14; i++) {
      var a = rnd(0, TAU), sp = rnd(18, 70);
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rnd(0.45, 0.8), max: 0.8,
        c: colors[(Math.random() * colors.length) | 0], s: rnd(1, 3) | 0 || 1
      });
    }
  }
  function floatText(x, y, text, c) {
    floaters.push({ x: x, y: y, text: text, life: 1.3, max: 1.3, c: c });
  }

  // ----------------------------------------------------- card pickups
  var CARD_DECK = [
    { label: '+2 TOP SPEED', kind: 'buff' },
    { label: 'NITRO BURST', kind: 'boost' },
    { label: 'SABOTAGE!', kind: 'sabotage' },
    { label: '+3 HANDLING', kind: 'buff' },
    { label: 'SCRAP PLATING', kind: 'buff' },
    { label: 'GHOST 15s', kind: 'ghost' }
  ];
  var deckIdx = 0;
  var cardPop = null;             // {t, label, kind, resolved}
  var nextCardAt = 2.6;
  var nextCrashAt = 4.5;
  var sabotageAt = -1;

  // -------------------------------------------------------- simulation
  var timescale = 1;

  function anyCrashed() {
    for (var i = 1; i < cars.length; i++) {
      if (cars[i].state !== 'race') return true;
    }
    return false;
  }

  function startCrash(car) {
    if (car.state !== 'race') return;
    car.state = 'wobble';
    car.stT = 0;
  }

  function crashRandomRival() {
    var order = [1, 2, 3].sort(function () { return Math.random() - 0.5; });
    for (var i = 0; i < order.length; i++) {
      if (cars[order[i]].state === 'race') { startCrash(cars[order[i]]); return; }
    }
  }

  function update(t, dt) {
    // --- card pickup scheduling / slow-mo curve ---
    if (!cardPop && t >= nextCardAt) {
      cardPop = { t: 0, label: CARD_DECK[deckIdx].label, kind: CARD_DECK[deckIdx].kind, resolved: false };
      deckIdx = (deckIdx + 1) % CARD_DECK.length;
      nextCardAt = t + rnd(5.6, 7.4);
    }
    if (cardPop) {
      cardPop.t += dt; // real time, unaffected by slow-mo
      var ct = cardPop.t;
      if (ct < 0.3) timescale = 1 - (ct / 0.3) * 0.72;
      else if (ct < 1.15) timescale = 0.28;
      else if (ct < 1.6) timescale = 0.28 + ((ct - 1.15) / 0.45) * 0.72;
      else timescale = 1;
      if (!cardPop.resolved && ct >= 1.15) {
        cardPop.resolved = true;
        if (cardPop.kind === 'boost' || cardPop.kind === 'buff') player.boost = 2.1;
        if (cardPop.kind === 'ghost') player.ghost = 2.6;
        if (cardPop.kind === 'sabotage') sabotageAt = t + 0.5;
        floatText(player.p.x, player.p.y - 12,
          cardPop.kind === 'sabotage' ? 'HEH.' : 'INSTALLED', CYAN);
      }
      if (ct > 1.9) cardPop = null;
    } else {
      timescale = 1;
    }

    // --- crash scheduling ---
    if (sabotageAt > 0 && t >= sabotageAt) { crashRandomRival(); sabotageAt = -1; }
    if (t >= nextCrashAt) {
      if (!anyCrashed()) crashRandomRival();
      nextCrashAt = t + rnd(7.5, 13);
    }

    var sdt = dt * timescale;

    // --- cars ---
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      c.stT += sdt;

      if (c.state === 'wobble') {
        // Losing it into the corner: lateral shudder + skids.
        c.dist += c.base * 0.9 * sdt;
        posAt(c.dist, c.laneF * 7 + Math.sin(c.stT * 34) * 3, c.p);
        if (skidTick(t)) {
          addSkid(c.p.x + rnd(-2, 2), c.p.y + rnd(-2, 2));
        }
        if (c.stT > 0.8) {
          c.state = 'crash'; c.stT = 0;
          c.cx = c.p.x; c.cy = c.p.y; c.cang = c.p.ang;
          var fly = c.p.ang - PI / 2 * (c.laneF < 0 ? 1 : -1) * 0.55;
          var v = c.base * 1.5;
          c.vx = Math.cos(c.p.ang) * v * 0.7 + Math.cos(fly) * v * 0.5;
          c.vy = Math.sin(c.p.ang) * v * 0.7 + Math.sin(fly) * v * 0.5;
          c.spin = rnd(9, 14) * (Math.random() < 0.5 ? -1 : 1);
          boomAt(c.cx, c.cy);
          floatText(c.cx, c.cy - 14, 'TAKEDOWN!', AMBER);
        }
        continue;
      }
      if (c.state === 'crash') {
        var damp = Math.pow(0.18, sdt);
        c.vx *= damp; c.vy *= damp;
        c.cx += c.vx * sdt; c.cy += c.vy * sdt;
        c.cang += c.spin * sdt;
        c.spin *= Math.pow(0.4, sdt);
        if (c.stT > 1.35) { c.state = 'gone'; c.stT = 0; }
        continue;
      }
      if (c.state === 'gone') {
        if (c.stT > 0.7) {
          c.state = 'respawn'; c.stT = 0;
          c.dist = player.dist - rnd(52, 78);
          c.lane = Math.random() < 0.5 ? -1 : 1;
          c.laneF = c.lane;
        }
        continue;
      }
      if (c.state === 'respawn') {
        c.dist += c.base * sdt;
        posAt(c.dist, c.laneF * 7, c.p);
        if (c.stT > 0.95) { c.state = 'race'; c.stT = 0; }
        continue;
      }

      // state === 'race'
      var wob = 1 + 0.12 * Math.sin(t * c.wave * TAU + c.phase);
      var sp = c.base * wob;
      if (c.player && c.boost > 0) {
        sp *= 1.55;
        c.boost -= sdt;
        // nitro flame
        if (skidTick(t)) {
          parts.push({
            x: c.p.x - Math.cos(c.p.ang) * 9, y: c.p.y - Math.sin(c.p.ang) * 9,
            vx: -Math.cos(c.p.ang) * 30 + rnd(-8, 8),
            vy: -Math.sin(c.p.ang) * 30 + rnd(-8, 8),
            life: 0.3, max: 0.3, c: Math.random() < 0.5 ? AMBER : RED, s: 2
          });
        }
      }
      if (c.player && c.ghost > 0) c.ghost -= sdt;
      c.dist += sp * sdt;

      // lane easing
      c.laneF += (c.lane - c.laneF) * Math.min(1, sdt * 5);
      if (Math.abs(c.lane - c.laneF) > 0.12 && skidTick(t)) {
        addSkid(c.p.x, c.p.y);
      }

      posAt(c.dist, c.laneF * 7, c.p);

      // corner skids when quick
      if (c.p.curve && sp > c.base * 1.04 && skidTick(t)) {
        var n = c.p.ang + PI / 2;
        addSkid(c.p.x + Math.cos(n) * 3, c.p.y + Math.sin(n) * 3);
        addSkid(c.p.x - Math.cos(n) * 3, c.p.y - Math.sin(n) * 3);
      }
    }

    // --- overtakes: trailing car ducks to the free lane ---
    laneTimer += sdt;
    if (laneTimer > 0.55) {
      laneTimer = 0;
      for (var a = 0; a < cars.length; a++) {
        var ca = cars[a];
        if (ca.state !== 'race') continue;
        for (var b = 0; b < cars.length; b++) {
          if (a === b) continue;
          var cb = cars[b];
          if (cb.state !== 'race') continue;
          var gap = ((cb.dist - ca.dist) % TRACK_LEN + TRACK_LEN) % TRACK_LEN;
          if (gap > 0 && gap < 17 && ca.lane === cb.lane) {
            ca.lane = -ca.lane; // dive for the gap
          }
        }
      }
      // occasional flavour swerve
      if (Math.random() < 0.16) {
        var rc = cars[(Math.random() * cars.length) | 0];
        if (rc.state === 'race') rc.lane = -rc.lane;
      }
    }

    // --- fx decay (real time so pops stay snappy) ---
    for (var p2 = parts.length - 1; p2 >= 0; p2--) {
      var pt = parts[p2];
      pt.life -= dt;
      if (pt.life <= 0) { parts.splice(p2, 1); continue; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.3, dt); pt.vy *= Math.pow(0.3, dt);
    }
    for (var f = floaters.length - 1; f >= 0; f--) {
      floaters[f].life -= dt;
      floaters[f].y -= dt * 10;
      if (floaters[f].life <= 0) floaters.splice(f, 1);
    }
    for (var sk = skids.length - 1; sk >= 0; sk--) {
      skids[sk].a -= dt * 0.28;
      if (skids[sk].a <= 0) skids.splice(sk, 1);
    }
  }

  var laneTimer = 0;
  var skidClock = 0;
  function skidTick(t) {
    // cheap decimator: true ~30x/sec
    var v = Math.floor(t * 30);
    if (v !== skidClock) { skidClock = v; return true; }
    return false;
  }

  // ------------------------------------------------------------- draw
  function drawCar(c) {
    var x, y, ang, alpha = 1;
    if (c.state === 'crash') {
      x = c.cx; y = c.cy; ang = c.cang;
    } else if (c.state === 'gone') {
      return;
    } else {
      x = c.p.x; y = c.p.y; ang = c.p.ang;
      if (c.state === 'respawn') alpha = (Math.floor(c.stT * 12) % 2 === 0) ? 0.25 : 0.9;
    }
    if (c.player && c.ghost > 0) alpha = 0.45;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    // wheels
    ctx.fillStyle = INK2;
    ctx.fillRect(-7, -6, 4, 2); ctx.fillRect(3, -6, 4, 2);
    ctx.fillRect(-7, 4, 4, 2); ctx.fillRect(3, 4, 4, 2);
    // shell
    ctx.fillRect(-9, -5, 18, 10);
    ctx.fillStyle = c.body;
    ctx.fillRect(-8, -4, 16, 8);
    // nose shade
    ctx.fillStyle = c.dark;
    ctx.fillRect(5, -4, 3, 8);
    // racing stripe
    if (c.stripe) {
      ctx.fillStyle = c.stripe;
      ctx.fillRect(-8, -1, 16, 2);
    }
    // canopy
    ctx.fillStyle = INK2;
    ctx.fillRect(-2, -2, 5, 4);
    if (c.player && c.ghost > 0) {
      ctx.fillStyle = CYAN;
      ctx.fillRect(-9, -6, 2, 2); ctx.fillRect(7, 4, 2, 2);
    }
    ctx.restore();
  }

  function drawCardPop() {
    if (!cardPop) return;
    var ct = cardPop.t;
    var px = player.p.x, py = player.p.y;
    var cw = 26, ch = 36;
    var cx = Math.max(8, Math.min(W - cw - 8, px + 16));
    var cy = Math.max(22, Math.min(H - ch - 8, py - 50));
    var a = ct < 0.15 ? ct / 0.15 : (ct > 1.6 ? Math.max(0, (1.9 - ct) / 0.3) : 1);
    var lift = ct < 0.25 ? (0.25 - ct) * 24 : 0;

    ctx.save();
    ctx.globalAlpha = a;

    // spark ring
    var rr = 8 + Math.min(1, ct / 0.5) * 16;
    ctx.fillStyle = GOLD;
    if (ct < 0.65) {
      for (var i = 0; i < 10; i++) {
        var an = (i / 10) * TAU + ct * 2.2;
        ctx.globalAlpha = a * (1 - ct / 0.65);
        ctx.fillRect(px + Math.cos(an) * rr - 1, py + Math.sin(an) * rr - 1, 2, 2);
      }
      ctx.globalAlpha = a;
    }

    // card
    var yy = cy + lift;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx + 2, yy + 3, cw, ch);
    ctx.fillStyle = PANEL;
    ctx.fillRect(cx, yy, cw, ch);
    ctx.strokeStyle = WHITE; ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, yy + 0.5, cw - 1, ch - 1);
    ctx.fillStyle = cardPop.kind === 'sabotage' ? RED : AMBER;
    ctx.fillRect(cx + 1, yy + 1, cw - 2, 7);
    ctx.fillStyle = '#3c4a60';
    ctx.fillRect(cx + 4, yy + 11, cw - 8, 13);
    ctx.fillStyle = STEEL;
    ctx.fillRect(cx + 4, yy + 27, cw - 8, 2);
    ctx.fillRect(cx + 4, yy + 31, cw - 12, 2);

    // caption
    ctx.font = '11px VT323, monospace';
    ctx.textBaseline = 'top';
    var tw = Math.ceil(ctx.measureText(cardPop.label).width);
    var lx = Math.max(4, Math.min(W - tw - 8, cx + cw / 2 - tw / 2));
    var ly = yy - 15;
    ctx.fillStyle = INK2;
    ctx.fillRect(lx - 3, ly - 2, tw + 6, 13);
    ctx.fillStyle = cardPop.kind === 'sabotage' ? RED : AMBER;
    ctx.fillText(cardPop.label, lx, ly);

    // connector nub from card to car
    ctx.fillStyle = WHITE;
    ctx.fillRect(Math.round((cx + cw / 2 + px) / 2), Math.round((yy + ch + py) / 2), 2, 2);
    ctx.restore();
  }

  function draw(t) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(trackCv, 0, 0);

    // skid marks
    for (var i = 0; i < skids.length; i++) {
      ctx.globalAlpha = Math.min(0.55, skids[i].a);
      ctx.fillStyle = '#06090e';
      ctx.fillRect(Math.round(skids[i].x) - 1, Math.round(skids[i].y) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    // slow-mo vignette
    if (timescale < 0.9) {
      ctx.fillStyle = 'rgba(53,196,238,' + (0.07 * (1 - timescale)) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // cars: rivals first, player on top
    for (var c = cars.length - 1; c >= 0; c--) drawCar(cars[c]);

    // particles
    for (var p = 0; p < parts.length; p++) {
      var pt = parts[p];
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.c;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.s, pt.s);
    }
    ctx.globalAlpha = 1;

    drawCardPop();

    // floaters ("TAKEDOWN!")
    ctx.font = '10px Silkscreen, VT323, monospace';
    ctx.textBaseline = 'top';
    for (var f = 0; f < floaters.length; f++) {
      var fl = floaters[f];
      var a = Math.min(1, fl.life / (fl.max * 0.5));
      var tw = Math.ceil(ctx.measureText(fl.text).width);
      var fx = Math.max(3, Math.min(W - tw - 5, fl.x - tw / 2));
      var fy = Math.max(3, fl.y);
      ctx.globalAlpha = a;
      ctx.fillStyle = INK2;
      ctx.fillText(fl.text, fx + 1, fy + 1);
      ctx.fillStyle = fl.c;
      ctx.fillText(fl.text, fx, fy);
    }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------- main loop
  var running = false, rafId = 0, lastMs = 0, simT = 0;
  var inView = true;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function frame(ms) {
    rafId = 0;
    if (!running) return;
    var dt = Math.min(0.05, (ms - lastMs) / 1000 || 0.016);
    lastMs = ms;
    simT += dt;
    update(simT, dt);
    draw(simT);
    rafId = requestAnimationFrame(frame);
  }

  function setRunning(on) {
    on = on && inView && !document.hidden && !(reduced && reduced.matches);
    if (on === running) return;
    running = on;
    if (running) {
      lastMs = performance.now();
      rafId = requestAnimationFrame(frame);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function staticFrame() {
    // Reduced motion: settle the field into a believable frozen moment.
    for (var i = 0; i < 40; i++) update(i * 0.1, 0.1);
    cardPop = { t: 0.6, label: 'NITRO BURST', kind: 'boost', resolved: true };
    timescale = 0.28;
    draw(4);
    cardPop = null;
    timescale = 1;
  }

  document.addEventListener('visibilitychange', function () { setRunning(true); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      setRunning(true);
    }, { threshold: 0.05 }).observe(canvas);
  }
  if (reduced && reduced.addEventListener) {
    reduced.addEventListener('change', function () {
      if (reduced.matches) { setRunning(false); staticFrame(); }
      else setRunning(true);
    });
  }

  function boot() {
    if (reduced && reduced.matches) staticFrame();
    else setRunning(true);
  }

  // Wait for the pixel fonts so canvas captions render in face.
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load('11px VT323'),
      document.fonts.load('10px Silkscreen')
    ]).then(boot, boot);
  } else {
    boot();
  }
})();
