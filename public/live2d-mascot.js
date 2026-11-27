/* 右下角 Live2D 吉祥物「梅娅」：待机小动作，点击切换动作/表情，可拖动与缩放 */

(function () {
    const MODEL_URL = 'live2d/meya/meya.model3.json';
    const VENDOR = 'vendor/live2d/';
    const VER = '?v=1.1.0b';
    const BOX_KEY = 'l2d_mascot_box';
    const MIN_W = 90;
    const MIN_H = 120;
    const MAX_W = 520;
    const MAX_H = 680;

    let app = null;
    let model = null;
    let box = null;
    let ready = false;
    let resting = 'A';
    let drag = null;

    let geo = { left: 0, top: 0, width: 240, height: 300 };

    function isSmallScreen() {
        return window.matchMedia('(max-width: 900px)').matches;
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = src;
            el.onload = resolve;
            el.onerror = () => reject(new Error('加载失败：' + src));
            document.head.appendChild(el);
        });
    }

    async function ensureLibs() {
        if (!window.PIXI) await loadScript(VENDOR + 'pixi.min.js' + VER);
        if (!window.Live2DCubismCore) await loadScript(VENDOR + 'live2dcubismcore.min.js' + VER);
        if (!window.PIXI.live2d) await loadScript(VENDOR + 'pixi-live2d-display.min.js' + VER);
    }

    function defaultGeo() {
        const small = isSmallScreen();
        const phone = window.matchMedia('(max-width: 640px)').matches;
        const width = phone ? 110 : small ? 150 : 240;
        const height = phone ? 140 : small ? 190 : 300;
        return {
            width: width,
            height: height,
            left: window.innerWidth - width - 18,
            top: window.innerHeight - height - 14
        };
    }

    function loadGeo() {
        try {
            const saved = JSON.parse(localStorage.getItem(BOX_KEY) || 'null');
            if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top) &&
                Number.isFinite(saved.width) && Number.isFinite(saved.height)) {
                return {
                    left: saved.left,
                    top: saved.top,
                    width: Math.min(MAX_W, Math.max(MIN_W, saved.width)),
                    height: Math.min(MAX_H, Math.max(MIN_H, saved.height))
                };
            }
        } catch (e) {}
        return defaultGeo();
    }

    function saveGeo() {
        try { localStorage.setItem(BOX_KEY, JSON.stringify(geo)); } catch (e) {}
    }

    function clampGeo() {
        geo.width = Math.min(MAX_W, Math.max(MIN_W, geo.width));
        geo.height = Math.min(MAX_H, Math.max(MIN_H, geo.height));
        geo.left = Math.min(Math.max(0, geo.left), Math.max(0, window.innerWidth - geo.width));
        geo.top = Math.min(Math.max(0, geo.top), Math.max(0, window.innerHeight - geo.height));
    }

    function applyGeo() {
        if (!box) return;
        box.style.left = geo.left + 'px';
        box.style.top = geo.top + 'px';
        box.style.width = geo.width + 'px';
        box.style.height = geo.height + 'px';
        layout();
    }

    function layout() {
        if (!app || !model || !box) return;
        const w = box.clientWidth;
        const h = box.clientHeight;
        if (!w || !h) return;
        app.renderer.resize(w, h);
        const baseW = model.internalModel.originalWidth || 1;
        const baseH = model.internalModel.originalHeight || 1;
        const scale = Math.min((w * 0.96) / baseW, (h * 0.96) / baseH);
        model.scale.set(scale);
        model.x = (w - baseW * scale) / 2;
        model.y = h - baseH * scale;
    }

    function playMood() {
        if (!ready || !model) return;
        const next = resting === 'A' ? 'B' : 'A';
        resting = next;
        try {
            model.motion(next, 0, 3);
        } catch (e) {
            console.warn('动作播放失败：', e);
        }
        box.classList.remove('bounce');
        void box.offsetWidth;
        box.classList.add('bounce');
        setTimeout(() => box.classList.remove('bounce'), 600);
    }

    function onPointerDown(e) {
        if (!ready || (e.button !== undefined && e.button !== 0)) return;
        const isResize = e.target.classList.contains('l2d-resize');
        drag = {
            mode: isResize ? 'resize' : 'move',
            x: e.clientX,
            y: e.clientY,
            id: e.pointerId,
            start: { left: geo.left, top: geo.top, width: geo.width, height: geo.height },
            moved: false
        };
        try { box.setPointerCapture(e.pointerId); } catch (err) {}
        box.classList.add(isResize ? 'resizing' : 'dragging');
        e.preventDefault();
    }

    function onPointerMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;

        if (drag.mode === 'move') {
            geo.left = drag.start.left + dx;
            geo.top = drag.start.top + dy;
        } else {
            const ratio = drag.start.width / drag.start.height;
            let width;
            if (Math.abs(dx) >= Math.abs(dy)) width = drag.start.width - dx;
            else width = (drag.start.height - dy) * ratio;
            width = Math.min(MAX_W, Math.max(MIN_W, width));
            const height = Math.min(MAX_H, Math.max(MIN_H, Math.round(width / ratio)));
            geo.width = Math.round(width);
            geo.height = height;
            geo.left = drag.start.left + drag.start.width - geo.width;
            geo.top = drag.start.top + drag.start.height - geo.height;
        }
        clampGeo();
        applyGeo();
    }

    function onPointerUp(e) {
        if (!drag) return;
        const wasMoved = drag.moved;
        const mode = drag.mode;
        const id = drag.id;
        drag = null;
        try { box.releasePointerCapture(id); } catch (err) {}
        box.classList.remove('dragging', 'resizing');
        saveGeo();
        if (!wasMoved && mode === 'move') playMood();
    }

    async function init() {
        geo = loadGeo();
        clampGeo();

        box = document.createElement('div');
        box.className = 'l2d-mascot';
        box.id = 'l2d-mascot';
        box.hidden = true;
        box.innerHTML = '<div class="l2d-resize" title="拖动调整大小"></div>';
        document.body.appendChild(box);
        applyGeo();

        const canvas = document.createElement('canvas');
        box.appendChild(canvas);

        try {
            await ensureLibs();
            app = new PIXI.Application({
                view: canvas,
                transparent: true,
                backgroundAlpha: 0,
                antialias: true,
                autoDensity: true,
                resolution: Math.min(window.devicePixelRatio || 1, 2),
                width: geo.width,
                height: geo.height
            });
            model = await PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false });
            app.stage.addChild(model);
            ready = true;
            box.hidden = false;
            layout();
            try { model.motion('A', 0, 3); } catch (e) {}

            box.addEventListener('pointerdown', onPointerDown);
            box.addEventListener('pointermove', onPointerMove);
            box.addEventListener('pointerup', onPointerUp);
            box.addEventListener('pointercancel', onPointerUp);
            window.addEventListener('resize', () => {
                clampGeo();
                applyGeo();
                saveGeo();
            });
            document.addEventListener('visibilitychange', () => {
                if (!app) return;
                if (document.hidden) app.ticker.stop();
                else app.ticker.start();
            });
        } catch (err) {
            console.error('Live2D 吉祥物加载失败：', err);
            if (box) box.remove();
            box = null;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
