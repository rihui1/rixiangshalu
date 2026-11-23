/* 图片 / PDF / 文档转换：全部在浏览器本地完成，文件不上传服务器 */

(function () {
    const LIB = {
        jspdf: 'vendor/docs/jspdf.umd.min.js',
        pdfjs: 'vendor/docs/pdf.min.js',
        pdfworker: 'vendor/docs/pdf.worker.min.js',
        mammoth: 'vendor/docs/mammoth.browser.min.js',
        html2canvas: 'vendor/docs/html2canvas.min.js'
    };

    const MODES = {
        img2img: { multiple: true, accept: 'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp', title: '点击选择图片，或拖到这里', hint: '支持 PNG / JPG / JPEG / WEBP / GIF / BMP' },
        img2pdf: { multiple: true, accept: 'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp', title: '选择一张或多张图片，合成 PDF', hint: '多张图片会按选择顺序各占一页' },
        pdf2img: { multiple: false, accept: 'application/pdf,.pdf', title: '点击选择 PDF 文件，或拖到这里', hint: '每一页会导出成一张图片' },
        doc2pdf: { multiple: false, accept: '.txt,.md,.markdown,.html,.htm,.docx', title: '选择文档，转成 PDF', hint: '支持 TXT / Markdown / HTML / DOCX' },
        pdf2txt: { multiple: false, accept: 'application/pdf,.pdf', title: '选择 PDF，导出纯文本', hint: '按页提取文字，图片型 PDF 无法识别' }
    };

    let mode = 'img2img';
    let files = [];
    let busy = false;
    const loaded = {};

    const $ = (id) => document.getElementById(id);

    function setStatus(text, isError) {
        const el = $('docs-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function setProgress(percent) {
        const wrap = $('docs-progress-wrap');
        const bar = $('docs-progress');
        if (!wrap || !bar) return;
        wrap.hidden = !percent;
        bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function loadScript(src) {
        if (loaded[src]) return loaded[src];
        loaded[src] = new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = src;
            el.onload = resolve;
            el.onerror = () => reject(new Error('组件加载失败：' + src));
            document.head.appendChild(el);
        });
        return loaded[src];
    }

    async function needJspdf() {
        if (!window.jspdf) await loadScript(LIB.jspdf);
        return window.jspdf.jsPDF;
    }

    async function needPdfjs() {
        if (!window.pdfjsLib) {
            await loadScript(LIB.pdfjs);
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB.pdfworker;
        }
        return window.pdfjsLib;
    }

    function fillFormats() {
        const select = $('docs-format');
        if (!select) return;
        let options = [];
        if (mode === 'img2img') {
            options = [['png', 'PNG'], ['jpeg', 'JPG / JPEG'], ['webp', 'WEBP']];
        } else if (mode === 'pdf2img') {
            options = [['png', 'PNG'], ['jpeg', 'JPG / JPEG'], ['webp', 'WEBP']];
        } else if (mode === 'img2pdf') {
            options = [['a4', 'A4 纸张'], ['fit', '按图片尺寸']];
        } else if (mode === 'doc2pdf') {
            options = [['a4', 'A4 纸张']];
        } else {
            options = [['txt', 'TXT 纯文本']];
        }
        select.innerHTML = options.map((o) => '<option value="' + o[0] + '">' + o[1] + '</option>').join('');
        const qualityWrap = $('docs-quality-wrap');
        if (qualityWrap) qualityWrap.hidden = !(mode === 'img2img' || mode === 'pdf2img');
        const formatWrap = $('docs-format-wrap');
        if (formatWrap) {
            const label = formatWrap.firstChild;
            if (label && label.nodeType === 3) label.textContent = mode === 'img2pdf' ? '页面尺寸' : mode === 'pdf2txt' ? '导出格式' : '输出格式';
        }
    }

    function switchDocMode(next) {
        if (busy) return;
        mode = next;
        document.querySelectorAll('#docs-tabs .convert-tab').forEach((el) => {
            el.classList.toggle('active', el.dataset.docmode === next);
        });
        const cfg = MODES[next];
        const input = $('docs-file');
        input.value = '';
        input.accept = cfg.accept;
        input.multiple = cfg.multiple;
        $('docs-drop-title').textContent = cfg.title;
        $('docs-drop-hint').textContent = cfg.hint;
        files = [];
        $('docs-file-info').hidden = true;
        $('docs-btn').disabled = true;
        $('docs-list').innerHTML = '';
        setProgress(0);
        fillFormats();
        setStatus('文件会在浏览器本地处理，不会上传服务器。');
    }

    function docsPick(event) {
        const list = Array.from(event.target.files || []);
        if (!list.length) return;
        files = MODES[mode].multiple ? list : [list[0]];
        const info = $('docs-file-info');
        info.hidden = false;
        info.innerHTML = '<strong>' + files.map((f) => escapeHtml(f.name)).join('、') + '</strong>' +
            '<span>' + files.length + ' 个文件 · ' +
            (files.reduce((sum, f) => sum + f.size, 0) / 1048576).toFixed(1) + ' MB</span>' +
            '<button type="button" class="ghost small" onclick="docsClear()">重选</button>';
        $('docs-btn').disabled = false;
        $('docs-list').innerHTML = '';
        setStatus('已选择文件，点「开始转换」。');
    }

    function docsClear() {
        if (busy) return;
        files = [];
        $('docs-file').value = '';
        $('docs-file-info').hidden = true;
        $('docs-btn').disabled = true;
        $('docs-list').innerHTML = '';
        setStatus('文件会在浏览器本地处理，不会上传服务器。');
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取这张图片：' + file.name)); };
            img.src = url;
        });
    }

    function canvasToBlob(canvas, mime, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('导出图片失败')), mime, quality);
        });
    }

    function addDownload(name, blob, label) {
        const url = URL.createObjectURL(blob);
        const row = document.createElement('div');
        row.className = 'docs-item';
        row.innerHTML = '<span>' + escapeHtml(label || name) + '</span>' +
            '<a class="primary download-btn" href="' + url + '" download="' + escapeHtml(name) + '">下载</a>';
        $('docs-list').appendChild(row);
    }

    function baseName(name) {
        return name.replace(/\.[^.]+$/, '');
    }

    async function runImg2Img() {
        const mime = 'image/' + $('docs-format').value;
        const ext = $('docs-format').value === 'jpeg' ? 'jpg' : $('docs-format').value;
        const quality = Number($('docs-quality').value);
        for (let i = 0; i < files.length; i++) {
            setStatus('正在处理 ' + (i + 1) + ' / ' + files.length + '…');
            setProgress(((i + 0.4) / files.length) * 100);
            const img = await loadImage(files[i]);
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (mime === 'image/jpeg') {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);
            const blob = await canvasToBlob(canvas, mime, quality);
            addDownload(baseName(files[i].name) + '.' + ext, blob, files[i].name + ' → ' + ext.toUpperCase());
            setProgress(((i + 1) / files.length) * 100);
        }
        setStatus('转换完成，点击右侧按钮下载。');
    }

    async function runImg2Pdf() {
        const JsPDF = await needJspdf();
        const layout = $('docs-format').value;
        let pdf = null;
        for (let i = 0; i < files.length; i++) {
            setStatus('正在合成第 ' + (i + 1) + ' / ' + files.length + ' 页…');
            setProgress(((i + 0.5) / files.length) * 100);
            const img = await loadImage(files[i]);
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

            if (!pdf) {
                if (layout === 'fit') {
                    pdf = new JsPDF({ unit: 'pt', format: [canvas.width * 0.75, canvas.height * 0.75], orientation: canvas.width > canvas.height ? 'landscape' : 'portrait' });
                } else {
                    pdf = new JsPDF({ unit: 'pt', format: 'a4' });
                }
            } else if (layout === 'fit') {
                pdf.addPage([canvas.width * 0.75, canvas.height * 0.75], canvas.width > canvas.height ? 'landscape' : 'portrait');
            } else {
                pdf.addPage('a4');
            }

            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const margin = layout === 'fit' ? 0 : 24;
            const maxW = pageW - margin * 2;
            const maxH = pageH - margin * 2;
            const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
            const w = canvas.width * ratio;
            const h = canvas.height * ratio;
            pdf.addImage(dataUrl, 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h);
            setProgress(((i + 1) / files.length) * 100);
        }
        const name = (files.length === 1 ? baseName(files[0].name) : 'images-' + Date.now()) + '.pdf';
        addDownload(name, pdf.output('blob'), name);
        setStatus('PDF 已生成，点击右侧按钮下载。');
    }

    async function runPdf2Img() {
        const pdfjsLib = await needPdfjs();
        const mime = 'image/' + $('docs-format').value;
        const quality = Number($('docs-quality').value);
        const ext = $('docs-format').value === 'jpeg' ? 'jpg' : $('docs-format').value;
        const buffer = await files[0].arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        for (let p = 1; p <= doc.numPages; p++) {
            setStatus('正在导出第 ' + p + ' / ' + doc.numPages + ' 页…');
            setProgress((p / doc.numPages) * 100);
            const page = await doc.getPage(p);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const ctx = canvas.getContext('2d');
            if (mime === 'image/jpeg') {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            await page.render({ canvasContext: ctx, viewport }).promise;
            const blob = await canvasToBlob(canvas, mime, quality);
            addDownload(baseName(files[0].name) + '-page' + p + '.' + ext, blob, '第 ' + p + ' 页');
        }
        setStatus('导出完成，共 ' + doc.numPages + ' 张图片。');
    }

    function escapeForHtml(text) {
        return escapeHtml(text).replace(/\n/g, '<br>');
    }

    async function buildDocHtml(file) {
        const name = file.name.toLowerCase();
        if (name.endsWith('.docx')) {
            if (!window.mammoth) await loadScript(LIB.mammoth);
            const result = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
            return result.value;
        }
        const text = await file.text();
        if (name.endsWith('.html') || name.endsWith('.htm')) return text;
        if (name.endsWith('.md') || name.endsWith('.markdown')) {
            return '<pre style="white-space:pre-wrap;font-family:inherit;">' + escapeForHtml(text) + '</pre>';
        }
        return '<pre style="white-space:pre-wrap;font-family:inherit;">' + escapeForHtml(text) + '</pre>';
    }

    async function runDoc2Pdf() {
        if (!window.html2canvas) await loadScript(LIB.html2canvas);
        const JsPDF = await needJspdf();
        setStatus('正在排版文档…');
        const html = await buildDocHtml(files[0]);

        const holder = document.createElement('div');
        holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;padding:48px;background:#fff;color:#000;font:16px/1.8 "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;';
        holder.innerHTML = html;
        holder.querySelectorAll('img').forEach((img) => { img.style.maxWidth = '100%'; });
        document.body.appendChild(holder);

        try {
            setStatus('正在生成页面图片…');
            setProgress(35);
            const canvas = await window.html2canvas(holder, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                windowWidth: 794
            });
            const pdf = new JsPDF({ unit: 'pt', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const sliceHeightPx = Math.floor(canvas.width * (pageH / pageW));
            const pages = Math.max(1, Math.ceil(canvas.height / sliceHeightPx));

            for (let p = 0; p < pages; p++) {
                if (p > 0) pdf.addPage('a4');
                const slice = document.createElement('canvas');
                slice.width = canvas.width;
                slice.height = Math.min(sliceHeightPx, canvas.height - p * sliceHeightPx);
                const sctx = slice.getContext('2d');
                sctx.fillStyle = '#fff';
                sctx.fillRect(0, 0, slice.width, slice.height);
                sctx.drawImage(canvas, 0, p * sliceHeightPx, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
                const imgH = (slice.height * pageW) / canvas.width;
                pdf.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pageW, imgH);
                setStatus('正在生成第 ' + (p + 1) + ' / ' + pages + ' 页…');
                setProgress(35 + ((p + 1) / pages) * 65);
            }

            const name = baseName(files[0].name) + '.pdf';
            addDownload(name, pdf.output('blob'), name);
            setStatus('PDF 已生成，点击右侧按钮下载。');
        } finally {
            holder.remove();
        }
    }

    async function runPdf2Txt() {
        const pdfjsLib = await needPdfjs();
        const buffer = await files[0].arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        let out = '';
        for (let p = 1; p <= doc.numPages; p++) {
            setStatus('正在提取第 ' + p + ' / ' + doc.numPages + ' 页…');
            setProgress((p / doc.numPages) * 100);
            const page = await doc.getPage(p);
            const content = await page.getTextContent();
            let line = '';
            content.items.forEach((item) => {
                line += item.str;
                if (item.hasEOL) line += '\n';
            });
            out += '===== 第 ' + p + ' 页 =====\n' + line.trim() + '\n\n';
        }
        const name = baseName(files[0].name) + '.txt';
        addDownload(name, new Blob([out], { type: 'text/plain;charset=utf-8' }), name + '（' + doc.numPages + ' 页）');
        setStatus('提取完成。图片型 PDF 没有文字层，结果可能为空。');
    }

    async function docsRun() {
        if (busy || !files.length) return;
        const btn = $('docs-btn');
        busy = true;
        btn.disabled = true;
        btn.textContent = '处理中…';
        $('docs-list').innerHTML = '';
        setProgress(4);
        try {
            if (mode === 'img2img') await runImg2Img();
            else if (mode === 'img2pdf') await runImg2Pdf();
            else if (mode === 'pdf2img') await runPdf2Img();
            else if (mode === 'doc2pdf') await runDoc2Pdf();
            else await runPdf2Txt();
        } catch (err) {
            setStatus('处理失败：' + (err && err.message ? err.message : '未知错误'), true);
        } finally {
            busy = false;
            btn.disabled = !files.length;
            btn.textContent = '开始转换';
            setTimeout(() => setProgress(0), 600);
        }
    }

    function initDocsView() {
        if (!$('docs-tabs')) return;
        switchDocMode(mode);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const zone = $('docs-drop');
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
                const dropped = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
                if (!dropped.length) return;
                files = MODES[mode].multiple ? dropped : [dropped[0]];
                const info = $('docs-file-info');
                info.hidden = false;
                info.innerHTML = '<strong>' + files.map((f) => escapeHtml(f.name)).join('、') + '</strong>' +
                    '<span>' + files.length + ' 个文件</span>';
                $('docs-btn').disabled = false;
                setStatus('已选择文件，点「开始转换」。');
            });
        }
        initDocsView();
    });

    window.switchDocMode = switchDocMode;
    window.docsPick = docsPick;
    window.docsClear = docsClear;
    window.docsRun = docsRun;
    window.initDocsView = initDocsView;
})();
