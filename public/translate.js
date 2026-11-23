/* 翻译：调用站内 /api/translate，源语言与目标语言可互换 */

(function () {
    const LANGS = [
        { code: 'auto', label: '自动检测' },
        { code: 'zh', label: '中文' },
        { code: 'en', label: '英语' },
        { code: 'ja', label: '日语' },
        { code: 'ko', label: '韩语' },
        { code: 'fr', label: '法语' },
        { code: 'de', label: '德语' },
        { code: 'es', label: '西班牙语' },
        { code: 'ru', label: '俄语' },
        { code: 'pt', label: '葡萄牙语' },
        { code: 'it', label: '意大利语' },
        { code: 'ar', label: '阿拉伯语' },
        { code: 'th', label: '泰语' }
    ];
    const MAX_LEN = 4000;
    let busy = false;

    const $ = (id) => document.getElementById(id);

    function setStatus(text, isError) {
        const el = $('trans-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function fillSelect(select, current) {
        if (!select) return;
        select.innerHTML = LANGS.map((l) =>
            '<option value="' + l.code + '">' + l.label + '</option>'
        ).join('');
        select.value = current;
    }

    function initTranslateView() {
        const from = $('trans-from');
        const to = $('trans-to');
        if (!from || !to) return;
        fillSelect(from, from.value || 'auto');
        fillSelect(to, to.value || 'en');
        updateTransCount();
    }

    function swapTransLang() {
        const from = $('trans-from');
        const to = $('trans-to');
        if (!from || !to) return;
        const f = from.value;
        const t = to.value;
        if (f === 'auto') {
            from.value = t;
            to.value = 'zh';
        } else {
            from.value = t;
            to.value = f;
        }
        setStatus('已交换源语言和目标语言。');
    }

    function updateTransCount() {
        const input = $('trans-input');
        const count = $('trans-count');
        if (!input || !count) return;
        const len = input.value.length;
        count.textContent = len + ' / ' + MAX_LEN;
        count.classList.toggle('over', len > MAX_LEN);
    }

    function transKey(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            runTranslate();
        }
    }

    async function runTranslate() {
        if (busy) return;
        const input = $('trans-input');
        const output = $('trans-output');
        const text = (input.value || '').trim();
        if (!text) {
            setStatus('先在左边输入要翻译的内容。', true);
            return;
        }
        if (text.length > MAX_LEN) {
            setStatus('内容太长了，请控制在 ' + MAX_LEN + ' 字以内。', true);
            return;
        }
        const from = $('trans-from').value;
        const to = $('trans-to').value;
        if (from !== 'auto' && from === to) {
            output.value = text;
            setStatus('源语言和目标语言相同，已直接填入原文。');
            return;
        }

        const btn = $('trans-btn');
        busy = true;
        btn.disabled = true;
        btn.textContent = '翻译中…';
        setStatus('正在翻译，稍等一下…');
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, from: from, to: to })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '翻译失败，请稍后再试。', true);
                return;
            }
            output.value = data.text || '';
            setStatus('翻译完成。');
        } catch (err) {
            setStatus('网络请求失败，请稍后再试。', true);
        } finally {
            busy = false;
            btn.disabled = false;
            btn.textContent = '开始翻译';
        }
    }

    function copyTrans() {
        const output = $('trans-output');
        const text = (output.value || '').trim();
        if (!text) {
            setStatus('还没有译文可以复制。', true);
            return;
        }
        const done = () => setStatus('译文已复制。');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(output, done));
        } else {
            fallbackCopy(output, done);
        }
    }

    function fallbackCopy(output, done) {
        output.removeAttribute('readonly');
        output.select();
        try {
            document.execCommand('copy');
            done();
        } catch (e) {
            setStatus('复制失败，请手动选中复制。', true);
        }
        output.setAttribute('readonly', 'readonly');
    }

    document.addEventListener('DOMContentLoaded', initTranslateView);

    window.initTranslateView = initTranslateView;
    window.swapTransLang = swapTransLang;
    window.updateTransCount = updateTransCount;
    window.transKey = transKey;
    window.runTranslate = runTranslate;
    window.copyTrans = copyTrans;
})();
