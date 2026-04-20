(function () {
    'use strict';

    const BASKET_MODIFY_POLL_MS = 5000;

    /**
     * Если true — при свёрнутой/фоновой вкладке опрос checkbasketmodify останавливается
     * и возобновляется при возврате (экономия запросов; в Safari фоновые таймеры и так редкие).
     * Если false — интервал крутится всегда (удобно отладить Safari / не терять опрос в фоне).
     */
    const BASKET_MODIFY_PAUSE_WHEN_TAB_HIDDEN = false;

    const BasketDom = {
        initialized: false,

        init() {
            if (this.initialized) return;
            this.initialized = true;

            document.addEventListener('click', (e) => {
                const staleReload = e.target.closest('[data-basket-stale-reload]');
                if (staleReload) {
                    e.preventDefault();
                    window.location.reload();
                    return;
                }

                const removeBtn = e.target.closest('[data-basket-remove]');
                if (removeBtn) {
                    e.preventDefault();
                    const row = removeBtn.closest('[data-basket-item]');
                    const productId = Number(row?.getAttribute('data-basket-product-id') || 0);
                    if (productId > 0) {
                        BasketState.setItem(productId, 0).catch(() => {});
                    }
                    return;
                }

                const clearBtn = e.target.closest('[data-basket-clear]');
                if (clearBtn) {
                    e.preventDefault();
                    const items = [...BasketState.items];
                    (async () => {
                        for (const item of items) {
                            const id = Math.max(0, Number(item?.id || 0));
                            if (!id) continue;
                            await BasketState.setItem(id, 0);
                        }
                    })().catch(() => {});
                }
            });
        },

        /**
         * Показать оверлей «корзина изменилась» (если разметка есть на странице, корзина/заказ).
         * @returns {boolean} показали ли оверлей
         */
        showBasketStaleOverlayIfPresent() {
            const root = document.querySelector('[data-basket-stale-overlay]');
            if (!root) {
                return false;
            }
            root.removeAttribute('hidden');
            root.setAttribute('aria-hidden', 'false');
            if (document.body) {
                root.dataset.prevBodyOverflow = document.body.style.overflow || '';
                document.body.style.overflow = 'hidden';
            }
            return true;
        },

        formatPrice(value) {
            return `${Math.round(Math.max(0, Number(value) || 0)).toLocaleString('ru-RU')} ₽`;
        },

        collectCatalogGoodIds() {
            const ids = [];
            const seen = new Set();
            const pushId = (raw) => {
                const id = Math.max(0, Number(raw || 0));
                if (id > 0 && !seen.has(id)) {
                    seen.add(id);
                    ids.push(id);
                }
            };
            document.querySelectorAll('[data-catalog-good-id]').forEach((el) => {
                pushId(el.getAttribute('data-catalog-good-id'));
            });
            if (ids.length > 0) {
                return ids;
            }
            document.querySelectorAll('[data-catalog-price-root][data-catalog-good-id]').forEach((el) => {
                pushId(el.getAttribute('data-catalog-good-id'));
            });
            return ids;
        },

        /**
         * Текст над списком корзины: при наличии data.basket_assembly — блоки акция/товар, шт., база, со скидкой;
         * good_line вне комплекта — без скидки (база = со скидкой). Иначе запасной вариант по items.
         */
        updateDynamicCartTextSummary(data) {
            const el = document.querySelector('.cart-container [data-basket-dynamic-lines]');
            if (!el || !data || typeof data !== 'object') {
                return;
            }
            const promo = data.promo_by_good_id || data.catalog_prices || {};
            const promoRow = (goodId) => {
                const id = String(Math.max(0, Number(goodId) || 0));
                if (!id || id === '0') {
                    return null;
                }
                const st = promo[id] ?? promo[Number(id)];
                return st && typeof st === 'object' ? st : null;
            };
            const rubUnitBase = (goodId) => {
                const st = promoRow(goodId);
                if (!st) {
                    return { base: null, unit: null };
                }
                const b = Number(st.base);
                const u = Number(st.unit);
                return {
                    base: !Number.isNaN(b) && b >= 0 ? b : null,
                    unit: !Number.isNaN(u) && u >= 0 ? u : null,
                };
            };
            const sumMoney = (pairs) => {
                let s = 0;
                let ok = false;
                pairs.forEach(({ qty, unitRub }) => {
                    if (unitRub == null || qty <= 0) {
                        return;
                    }
                    ok = true;
                    s += qty * unitRub;
                });
                return ok ? Math.round(Math.max(0, s)) : null;
            };

            const assembly = data.basket_assembly;
            if (assembly && typeof assembly === 'object' && Array.isArray(assembly.rows)) {
                const rows = assembly.rows;
                if (rows.length === 0) {
                    el.textContent = '';
                    return;
                }
                const lines = [];
                rows.forEach((row) => {
                    if (!row || typeof row !== 'object') {
                        return;
                    }
                    if (row.kind === 'promo_bundle') {
                        const an = (row.action_name && String(row.action_name).trim()) || '';
                        const title = an ? `Акция «${an}»` : `Акция #${Math.max(0, Number(row.action_id) || 0)}`;
                        const members = Array.isArray(row.members) ? row.members : [];
                        let qtySum = 0;
                        const basePairs = [];
                        const unitPairs = [];
                        members.forEach((m) => {
                            const gid = Math.max(0, Number(m?.good_id || 0));
                            const q = Math.max(0, Number(m?.qty_total_in_bundles || 0));
                            if (gid <= 0 || q <= 0) {
                                return;
                            }
                            qtySum += q;
                            const { base, unit } = rubUnitBase(gid);
                            const uEff = unit != null ? unit : base;
                            basePairs.push({ qty: q, unitRub: base });
                            unitPairs.push({ qty: q, unitRub: uEff != null ? uEff : base });
                        });
                        const baseTot = sumMoney(basePairs);
                        const discTot = sumMoney(unitPairs);
                        lines.push(
                            `${title} — ${qtySum} шт — ${baseTot != null ? this.formatPrice(baseTot) : '—'} — ${discTot != null ? this.formatPrice(discTot) : '—'}`,
                        );
                        return;
                    }
                    if (row.kind === 'good_line') {
                        const gid = Math.max(0, Number(row.good_id || 0));
                        const q = Math.max(0, Number(row.quantity || 0));
                        if (gid <= 0 || q <= 0) {
                            return;
                        }
                        const { base } = rubUnitBase(gid);
                        const baseRub = base != null ? base : null;
                        const baseTot = baseRub != null ? Math.round(q * baseRub) : null;
                        const name = (row.name && String(row.name).trim()) || '';
                        let label = name;
                        if (!label) {
                            const domRow = document.querySelector(`[data-basket-item][data-catalog-good-id="${gid}"]`);
                            const t = domRow?.querySelector('.cart-name-title');
                            label = (t && t.textContent && t.textContent.trim()) ? t.textContent.trim().replace(/\s+/g, ' ') : `Товар #${gid}`;
                        }
                        const rub = baseTot != null ? this.formatPrice(baseTot) : '—';
                        lines.push(`${label} — ${q} шт — ${rub} — ${rub}`);
                    }
                });
                el.textContent = lines.join(' | ');
                return;
            }

            const items = Array.isArray(data.items) ? data.items : [];
            if (items.length === 0) {
                el.textContent = '';
                return;
            }
            const legacyLines = [];
            items.forEach((it) => {
                const id = Math.max(0, Number(it?.id || 0));
                const q = Math.max(0, Number(it?.quantity || 0));
                if (id <= 0) {
                    return;
                }
                const st = promo[String(id)] ?? promo[id];
                let baseStr = '—';
                if (st && typeof st === 'object' && st.base != null && st.base !== '') {
                    const bn = Number(st.base);
                    if (!Number.isNaN(bn)) {
                        baseStr = this.formatPrice(bn);
                    }
                }
                let label = `#${id}`;
                const row = document.querySelector(`[data-basket-item][data-catalog-good-id="${id}"]`);
                const title = row?.querySelector('.cart-name-title');
                if (title && title.textContent && title.textContent.trim()) {
                    label = title.textContent.trim().replace(/\s+/g, ' ');
                }
                legacyLines.push(`${label} — ${q} — ${baseStr}`);
            });
            el.textContent = legacyLines.join(' | ');
        },

        /**
         * Ответ /jsapi/basket или /jsapi/checkbasketmodify (при modified): синхронизация корзины + витрина (promo).
         */
        applyBasketClientPayload(data) {
            if (!data || typeof data !== 'object') {
                return;
            }
            BasketState.applySyncMeta(data);
            const promo = data.promo_by_good_id || data.catalog_prices;
            if (promo && typeof promo === 'object') {
                BasketDom.applyCatalogPriceStates(promo);
                requestAnimationFrame(() => BasketDom.applyCatalogPriceStates(promo));
            }
            BasketDom.updateDynamicCartTextSummary(data);
            requestAnimationFrame(() => BasketDom.updateDynamicCartTextSummary(data));
        },

        /**
         * promo_by_good_id из /jsapi/basket: quantity + hint_mincount в одном объекте; пока quantity < hint_mincount — без old-price и без скидочной цены.
         */
        applyCatalogPriceStates(map) {
            if (!map || typeof map !== 'object') {
                return;
            }
            const num = (v) => {
                if (v == null || v === '') {
                    return null;
                }
                const n = Number(v);
                return Number.isNaN(n) ? null : n;
            };
            const rub = (v) => {
                const n = num(v);
                return n == null ? null : `${Math.round(n)}₽`;
            };
            const staticDiscountPct = (st) => {
                const sp = num(st.static_discount_pct);
                if (sp != null && sp > 0) {
                    return Math.round(sp);
                }
                const h = num(st.hint_discount_pct);
                if (h != null && h > 0) {
                    return Math.round(h);
                }
                return null;
            };
            const setHidden = (el, on) => {
                if (!el) {
                    return;
                }
                if (on) {
                    el.setAttribute('hidden', '');
                } else {
                    el.removeAttribute('hidden');
                }
            };

            const applyOneCard = (node, st) => {
                if (Object.prototype.hasOwnProperty.call(st, 'action_is_single') && Number(st.action_is_single) === 0) {
                    return;
                }
                const mode = st.price_mode || 'plain';
                const state = st.state || 'base';
                const b = num(st.base);
                const u = num(st.unit);
                const qty = num(st.quantity);
                const hm = num(st.hint_mincount);
                const hp = num(st.hint_discount_pct);
                const isSingle =
                    Object.prototype.hasOwnProperty.call(st, 'action_is_single') && Number(st.action_is_single) === 1;
                const belowPromoMin = isSingle && hm != null && hm > 1 && qty != null && qty < hm;
                try {
                node.setAttribute('data-catalog-price-mode', mode);
                node.setAttribute('data-catalog-price-state', state);
                const line = node.querySelector('[data-catalog-promo-line]');
                const oldEl = node.querySelector('[data-catalog-old-price]');
                const priceEl = node.querySelector('.price-main .price');
                const lineHide = () => {
                    if (line) {
                        line.setAttribute('hidden', '');
                        line.classList.remove('active');
                    }
                };
                const lineActive = (txt) => {
                    if (!line) {
                        return;
                    }
                    line.removeAttribute('hidden');
                    line.classList.add('active');
                    line.textContent = txt;
                };
                const lineHint = (txt) => {
                    if (!line) {
                        return;
                    }
                    line.removeAttribute('hidden');
                    line.classList.remove('active');
                    line.textContent = txt;
                };
                if (belowPromoMin) {
                    if (hm != null && hp != null) {
                        lineHint(`от ${Math.round(hm)} шт - ${Math.round(hp)}%`);
                    } else {
                        lineHide();
                    }
                    setHidden(oldEl, true);
                    if (priceEl && b != null) {
                        priceEl.textContent = rub(b);
                    }
                    return;
                }
                /* backend может отдать price_mode plain при min>1, но state activated/pending — не режем до одной цены */
                if (mode === 'plain' && state !== 'activated' && state !== 'pending') {
                    lineHide();
                    setHidden(oldEl, true);
                    if (priceEl && b != null) {
                        priceEl.textContent = rub(b);
                    }
                    return;
                }
                if (mode === 'static') {
                    const pct = staticDiscountPct(st);
                    if (pct != null) {
                        lineActive(`- ${pct}%`);
                    } else {
                        lineHide();
                    }
                    setHidden(oldEl, false);
                    if (priceEl && u != null) {
                        priceEl.textContent = rub(u);
                    }
                    if (oldEl && b != null) {
                        oldEl.textContent = rub(b);
                    }
                    return;
                }
                if (state === 'base') {
                    lineHide();
                    setHidden(oldEl, true);
                    if (priceEl && b != null) {
                        priceEl.textContent = rub(b);
                    }
                    return;
                }
                if (state === 'pending') {
                    if (hm != null && hp != null) {
                        lineHint(`от ${Math.round(hm)} шт - ${Math.round(hp)}%`);
                    } else {
                        lineHide();
                    }
                    setHidden(oldEl, false);
                    if (priceEl && b != null) {
                        priceEl.textContent = rub(b);
                    }
                    if (oldEl && b != null) {
                        oldEl.textContent = rub(b);
                    }
                    return;
                }
                const disc = num(st.discount_pct);
                if (disc != null && disc > 0) {
                    lineActive(`- ${Math.round(disc)}%`);
                } else {
                    lineHide();
                }
                setHidden(oldEl, false);
                if (priceEl && u != null) {
                    priceEl.textContent = rub(u);
                }
                if (oldEl && b != null) {
                    oldEl.textContent = rub(b);
                }
                } finally {
                    const basketRow = node.closest('[data-basket-item]');
                    if (basketRow) {
                        let eff = u != null ? u : b;
                        if (belowPromoMin && b != null) {
                            eff = b;
                        }
                        if (eff != null) {
                            basketRow.setAttribute('data-basket-unit-price', String(Math.round(eff)));
                        }
                    }
                }
            };

            document.querySelectorAll('[data-catalog-good-id]').forEach((node) => {
                const gid = String(Math.max(0, parseInt(node.getAttribute('data-catalog-good-id'), 10) || 0));
                if (!gid || gid === '0') {
                    return;
                }
                const st = map[gid];
                if (!st || typeof st !== 'object') {
                    return;
                }
                applyOneCard(node, st);
            });
        },

        /** Подмена HTML списка корзины; после замены — повторный GET для promo на витрине (без рекурсии в maybeReloadCartListHtml). */
        maybeReloadCartListHtml() {
            const cart = document.querySelector('.cart-container[data-basket-list-refresh-url]');
            if (!cart) {
                return;
            }
            const url = (cart.getAttribute('data-basket-list-refresh-url') || '').trim();
            if (!url) {
                return;
            }
            fetch(url, {
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            })
                .then((r) => r.text())
                .then((html) => {
                    const list = cart.querySelector('.cart-list');
                    if (!list) {
                        return;
                    }
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const next = doc.querySelector('.cart-list');
                    if (next) {
                        list.innerHTML = next.innerHTML;
                    }
                    try {
                        document.dispatchEvent(new CustomEvent('basket:cart-fragment-replaced'));
                    } catch (e) {
                        /* ignore */
                    }
                    const ids = BasketDom.collectCatalogGoodIds();
                    if (ids.length === 0) {
                        return;
                    }
                    return BasketState.api(BasketState.payloadWithCatalogIds({ action: 'get' })).then((data) => {
                        BasketDom.applyBasketClientPayload(data);
                    });
                })
                .catch(() => {});
        },

        updateCartSummary(items) {
            const totalQtyNode = document.querySelector('[data-basket-total-quantity]');
            const totalAmountNode = document.querySelector('[data-basket-total-amount]');
            if (!totalQtyNode && !totalAmountNode) return;

            const itemMap = new Map();
            (Array.isArray(items) ? items : []).forEach((it) => {
                const id = Math.max(0, Number(it?.id || 0));
                const quantity = Math.max(0, Number(it?.quantity || 0));
                if (id > 0) itemMap.set(id, quantity);
            });

            let totalQuantity = 0;
            let totalAmount = 0;

            document.querySelectorAll('[data-basket-item]').forEach((row) => {
                const id = Math.max(0, Number(row.getAttribute('data-basket-product-id') || 0));
                if (!id) return;
                const quantity = Math.max(0, Number(itemMap.get(id) || 0));
                const unitPrice = Math.max(0, Number(row.getAttribute('data-basket-unit-price') || 0));

                if (quantity <= 0) {
                    row.remove();
                    return;
                }

                totalQuantity += quantity;
                totalAmount += unitPrice * quantity;
            });

            if (totalQtyNode) totalQtyNode.textContent = String(totalQuantity);
            if (totalAmountNode) totalAmountNode.textContent = this.formatPrice(totalAmount);

            const cartRoot = document.querySelector('.cart-container[data-basket-free-shipping-threshold]');
            const freeShipThreshold = Math.max(0, Number(cartRoot?.getAttribute('data-basket-free-shipping-threshold') || 0));
            const freeShipStatus = document.querySelector('[data-basket-free-ship-status]');
            const freeShipBelowWrap = freeShipStatus?.querySelector('[data-basket-free-ship-below-wrap]');
            const freeShipFreeWrap = freeShipStatus?.querySelector('[data-basket-free-ship-free-wrap]');
            const freeShipRemainder = document.querySelector('[data-basket-free-ship-remainder]');
            if (freeShipThreshold > 0 && freeShipStatus) {
                if (totalAmount >= freeShipThreshold) {
                    if (freeShipBelowWrap) freeShipBelowWrap.style.display = 'none';
                    if (freeShipFreeWrap) freeShipFreeWrap.style.display = '';
                } else {
                    if (freeShipBelowWrap) freeShipBelowWrap.style.display = '';
                    if (freeShipFreeWrap) freeShipFreeWrap.style.display = 'none';
                    if (freeShipRemainder) {
                        const remainder = Math.ceil(Math.max(0, freeShipThreshold - totalAmount));
                        freeShipRemainder.textContent = this.formatPrice(remainder);
                    }
                }
            }

            const clearBtn = document.querySelector('[data-basket-clear]');
            if (clearBtn) {
                clearBtn.style.display = totalQuantity > 0 ? '' : 'none';
            }
        }
    };

    const BasketState = {
        items: [],
        loaded: false,
        loadingPromise: null,
        /** Серверная метка корзины для jsapi/checkbasketmodify */
        syncAt: '1970-01-01 00:00:00',
        lineCountSnapshot: 0,
        modifyPollTimer: null,
        /** Время последнего тика опроса (для немедленной проверки после возврата на вкладку) */
        modifyPollLastTickAt: null,
        modifyPollVisibilityBound: false,
        /** Остановка опроса после оверлея «корзина изменилась» — не возобновлять по visibility */
        modifyPollStoppedForStale: false,

        async api(payload) {
            const response = await window.ApiService.post('basket', payload);
            if (!response || response.status !== 'success') {
                throw new Error(response?.error || 'Basket API error');
            }
            return response.data || {};
        },

        payloadWithCatalogIds(base) {
            const ids = BasketDom.collectCatalogGoodIds();
            if (ids.length === 0) {
                return base;
            }
            // Массив в JSON-теле: иначе строка "[1,2]" может исказиться при sanitize в Request
            return { ...base, catalog_good_ids: ids };
        },

        normalizeItems(items) {
            if (!Array.isArray(items)) return [];
            return items
                .map((it) => ({
                    id: Math.max(0, Number(it?.id || 0)),
                    quantity: Math.max(0, Number(it?.quantity || 0))
                }))
                .filter((it) => it.id > 0 && it.quantity > 0);
        },

        applySyncMeta(data) {
            if (!data || typeof data !== 'object') {
                return;
            }
            if (typeof data.basket_sync_at === 'string' && data.basket_sync_at !== '') {
                this.syncAt = data.basket_sync_at;
            }
            if (data.basket_line_count != null && data.basket_line_count !== '') {
                this.lineCountSnapshot = Math.max(0, parseInt(String(data.basket_line_count), 10) || 0);
            }
        },

        async checkBasketModified() {
            const body = {
                starttime: this.syncAt,
                line_count: this.lineCountSnapshot,
            };
            const ids = BasketDom.collectCatalogGoodIds();
            if (ids.length > 0) {
                body.catalog_good_ids = JSON.stringify(ids);
            }
            const response = await window.ApiService.post('checkbasketmodify', body);
            if (!response || response.status !== 'success') {
                return { modified: false, data: null };
            }
            const d = response.data || {};
            return { modified: Boolean(d.modified), data: d };
        },

        async refreshBasketFromServer() {
            const data = await this.api(this.payloadWithCatalogIds({ action: 'get' }));
            this.items = this.normalizeItems(data.items || []);
            BasketDom.applyBasketClientPayload(data);
            BasketDom.maybeReloadCartListHtml();
            this.loaded = true;
            this.dispatch();
        },

        ensureModifyPollVisibilityListener() {
            if (this.modifyPollVisibilityBound) {
                return;
            }
            this.modifyPollVisibilityBound = true;
            document.addEventListener('visibilitychange', () => {
                if (BASKET_MODIFY_PAUSE_WHEN_TAB_HIDDEN && document.hidden) {
                    this.stopModifyPolling();
                    return;
                }
                if (this.modifyPollStoppedForStale) {
                    return;
                }
                if (!document.hidden) {
                    this.onModifyPollDocumentVisible();
                }
            });
        },

        onModifyPollDocumentVisible() {
            const last = this.modifyPollLastTickAt;
            if (last != null && Date.now() - last > BASKET_MODIFY_POLL_MS) {
                this.runModifyPollTick().catch(() => {});
            }
            this.startModifyPollingInterval();
        },

        runModifyPollTick() {
            this.modifyPollLastTickAt = Date.now();
            return this.checkBasketModified()
                .then((result) => {
                    const modified = result && result.modified;
                    const pollData = result && result.data;
                    if (!modified) {
                        return;
                    }
                    if (pollData) {
                        BasketDom.applyBasketClientPayload(pollData);
                    }
                    if (BasketDom.showBasketStaleOverlayIfPresent()) {
                        this.modifyPollStoppedForStale = true;
                        this.stopModifyPolling();
                        return;
                    }
                    return this.refreshBasketFromServer().then(() => {
                        this.startModifyPolling();
                    });
                });
        },

        startModifyPollingInterval() {
            if (this.modifyPollStoppedForStale) {
                return;
            }
            if (BASKET_MODIFY_PAUSE_WHEN_TAB_HIDDEN && document.visibilityState === 'hidden') {
                return;
            }
            if (this.modifyPollTimer) {
                clearInterval(this.modifyPollTimer);
                this.modifyPollTimer = null;
            }
            this.modifyPollTimer = window.setInterval(() => {
                this.runModifyPollTick().catch(() => {});
            }, BASKET_MODIFY_POLL_MS);
        },

        startModifyPolling() {
            if (this.modifyPollStoppedForStale) {
                return;
            }
            this.ensureModifyPollVisibilityListener();
            if (BASKET_MODIFY_PAUSE_WHEN_TAB_HIDDEN && document.visibilityState === 'hidden') {
                return;
            }
            this.startModifyPollingInterval();
        },

        stopModifyPolling() {
            if (this.modifyPollTimer) {
                clearInterval(this.modifyPollTimer);
                this.modifyPollTimer = null;
            }
        },

        dispatch() {
            this.updateGlobalCounters();
            BasketDom.updateCartSummary(this.items);
            document.dispatchEvent(new CustomEvent('basket:updated', { detail: { items: this.items } }));
        },

        updateGlobalCounters() {
            const totalItems = this.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
            const cartCounter = document.querySelector('.cart-counter');
            if (cartCounter) {
                cartCounter.textContent = String(totalItems);
                cartCounter.style.display = totalItems > 0 ? 'flex' : 'none';
            }
            const cartIcon = document.querySelector('.cart-icon');
            if (cartIcon) {
                cartIcon.classList.toggle('filled', totalItems > 0);
            }
        },

        async ensureLoaded() {
            if (this.loaded) return this.items;
            if (this.loadingPromise) return this.loadingPromise;
            this.loadingPromise = (async () => {
                const data = await this.api(BasketState.payloadWithCatalogIds({ action: 'get' }));
                this.items = this.normalizeItems(data.items || []);
                BasketDom.applyBasketClientPayload(data);
                BasketDom.maybeReloadCartListHtml();
                this.loaded = true;
                this.dispatch();
                this.startModifyPolling();
                return this.items;
            })().finally(() => {
                this.loadingPromise = null;
            });
            return this.loadingPromise;
        },

        async setItem(productId, quantity) {
            await this.ensureLoaded();
            const data = await this.api(
                BasketState.payloadWithCatalogIds({
                    action: 'set',
                    product_id: Number(productId) || 0,
                    quantity: Math.max(0, Number(quantity) || 0)
                })
            );
            this.items = this.normalizeItems(data.items || []);
            BasketDom.applyBasketClientPayload(data);
            BasketDom.maybeReloadCartListHtml();
            this.dispatch();
            this.startModifyPolling();
            return this.items;
        }
    };

    class BasketPlugin {
        constructor(element) {
            this.element = element;
            this.productId = parseInt(this.element.getAttribute('data-basket-product-id') || '0', 10);
            this.cartMinus = this.element.querySelector('.cart-minus');
            this.cartPlus = this.element.querySelector('.cart-plus');
            this.cartQuantity = this.element.querySelector('.cart-quantity');
            this.cartText = this.element.querySelector('.cart-text');
            this.onBasketUpdated = this.onBasketUpdated.bind(this);
        }

        async init() {
            BasketDom.init();
            document.addEventListener('basket:updated', this.onBasketUpdated);
            if (this.productId) {
                this.bindEvents();
            }
            await BasketState.ensureLoaded();
            if (this.productId) {
                this.syncUI();
            }
            return this;
        }

        bindEvents() {
            this.element.addEventListener('click', (e) => {
                const clickedMinus = e.target.closest('.cart-minus');
                const clickedPlus = e.target.closest('.cart-plus');
                if (clickedMinus || clickedPlus) return;
                e.preventDefault();
                e.stopPropagation();
                this.addOne().catch(() => {});
            });

            if (this.cartMinus) {
                this.cartMinus.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.changeQuantity(-1).catch(() => {});
                });
            }

            if (this.cartPlus) {
                this.cartPlus.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.changeQuantity(1).catch(() => {});
                });
            }
        }

        onBasketUpdated() {
            this.syncUI();
        }

        getItem() {
            const items = BasketState.items;
            return items.find((item) => Number(item.id) === this.productId) || null;
        }

        async addOne() {
            const item = this.getItem();
            const quantity = Math.max(1, Number(item?.quantity || 0) + 1);
            await BasketState.setItem(this.productId, quantity);
        }

        async changeQuantity(delta) {
            const item = this.getItem();
            const current = Math.max(0, Number(item?.quantity || 0));
            if (current <= 0 && delta <= 0) return;
            const nextQty = Math.max(0, current + delta);
            await BasketState.setItem(this.productId, nextQty);
        }

        syncUI() {
            if (!this.element || !this.element.isConnected) return;
            const item = this.getItem();
            const quantity = item ? Math.max(1, Number(item.quantity || 1)) : 0;

            if (quantity > 0) {
                this.element.classList.add('filled');
                if (this.cartQuantity) this.cartQuantity.textContent = String(quantity);
                if (this.cartText) this.cartText.style.display = 'none';
            } else {
                this.element.classList.remove('filled');
                if (this.cartQuantity) this.cartQuantity.textContent = '1';
                if (this.cartText) this.cartText.style.display = 'block';
                const row = this.element.closest('[data-basket-item]');
                if (row) row.remove();
            }
        }

        destroy() {
            document.removeEventListener('basket:updated', this.onBasketUpdated);
        }
    }

    window.registerProjectPlugin('basket', BasketPlugin);
})();

