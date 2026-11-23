/* 格式转换：全部在浏览器本地用 ffmpeg.wasm（单线程版）完成，文件不会上传服务器 */

(function () {
    const LOCAL_BASE = new URL('vendor/ffmpeg/', window.location.href).href;
    // 优先使用站点自带的引擎，失败再退回 CDN
    const CORE_BASES = [
        LOCAL_BASE,
        'https://registry.npmmirror.com/@ffmpeg/core/0.12.6/files/dist/umd/',
        'https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/',
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/'
    ];

    const AUDIO_FORMATS = [
        { value: 'mp3', label: 'MP3', mime: 'audio/mpeg' },
        { value: 'wav', label: 'WAV', mime: 'audio/wav' },
        { value: 'flac', label: 'FLAC', mime: 'audio/flac' },
        { value: 'ogg', label: 'OGG（Vorbis）', mime: 'audio/ogg' },
        { value: 'm4a', label: 'M4A（AAC）', mime: 'audio/mp4' },
        { value: 'aac', label: 'AAC', mime: 'audio/aac' },
        { value: 'opus', label: 'OPUS', mime: 'audio/ogg' }
    ];

    const VIDEO_FORMATS = [
        { value: 'mp4', label: 'MP4（H.264）', mime: 'video/mp4' },
        { value: 'mov', label: 'MOV（H.264）', mime: 'video/quicktime' },
        { value: 'webm', label: 'WEBM（VP8）', mime: 'video/webm' },
        { value: 'mkv', label: 'MKV（直接封装）', mime: 'video/x-matroska' },
        { value: 'avi', label: 'AVI（MPEG-4）', mime: 'video/x-msvideo' },
        { value: 'gif', label: 'GIF（无声动图）', mime: 'image/gif' }
    ];

    let mode = 'audio';
    let currentFile = null;
    let ffmpeg = null;
    let engineReady = false;
    let engineLoading = null;
    let busy = false;
    let lastLog = [];
    let lastUrl = '';

    const $ = (id) => document.getElementById(id);

    function setStatus(text, isError) {
        const el = $('convert-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function defaultHint() {
        return engineReady
            ? '引擎已就绪，选择文件后即可开始转换。'
            : '转换在浏览器本地完成，文件不会上传；首次使用需要加载约 32MB 的转换引擎。';
    }

    function fillFormats() {
        const list = mode === 'audio' ? AUDIO_FORMATS : VIDEO_FORMATS;
        const select = $('convert-format');
        if (!select) return;
        select.innerHTML = list.map((f) => '<option value="' + f.value + '">' + f.label + '</option>').join('');
    }

    function switchConvertMode(next) {
        if (busy) return;
        mode = next;
        document.querySelectorAll('.convert-tab').forEach((el) => {
            el.classList.toggle('active', el.dataset.mode === next);
        });
        fillFormats();
        setStatus(defaultHint());
        if (next !== 'frame') renderFileInfo(currentFile);
        if (window.onFrameModeChange) window.onFrameModeChange(next);
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = src;
            el.onload = resolve;
            el.onerror = () => reject(new Error('转换组件加载失败'));
            document.head.appendChild(el);
        });
    }

    function onConvertFile(event) {
        const file = event.target.files && event.target.files[0];
        pickFile(file);
    }

    function renderFileInfo(file) {
        const info = $('convert-file-info');
        if (!info) return;
        if (!file) {
            info.hidden = true;
            return;
        }
        info.hidden = false;
        info.innerHTML = '<strong>' + escapeHtml(file.name) + '</strong><span>' +
            (file.size / 1048576).toFixed(1) + ' MB</span>' +
            '<button type="button" class="ghost small" onclick="clearConvertFile()">换一个</button>';
    }

    function pickFile(file) {
        if (!file) return;
        if (mode === 'frame') {
            if (window.frameLoadFile) window.frameLoadFile(file);
            return;
        }
        currentFile = file;
        renderFileInfo(file);
        const btn = $('convert-btn');
        if (btn) btn.disabled = false;
        const result = $('convert-result');
        if (result) result.hidden = true;
        if (file.size > 800 * 1048576) {
            setStatus('文件超过 800MB，浏览器内存可能不够，建议先裁剪或压缩后再试。', true);
        } else {
            setStatus(defaultHint());
        }
        ensureEngine().catch(() => {});
    }

    function clearConvertFile() {
        if (busy) return;
        if (mode === 'frame') {
            if (window.frameClear) window.frameClear();
            return;
        }
        currentFile = null;
        const input = $('convert-file');
        if (input) input.value = '';
        const info = $('convert-file-info');
        if (info) info.hidden = true;
        const btn = $('convert-btn');
        if (btn) btn.disabled = true;
        const result = $('convert-result');
        if (result) result.hidden = true;
        setStatus(defaultHint());
    }

    async function ensureEngine() {
        if (engineReady) return ffmpeg;
        if (engineLoading) return engineLoading;

        engineLoading = (async () => {
            if (typeof FFmpegWASM === 'undefined') await loadScript('vendor/ffmpeg/ffmpeg.js');
            if (typeof FFmpegUtil === 'undefined') await loadScript('vendor/ffmpeg/util.js');
            if (typeof FFmpegWASM === 'undefined' || typeof FFmpegUtil === 'undefined') {
                throw new Error('转换组件不可用');
            }

            setStatus('正在加载转换引擎，约 32MB，请保持页面打开…');
            const { FFmpeg } = FFmpegWASM;
            const { toBlobURL } = FFmpegUtil;
            let lastError = null;

            for (const base of CORE_BASES) {
                try {
                    const instance = new FFmpeg();
                    instance.on('log', ({ message }) => {
                        if (message) {
                            lastLog.push(message);
                            if (lastLog.length > 60) lastLog.shift();
                        }
                    });
                    instance.on('progress', ({ progress }) => {
                        const bar = $('convert-progress');
                        if (!bar) return;
                        if (isFinite(progress) && progress > 0) {
                            bar.style.width = Math.min(100, Math.round(progress * 100)) + '%';
                        }
                    });
                    await instance.load({
                        coreURL: await toBlobURL(base + 'ffmpeg-core.js', 'text/javascript'),
                        wasmURL: await toBlobURL(base + 'ffmpeg-core.wasm', 'application/wasm')
                    });
                    ffmpeg = instance;
                    engineReady = true;
                    setStatus('引擎已就绪，可以开始转换了。');
                    return ffmpeg;
                } catch (err) {
                    lastError = err;
                    console.warn('引擎加载失败：', base, err && err.message);
                }
            }
            throw lastError || new Error('引擎加载失败');
        })();

        try {
            return await engineLoading;
        } catch (err) {
            engineLoading = null;
            setStatus('转换引擎加载失败，请检查网络后重试。', true);
            throw err;
        }
    }

    function buildArgs(input, output, target, quality) {
        const args = ['-i', input];
        if (mode === 'audio') {
            const bitrate = quality === 'high' ? '320k' : quality === 'small' ? '128k' : '192k';
            args.push('-vn');
            if (target === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
            else if (target === 'wav') args.push('-c:a', 'pcm_s16le');
            else if (target === 'flac') args.push('-c:a', 'flac');
            else if (target === 'ogg') args.push('-c:a', 'libvorbis', '-q:a', '5');
            else if (target === 'm4a' || target === 'aac') args.push('-c:a', 'aac', '-b:a', bitrate);
            else if (target === 'opus') args.push('-c:a', 'libopus', '-b:a', '96k');
            else args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
        } else {
            const crf = quality === 'high' ? '20' : quality === 'small' ? '28' : '23';
            if (target === 'mp4') args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart');
            else if (target === 'mov') args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-c:a', 'aac', '-b:a', '128k');
            else if (target === 'webm') args.push('-c:v', 'libvpx', '-crf', String(Number(crf) + 7), '-b:v', '1M', '-c:a', 'libvorbis');
            else if (target === 'mkv') args.push('-c', 'copy');
            else if (target === 'avi') args.push('-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'libmp3lame');
            else if (target === 'gif') args.push('-vf', 'fps=10,scale=480:-1:flags=lanczos', '-an');
        }
        args.push(output);
        return args;
    }

    async function startConvert() {
        if (mode === 'frame' || busy || !currentFile) return;
        const target = $('convert-format').value;
        const quality = $('convert-quality').value;
        const btn = $('convert-btn');
        const result = $('convert-result');
        const progressWrap = $('convert-progress-wrap');
        const progressBar = $('convert-progress');

        busy = true;
        btn.disabled = true;
        btn.textContent = '转换中…';
        if (result) result.hidden = true;
        if (progressWrap) progressWrap.hidden = false;
        if (progressBar) progressBar.style.width = '0%';
        lastLog = [];

        try {
            const engine = await ensureEngine();
            const list = mode === 'audio' ? AUDIO_FORMATS : VIDEO_FORMATS;
            const meta = list.find((f) => f.value === target) || list[0];
            const ext = (currentFile.name.split('.').pop() || 'bin').toLowerCase();
            const inputName = 'input.' + (ext.length <= 5 ? ext : 'bin');
            const outputName = 'output.' + meta.value;

            setStatus('正在读取文件…');
            await engine.writeFile(inputName, await FFmpegUtil.fetchFile(currentFile));

            setStatus('正在转换，视频较大时需要等一会儿，请不要关闭页面…');
            const code = await engine.exec(buildArgs(inputName, outputName, meta.value, quality));
            if (code !== 0) {
                const tail = lastLog.slice(-4).join(' ');
                throw new Error('转换进程退出码 ' + code + (tail ? '（' + tail + '）' : ''));
            }

            setStatus('正在生成下载文件…');
            const data = await engine.readFile(outputName);
            if (lastUrl) URL.revokeObjectURL(lastUrl);
            const blob = new Blob([data.buffer || data], { type: meta.mime });
            lastUrl = URL.createObjectURL(blob);

            const base = currentFile.name.replace(/\.[^.]+$/, '');
            const outName = base + '.' + meta.value;
            if (result) {
                result.hidden = false;
                result.innerHTML =
                    '<div><strong>转换完成</strong><span>' + escapeHtml(outName) + ' · ' +
                    (blob.size / 1048576).toFixed(2) + ' MB</span></div>' +
                    '<a class="primary download-btn" href="' + lastUrl + '" download="' + escapeHtml(outName) + '">下载文件</a>';
            }
            if (progressBar) progressBar.style.width = '100%';
            setStatus('转换完成，点击下方按钮保存文件。');

            try { await engine.deleteFile(inputName); } catch (e) {}
            try { await engine.deleteFile(outputName); } catch (e) {}
        } catch (err) {
            const tail = lastLog.slice(-3).join(' ');
            const hint = /not found|Invalid argument|Unknown encoder/i.test(tail)
                ? ' 可以换个输出格式再试一次。'
                : '';
            setStatus('转换失败：' + (err && err.message ? err.message : '未知错误') + hint, true);
            if (tail) console.warn('ffmpeg:', tail);
        } finally {
            busy = false;
            btn.disabled = !currentFile;
            btn.textContent = '开始转换';
            if (progressWrap) setTimeout(() => { progressWrap.hidden = true; }, 600);
        }
    }

    function initConvertView() {
        if (!$('convert-format')) return;
        fillFormats();
        setStatus(defaultHint());
        if (window.onFrameModeChange) window.onFrameModeChange(mode);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const zone = $('drop-zone');
        if (zone) {
            ['dragenter', 'dragover'].forEach((evt) => zone.addEventListener(evt, (e) => {
                e.preventDefault();
                zone.classList.add('dragging');
            }));
            ['dragleave', 'drop'].forEach((evt) => zone.addEventListener(evt, (e) => {
                e.preventDefault();
                zone.classList.remove('dragging');
            }));
            zone.addEventListener('drop', (e) => {
                const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (file) pickFile(file);
            });
        }
        initConvertView();
    });

    window.switchConvertMode = switchConvertMode;
    window.onConvertFile = onConvertFile;
    window.pickFile = pickFile;
    window.clearConvertFile = clearConvertFile;
    window.startConvert = startConvert;
    window.initConvertView = initConvertView;
})();
