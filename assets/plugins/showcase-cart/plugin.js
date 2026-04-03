/**
 * Интерактивная витрина / набор товаров для cabinet/editcart.php
 * — выбор из select, список позиций, +/- количество, итоги;
 * при data-showcase-id и data-showcase-guid — дебаунс-сохранение в t_mycart_detail и полей t_mycart (jsapi cabinet.showcase-detail).
 */
(function () {
    'use strict';

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function formatPriceRub(value) {
        const n = Number(value);
        if (Number.isNaN(n)) {
            return '0 ₽';
        }
        return (
            new Intl.NumberFormat('ru-RU', {
                maximumFractionDigits: 0,
                minimumFractionDigits: 0
            }).format(Math.round(n)) + ' ₽'
        );
    }

    function pluralGoods(n) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) {
            return 'товар';
        }
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
            return 'товара';
        }
        return 'товаров';
    }

    function splitNameHtml(name) {
        const s = String(name || '');
        const i = s.indexOf(',');
        if (i === -1) {
            return `<div class="cart-name-title">${escapeHtml(s)}</div>`;
        }
        const a = s.slice(0, i + 1).trim();
        const b = s.slice(i + 1).trim();
        return `<div class="cart-name-title"><p>${escapeHtml(a)}</p><p>${escapeHtml(b)}</p></div>`;
    }

    const FALLBACK_IMG = 'assets/images/lot/lot-1.png';

    class ShowcaseCartPlugin {
        constructor(element, hydrator) {
            this.root = element;
            this.hydrator = hydrator;
            /** @type {Map<string, { qty: number, product: object }>} */
            this.lines = new Map();
            this.goodsById = new Map();
            /** @type {ReturnType<typeof setTimeout> | null} */
            this._saveTimer = null;
            /** @type {ReturnType<typeof setTimeout> | null} */
            this._metaTimer = null;
            /** @type {HTMLElement | null} */
            this._metaPendingEl = null;
            this._saveUrl = '/jsapi/cabinet/showcase-detail';
        }

        getApi() {
            return (
                (this.hydrator && this.hydrator.getService && this.hydrator.getService('jsapi')) ||
                window.ApiService ||
                null
            );
        }

        isPersistMode() {
            return this.showcaseId > 0 && this.showcaseGuid !== '';
        }

        loadLinesFromJson() {
            const linesEl = this.root.querySelector('.showcase-cart__lines-json');
            if (!linesEl || !linesEl.textContent) {
                return;
            }
            try {
                const arr = JSON.parse(linesEl.textContent);
                if (!Array.isArray(arr)) {
                    return;
                }
                arr.forEach((line) => {
                    if (!line) {
                        return;
                    }
                    const gid = line.good_id != null ? parseInt(String(line.good_id), 10) : 0;
                    const qty = Math.max(0, parseInt(String(line.qty != null ? line.qty : line.cnt_count || 0), 10) || 0);
                    if (gid <= 0 || qty < 1) {
                        return;
                    }
                    const key = String(gid);
                    const fromCatalog = this.goodsById.get(key);
                    const product = fromCatalog || {
                        id: gid,
                        name: line.name != null ? String(line.name) : '',
                        article: line.article != null ? String(line.article) : '',
                        price: Number(line.price) || 0,
                        image: line.image != null ? String(line.image) : ''
                    };
                    this.lines.set(key, { qty, product });
                });
            } catch (e) {
                console.warn('showcase-cart: не удалось разобрать JSON строк витрины', e);
            }
        }

        buildLinesPayload() {
            /** @type {Array<{ good_id: number, qty: number, cnt_order: number }>} */
            const lines = [];
            let order = 0;
            this.lines.forEach((line, id) => {
                const gid = parseInt(id, 10);
                if (!Number.isFinite(gid) || gid <= 0 || line.qty < 1) {
                    return;
                }
                lines.push({
                    good_id: gid,
                    qty: line.qty,
                    cnt_order: order
                });
                order++;
            });
            return lines;
        }

        scheduleSave() {
            if (!this.isPersistMode()) {
                return;
            }
            if (this._saveTimer) {
                clearTimeout(this._saveTimer);
            }
            this._saveTimer = setTimeout(() => {
                this._saveTimer = null;
                this.flushSave();
            }, 450);
        }

        async flushSave() {
            if (!this.isPersistMode()) {
                return;
            }
            const api = this.getApi();
            if (!api || typeof api.post !== 'function') {
                console.warn('showcase-cart: jsapi недоступен, состав не сохранён');
                return;
            }
            const payload = {
                action: 'save',
                guid: this.showcaseGuid,
                lines: this.buildLinesPayload()
            };
            try {
                const res = await api.post(this._saveUrl, payload);
                if (!res || res.success !== true) {
                    console.warn('showcase-cart: ответ сохранения', res);
                }
            } catch (err) {
                console.warn('showcase-cart: ошибка сохранения состава', err);
            }
        }

        /**
         * @param {HTMLElement} el
         */
        normalizeEditableValue(el) {
            let text = (el.innerText || '').replace(/\r\n/g, '\n').trim();
            const ph = (el.getAttribute('data-placeholder') || '').trim();
            if (ph && text === ph) {
                return '';
            }
            return text;
        }

        /**
         * @param {HTMLElement} el
         */
        scheduleMetaSave(el) {
            if (!this.isPersistMode() || !el) {
                return;
            }
            this._metaPendingEl = el;
            if (this._metaTimer) {
                clearTimeout(this._metaTimer);
            }
            this._metaTimer = setTimeout(() => {
                this._metaTimer = null;
                this.flushMetaSave(this._metaPendingEl);
            }, 450);
        }

        /**
         * @param {HTMLElement | null} el
         */
        async flushMetaSave(el) {
            if (!this.isPersistMode() || !el) {
                return;
            }
            const field = el.getAttribute('data-showcase-field');
            if (field !== 'varc_name' && field !== 'varc_desc') {
                return;
            }
            const api = this.getApi();
            if (!api || typeof api.post !== 'function') {
                console.warn('showcase-cart: jsapi недоступен, поля витрины не сохранены');
                return;
            }
            const text = this.normalizeEditableValue(el);
            const payload = {
                action: 'save',
                guid: this.showcaseGuid
            };
            if (field === 'varc_name') {
                payload.varc_name = text;
            } else {
                payload.varc_desc = text;
            }
            try {
                const res = await api.post(this._saveUrl, payload);
                if (!res || res.success !== true) {
                    console.warn('showcase-cart: ответ сохранения витрины', res);
                }
            } catch (err) {
                console.warn('showcase-cart: ошибка сохранения названия/описания', err);
            }
        }

        focusEditable(el) {
            if (!el) {
                return;
            }
            el.contentEditable = 'true';
            el.focus();
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        initShowcaseMetaEditors() {
            if (!this.isPersistMode()) {
                return;
            }
            this.root.querySelectorAll('[data-showcase-edit]').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const key = btn.getAttribute('data-showcase-edit');
                    if (!key) {
                        return;
                    }
                    const el = this.root.querySelector(`[data-showcase-field="${key}"]`);
                    if (el) {
                        this.focusEditable(el);
                    }
                });
            });

            this.root.querySelectorAll('[data-showcase-field]').forEach((el) => {
                el.addEventListener('input', () => this.scheduleMetaSave(el));
                el.addEventListener('blur', () => {
                    if (this._metaTimer) {
                        clearTimeout(this._metaTimer);
                        this._metaTimer = null;
                    }
                    el.contentEditable = 'false';
                    this.flushMetaSave(el);
                });
            });
        }

        async init() {
            const sidRaw = this.root.getAttribute('data-showcase-id');
            const sid = sidRaw != null && sidRaw !== '' ? parseInt(sidRaw, 10) : 0;
            this.showcaseId = Number.isFinite(sid) && sid > 0 ? sid : 0;
            this.showcaseGuid = (this.root.getAttribute('data-showcase-guid') || '').trim() || '';

            this.listEl = this.root.querySelector('.edit-list');
            this.selectEl = this.root.querySelector('select.choices-list');
            this.countEl = this.root.querySelector('[data-showcase-count]');
            this.totalEl = this.root.querySelector('[data-showcase-total]');

            const jsonEl = this.root.querySelector('.showcase-cart__goods-json');
            if (jsonEl && jsonEl.textContent) {
                try {
                    const arr = JSON.parse(jsonEl.textContent);
                    if (Array.isArray(arr)) {
                        arr.forEach((g) => {
                            if (g && g.id) {
                                this.goodsById.set(String(g.id), g);
                            }
                        });
                    }
                } catch (e) {
                    console.warn('showcase-cart: не удалось разобрать JSON товаров', e);
                }
            }

            this.loadLinesFromJson();

            if (this.selectEl) {
                this.selectEl.addEventListener('change', () => this.onSelectChange());
            }

            if (this.listEl) {
                this.listEl.addEventListener('click', (e) => this.onListClick(e));
            }

            this.render();
            this.initShowcaseMetaEditors();
        }

        onSelectChange() {
            if (!this.selectEl) {
                return;
            }
            const id = this.selectEl.value;
            if (!id) {
                return;
            }
            const g = this.goodsById.get(id);
            if (!g) {
                return;
            }
            const key = String(g.id);
            if (this.lines.has(key)) {
                const line = this.lines.get(key);
                line.qty += 1;
            } else {
                this.lines.set(key, { qty: 1, product: g });
            }
            this.selectEl.selectedIndex = 0;
            this.render();
            this.scheduleSave();
        }

        onListClick(e) {
            const minus = e.target.closest('[data-showcase-minus]');
            const plus = e.target.closest('[data-showcase-plus]');
            const removeBtn = e.target.closest('[data-showcase-remove]');
            const row = e.target.closest('[data-showcase-line]');
            if (!row) {
                return;
            }
            const id = row.getAttribute('data-good-id');
            if (!id || !this.lines.has(id)) {
                return;
            }
            if (removeBtn) {
                this.lines.delete(id);
                this.render();
                this.scheduleSave();
                return;
            }
            const line = this.lines.get(id);
            if (minus) {
                line.qty -= 1;
                if (line.qty < 1) {
                    this.lines.delete(id);
                }
            } else if (plus) {
                line.qty += 1;
            }
            this.render();
            this.scheduleSave();
        }

        render() {
            if (!this.listEl) {
                return;
            }
            this.listEl.innerHTML = '';

            let totalQty = 0;
            let totalSum = 0;

            this.lines.forEach((line, id) => {
                const { qty, product } = line;
                totalQty += qty;
                totalSum += qty * (Number(product.price) || 0);
                this.listEl.appendChild(this.buildLineEl(id, qty, product));
            });

            if (this.countEl) {
                this.countEl.textContent =
                    totalQty === 0
                        ? 'В корзине пока пусто'
                        : `В корзине ${totalQty} ${pluralGoods(totalQty)}`;
            }
            if (this.totalEl) {
                this.totalEl.textContent = `Итого: ${formatPriceRub(totalSum)}`;
            }
        }

        buildLineEl(id, qty, product) {
            const wrap = document.createElement('div');
            wrap.className = 'cart-item';
            wrap.setAttribute('data-showcase-line', '');
            wrap.setAttribute('data-good-id', id);

            const imgSrc = product.image && String(product.image).trim() !== '' ? product.image : FALLBACK_IMG;
            const article = product.article != null ? String(product.article) : '';
            const unitPrice = Number(product.price) || 0;

            wrap.innerHTML = `
                <div class="cart-image">
                    <img src="${escapeHtml(imgSrc)}" alt="">
                </div>
                <div class="cart-main">
                    <div class="cart-name">
                        ${splitNameHtml(product.name)}
                        <div class="cart-name-article">${escapeHtml(article)}</div>
                    </div>
                    <div class="cart-price">
                        ${formatPriceRub(unitPrice)}
                    </div>
                </div>
                <div class="quantity-container">
                    <div class="btn-remove" data-showcase-remove role="button">Удалить</div>
                    <div class="quantity-item">
                        <button type="button" class="btn-quantity" data-showcase-minus aria-label="Меньше">
                            <svg xmlns="http://www.w3.org/2000/svg" width="6" height="3" viewBox="0 0 6 3" fill="none">
                                <path d="M0 2.55V0H5.72V2.55H0Z" fill="#F6F6F6"/>
                            </svg>
                        </button>
                        <div class="quantity">${qty}</div>
                        <button type="button" class="btn-quantity" data-showcase-plus aria-label="Больше">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 11 11" fill="none">
                                <path d="M4.32 10.33V6.18H0V4.14H4.32V0H6.44V4.14H10.76V6.18H6.44V10.33H4.32Z" fill="#F6F6F6"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            return wrap;
        }
    }

    window.registerProjectPlugin('showcase-cart', ShowcaseCartPlugin);
})();
