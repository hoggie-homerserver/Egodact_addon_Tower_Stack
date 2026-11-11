// ============================================================
// EGODACT ADDON: TOWER STACK
// ============================================================
// A small timing game: blocks slide left/right above the tower.
// Click / tap / press Space to drop the block. Overlap keeps only
// the overlapping part; a perfect hit keeps the full width (and
// gives a bonus point). All scores are stored locally.

(function () {
    'use strict';

    if (window.__egodactTowerStackLoaded) return;
    window.__egodactTowerStackLoaded = true;

    const client = window.EgodactAddonClient;
    const L = window.EgodactAddonLib;
    if (!client || !L) {
        console.warn('Tower Stack: Egodact addon SDK/lib ontbreekt.');
        return;
    }

    const ADDON_ID = 'tower-stack-addon';
    const GAME_ID = 'tower-stack';
    const HAMBURGER_ID = 'tower-stack-open';

    const store = (L.data && typeof L.data.storage === 'function')
        ? L.data.storage('tower-stack')
        : client.storage('tower-stack');

    const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="4" y="17" width="16" height="4" rx="1"/>' +
        '<rect x="6" y="12" width="12" height="4" rx="1"/>' +
        '<rect x="8" y="7" width="8" height="4" rx="1"/>' +
        '<rect x="10" y="2" width="4" height="4" rx="1"/>' +
        '</svg>';

    client.registerAddon({
        id: ADDON_ID,
        name: 'Tower Stack',
        version: '0.1.0',
        description: 'Drop blocks and build the tallest tower.',
        author: 'MaxiTaxi',
        source: 'https://github.com/hoggie-homerserver/Egodact_addon_Tower_Stack'
    });

    client.registerGame({
        addonId: ADDON_ID,
        id: GAME_ID,
        title: 'Tower Stack',
        description: 'Time your drops and build the tallest tower.',
        icon: ICON
    });

    // Optional quick entry in the hamburger menu (hosts with hamburger support).
    try {
        client.registerHamburger({
            addonId: ADDON_ID,
            id: HAMBURGER_ID,
            title: 'Tower Stack',
            icon: ICON,
            order: 60
        });
    } catch (err) {}

    client.onOpen(GAME_ID, function () { openTowerStack(); });
    client.onOpen(HAMBURGER_ID, function () { openTowerStack(); });

    // ------------------------------------------------------------
    // Game
    // ------------------------------------------------------------
    function openTowerStack() {
        if (document.getElementById('egodact-tower-stack-open')) return;

        const ui = L.ui;
        const game = L.game;
        const el = L.el;
        if (!ui || !game || !el) return;

        const W = 300;
        const H = 420;
        const BLOCK_H = 16;
        const BASE_W = 110;
        const BEST_KEY = 'best';

        // Palette stays readable in both themes.
        const palette = ['#90caf9', '#f48fb1', '#ffcc80', '#a5d6a7', '#ce93d8', '#80deea'];

        let theme = L.theme();
        if (typeof client.onThemeChange === 'function') {
            client.onThemeChange(function () { theme = L.theme(); });
        }

        let best = Number(store.get(BEST_KEY, 0)) || 0;

        let blocks = [];
        let moving = null;
        let score = 0;
        let state = 'playing';
        let cam = 0;
        let alive = true;

        const baseY = H - 24;

        const scoreEl = el('div', {
            text: 'Score: 0',
            style: { fontSize: '15px', fontWeight: 'bold', color: theme.tekst }
        });
        const bestEl = el('div', {
            text: 'Best: ' + best,
            style: { fontSize: '12px', color: theme.tekstZacht, alignSelf: 'center' }
        });
        const hud = ui.row({ justify: 'space-between', children: [scoreEl, bestEl] });

        const { canvas, ctx } = game.createCanvas(null, W, H, {
            background: theme.veld,
            radius: 6
        });

        const hint = el('div', {
            text: 'Klik of druk op spatie om te laten vallen.',
            style: { fontSize: '11px', color: theme.tekstZacht, textAlign: 'center' }
        });

        const body = ui.col({ gap: 8, children: [hud, canvas, hint] });
        const root = el('div', { style: { display: 'flex', flexDirection: 'column' } });
        root.id = 'egodact-tower-stack-open';
        root.appendChild(body);

        const backdrop = ui.modal('Tower Stack', root, { width: 'min(380px, calc(100vw - 24px))' });

        function getCam() {
            // Keep the newest block roughly 90px from the top of the canvas.
            return Math.max(0, blocks.length * BLOCK_H - (H - 114));
        }

        function updateHud() {
            scoreEl.textContent = 'Score: ' + score;
            bestEl.textContent = 'Best: ' + best;
        }

        function spawnMoving() {
            const prev = blocks[blocks.length - 1];
            const w = prev.w;
            const dir = (blocks.length % 2 === 0) ? 1 : -1;
            moving = {
                x: dir === 1 ? 0 : W - w,
                w: w,
                dir: dir,
                speed: Math.min(130 + score * 6, 420),
                color: palette[blocks.length % palette.length]
            };
        }

        function reset() {
            blocks = [{ x: (W - BASE_W) / 2, w: BASE_W, color: palette[0] }];
            score = 0;
            state = 'playing';
            cam = 0;
            spawnMoving();
            hint.textContent = 'Klik of druk op spatie om te laten vallen.';
            hint.style.color = theme.tekstZacht;
            updateHud();
        }

        function gameOver() {
            state = 'over';
            hint.textContent = 'Mis! Klik om opnieuw te beginnen.';
            hint.style.color = theme.tekstZacht;
            updateHud();
        }

        function drop() {
            if (!moving || state !== 'playing') return;

            const prev = blocks[blocks.length - 1];
            const left = Math.max(moving.x, prev.x);
            const right = Math.min(moving.x + moving.w, prev.x + prev.w);
            const overlap = right - left;

            if (overlap <= 2) {
                gameOver();
                return;
            }

            const perfect = Math.abs(moving.x - prev.x) <= 2.5 &&
                Math.abs(moving.w - prev.w) <= 2.5;

            blocks.push({
                x: perfect ? prev.x : left,
                w: perfect ? prev.w : overlap,
                color: moving.color
            });

            score += perfect ? 2 : 1;
            if (score > best) {
                best = score;
                store.set(BEST_KEY, best);
            }

            spawnMoving();
            updateHud();
        }

        function press() {
            if (state === 'over') {
                reset();
                return;
            }
            if (state === 'playing') drop();
        }

        function update(dt) {
            if (!alive) return;

            if (state === 'playing' && moving) {
                moving.x += moving.dir * moving.speed * dt;
                const maxX = W - moving.w;
                if (moving.x <= 0) {
                    moving.x = 0;
                    moving.dir = 1;
                } else if (moving.x >= maxX) {
                    moving.x = maxX;
                    moving.dir = -1;
                }
            }

            cam = getCam();
        }

        function render() {
            game.clear(ctx, theme.veld);

            blocks.forEach(function (b, i) {
                const y = baseY - i * BLOCK_H + cam;
                if (y > H || y < -BLOCK_H) return;
                game.rect(ctx, b.x, y, b.w, BLOCK_H, b.color, { radius: 3 });
            });

            if (moving && state !== 'over') {
                const y = baseY - blocks.length * BLOCK_H + cam;
                game.rect(ctx, moving.x, y, moving.w, BLOCK_H, moving.color, {
                    radius: 3,
                    stroke: theme.tekstZacht,
                    lineWidth: 1
                });
            }

            if (state === 'over') {
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.fillRect(0, 0, W, H);
                game.text(ctx, 'Game over', W / 2, H / 2 - 28, {
                    color: '#fff', size: 22, bold: true, align: 'center'
                });
                game.text(ctx, 'Score ' + score + '  -  klik om opnieuw', W / 2, H / 2 + 4, {
                    color: '#fff', size: 12, align: 'center'
                });
            }
        }

        function onPointer(e) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            press();
        }

        function onKey(e) {
            if (!alive) return;
            if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                press();
            }
        }

        canvas.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onKey, true);

        reset();
        const loop = game.loop(update, render, { maxDt: 0.05 });

        const observer = new MutationObserver(function () {
            if (!document.body.contains(backdrop)) {
                alive = false;
                loop.stop();
                observer.disconnect();
                window.removeEventListener('keydown', onKey, true);
                canvas.removeEventListener('pointerdown', onPointer);
            }
        });
        observer.observe(document.body, { childList: true });
    }
})();
