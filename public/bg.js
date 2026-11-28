/* 插画背景轮换：随机顺序，45 秒淡入淡出切换，低透明度 */
(function () {
    var IMAGES = [
        'bg/bg-1.jpg', 'bg/bg-2.jpg', 'bg/bg-3.jpg', 'bg/bg-4.jpg',
        'bg/bg-5.jpg', 'bg/bg-6.jpg', 'bg/bg-7.jpg', 'bg/bg-8.jpg'
    ];
    var INTERVAL = 45000;

    var layer = document.createElement('div');
    layer.className = 'bg-rotator';
    layer.setAttribute('aria-hidden', 'true');
    var front = document.createElement('img');
    var back = document.createElement('img');
    front.alt = '';
    back.alt = '';
    layer.appendChild(front);
    layer.appendChild(back);
    document.body.appendChild(layer);

    // 随机打乱顺序，每次访问看到的起始图不同
    var order = IMAGES.slice();
    for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
    }

    var idx = 0;
    var timer = null;

    function loadAndShow(img, src, done) {
        img.onload = function () {
            img.classList.add('show');
            if (done) done();
        };
        img.onerror = function () {
            // 某张图加载失败就跳过，不阻塞轮换
            if (done) done(true);
        };
        img.src = src;
    }

    function tick() {
        var nextIdx = (idx + 1) % order.length;
        var showing = front.classList.contains('show') ? front : back;
        var hidden = showing === front ? back : front;
        loadAndShow(hidden, order[nextIdx], function (failed) {
            if (failed) { idx = nextIdx; return; } // 跳过坏图，继续下一张
            showing.classList.remove('show');
            idx = nextIdx;
        });
    }

    function start() {
        if (timer || document.hidden) return;
        timer = setInterval(tick, INTERVAL);
    }

    function stop() {
        if (!timer) return;
        clearInterval(timer);
        timer = null;
    }

    loadAndShow(front, order[0], function (failed) {
        if (failed) tick();
        start();
    });

    // 切到后台标签页时暂停轮换，回来再继续
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop();
        else start();
    });
})();
