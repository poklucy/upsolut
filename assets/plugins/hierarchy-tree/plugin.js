(function () {
    'use strict';

    class HierarchyTreePlugin {
        constructor(element, hydrator) {
            this.element = element;
            this.hydrator = hydrator;
            this.DATA = [];
            this.currentMode = 'compact';
            this.lastItems = [];
            this.scale = 1;
            this.pan = { x: 0, y: 0 };
            this.DETAIL_THRESHOLD = 1.05;
            this.STEP = 0.05;
            this.MINZ = 0.1;
            this.MAXZ = 1.05;
            this.CHARS_PER_LINE = 14;
            this.LINE_H = 17;
            this.GAP_PER_LINE = 10;
            this.MODES = {
                compact: { CELL: 114, ROWH: 100, NODE_H: 70, PAD: 55 },
                detailed: { CELL: 270, ROWH: 330, NODE_H: 242, PAD: 60 },
            };
            this.drag = false;
            this.ds = { x: 0, y: 0 };
            this.ps = { x: 0, y: 0 };
            this.lastTouches = null;
            this.tipTimer = null;
            this.bound = {};
        }

        async init() {
            if (!this.element) {
                return this;
            }
            this.canvas = this.element.querySelector('#canvas');
            this.svgEl = this.element.querySelector('#lines');
            this.tipEl = this.element.querySelector('#tooltip');
            this.tipAvatar = this.element.querySelector('#ttAvatar');
            this.tipName = this.element.querySelector('#ttName');
            this.tipFields = this.element.querySelector('#ttFields');
            this.zIn = this.element.querySelector('#zIn');
            this.zOut = this.element.querySelector('#zOut');
            this.zPct = this.element.querySelector('#zPct');
            if (!this.canvas || !this.svgEl) {
                return this;
            }
            this.bindEvents();
            await this.loadData();
            return this;
        }

        destroy() {
            this.unbindEvents();
        }

        cfg() {
            return this.MODES[this.currentMode];
        }

        transformNode(n) {
            return {
                id: String(n.cat),
                name: n.fio || '—',
                email: n.email || '',
                lo: n.lo ?? 0,
                go: n.go ?? 0,
                role: n.role || '—',
                qualification: n.qualification || '—',
                activity: n.activity || '—',
                avatar: n.photo_url || null,
                children: (n.children || []).map((child) => this.transformNode(child)),
            };
        }

        async loadData() {
            const api = (this.hydrator && typeof this.hydrator.getService === 'function'
                ? this.hydrator.getService('jsapi')
                : null) || window.ApiService;
            let json = null;
            try {
                const params = new URLSearchParams();
                const year = this.element.getAttribute('data-year');
                const month = this.element.getAttribute('data-month');
                if (year) {
                    params.set('year', year);
                }
                if (month) {
                    params.set('month', month);
                }
                const qs = params.toString();
                const url = '/jsapi/cabinet.user-tree' + (qs ? '?' + qs : '');
                if (api && typeof api.get === 'function') {
                    json = await api.get(url);
                } else {
                    const res = await fetch(url, { credentials: 'same-origin' });
                    json = await res.json();
                }
            } catch (e) {
                console.error('hierarchy-tree: не удалось загрузить дерево', e);
                this.DATA = [];
                this.render(this.DATA);
                return;
            }
            if (!json || json.status === 'fail') {
                console.error('hierarchy-tree:', json && json.error ? json.error : 'ошибка ответа');
                this.DATA = [];
                this.render(this.DATA);
                return;
            }
            const payload = json.data || json;
            const tree = payload && Array.isArray(payload.tree) ? payload.tree : [];
            this.DATA = tree.map((node) => this.transformNode(node));
            this.render(this.DATA);
            this.centerOnRoot();
            this.applyTransform();
            requestAnimationFrame(() => {
                this.centerOnRoot();
                this.applyTransform();
                const card = this.element.querySelector('.detail-card');
                if (card) {
                    this.MODES.detailed.NODE_H = card.offsetHeight;
                    if (this.currentMode === 'detailed') {
                        this.svgEl.innerHTML = this.buildLines(this.lastItems);
                    }
                }
            });
        }

        leafCount(node) {
            return node.children && node.children.length
                ? node.children.reduce((s, c) => s + this.leafCount(c), 0)
                : 1;
        }

        initials(name) {
            return String(name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        }

        nameExtraLines(name) {
            const words = String(name || '').trim().split(/\s+/);
            let lines = 1;
            let lineLen = 0;
            for (const w of words) {
                if (lineLen === 0) {
                    lineLen = w.length;
                } else if (lineLen + 1 + w.length <= this.CHARS_PER_LINE) {
                    lineLen += 1 + w.length;
                } else {
                    lines++;
                    lineLen = w.length;
                }
            }
            return lines - 1;
        }

        computeLayout(roots) {
            if (!roots || !roots.length) {
                return [];
            }
            const items = [];
            const c = this.cfg();
            const maxExtraLines = {};
            const scanDepths = (node, depth) => {
                const el = this.currentMode === 'compact' ? this.nameExtraLines(node.name) : 0;
                maxExtraLines[depth] = Math.max(maxExtraLines[depth] || 0, el);
                for (const child of (node.children || [])) {
                    scanDepths(child, depth + 1);
                }
            };
            for (const root of roots) {
                scanDepths(root, 0);
            }
            const maxDepth = Math.max(...Object.keys(maxExtraLines).map(Number));
            const yAt = [c.PAD];
            for (let d = 0; d <= maxDepth; d++) {
                yAt.push(yAt[d] + c.ROWH + (maxExtraLines[d] || 0) * (this.LINE_H + this.GAP_PER_LINE));
            }
            const walk = (node, left, depth) => {
                const lc = this.leafCount(node);
                const x = c.PAD + (left + lc / 2) * c.CELL;
                const y = yAt[depth];
                const el = this.currentMode === 'compact' ? this.nameExtraLines(node.name) : 0;
                items.push({ node, x, y, nodeH: c.NODE_H + el * this.LINE_H, longName: el > 0 });
                let cl = left;
                for (const child of (node.children || [])) {
                    walk(child, cl, depth + 1);
                    cl += this.leafCount(child);
                }
            };
            let cl = 0;
            for (const root of roots) {
                walk(root, cl, 0);
                cl += this.leafCount(root);
            }
            return items;
        }

        buildLines(items) {
            const idMap = new Map(items.map((p) => [p.node.id, p]));
            let svg = `<defs>
    <marker id="arr" markerWidth="9" markerHeight="9" refX="9" refY="4.5"
            orient="auto" markerUnits="userSpaceOnUse">
      <polygon points="0,0 9,4.5 0,9" fill="#121212" fill-opacity="0.35"/>
    </marker>
  </defs>`;
            const S = 'stroke="#121212" stroke-width="1" stroke-opacity="0.3"';
            const SARR = `${S} marker-end="url(#arr)"`;
            for (const { node, x, y, nodeH } of items) {
                const kids = node.children || [];
                if (!kids.length) {
                    continue;
                }
                const lineFrom = y + nodeH;
                const kInfos = kids.map((k) => idMap.get(k.id)).filter(Boolean);
                if (!kInfos.length) {
                    continue;
                }
                const childTop = kInfos[0].y;
                const mid = (lineFrom + childTop) / 2;
                const kxs = kInfos.map((k) => k.x);
                const minX = Math.min(...kxs);
                const maxX = Math.max(...kxs);
                svg += `<line x1="${x}" y1="${lineFrom}" x2="${x}" y2="${mid}" ${S}/>`;
                if (kids.length > 1) {
                    svg += `<line x1="${minX}" y1="${mid}" x2="${maxX}" y2="${mid}" ${S}/>`;
                }
                for (const kx of kxs) {
                    svg += `<line x1="${kx}" y1="${mid}" x2="${kx}" y2="${childTop}" ${SARR}/>`;
                }
            }
            return svg;
        }

        render(roots) {
            this.canvas.querySelectorAll('.tree-node, .detail-card').forEach((el) => el.remove());
            if (!roots || !roots.length) {
                this.canvas.style.width = '0px';
                this.canvas.style.height = '0px';
                this.svgEl.setAttribute('width', 0);
                this.svgEl.setAttribute('height', 0);
                this.svgEl.innerHTML = '';
                this.lastItems = [];
                return;
            }
            const items = this.computeLayout(roots);
            this.lastItems = items;
            const c = this.cfg();
            const maxX = Math.max(...items.map((p) => p.x)) + c.PAD + c.CELL / 2;
            const maxY = Math.max(...items.map((p) => p.y + p.nodeH)) + c.PAD;
            this.canvas.style.width = maxX + 'px';
            this.canvas.style.height = maxY + 'px';
            this.svgEl.setAttribute('width', maxX);
            this.svgEl.setAttribute('height', maxY);
            this.svgEl.innerHTML = this.buildLines(items);
            for (const item of items) {
                if (this.currentMode === 'compact') {
                    this.renderCompact(item);
                } else {
                    this.renderDetailed(item);
                }
            }
        }

        renderCompact({ node, x, y, longName }) {
            const el = document.createElement('div');
            el.className = 'tree-node';
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            const av = document.createElement('div');
            av.className = 'node-avatar';
            if (node.avatar) {
                const img = document.createElement('img');
                img.src = node.avatar;
                img.alt = node.name;
                av.appendChild(img);
            } else {
                av.textContent = this.initials(node.name);
            }
            const nm = document.createElement('div');
            nm.className = 'node-name' + (longName ? ' wrap' : '');
            nm.textContent = node.name;
            el.append(av, nm);
            el.addEventListener('mouseenter', (e) => this.showTip(node, e));
            el.addEventListener('mouseleave', () => this.hideTip());
            this.canvas.appendChild(el);
        }

        esc(s) {
            return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        renderDetailed({ node, x, y }) {
            const fields = [
                ['ЛО', node.lo], ['ГО', node.go], ['Роль', node.role],
                ['Email', node.email], ['Квалификация', node.qualification], ['Активность', node.activity],
            ];
            const el = document.createElement('div');
            el.className = 'detail-card';
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            const avatarHTML = node.avatar
                ? `<img src="${this.esc(node.avatar)}" alt="${this.esc(node.name)}">`
                : this.esc(this.initials(node.name));
            el.innerHTML = `
    <div class="dc-header">
      <div class="dc-avatar">${avatarHTML}</div>
      <div class="dc-name">${this.esc(node.name)}</div>
    </div>
    <div class="dc-fields">
      ${fields.map(([l, v]) =>
        `<div class="dc-row"><span class="dc-label">${this.esc(l)}</span><span class="dc-value${l === 'Email' ? ' dc-value--email' : ''}">${this.esc(v)}</span></div>`
    ).join('')}
    </div>`;
            this.canvas.appendChild(el);
        }

        showTip(node, e) {
            if (this.currentMode !== 'compact' || !this.tipEl || !this.tipAvatar || !this.tipName || !this.tipFields) {
                return;
            }
            clearTimeout(this.tipTimer);
            this.tipAvatar.textContent = this.initials(node.name);
            this.tipName.textContent = node.name;
            this.tipFields.innerHTML = [
                ['ЛО', node.lo], ['ГО', node.go], ['Роль', node.role],
                ['Email', node.email], ['Квалификация', node.qualification], ['Активность', node.activity],
            ].map(([l, v]) =>
                `<div class="tt-row"><span class="tt-label">${this.esc(l)}</span><span class="tt-value${l === 'Email' ? ' tt-value--email' : ''}">${this.esc(v)}</span></div>`
            ).join('');
            const rect = this.element.getBoundingClientRect();
            const TW = 250;
            const TH = 290;
            let tx = e.clientX - rect.left + 16;
            let ty = e.clientY - rect.top - 20;
            if (tx + TW > rect.width - 65) {
                tx = e.clientX - rect.left - TW - 16;
            }
            if (ty + TH > rect.height - 10) {
                ty = rect.height - TH - 10;
            }
            if (ty < 10) {
                ty = 10;
            }
            if (tx < 10) {
                tx = 10;
            }
            this.tipEl.style.left = tx + 'px';
            this.tipEl.style.top = ty + 'px';
            this.tipEl.classList.add('visible');
        }

        hideTip() {
            if (!this.tipEl) {
                return;
            }
            this.tipTimer = setTimeout(() => this.tipEl.classList.remove('visible'), 150);
        }

        rootLayoutItem() {
            if (!this.lastItems.length) {
                return null;
            }
            const rootId = this.DATA[0] && this.DATA[0].id;
            if (rootId) {
                const found = this.lastItems.find((item) => item.node.id === rootId);
                if (found) {
                    return found;
                }
            }
            return this.lastItems[0];
        }

        centerOnRoot() {
            const root = this.rootLayoutItem();
            const vw = this.element.offsetWidth;
            const vh = this.element.offsetHeight;
            if (!root || !vw || !vh) {
                return;
            }
            this.pan.x = vw / 2 - root.x * this.scale;
            this.pan.y = vh / 2 - (root.y + root.nodeH / 2) * this.scale;
        }

        applyTransform(pivotX, pivotY) {
            this.canvas.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
            if (this.zPct) {
                this.zPct.textContent = Math.round(this.scale * 100) + '%';
            }
            const newMode = this.scale >= this.DETAIL_THRESHOLD ? 'detailed' : 'compact';
            if (newMode !== this.currentMode) {
                const px = pivotX ?? this.element.offsetWidth / 2;
                const py = pivotY ?? this.element.offsetHeight / 2;
                const oldW = parseFloat(this.canvas.style.width) || 1;
                const oldH = parseFloat(this.canvas.style.height) || 1;
                const fx = (px - this.pan.x) / (this.scale * oldW);
                const fy = (py - this.pan.y) / (this.scale * oldH);
                this.currentMode = newMode;
                if (this.currentMode === 'compact' && this.tipEl) {
                    this.tipEl.classList.remove('visible');
                }
                this.render(this.DATA);
                const newW = parseFloat(this.canvas.style.width);
                const newH = parseFloat(this.canvas.style.height);
                this.pan.x = px - fx * newW * this.scale;
                this.pan.y = py - fy * newH * this.scale;
                this.canvas.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
            }
        }

        zoomAt(newScale, pivotX, pivotY) {
            const canvasX = (pivotX - this.pan.x) / this.scale;
            const canvasY = (pivotY - this.pan.y) / this.scale;
            this.scale = newScale;
            this.pan.x = pivotX - canvasX * this.scale;
            this.pan.y = pivotY - canvasY * this.scale;
            this.applyTransform(pivotX, pivotY);
        }

        bindEvents() {
            this.bound.zIn = () => {
                this.zoomAt(
                    Math.min(this.MAXZ, +(this.scale + this.STEP).toFixed(2)),
                    this.element.offsetWidth / 2,
                    this.element.offsetHeight / 2
                );
            };
            this.bound.zOut = () => {
                this.zoomAt(
                    Math.max(this.MINZ, +(this.scale - this.STEP).toFixed(2)),
                    this.element.offsetWidth / 2,
                    this.element.offsetHeight / 2
                );
            };
            if (this.zIn) {
                this.zIn.addEventListener('click', this.bound.zIn);
            }
            if (this.zOut) {
                this.zOut.addEventListener('click', this.bound.zOut);
            }

            this.bound.wheel = (e) => {
                e.preventDefault();
                const rect = this.element.getBoundingClientRect();
                const delta = e.deltaY > 0 ? -this.STEP : this.STEP;
                this.zoomAt(
                    Math.max(this.MINZ, Math.min(this.MAXZ, +(this.scale + delta).toFixed(2))),
                    e.clientX - rect.left,
                    e.clientY - rect.top
                );
            };
            this.element.addEventListener('wheel', this.bound.wheel, { passive: false });

            this.bound.mousedown = (e) => {
                if (e.target.closest('.zoom-controls, .node-tooltip')) {
                    return;
                }
                this.drag = true;
                this.ds = { x: e.clientX, y: e.clientY };
                this.ps = { ...this.pan };
                this.element.classList.add('dragging');
            };
            this.bound.mousemove = (e) => {
                if (!this.drag) {
                    return;
                }
                this.pan = { x: this.ps.x + (e.clientX - this.ds.x), y: this.ps.y + (e.clientY - this.ds.y) };
                this.canvas.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
            };
            this.bound.mouseup = () => {
                this.drag = false;
                this.element.classList.remove('dragging');
            };
            this.element.addEventListener('mousedown', this.bound.mousedown);
            window.addEventListener('mousemove', this.bound.mousemove);
            window.addEventListener('mouseup', this.bound.mouseup);

            this.bound.touchstart = (e) => {
                if (e.target.closest('.zoom-controls, .node-tooltip')) {
                    return;
                }
                e.preventDefault();
                this.lastTouches = e.touches;
                this.ps = { ...this.pan };
                if (e.touches.length === 1) {
                    this.ds = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            };
            this.bound.touchmove = (e) => {
                e.preventDefault();
                if (!this.lastTouches) {
                    return;
                }
                if (e.touches.length === 1) {
                    this.pan = {
                        x: this.ps.x + (e.touches[0].clientX - this.ds.x),
                        y: this.ps.y + (e.touches[0].clientY - this.ds.y),
                    };
                    this.canvas.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
                } else if (e.touches.length === 2) {
                    const prev = this.lastTouches.length >= 2 ? this.lastTouches : e.touches;
                    const prevDist = this.touchDist(prev);
                    const newDist = this.touchDist(e.touches);
                    const mid = this.touchMidpoint(e.touches);
                    const ratio = newDist / (prevDist || newDist);
                    const newScale = Math.max(this.MINZ, Math.min(this.MAXZ, +(this.scale * ratio).toFixed(3)));
                    this.zoomAt(newScale, mid.x, mid.y);
                    this.ps = { ...this.pan };
                    this.ds = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
                this.lastTouches = e.touches;
            };
            this.bound.touchend = (e) => {
                this.lastTouches = e.touches.length ? e.touches : null;
                if (e.touches.length === 1) {
                    this.ps = { ...this.pan };
                    this.ds = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            };
            this.element.addEventListener('touchstart', this.bound.touchstart, { passive: false });
            this.element.addEventListener('touchmove', this.bound.touchmove, { passive: false });
            this.element.addEventListener('touchend', this.bound.touchend, { passive: false });

            if (this.tipEl) {
                this.bound.tipEnter = () => clearTimeout(this.tipTimer);
                this.bound.tipLeave = () => this.hideTip();
                this.tipEl.addEventListener('mouseenter', this.bound.tipEnter);
                this.tipEl.addEventListener('mouseleave', this.bound.tipLeave);
            }
        }

        unbindEvents() {
            if (this.zIn && this.bound.zIn) {
                this.zIn.removeEventListener('click', this.bound.zIn);
            }
            if (this.zOut && this.bound.zOut) {
                this.zOut.removeEventListener('click', this.bound.zOut);
            }
            if (this.bound.wheel) {
                this.element.removeEventListener('wheel', this.bound.wheel);
            }
            if (this.bound.mousedown) {
                this.element.removeEventListener('mousedown', this.bound.mousedown);
            }
            if (this.bound.mousemove) {
                window.removeEventListener('mousemove', this.bound.mousemove);
            }
            if (this.bound.mouseup) {
                window.removeEventListener('mouseup', this.bound.mouseup);
            }
            if (this.bound.touchstart) {
                this.element.removeEventListener('touchstart', this.bound.touchstart);
            }
            if (this.bound.touchmove) {
                this.element.removeEventListener('touchmove', this.bound.touchmove);
            }
            if (this.bound.touchend) {
                this.element.removeEventListener('touchend', this.bound.touchend);
            }
            if (this.tipEl && this.bound.tipEnter) {
                this.tipEl.removeEventListener('mouseenter', this.bound.tipEnter);
                this.tipEl.removeEventListener('mouseleave', this.bound.tipLeave);
            }
        }

        touchMidpoint(touches) {
            const rect = this.element.getBoundingClientRect();
            return {
                x: ((touches[0].clientX + touches[1].clientX) / 2) - rect.left,
                y: ((touches[0].clientY + touches[1].clientY) / 2) - rect.top,
            };
        }

        touchDist(touches) {
            return Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
        }
    }

    if (typeof window.registerProjectPlugin === 'function') {
        window.registerProjectPlugin('hierarchy-tree', HierarchyTreePlugin);
    }
})();
