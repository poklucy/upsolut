/**
 * Плейсхолдер-текст для вёрстки: генерация Lorem Ipsum по числу слов.
 * В разметке: <script src="scripts/plugin-textgenerator.js"></script> в head,
 * затем в нужном месте: <script>text(2, 5)</script> — случайно от 2 до 5 слов.
 */
(function () {
    var LOREM_POOL = (
        'lorem ipsum dolor sit amet consectetur adipiscing elit integer euismod ac diam sed tristique ' +
        'fusce porttitor turpis odio vel lobortis arcu sollicitudin nec nulla velit nisl ultricies ac ' +
        'dapibus nec viverra luctus elit curabitur sed erat libero donec non porttitor ante donec sed ' +
        'lobortis nisi suspendisse massa ex commodo mollis sollicitudin non eleifend ut libero sed nec ' +
        'nibh nulla duis consectetur tellus in quam porttitor porta ut ligula risus interdum ut pharetra ' +
        'eget volutpat varius nulla curabitur luctus venenatis velit nec pretium diam facilisis sed proin ' +
        'in ante eros curabitur rutrum eu erat sed pellentesque sed elementum laoreet diam sed eleifend ' +
        'integer sollicitudin id urna sit amet tincidunt aenean ut odio eu dui malesuada bibendum nullam ' +
        'vitae convallis erat in lacinia dolor nam pretium hendrerit scelerisque nullam sit amet urna quis ' +
        'odio tristique lobortis non ut est vestibulum porttitor sem vitae faucibus ullamcorper est dui ' +
        'pellentesque turpis nec consequat orci nibh sed velit morbi sollicitudin eros eget est fermentum ' +
        'iaculis donec vel magna augue nullam vestibulum massa in posuere molestie mi tellus imperdiet ' +
        'lacus in finibus erat tellus non velit nunc ultrices tristique velit eget porta ut ut viverra orci ' +
        'phasellus at augue at felis congue tristique et sed odio vivamus venenatis consequat magna ac ' +
        'iaculis vestibulum iaculis sagittis ipsum ut dolor sapien convallis id ligula bibendum viverra ' +
        'dignissim arcu class aptent taciti sociosqu ad litora torquent per conubia nostra per inceptos ' +
        'himenaeos proin id magna sit amet nisi auctor tincidunt maecenas pharetra convallis posuere morbi ' +
        'leo urna molestie at elementum eu facilisis sed odio morbi quis commodo odio aenean massa cum ' +
        'sociis natoque penatibus et magnis dis parturient montes nascetur ridiculus mus donec quam felis ' +
        'ultricies nec pellentesque eu pretium quis sem nulla consequat massa quis enim'
    ).split(/\s+/);

    function clampInt(n, min, max) {
        var x = Math.floor(Number(n));
        if (!isFinite(x)) return min;
        return Math.max(min, Math.min(max, x));
    }

    /**
     * @param {number} wordCount — нужное число слов (будет ограничено разумными пределами)
     * @returns {string}
     */
    function loremWords(wordCount) {
        var n = clampInt(wordCount, 1, 5000);
        var poolLen = LOREM_POOL.length;
        var start = Math.floor(Math.random() * poolLen);
        var out = [];
        var i;
        for (i = 0; i < n; i++) {
            out.push(LOREM_POOL[(start + i) % poolLen]);
        }
        out[0] = out[0].charAt(0).toUpperCase() + out[0].slice(1);
        return out.join(' ');
    }

    /**
     * Вставляет случайный lorem-текст с числом слов от minWords до maxWords (включительно)
     * в место вызова: только из синхронного inline <script>text(a,b)</script>
     */
    function text(minWords, maxWords) {
        var script = document.currentScript;
        if (!script || !script.parentNode) {
            return;
        }
        var lo = clampInt(minWords, 1, 5000);
        var hi = maxWords === undefined ? lo : clampInt(maxWords, 1, 5000);
        if (hi < lo) {
            var t = lo;
            lo = hi;
            hi = t;
        }
        var count = lo + Math.floor(Math.random() * (hi - lo + 1));
        var str = loremWords(count);
        script.parentNode.insertBefore(document.createTextNode(str), script);
        script.parentNode.removeChild(script);
    }

    window.loremWords = loremWords;
    window.text = text;
})();
