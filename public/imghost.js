/* 极简图床：图片以二进制上传到服务器，返回 /uploads 直链 */

(function () {
    const $ = (id) => document.getElementById(id);
    const MAX_BYTES = 8 * 1024 * 1024;
    const ACCEPT = /^image\/(png|jpeg|webp|gif)$/;

    let lastToken = null;
    let loaded = false;
    let uploading = false;
    let bound = false;

    function getToken() {
        try { return token || ''; } catch (e) { return ''; }
    }

    function setStatus(text, isError) {
        const el = $('img-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function fmtSize(bytes) {
        const n = Number(bytes) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1024 / 1024).toFixed(2) + ' MB';
    }

    /* 超过 5MB 时在浏览器里等比缩小，避免超过服务端限制 */
    function prepare(file) {
        if (file.size <= 5 * 1024 * 1024) return Promise.resolve({ blob: file, type: file.type });
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 2400 / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                canvas.toBlob((blob) => {
                    if (blob) resolve({ blob: blob, type: type });
                    else resolve({ blob: file, type: file.type });
                }, type, 0.88);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve({ blob: file, type: file.type });
            };
            img.src = url;
        });
    }

    async function uploadFiles(fileList) {
        const tk = getToken();
        if (!tk) {
            setStatus('登录后才能上传图片。', true);
            if (window.openView) window.openView('view-profile');
            return;
        }
        if (uploading) return;
        const files = Array.prototype.slice.call(fileList || []).filter((f) => ACCEPT.test(f.type));
        if (!files.length) {
            setStatus('请选择 PNG / JPG / WEBP / GIF 图片。', true);
            return;
        }

        uploading = true;
        setStatus('准备上传 ' + files.length + ' 张图片…');
        let ok = 0;
        const failed = [];
        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            if (file.size > MAX_BYTES) {
                failed.push(file.name + '（超过 8MB）');
                continue;
            }
            setStatus('正在上传 ' + (i + 1) + ' / ' + files.length + '…');
            try {
                const prepared = await prepare(file);
                const res = await fetch('/api/images?name=' + encodeURIComponent(file.name || ''), {
                    method: 'POST',
                    headers: {
                        'Content-Type': prepared.type,
                        Authorization: 'Bearer ' + tk
                    },
                    body: prepared.blob
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (res.status === 401) {
                        setStatus('登录已过期，请重新登录。', true);
                        if (window.logout) window.logout();
                        uploading = false;
                        return;
                    }
                    failed.push(file.name + '（' + (data.error || '上传失败') + '）');
                    continue;
                }
                ok += 1;
                showLatest(location.origin + data.url);
            } catch (e) {
                failed.push(file.name + '（网络异常）');
            }
        }
        uploading = false;
        if (failed.length) {
            setStatus('成功 ' + ok + ' 张，失败 ' + failed.length + ' 张：' + failed.join('；'), true);
        } else {
            setStatus('上传完成，共 ' + ok + ' 张，直链可以直接复制。');
        }
        loadGallery();
    }

    function showLatest(fullUrl) {
        const box = $('img-list');
        if (!box) return;
        const item = document.createElement('div');
        item.className = 'img-item just-uploaded';
        item.innerHTML =
            '<a class="img-thumb" href="' + escapeHtml(fullUrl) + '" target="_blank" rel="noopener">' +
                '<img src="' + escapeHtml(fullUrl) + '" alt="">' +
            '</a>' +
            '<div class="img-info"><strong>刚刚上传</strong><code>' + escapeHtml(fullUrl) + '</code></div>' +
            '<div class="img-actions"><button type="button" class="ghost small" data-url="' + escapeHtml(fullUrl) + '" onclick="copyImgUrl(this.dataset.url)">复制链接</button></div>';
        if (box.querySelector('.empty')) box.innerHTML = '';
        box.insertBefore(item, box.firstChild);
    }

    function renderGallery(data) {
        const box = $('img-list');
        if (!box) return;
        const images = Array.isArray(data.images) ? data.images : [];
        if (!images.length) {
            box.innerHTML = '<p class="empty">还没有上传过图片。</p>';
            return;
        }
        box.innerHTML = images.map((img) => {
            const full = location.origin + img.url;
            return '<div class="img-item">' +
                '<a class="img-thumb" href="' + escapeHtml(full) + '" target="_blank" rel="noopener"><img src="' + escapeHtml(img.url) + '" alt="" loading="lazy"></a>' +
                '<div class="img-info"><strong>' + escapeHtml(img.name || '') + '</strong>' +
                    '<span>' + fmtSize(img.size) + ' · ' + escapeHtml(String(img.created_at || '').slice(0, 16)) + '</span>' +
                    '<code>' + escapeHtml(full) + '</code></div>' +
                '<div class="img-actions">' +
                    '<button type="button" class="ghost small" data-url="' + escapeHtml(full) + '" onclick="copyImgUrl(this.dataset.url)">复制链接</button>' +
                    '<button type="button" class="danger small" onclick="deleteImg(' + img.id + ')">删除</button>' +
                '</div>' +
            '</div>';
        }).join('');
        if (data.limit) {
            setStatus('今天已上传 ' + (data.usedToday || 0) + ' / ' + data.limit + ' 张。');
        }
    }

    async function loadGallery() {
        const tk = getToken();
        if (!tk) {
            const box = $('img-list');
            if (box) box.innerHTML = '<p class="empty">登录后可以查看自己上传过的图片。</p>';
            setStatus('登录后即可上传，图片会保存到服务器。');
            return;
        }
        try {
            const res = await fetch('/api/images', {
                headers: { Authorization: 'Bearer ' + tk }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '加载失败，请稍后再试。', true);
                return;
            }
            loaded = true;
            renderGallery(data);
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        }
    }

    function copyImgUrl(url) {
        const done = () => setStatus('链接已复制：' + url);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
        } else {
            fallbackCopy(url, done);
        }
    }

    function fallbackCopy(text, done) {
        const input = document.createElement('textarea');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        try { document.execCommand('copy'); done(); } catch (e) { setStatus('复制失败，请手动选中复制。', true); }
        document.body.removeChild(input);
    }

    async function deleteImg(id) {
        if (!confirm('删除这张图片？直链会立刻失效。')) return;
        const tk = getToken();
        if (!tk) return;
        try {
            const res = await fetch('/api/images/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tk } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '删除失败', true);
                return;
            }
            setStatus('已删除。');
            loadGallery();
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        }
    }

    function imgPick(event) {
        const input = event.target;
        const files = input.files;
        input.value = '';
        uploadFiles(files);
    }

    function bindDrop() {
        const zone = $('img-drop');
        if (!zone || bound) return;
        bound = true;
        ['dragenter', 'dragover'].forEach((name) => {
            zone.addEventListener(name, (e) => {
                e.preventDefault();
                zone.classList.add('dragging');
            });
        });
        ['dragleave', 'drop'].forEach((name) => {
            zone.addEventListener(name, (e) => {
                e.preventDefault();
                zone.classList.remove('dragging');
            });
        });
        zone.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                uploadFiles(e.dataTransfer.files);
            }
        });
        document.addEventListener('paste', (e) => {
            const view = $('view-imghost');
            if (!view || !view.classList.contains('active')) return;
            if (!e.clipboardData || !e.clipboardData.items) return;
            const files = [];
            for (let i = 0; i < e.clipboardData.items.length; i += 1) {
                const item = e.clipboardData.items[i];
                if (item.kind === 'file' && ACCEPT.test(item.type)) {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }
            if (files.length) {
                e.preventDefault();
                uploadFiles(files);
            }
        });
    }

    function initImgHostView() {
        bindDrop();
        const tk = getToken();
        if (!loaded || lastToken !== tk) {
            lastToken = tk;
            loaded = false;
            loadGallery();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindDrop();
        if (!loaded) { lastToken = getToken(); loadGallery(); }
    });

    window.initImgHostView = initImgHostView;
    window.imgPick = imgPick;
    window.copyImgUrl = copyImgUrl;
    window.deleteImg = deleteImg;
})();
