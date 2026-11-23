/* 短链接：登录后可生成 / 管理自己的短链，访问 /s/短码 会 302 跳转 */

(function () {
    const $ = (id) => document.getElementById(id);

    let lastToken = null;
    let loaded = false;

    function getToken() {
        try { return token || ''; } catch (e) { return ''; }
    }

    function setStatus(text, isError) {
        const el = $('short-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function shortKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            createShort();
        }
    }

    function renderResult(code) {
        const box = $('short-result');
        if (!box) return;
        const full = location.origin + '/s/' + code;
        box.hidden = false;
        box.innerHTML =
            '<div class="short-full"><strong>短链接已生成</strong>' +
            '<a href="' + escapeHtml(full) + '" target="_blank" rel="noopener">' + escapeHtml(full) + '</a></div>' +
            '<button type="button" class="primary small" data-url="' + escapeHtml(full) + '" onclick="copyShortUrl(this.dataset.url)">复制</button>';
    }

    async function createShort() {
        const tk = getToken();
        if (!tk) {
            setStatus('登录后才能生成短链接。', true);
            if (window.openView) window.openView('view-profile');
            return;
        }
        const input = $('short-input');
        const url = input ? input.value.trim() : '';
        if (!url) {
            setStatus('先粘贴一个长链接。', true);
            if (input) input.focus();
            return;
        }
        const btn = document.querySelector('#view-short .primary');
        if (btn) btn.disabled = true;
        setStatus('正在生成…');
        try {
            const res = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
                body: JSON.stringify({ url: url })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '生成失败，请稍后再试。', true);
                return;
            }
            renderResult(data.code);
            if (input) input.value = '';
            setStatus('生成成功，点右侧按钮复制。');
            loadLinks();
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function renderLinks(links) {
        const box = $('short-list');
        if (!box) return;
        if (!links.length) {
            box.innerHTML = '<p class="empty">还没有生成过短链接。</p>';
            return;
        }
        box.innerHTML = links.map((link) => {
            const full = location.origin + '/s/' + link.code;
            return '<div class="link-item">' +
                '<div class="link-main">' +
                    '<a href="' + escapeHtml(full) + '" target="_blank" rel="noopener">' + escapeHtml(full) + '</a>' +
                    '<span class="link-target">' + escapeHtml(link.url) + '</span>' +
                '</div>' +
                '<span class="link-hits">' + (link.hits || 0) + ' 次访问</span>' +
                '<div class="link-actions">' +
                    '<button type="button" class="ghost small" data-url="' + escapeHtml(full) + '" onclick="copyShortUrl(this.dataset.url)">复制</button>' +
                    '<button type="button" class="danger small" onclick="deleteShort(' + link.id + ')">删除</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    async function loadLinks() {
        const tk = getToken();
        if (!tk) {
            const box = $('short-list');
            if (box) box.innerHTML = '<p class="empty">登录后可以查看自己的短链接。</p>';
            setStatus('登录后可以生成并管理自己的短链接。');
            return;
        }
        try {
            const res = await fetch('/api/shorten', { headers: { Authorization: 'Bearer ' + tk } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '加载失败，请稍后再试。', true);
                return;
            }
            loaded = true;
            renderLinks(Array.isArray(data.links) ? data.links : []);
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        }
    }

    function copyShortUrl(url) {
        const done = () => setStatus('短链接已复制：' + url);
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

    async function deleteShort(id) {
        const tk = getToken();
        if (!tk) return;
        if (!confirm('删除这条短链接？删除后原地址无法再跳转。')) return;
        try {
            const res = await fetch('/api/shorten/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tk } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '删除失败', true);
                return;
            }
            setStatus('已删除。');
            loadLinks();
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        }
    }

    function initShortView() {
        const tk = getToken();
        if (!loaded || lastToken !== tk) {
            lastToken = tk;
            loaded = false;
            loadLinks();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!loaded) { lastToken = getToken(); loadLinks(); }
    });

    window.initShortView = initShortView;
    window.shortKey = shortKey;
    window.createShort = createShort;
    window.copyShortUrl = copyShortUrl;
    window.deleteShort = deleteShort;
})();
