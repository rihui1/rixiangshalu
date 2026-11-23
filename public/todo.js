/* 待办清单：登录后存到服务器，未登录时退化为本地 localStorage */

(function () {
    const $ = (id) => document.getElementById(id);
    const GUEST_KEY = 'guest_todos';

    let todos = [];
    let loaded = false;
    let lastToken = null;

    function getToken() {
        try { return token || ''; } catch (e) { return ''; }
    }

    function authHeaders(json) {
        const headers = {};
        if (json) headers['Content-Type'] = 'application/json';
        const tk = getToken();
        if (tk) headers.Authorization = 'Bearer ' + tk;
        return headers;
    }

    function setStatus(text, isError) {
        const el = $('todo-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function readGuest() {
        try {
            const raw = localStorage.getItem(GUEST_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function saveGuest() {
        try {
            localStorage.setItem(GUEST_KEY, JSON.stringify(todos));
        } catch (e) { /* 隐私模式下忽略 */ }
    }

    function render() {
        const list = $('todo-list');
        if (!list) return;
        const pending = todos.filter((t) => !t.done).length;
        const count = $('todo-count');
        if (count) count.textContent = pending + ' 项待办';
        const clearBtn = $('todo-clear-btn');
        if (clearBtn) clearBtn.disabled = !todos.some((t) => t.done);

        if (!todos.length) {
            list.innerHTML = '<p class="empty">还没有待办，先加一条吧。</p>';
            return;
        }
        list.innerHTML = todos.map((t) =>
            '<div class="todo-item' + (t.done ? ' done' : '') + '">' +
                '<label class="todo-check">' +
                    '<input type="checkbox"' + (t.done ? ' checked' : '') + ' onchange="toggleTodo(' + t.id + ', this.checked)">' +
                    '<span></span>' +
                '</label>' +
                '<span class="todo-text">' + escapeHtml(t.content) + '</span>' +
                '<button type="button" class="todo-del" title="删除" aria-label="删除" onclick="removeTodo(' + t.id + ')">×</button>' +
            '</div>'
        ).join('');
    }

    async function load() {
        const tk = getToken();
        if (!tk) {
            todos = readGuest();
            loaded = true;
            render();
            setStatus('未登录时待办只保存在这台设备；登录后会保存到云端。');
            return;
        }
        setStatus('正在同步云端待办…');
        try {
            const res = await fetch('/api/todos', { headers: authHeaders() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '加载失败，请稍后再试。', true);
                return;
            }
            todos = Array.isArray(data.todos) ? data.todos : [];
            loaded = true;
            render();
            setStatus('已同步到云端，共 ' + todos.length + ' 条。');
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        }
    }

    function initTodoView() {
        const tk = getToken();
        if (!loaded || lastToken !== tk) {
            lastToken = tk;
            loaded = false;
            load();
        }
    }

    function todoKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTodo();
        }
    }

    async function addTodo() {
        const input = $('todo-input');
        if (!input) return;
        const content = input.value.trim();
        if (!content) {
            setStatus('先写点要做什么。', true);
            input.focus();
            return;
        }
        const tk = getToken();
        if (!tk) {
            todos.unshift({ id: Date.now(), content: content, done: 0 });
            saveGuest();
            input.value = '';
            render();
            setStatus('已保存在本机，登录后会改为云端同步。');
            return;
        }
        try {
            const res = await fetch('/api/todos', {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ content: content })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || '添加失败，请稍后再试。', true);
                return;
            }
            todos.unshift(data.todo);
            input.value = '';
            render();
            setStatus('已添加。');
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        }
    }

    async function toggleTodo(id, done) {
        const item = todos.find((t) => String(t.id) === String(id));
        if (!item) return;
        item.done = done ? 1 : 0;
        todos.sort((a, b) => (a.done - b.done) || (b.id - a.id));
        render();
        const tk = getToken();
        if (!tk) { saveGuest(); return; }
        try {
            await fetch('/api/todos/' + id, {
                method: 'PATCH',
                headers: authHeaders(true),
                body: JSON.stringify({ done: !!done })
            });
        } catch (e) {
            setStatus('状态同步失败，刷新后可能不一致。', true);
        }
    }

    async function removeTodo(id) {
        todos = todos.filter((t) => String(t.id) !== String(id));
        render();
        const tk = getToken();
        if (!tk) { saveGuest(); return; }
        try {
            await fetch('/api/todos/' + id, { method: 'DELETE', headers: authHeaders() });
        } catch (e) {
            setStatus('删除同步失败，请刷新重试。', true);
        }
    }

    async function clearDoneTodos() {
        const doneCount = todos.filter((t) => t.done).length;
        if (!doneCount) {
            setStatus('还没有已完成的待办。', true);
            return;
        }
        if (!confirm('清除 ' + doneCount + ' 条已完成的待办？')) return;
        todos = todos.filter((t) => !t.done);
        render();
        const tk = getToken();
        if (!tk) {
            saveGuest();
            setStatus('已清除本机记录。');
            return;
        }
        try {
            const res = await fetch('/api/todos/done', { method: 'DELETE', headers: authHeaders() });
            const data = await res.json().catch(() => ({}));
            setStatus(res.ok ? '已清除 ' + doneCount + ' 条。' : (data.error || '清除失败'), !res.ok);
        } catch (e) {
            setStatus('网络请求失败，请稍后再试。', true);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!loaded) { lastToken = getToken(); load(); }
    });

    window.initTodoView = initTodoView;
    window.todoKey = todoKey;
    window.addTodo = addTodo;
    window.toggleTodo = toggleTodo;
    window.removeTodo = removeTodo;
    window.clearDoneTodos = clearDoneTodos;
})();
