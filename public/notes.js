/* Markdown 笔记：左侧编辑右侧实时预览，支持 AI 润色，内容保存在服务器 */

(function () {
    const $ = (id) => document.getElementById(id);

    let notes = [];
    let currentId = null;
    let dirty = false;
    let loaded = false;
    let lastToken = null;
    let polishing = false;
    let previewTimer = 0;
    let bound = false;

    function getToken() {
        try { return token || ''; } catch (e) { return ''; }
    }

    function setStatus(text, isError) {
        const el = $('note-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    /* 清理 marked 输出的 HTML，去掉脚本、内联事件和 javascript: 链接 */
    function sanitize(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button,textarea,svg').forEach((el) => el.remove());
        doc.querySelectorAll('*').forEach((el) => {
            Array.prototype.slice.call(el.attributes).forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = String(attr.value || '').trim();
                if (name.indexOf('on') === 0) el.removeAttribute(attr.name);
                else if ((name === 'href' || name === 'src') && /^javascript:/i.test(value)) el.removeAttribute(attr.name);
            });
        });
        return doc.body.innerHTML;
    }

    function renderPreview() {
        const textarea = $('note-content');
        const box = $('note-preview');
        if (!textarea || !box) return;
        const content = textarea.value;
        if (!content.trim()) {
            box.innerHTML = '<p class="empty">开始写 Markdown，这里会实时预览。</p>';
            return;
        }
        let html = '';
        if (window.marked && typeof window.marked.parse === 'function') {
            try {
                html = window.marked.parse(content, { gfm: true, breaks: true });
            } catch (e) {
                html = '<pre>' + escapeHtml(content) + '</pre>';
            }
        } else {
            html = '<pre>' + escapeHtml(content) + '</pre>';
        }
        box.innerHTML = sanitize(html);
        box.querySelectorAll('a').forEach((a) => {
            a.target = '_blank';
            a.rel = 'noopener';
        });
    }

    function renderList() {
        const box = $('notes-list');
        if (!box) return;
        if (!notes.length) {
            box.innerHTML = '<p class="empty">还没有笔记。</p>';
            return;
        }
        box.innerHTML = notes.map((note) =>
            '<button type="button" class="note-item' + (note.id === currentId ? ' active' : '') + '" onclick="openNote(' + note.id + ')">' +
                '<strong>' + escapeHtml(note.title || '未命名笔记') + '</strong>' +
                '<span>' + escapeHtml(String(note.updated_at || '').slice(0, 16)) + '</span>' +
            '</button>'
        ).join('');
    }

    function fillEditor(note) {
        const title = $('note-title');
        const content = $('note-content');
        if (title) title.value = note ? (note.title || '') : '';
        if (content) content.value = note ? (note.content || '') : '';
        renderPreview();
    }

    function openNote(id) {
        const note = notes.find((n) => n.id === id);
        if (!note) return;
        if (dirty && !confirm('当前笔记还没保存，确定切换到另一篇吗？')) return;
        currentId = id;
        dirty = false;
        fillEditor(note);
        renderList();
        setStatus('已打开「' + (note.title || '未命名笔记') + '」。');
    }

    function newNote() {
        if (dirty && !confirm('当前笔记还没保存，确定新建一篇吗？')) return;
        currentId = null;
        dirty = false;
        fillEditor(null);
        const title = $('note-title');
        if (title) title.focus();
        renderList();
        setStatus('新笔记，写完点保存。');
    }

    async function loadNotes() {
        const tk = getToken();
        if (!tk) {
            notes = [];
            renderList();
            fillEditor(null);
            setStatus('未登录时无法保存笔记，请先登录。');
            return;
        }
        try {
            const res = await fetch('/api/notes', { headers: { Authorization: 'Bearer ' + tk } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '加载失败，请稍后再试。', true);
                return;
            }
            notes = Array.isArray(data.notes) ? data.notes : [];
            loaded = true;
            renderList();
            if (notes.length) {
                const keep = notes.find((n) => n.id === currentId);
                const target = keep || notes[0];
                currentId = target.id;
                dirty = false;
                fillEditor(target);
                setStatus('共 ' + notes.length + ' 篇笔记。');
            } else {
                currentId = null;
                fillEditor(null);
                setStatus('还没有笔记，点「新建笔记」开始吧。');
            }
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        }
    }

    async function saveNote() {
        const tk = getToken();
        if (!tk) {
            setStatus('登录后才能保存笔记。', true);
            if (window.openView) window.openView('view-profile');
            return;
        }
        const titleEl = $('note-title');
        const contentEl = $('note-content');
        const title = ((titleEl && titleEl.value) || '').trim() || '未命名笔记';
        const content = (contentEl && contentEl.value) || '';
        const btn = document.querySelector('#view-notes .primary.small');
        if (btn) btn.disabled = true;
        setStatus('正在保存…');
        try {
            const isNew = !currentId;
            const res = await fetch(isNew ? '/api/notes' : '/api/notes/' + currentId, {
                method: isNew ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
                body: JSON.stringify({ title: title, content: content })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '保存失败，请稍后再试。', true);
                return;
            }
            const now = new Date();
            const stamp = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + ' ' +
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0');
            if (isNew && data.note) {
                currentId = data.note.id;
                notes.unshift({ ...data.note, title: title, content: content, updated_at: stamp });
            } else {
                const exist = notes.find((n) => n.id === currentId);
                if (exist) {
                    exist.title = title;
                    exist.content = content;
                    exist.updated_at = stamp;
                }
            }
            dirty = false;
            renderList();
            setStatus('已保存。');
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function deleteNote() {
        const tk = getToken();
        if (!tk) {
            setStatus('登录后才能删除笔记。', true);
            return;
        }
        if (!currentId) {
            setStatus('当前没有已保存的笔记。', true);
            return;
        }
        if (!confirm('删除这篇笔记？删除后不能恢复。')) return;
        try {
            const res = await fetch('/api/notes/' + currentId, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + tk }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '删除失败', true);
                return;
            }
            notes = notes.filter((n) => n.id !== currentId);
            currentId = null;
            dirty = false;
            renderList();
            if (notes.length) {
                currentId = notes[0].id;
                fillEditor(notes[0]);
            } else {
                fillEditor(null);
            }
            setStatus('已删除。');
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        }
    }

    async function polishNote() {
        const tk = getToken();
        if (!tk) {
            setStatus('登录后才能使用 AI 润色。', true);
            return;
        }
        if (polishing) return;
        const contentEl = $('note-content');
        const text = ((contentEl && contentEl.value) || '').trim();
        if (!text) {
            setStatus('先写点内容再润色。', true);
            return;
        }
        if (text.length > 8000) {
            setStatus('内容太长了，请控制在 8000 字以内。', true);
            return;
        }
        const btn = $('note-polish-btn');
        polishing = true;
        if (btn) { btn.disabled = true; btn.textContent = '润色中…'; }
        setStatus('AI 正在润色，稍等一下…');
        try {
            const res = await fetch('/api/notes/polish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
                body: JSON.stringify({ text: text })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '润色失败，请稍后再试。', true);
                return;
            }
            contentEl.value = data.text || '';
            dirty = true;
            renderPreview();
            setStatus('润色完成，确认没问题后点保存。');
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        } finally {
            polishing = false;
            if (btn) { btn.disabled = false; btn.textContent = 'AI 润色'; }
        }
    }

    function toggleNotePreview() {
        const editor = $('notes-editor');
        const btn = $('note-preview-toggle');
        if (!editor) return;
        const next = !editor.classList.contains('preview-only');
        editor.classList.toggle('preview-only', next);
        if (btn) btn.textContent = next ? '返回编辑' : '只看预览';
    }

    function bindInputs() {
        if (bound) return;
        bound = true;
        const content = $('note-content');
        if (content) {
            content.addEventListener('input', () => {
                dirty = true;
                clearTimeout(previewTimer);
                previewTimer = setTimeout(renderPreview, 120);
            });
        }
        const title = $('note-title');
        if (title) {
            title.addEventListener('input', () => { dirty = true; });
        }
        window.addEventListener('beforeunload', (e) => {
            if (!dirty) return;
            e.preventDefault();
            e.returnValue = '';
        });
    }

    function initNotesView() {
        bindInputs();
        const tk = getToken();
        if (!loaded || lastToken !== tk) {
            lastToken = tk;
            loaded = false;
            loadNotes();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindInputs();
        if (!loaded) { lastToken = getToken(); loadNotes(); }
    });

    window.initNotesView = initNotesView;
    window.newNote = newNote;
    window.openNote = openNote;
    window.saveNote = saveNote;
    window.deleteNote = deleteNote;
    window.polishNote = polishNote;
    window.toggleNotePreview = toggleNotePreview;
})();
