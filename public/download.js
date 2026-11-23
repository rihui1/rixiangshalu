/* 高速下载：把 GitHub / Hugging Face 链接转换成公共镜像地址，下载由浏览器直连镜像 */

(function () {
    const $ = (id) => document.getElementById(id);
    const POLICY_KEY = 'dl_proxy_prefix';

    // 公共 GitHub 镜像，按实测可用性排序；失效时可以手动换下一个
    const GH_MIRRORS = [
        { name: 'ghproxy.net', make: (u) => 'https://ghproxy.net/' + u },
        { name: 'gh-proxy.com', make: (u) => 'https://gh-proxy.com/' + u },
        { name: 'ghfast.top', make: (u) => 'https://ghfast.top/' + u },
        { name: 'gh.llkk.cc', make: (u) => 'https://gh.llkk.cc/' + u },
        { name: 'gitmirror', make: (u) => 'https://hub.gitmirror.com/' + u },
        { name: 'moeyy', make: (u) => 'https://github.moeyy.xyz/' + u }
    ];

    function setStatus(text, isError) {
        const el = $('dl-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function getPrefix() {
        try { return (localStorage.getItem(POLICY_KEY) || '').trim(); } catch (e) { return ''; }
    }

    function buildProxied(prefix, url) {
        if (!prefix) return '';
        let base = prefix.trim();
        if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
        if (base.indexOf('{url}') >= 0) return base.replace('{url}', encodeURIComponent(url));
        return base.replace(/\/+$/, '') + '/' + url;
    }

    function normalize(raw) {
        let value = String(raw || '').trim();
        if (!value) return '';
        if (/^[\w-]+\/[\w.-]+$/.test(value)) {
            value = 'https://github.com/' + value;
        } else if (!/^https?:\/\//i.test(value)) {
            value = 'https://' + value;
        }
        return value;
    }

    function fmtError() {
        setStatus('这个链接看起来不太对，检查一下再试。', true);
    }

    function ghRaw(owner, repo, branch, filePath) {
        return 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + branch + '/' + filePath;
    }

    function analyzeGithub(url) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length < 2) return null;
        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/, '');
        const rest = parts.slice(2);
        const prefix = getPrefix();

        let direct = url.href;
        let title = 'GitHub 链接';
        let rawInfo = null;

        if ((rest[0] === 'blob' || rest[0] === 'raw') && rest.length >= 3) {
            const branch = rest[1];
            const filePath = rest.slice(2).join('/');
            direct = ghRaw(owner, repo, branch, filePath);
            title = 'GitHub 文件';
            rawInfo = { owner: owner, repo: repo, branch: branch, filePath: filePath };
        } else if (rest[0] === 'releases') {
            title = 'GitHub Release';
        } else if (rest[0] === 'archive') {
            title = 'GitHub 仓库压缩包';
        } else if (!rest.length || rest[0] === 'tree') {
            const branch = rest[0] === 'tree' && rest[1] ? rest[1] : 'main';
            direct = 'https://github.com/' + owner + '/' + repo + '/archive/refs/heads/' + branch + '.zip';
            title = 'GitHub 仓库压缩包';
        }

        const mirrors = GH_MIRRORS.map((m) => ({ name: m.name, url: m.make(direct) }));
        if (rawInfo) {
            mirrors.unshift({
                name: 'jsDelivr',
                url: 'https://cdn.jsdelivr.net/gh/' + rawInfo.owner + '/' + rawInfo.repo + '@' +
                    rawInfo.branch + '/' + rawInfo.filePath
            });
        }
        const custom = buildProxied(prefix, direct);
        if (custom) mirrors.unshift({ name: '自建中转', url: custom });

        const sections = [
            { title: '原始链接', note: title, rows: [{ name: '直链', url: direct }] },
            { title: '镜像加速', note: '任选一个能打开的即可', rows: mirrors }
        ];
        return { title: title, sections: sections };
    }

    function analyzeHuggingFace(url) {
        const prefix = getPrefix();
        const mirror = new URL(url.href);
        mirror.hostname = 'hf-mirror.com';
        const rows = [{ name: 'hf-mirror.com', url: mirror.href }];
        const custom = buildProxied(prefix, url.href);
        if (custom) rows.unshift({ name: '自建中转', url: custom });
        return {
            title: 'Hugging Face',
            sections: [
                { title: '原始链接', note: '官方地址', rows: [{ name: '直链', url: url.href }] },
                { title: '镜像加速', note: 'hf-mirror.com 国内镜像', rows: rows }
            ]
        };
    }

    function analyzeGeneric(url) {
        const prefix = getPrefix();
        const rows = [];
        const custom = buildProxied(prefix, url.href);
        if (custom) rows.push({ name: '自建中转', url: custom });
        return {
            title: '普通链接',
            sections: [
                {
                    title: '原始链接',
                    note: prefix ? '公共镜像只覆盖 GitHub 与 Hugging Face' : '可以复制直链用下载工具加速',
                    rows: [{ name: '直链', url: url.href }]
                }
            ].concat(rows.length ? [{ title: '自建中转', note: '使用你填写的加速前缀', rows: rows }] : [])
        };
    }

    function analyze(raw) {
        const value = normalize(raw);
        if (!value) { fmtError(); return null; }
        let url;
        try { url = new URL(value); } catch (e) { fmtError(); return null; }
        if (!/^https?:$/.test(url.protocol)) { fmtError(); return null; }

        const host = url.hostname.toLowerCase();
        if (host === 'github.com' || host === 'm.github.com') return analyzeGithub(url);
        if (host === 'raw.githubusercontent.com') {
            const parts = url.pathname.split('/').filter(Boolean);
            if (parts.length >= 4) {
                const direct = url.href;
                const rawInfo = { owner: parts[0], repo: parts[1], branch: parts[2], filePath: parts.slice(3).join('/') };
                const mirrors = GH_MIRRORS.map((m) => ({ name: m.name, url: m.make(direct) }));
                mirrors.unshift({
                    name: 'jsDelivr',
                    url: 'https://cdn.jsdelivr.net/gh/' + rawInfo.owner + '/' + rawInfo.repo + '@' +
                        rawInfo.branch + '/' + rawInfo.filePath
                });
                const custom = buildProxied(getPrefix(), direct);
                if (custom) mirrors.unshift({ name: '自建中转', url: custom });
                return {
                    title: 'GitHub 文件',
                    sections: [
                        { title: '原始链接', note: 'raw.githubusercontent.com', rows: [{ name: '直链', url: direct }] },
                        { title: '镜像加速', note: '任选一个能打开的即可', rows: mirrors }
                    ]
                };
            }
            return analyzeGeneric(url);
        }
        if (host === 'huggingface.co' || host === 'www.huggingface.co') return analyzeHuggingFace(url);
        return analyzeGeneric(url);
    }

    function rowHtml(row) {
        const safeUrl = escapeHtml(row.url);
        return '<div class="dl-row">' +
            '<span class="dl-name">' + escapeHtml(row.name) + '</span>' +
            '<code>' + safeUrl + '</code>' +
            '<div class="dl-actions">' +
                '<button type="button" class="ghost small" data-url="' + safeUrl + '" onclick="copyDownloadUrl(this.dataset.url)">复制</button>' +
                '<a class="ghost small" href="' + safeUrl + '" target="_blank" rel="noopener">打开</a>' +
            '</div>' +
        '</div>';
    }

    function render(result) {
        const box = $('dl-result');
        if (!box) return;
        box.innerHTML = result.sections.map((section) =>
            '<div class="dl-block">' +
                '<div class="dl-block-head"><strong>' + escapeHtml(section.title) + '</strong><span>' + escapeHtml(section.note || '') + '</span></div>' +
                section.rows.map(rowHtml).join('') +
            '</div>'
        ).join('');
    }

    function parseDownload() {
        const input = $('dl-input');
        const raw = input ? input.value : '';
        const result = analyze(raw);
        if (!result) return;
        render(result);
        setStatus('已生成下载地址，点「打开」由浏览器直连镜像下载。');
    }

    function dlKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            parseDownload();
        }
    }

    function copyDownloadUrl(url) {
        const done = () => setStatus('下载地址已复制：' + url);
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

    function savePrefix() {
        const input = $('dl-proxy');
        const value = input ? input.value.trim() : '';
        try { localStorage.setItem(POLICY_KEY, value); } catch (e) { /* 忽略隐私模式 */ }
        setStatus(value ? '已保存自建加速前缀，重新解析即可生效。' : '已清除自建加速前缀。');
        if (value) parseDownload();
    }

    function initDownloadView() {
        const input = $('dl-proxy');
        if (input && !input.value) input.value = getPrefix();
    }

    document.addEventListener('DOMContentLoaded', initDownloadView);

    window.initDownloadView = initDownloadView;
    window.parseDownload = parseDownload;
    window.dlKey = dlKey;
    window.copyDownloadUrl = copyDownloadUrl;
    window.savePrefix = savePrefix;
})();
