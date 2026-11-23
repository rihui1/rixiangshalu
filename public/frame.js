/* 视频截图：浏览器本地取帧导出图片，文件不会上传服务器 */

(function () {
    const $ = (id) => document.getElementById(id);
    let objectUrl = '';
    let fileName = '';

    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function setStatus(text, isError) {
        const el = $('convert-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function fmt(sec) {
        if (!isFinite(sec) || sec < 0) return '0:00.00';
        const m = Math.floor(sec / 60);
        const s = sec - m * 60;
        return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
    }

    function updateTime() {
        const v = $('frame-video');
        if (!v) return;
        const label = $('frame-time');
        if (label) label.textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration);
        const range = $('frame-range');
        if (range && document.activeElement !== range) range.value = String(v.currentTime || 0);
    }

    function onFrameModeChange(mode) {
        const isFrame = mode === 'frame';
        const panel = $('frame-panel');
        if (panel) panel.hidden = !isFrame;
        ['convert-options', 'convert-progress-wrap', 'convert-btn', 'convert-result'].forEach((id) => {
            const el = $(id);
            if (el) el.hidden = isFrame;
        });
        const input = $('convert-file');
        if (input) input.accept = isFrame ? 'video/*' : 'video/*,audio/*';
        const title = $('convert-drop-title');
        const hint = $('convert-drop-hint');
        if (title) title.textContent = isFrame ? '点击选择视频，或把视频拖到这里' : '点击选择文件，或把音视频拖到这里';
        if (hint) hint.textContent = isFrame
            ? '支持 MP4 / MOV / WEBM / MKV 等浏览器能播放的格式'
            : '常见 MP4 / MOV / MKV / WEBM / AVI / MP3 / WAV / FLAC / OGG / M4A 都可以';
        if (isFrame) {
            const info = $('convert-file-info');
            if (info) info.hidden = !fileName;
            const btn = $('frame-btn');
            if (btn) btn.disabled = !fileName;
            setStatus(fileName ? '拖动进度条选择画面后点「截取当前帧」。' : '选择视频后，在时间轴上选一帧截图。');
        } else {
            const v = $('frame-video');
            if (v) v.pause();
        }
    }

    function frameLoadFile(file) {
        const v = $('frame-video');
        if (!v || !file) return;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        fileName = file.name;
        v.src = objectUrl;
        const list = $('frame-list');
        if (list) list.innerHTML = '';
        const range = $('frame-range');
        if (range) range.value = '0';
        const btn = $('frame-btn');
        if (btn) btn.disabled = true;
        const info = $('convert-file-info');
        if (info) {
            info.hidden = false;
            info.innerHTML = '<strong>' + escapeHtml(file.name) + '</strong><span>' +
                (file.size / 1048576).toFixed(1) + ' MB</span>' +
                '<button type="button" class="ghost small" onclick="clearConvertFile()">换一个</button>';
        }
        setStatus('正在读取视频信息…');
        v.onloadedmetadata = () => {
            if (range) {
                range.max = String(v.duration || 0);
                range.step = String(Math.max(0.01, (v.duration || 1) / 2000));
                range.value = '0';
            }
            if (btn) btn.disabled = false;
            updateTime();
            setStatus('已载入视频：' + v.videoWidth + '×' + v.videoHeight + '，拖动进度条选好画面后点「截取当前帧」。');
        };
        v.onerror = () => {
            setStatus('这个视频浏览器无法解码，换一个 MP4 / WEBM 文件试试。', true);
            if (btn) btn.disabled = true;
        };
        v.ontimeupdate = updateTime;
    }

    function frameSeek(value) {
        const v = $('frame-video');
        if (!v || !v.duration) return;
        v.currentTime = Math.min(v.duration, Math.max(0, Number(value) || 0));
        updateTime();
    }

    function frameCapture() {
        const v = $('frame-video');
        if (!v || !v.videoWidth) {
            setStatus('视频还没准备好，请稍等一下。', true);
            return;
        }
        const mime = $('frame-format').value;
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const time = v.currentTime || 0;
        const base = fileName.replace(/\.[^.]+$/, '') || 'video';
        const ext = mime === 'image/jpeg' ? 'jpg' : 'png';
        const name = base + '-帧-' + time.toFixed(2) + 's.' + ext;
        canvas.toBlob((blob) => {
            if (!blob) {
                setStatus('截图失败，换一个视频再试试。', true);
                return;
            }
            addShot(blob, name, canvas.width, canvas.height);
            setStatus('截图完成，点击右侧「下载」保存。');
        }, mime, 0.92);
    }

    function addShot(blob, name, w, h) {
        const list = $('frame-list');
        if (!list) return;
        const url = URL.createObjectURL(blob);
        const row = document.createElement('div');
        row.className = 'docs-item';
        row.innerHTML = '<span class="unzip-name">' + escapeHtml(name) + '</span>' +
            '<span class="unzip-size">' + w + '×' + h + ' · ' + (blob.size / 1024).toFixed(0) + ' KB</span>' +
            '<a class="ghost small" href="' + url + '" download="' + escapeHtml(name) + '">下载</a>';
        list.appendChild(row);
    }

    function frameClear() {
        const v = $('frame-video');
        if (v) {
            v.pause();
            v.removeAttribute('src');
            v.load();
        }
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = '';
        }
        fileName = '';
        const info = $('convert-file-info');
        if (info) info.hidden = true;
        const list = $('frame-list');
        if (list) list.innerHTML = '';
        const btn = $('frame-btn');
        if (btn) btn.disabled = true;
        const range = $('frame-range');
        if (range) {
            range.max = '0';
            range.value = '0';
        }
        const label = $('frame-time');
        if (label) label.textContent = '0.00s';
        const input = $('convert-file');
        if (input) input.value = '';
        setStatus('选择视频后，在时间轴上选一帧截图。');
    }

    window.onFrameModeChange = onFrameModeChange;
    window.frameLoadFile = frameLoadFile;
    window.frameSeek = frameSeek;
    window.frameCapture = frameCapture;
    window.frameClear = frameClear;
})();
