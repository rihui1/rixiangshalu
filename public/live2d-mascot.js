/* 右下角 Live2D 吉祥物「梅娅」：待机小动作，点击切换动作/表情 */

(function () {
    const MODEL_URL = 'live2d/meya/meya.model3.json';
    const VENDOR = 'vendor/live2d/';
    const VER = '?v=1.1.0b';

    let app = null;
    let model = null;
    let box = null;
    let ready = false;
    let resting = 'A';

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

    function hideTip() {
        const tip = box && box.querySelector('.l2d-tip');
        if (tip) tip.classList.add('gone');
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
        hideTip();
    }

    async function init() {
        box = document.createElement('div');
        box.className = 'l2d-mascot';
        box.id = 'l2d-mascot';
        box.hidden = true;
        box.innerHTML = '<div class="l2d-tip">点我一下</div>';
        document.body.appendChild(box);

        const canvas = document.createElement('canvas');
        box.appendChild(canvas);

        try {
            await ensureLibs();
            const small = isSmallScreen();
            app = new PIXI.Application({
                view: canvas,
                transparent: true,
                backgroundAlpha: 0,
                antialias: true,
                autoDensity: true,
                resolution: Math.min(window.devicePixelRatio || 1, 2),
                width: small ? 150 : 240,
                height: small ? 190 : 300
            });
            model = await PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false });
            app.stage.addChild(model);
            ready = true;
            box.hidden = false;
            layout();
            try { model.motion('A', 0, 3); } catch (e) {}
            box.addEventListener('click', (e) => {
                e.preventDefault();
                playMood();
            });
            window.addEventListener('resize', layout);
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
