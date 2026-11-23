/* 解压工具合集：libarchive.wasm 在浏览器本地解压，文件不上传服务器 */

(function () {
    const VENDOR = 'vendor/archive/';

    const GROUP_ICON = {
        archive: 'M4 4h16v4H4zm1 5h14v11H5zm5 2v2h4v-2z',
        disc: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
        pkg: 'M12 2 3 7v10l9 5 9-5V7zm0 2.3 6.5 3.6L12 11.5 5.5 7.9zM5 9.6l6 3.3v6.5l-6-3.3zm8 9.8v-6.5l6-3.3v6.5z'
    };

    const GROUPS = {
        archive: [
            { id: 'zip', name: '解压 ZIP', desc: '常见的 ZIP 压缩包，含 DOCX / XLSX / EPUB', accept: '.zip,.cbz,.epub,.docx,.xlsx,.pptx,.odt,.odp' },
            { id: 'jar', name: '解压 JAR / WAR', desc: 'Java 应用包，本质是 ZIP 结构', accept: '.jar,.war,.ear' },
            { id: 'tar', name: '解压 TAR', desc: '保留目录结构展开 tar 归档', accept: '.tar' },
            { id: 'targz', name: '解压 TAR.GZ / TGZ', desc: '先解 gzip，再展开里面的 tar', accept: '.tar.gz,.tgz,.gz,.tar.bz2,.tbz2,.tar.xz,.txz' },
            { id: '7z', name: '解压 7Z', desc: '读取 7z 压缩包，支持加密包', accept: '.7z' },
            { id: 'rar', name: '解压 RAR', desc: '支持 RAR / RAR5 压缩包', accept: '.rar' },
            { id: 'cab', name: '解压 CAB', desc: 'Windows 安装包里的 cabinet 归档', accept: '.cab' },
            { id: 'auto', name: '自动识别', desc: '不确定格式就选这个，按内容自动判断', accept: '' }
        ],
        disc: [
            { id: 'iso', name: '打开 ISO', desc: '浏览并提取 ISO 9660 光盘镜像', accept: '.iso' },
            { id: 'img', name: '打开 IMG / BIN', desc: '标准 ISO 9660 的 img / bin 镜像可用', accept: '.img,.bin' }
        ],
        pkg: [
            { id: 'apk', name: '打开 APK', desc: '提取安卓安装包里的文件', accept: '.apk' },
            { id: 'ipa', name: '打开 IPA', desc: '提取 iOS 应用包里的文件', accept: '.ipa' },
            { id: 'deb', name: '打开 DEB', desc: 'Debian 软件包（ar 归档结构）', accept: '.deb' },
            { id: 'rpm', name: '打开 RPM', desc: '浏览 RPM 软件包内容', accept: '.rpm' },
            { id: 'xar', name: '打开 XAR / PKG', desc: 'macOS 安装包归档', accept: '.xar,.pkg' }
        ]
    };

    const LIST_LIMIT = 300;

    let group = 'archive';
    let picked = null;
    let file = null;
    let archive = null;
    let entries = [];
    let busy = false;
    let libPromise = null;
    let jszipPromise = null;

    const $ = (id) => document.getElementById(id);

    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function fmtSize(bytes) {
        const n = Number(bytes) || 0;
        if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
        if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
        if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
        return n + ' B';
    }

    function setStatus(text, isError) {
        const el = $('unzip-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function setProgress(percent) {
        const wrap = $('unzip-progress-wrap');
        const bar = $('unzip-progress');
        if (!wrap || !bar) return;
        wrap.hidden = !percent;
        bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    }

    function loadJszip() {
        if (window.JSZip) return Promise.resolve(window.JSZip);
        if (!jszipPromise) {
            jszipPromise = new Promise((resolve, reject) => {
                const el = document.createElement('script');
                el.src = VENDOR + 'jszip.min.js';
                el.onload = () => resolve(window.JSZip);
                el.onerror = () => reject(new Error('打包组件加载失败'));
                document.head.appendChild(el);
            });
        }
        return jszipPromise;
    }

    function loadLibarchive() {
        if (!libPromise) {
            libPromise = import(new URL(VENDOR + 'libarchive.js', location.href).href)
                .then((mod) => {
                    mod.Archive.init({ workerUrl: new URL(VENDOR + 'worker-bundle.js', location.href).href });
                    return mod.Archive;
                })
                .catch((err) => {
                    libPromise = null;
                    throw new Error('解压引擎加载失败：' + (err && err.message ? err.message : '未知错误'));
                });
        }
        return libPromise;
    }

    function renderCards() {
        const wrap = $('unzip-cards');
        if (!wrap) return;
        wrap.innerHTML = GROUPS[group].map((card) =>
            '<button type="button" class="unzip-card' + (picked && picked.id === card.id ? ' active' : '') +
            '" onclick="unzipChoose(\'' + card.id + '\')">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + GROUP_ICON[group] + '"/></svg>' +
            '<strong>' + card.name + '</strong>' +
            '<span>' + card.desc + '</span>' +
            '</button>'
        ).join('');
    }

    function resetResult() {
        entries = [];
        const list = $('unzip-list');
        if (list) list.innerHTML = '';
        setProgress(0);
    }

    function switchUnzipGroup(next) {
        if (busy) return;
        group = next;
        picked = null;
        document.querySelectorAll('#unzip-tabs .convert-tab').forEach((el) => {
            el.classList.toggle('active', el.dataset.group === next);
        });
        const input = $('unzip-file');
        input.value = '';
        input.accept = '';
        file = null;
        $('unzip-file-info').hidden = true;
        $('unzip-btn').disabled = true;
        $('unzip-pass-wrap').hidden = true;
        $('unzip-pass').value = '';
        $('unzip-drop-title').textContent = '点击选择文件，或拖到这里';
        $('unzip-drop-hint').textContent = '选择一个文件，或直接拖进来；没选格式时按内容自动识别';
        resetResult();
        renderCards();
        setStatus('文件会在浏览器本地解压，不会上传服务器。');
    }

    function unzipChoose(id) {
        if (busy) return;
        const card = GROUPS[group].find((c) => c.id === id);
        if (!card) return;
        picked = card;
        renderCards();
        const input = $('unzip-file');
        input.accept = card.accept;
        $('unzip-drop-title').textContent = card.name.replace(/^(解压|打开)\s*/, '选择') + ' 文件';
        $('unzip-drop-hint').textContent = card.accept
            ? '支持 ' + card.accept.split(',').map((s) => s.replace(/^\./, '').toUpperCase()).join(' / ')
            : card.desc;
        setStatus('已选择「' + card.name + '」，点上方虚线区域选择文件。');
    }

    function applyFile(f) {
        file = f || null;
        const info = $('unzip-file-info');
        if (!file) {
            info.hidden = true;
            $('unzip-btn').disabled = true;
            return;
        }
        info.hidden = false;
        info.innerHTML = '<strong>' + escapeHtml(file.name) + '</strong>' +
            '<span>' + fmtSize(file.size) + '</span>' +
            '<button type="button" class="ghost small" onclick="unzipClear()">重选</button>';
        $('unzip-btn').disabled = false;
        resetResult();
        setStatus('已选择文件，点「开始解压」。');
    }

    function unzipPick(event) {
        const f = event.target.files && event.target.files[0];
        if (f) applyFile(f);
    }

    function unzipClear() {
        if (busy) return;
        $('unzip-file').value = '';
        applyFile(null);
        $('unzip-pass-wrap').hidden = true;
        $('unzip-pass').value = '';
        setStatus('文件会在浏览器本地解压，不会上传服务器。');
    }

    function renderList() {
        const list = $('unzip-list');
        list.innerHTML = '';

        const bar = document.createElement('div');
        bar.className = 'unzip-actions';
        bar.innerHTML = '<span>共 ' + entries.length + ' 个文件</span>' +
            '<button type="button" class="primary small" onclick="unzipAll()">全部解压并打包下载</button>';
        list.appendChild(bar);

        entries.slice(0, LIST_LIMIT).forEach((row) => {
            const item = document.createElement('div');
            item.className = 'docs-item';
            item.innerHTML = '<span class="unzip-name" title="' + escapeHtml(row.file.name) + '">' +
                escapeHtml(row.file.name) + '</span>' +
                '<span class="unzip-size">' + fmtSize(row.file.size) + '</span>' +
                '<button type="button" class="ghost small">下载</button>';
            item.querySelector('button').addEventListener('click', () => downloadOne(row, item));
            list.appendChild(item);
        });

        if (entries.length > LIST_LIMIT) {
            const more = document.createElement('p');
            more.className = 'convert-hint';
            more.textContent = '文件较多，这里只列出前 ' + LIST_LIMIT + ' 个，其余内容可用「全部解压并打包下载」导出。';
            list.appendChild(more);
        }
    }

    function saveBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }

    async function downloadOne(row, item) {
        const btn = item.querySelector('button');
        btn.disabled = true;
        btn.textContent = '解压中';
        try {
            const out = await row.file.extract();
            saveBlob(out, out.name || row.file.name);
            btn.textContent = '已下载';
        } catch (err) {
            btn.textContent = '失败';
            setStatus('这个文件解压失败：' + (err && err.message ? err.message : '未知错误'), true);
        } finally {
            setTimeout(() => { btn.disabled = false; btn.textContent = '下载'; }, 1500);
        }
    }

    function baseName(name) {
        return String(name || 'archive').replace(/\.(tar\.gz|tar\.bz2|tar\.xz|tgz|tbz2|txz|[^.]+)$/i, '');
    }

    async function unzipAll() {
        if (busy || !entries.length) return;
        busy = true;
        const btn = $('unzip-btn');
        btn.disabled = true;
        try {
            setStatus('正在读取全部文件…');
            const JSZip = await loadJszip();
            const zip = new JSZip();
            for (let i = 0; i < entries.length; i++) {
                const row = entries[i];
                const out = await row.file.extract();
                zip.file((row.path || '') + (out.name || row.file.name), out);
                setProgress(10 + ((i + 1) / entries.length) * 70);
                if (i % 20 === 0) setStatus('正在读取 ' + (i + 1) + ' / ' + entries.length + ' 个文件…');
            }
            const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
                setProgress(80 + meta.percent * 0.2);
                setStatus('正在打包 ' + Math.round(meta.percent) + '%…');
            });
            saveBlob(blob, baseName(file.name) + '-解压.zip');
            setProgress(100);
            setStatus('已打包完成，浏览器开始下载。');
        } catch (err) {
            setStatus('打包失败：' + (err && err.message ? err.message : '未知错误'), true);
        } finally {
            busy = false;
            btn.disabled = false;
            setTimeout(() => setProgress(0), 800);
        }
    }

    async function unzipRun() {
        if (busy || !file) return;
        busy = true;
        const btn = $('unzip-btn');
        btn.disabled = true;
        btn.textContent = '解压中…';
        try {
            setStatus('正在加载解压引擎…');
            setProgress(5);
            const Archive = await loadLibarchive();

            if (archive) {
                try { await archive.close(); } catch (e) {}
                archive = null;
            }

            setProgress(25);
            setStatus('正在读取压缩包…');
            archive = await Archive.open(file);

            if (await archive.hasEncryptedData()) {
                const pass = ($('unzip-pass').value || '').trim();
                if (!pass) {
                    $('unzip-pass-wrap').hidden = false;
                    setStatus('这个压缩包已加密，请填写密码后再点「开始解压」。', true);
                    return;
                }
                await archive.usePassword(pass);
            }

            $('unzip-pass-wrap').hidden = true;
            setProgress(60);
            const rows = await archive.getFilesArray();
            entries = rows.filter((row) => row.file && typeof row.file.extract === 'function');
            if (!entries.length) {
                setStatus('没有读到可解压的文件，可能是空包或格式不被支持。', true);
                return;
            }
            renderList();
            setProgress(100);
            setStatus('读取完成：共 ' + entries.length + ' 个文件，可单独下载或全部打包下载。');
        } catch (err) {
            const msg = String((err && err.message) || err || '未知错误');
            if (/passphrase|password|encrypt/i.test(msg)) {
                $('unzip-pass-wrap').hidden = false;
                setStatus('解压失败：压缩包已加密，请填写密码后重试。', true);
            } else {
                setStatus('解压失败：' + msg + '（该格式可能不被支持）', true);
            }
        } finally {
            busy = false;
            btn.disabled = false;
            btn.textContent = '开始解压';
            setTimeout(() => setProgress(0), 800);
        }
    }

    function initUnzipView() {
        if (!$('unzip-cards')) return;
        renderCards();
    }

    document.addEventListener('DOMContentLoaded', () => {
        const zone = $('unzip-drop');
        if (!zone) return;
        ['dragenter', 'dragover'].forEach((evt) => zone.addEventListener(evt, (e) => {
            e.preventDefault();
            zone.classList.add('dragging');
        }));
        ['dragleave', 'drop'].forEach((evt) => zone.addEventListener(evt, (e) => {
            e.preventDefault();
            zone.classList.remove('dragging');
        }));
        zone.addEventListener('drop', (e) => {
            const dropped = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (dropped) applyFile(dropped);
        });
        initUnzipView();
    });

    window.switchUnzipGroup = switchUnzipGroup;
    window.unzipChoose = unzipChoose;
    window.unzipPick = unzipPick;
    window.unzipClear = unzipClear;
    window.unzipRun = unzipRun;
    window.unzipAll = unzipAll;
    window.initUnzipView = initUnzipView;
})();
