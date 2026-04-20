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
                const blockedCheckout = e.target.closest('[data-basket-checkout][data-basket-checkout-blocked]');
                if (blockedCheckout) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                const removeUnavailBtn = e.target.closest('[data-basket-remove-unavailable]');
                if (removeUnavailBtn) {
                    e.preventDefault();
                    BasketDom.removeUnavailableBasketLines().catch(() => {});
                    return;
                }

                const deltaHost = e.target.closest('[data-basket-deltas]');
                if (deltaHost) {
                    e.preventDefault();
                    e.stopPropagation();
                    const spec = BasketDom.parseBasketDeltasAttr(deltaHost.getAttribute('data-basket-deltas'));
                    if (!spec) {
                        return;
                    }
                    const isDeleteButton = deltaHost.hasAttribute('data-basket-remove')
                        || deltaHost.classList.contains('btn-remove');
                    (async () => {
                        if (isDeleteButton) {
                            const row = deltaHost.closest('.cart-item');
                            await BasketDom.animateCartRowLeave(row);
                        }
                        await BasketDom.applyBasketDeltasFromObject(spec);
                    })().catch(() => {});
                    return;
                }

                const removeBtn = e.target.closest('[data-basket-remove]');
                if (removeBtn) {
                    e.preventDefault();
                    const scope = removeBtn.closest('[data-basket-item]')
                        || removeBtn.closest('[data-basket-assembly-row]');
                    const qtyLine = Math.max(
                        0,
                        parseInt(
                            removeBtn.closest('.quantity-container')?.querySelector('.cart-quantity')?.textContent || '0',
                            10,
                        ) || 0,
                    );
                    let productId = Math.max(
                        0,
                        Number(
                            scope?.getAttribute('data-catalog-good-id')
                                || scope?.getAttribute('data-basket-assembly-good-id')
                                || 0,
                        ),
                    );
                    if (productId <= 0) {
                        const idHost = scope?.querySelector('[data-basket-product-id]')
                            || (scope?.hasAttribute('data-basket-product-id') ? scope : null);
                        productId = Number(idHost?.getAttribute('data-basket-product-id') || 0);
                    }
                    if (productId > 0 && qtyLine > 0) {
                        (async () => {
                            const row = removeBtn.closest('.cart-item');
                            await BasketDom.animateCartRowLeave(row);
                            await BasketState.ensureLoaded();
                            const cur = BasketState.items.find((it) => Number(it.id) === productId);
                            const curQ = cur ? Math.max(0, Number(cur.quantity || 0)) : 0;
                            await BasketState.setItem(productId, Math.max(0, curQ - qtyLine));
                        })().catch(() => {});
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

        parseBasketDeltasAttr(raw) {
            if (raw == null || raw === '') {
                return null;
            }
            let s = String(raw).trim();
            if (s.includes('&quot;')) {
                s = s.replace(/&quot;/g, '"');
            }
            if (s.includes('&#34;')) {
                s = s.replace(/&#34;/g, '"');
            }
            try {
                const o = JSON.parse(s);
                return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
            } catch {
                return null;
            }
        },

        async applyBasketDeltasFromObject(obj) {
            if (!obj || typeof obj !== 'object') {
                return;
            }
            await BasketState.ensureLoaded();
            const entries = Object.entries(obj).filter(([, v]) => {
                const n = Number(v);
                return !Number.isNaN(n) && n !== 0;
            });
            for (let i = 0; i < entries.length; i += 1) {
                const [ks, dv] = entries[i];
                const gid = Math.max(0, Number(ks));
                const delta = Math.round(Number(dv));
                if (gid <= 0 || delta === 0) {
                    continue;
                }
                const curEntry = BasketState.items.find((it) => Number(it.id) === gid);
                const curQ = curEntry ? Math.max(0, Number(curEntry.quantity || 0)) : 0;
                await BasketState.setItem(gid, Math.max(0, curQ + delta));
            }
        },

        async animateCartRowLeave(row) {
            if (!row || !row.isConnected) {
                return;
            }
            requestAnimationFrame(() => {
                row.classList.add('basket-row-leaving');
            });
            await new Promise((resolve) => {
                setTimeout(resolve, 300);
            });
        },

        /**
         * После вставки строк корзины MutationObserver может отстать; явно дожидаемся init data-plugin="basket".
         */
        async rescanBasketPluginsInList(list) {
            const root = list || document.querySelector('.cart-container .cart-list[data-basket-dynamic-lines]');
            const h = typeof window !== 'undefined' ? window.Project : null;
            if (!root || !h || typeof h.scheduleElement !== 'function') {
                return;
            }
            await new Promise((resolve) => {
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(resolve);
                });
            });
            const nodes = [...root.querySelectorAll('[data-plugin]:not([data-plugin-initialized])')];
            if (nodes.length === 0) {
                return;
            }
            await Promise.all(nodes.map((el) => h.scheduleElement(el)));
        },

        formatPrice(value) {
            return `${Math.round(Math.max(0, Number(value) || 0)).toLocaleString('ru-RU')} ₽`;
        },

        syncBasketAvailabilityFromPayload(data) {
            const available = !(data && Object.prototype.hasOwnProperty.call(data, 'available') && data.available === false);
            const removeUnavail = document.querySelector('[data-basket-remove-unavailable]');
            if (removeUnavail) {
                if (!available) {
                    removeUnavail.removeAttribute('hidden');
                } else {
                    removeUnavail.setAttribute('hidden', '');
                }
            }
            document.querySelectorAll('[data-basket-checkout]').forEach((el) => {
                if (!available) {
                    el.setAttribute('data-basket-checkout-blocked', '1');
                    el.setAttribute('aria-disabled', 'true');
                    el.tabIndex = -1;
                    el.classList.add('basket-checkout--blocked');
                } else {
                    el.removeAttribute('data-basket-checkout-blocked');
                    el.removeAttribute('aria-disabled');
                    el.removeAttribute('tabindex');
                    el.classList.remove('basket-checkout--blocked');
                }
            });
            ['submit-delivery-order-btn', 'submit-delivery-order-payfree-btn'].forEach((id) => {
                const b = document.getElementById(id);
                if (!b) {
                    return;
                }
                b.disabled = !available;
                if (!available) {
                    b.setAttribute('aria-disabled', 'true');
                    b.classList.add('basket-checkout--blocked');
                } else {
                    b.removeAttribute('aria-disabled');
                    b.classList.remove('basket-checkout--blocked');
                }
            });
        },

        async removeUnavailableBasketLines() {
            const goods = BasketState.lastBasketAssemblyGoods;
            if (!goods || typeof goods !== 'object') {
                return;
            }
            await BasketState.ensureLoaded();
            const ids = [];
            Object.keys(goods).forEach((k) => {
                const card = goods[k];
                if (!card || typeof card !== 'object') {
                    return;
                }
                if (!Object.prototype.hasOwnProperty.call(card, 'stat_available')) {
                    return;
                }
                const v = card.stat_available;
                if (v !== 0 && v !== '0') {
                    return;
                }
                const gid = Math.max(0, Number(k));
                if (gid <= 0) {
                    return;
                }
                if (BasketState.items.some((it) => Number(it.id) === gid && Math.max(0, Number(it.quantity || 0)) > 0)) {
                    ids.push(gid);
                }
            });
            for (let i = 0; i < ids.length; i += 1) {
                await BasketState.setItem(ids[i], 0);
            }
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
         * Сборка basket_assembly: только разметка .cart-list > .cart-item (как в макете), маркеры — data-basket-assembly-*.
         * Вставка перед первым [data-basket-item], без лишних обёрток. Legacy — один .cart-item с data-basket-assembly-fallback.
         */
        updateDynamicCartTextSummary(data) {
            const list = document.querySelector('.cart-container .cart-list[data-basket-dynamic-lines]');
            if (!list || !data || typeof data !== 'object') {
                return;
            }
            const escHtml = (s) => String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const escAttr = escHtml;
            const svgQtyMinus = '<svg xmlns="http://www.w3.org/2000/svg" width="6" height="3" viewBox="0 0 6 3" fill="none">'
                + '<path d="M0 2.55V0H5.72V2.55H0Z" fill="#F6F6F6"/></svg>';
            const svgQtyPlus = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 11 11" fill="none">'
                + '<path d="M4.32 10.33V6.18H0V4.14H4.32V0H6.44V4.14H10.76V6.18H6.44V10.33H4.32Z" fill="#F6F6F6"/></svg>';
            /**
             * Как в template.php: quantity-container + stepper.
             * Полная строка по sku — data-plugin="basket". «Лишок» good_line — ± через data-basket-deltas (иначе
             * syncUI подставил бы полное кол-во из корзины вместо quantity из basket_assembly).
             * @param {{ removeClearsProduct?: boolean, stepperWithBasket?: boolean, stepperWithDeltas?: boolean }} opts
             */
            const assemblyQuantityContainerHtml = (qty, productId, opts = {}) => {
                const q = Math.max(0, Number(qty) || 0);
                const pid = Math.max(0, Number(productId) || 0);
                const removeClearsProduct = !!opts.removeClearsProduct && pid > 0;
                const stepperWithBasket = !!opts.stepperWithBasket && pid > 0;
                const stepperWithDeltas = !!opts.stepperWithDeltas && pid > 0 && !stepperWithBasket;
                const idAttr = !stepperWithBasket && !stepperWithDeltas && removeClearsProduct
                    ? ` data-basket-product-id="${pid}"`
                    : '';
                let inner;
                if (stepperWithBasket) {
                    inner = `<div class="quantity-item cart-control" data-plugin="basket" data-basket-product-id="${pid}">`
                        + `<button class="btn-quantity cart-minus" type="button">${svgQtyMinus}</button>`
                        + `<div class="quantity cart-quantity">${q}</div>`
                        + `<button class="btn-quantity cart-plus" type="button">${svgQtyPlus}</button>`
                        + `</div>`;
                } else if (stepperWithDeltas) {
                    const dMinus = escAttr(JSON.stringify({ [String(pid)]: -1 }));
                    const dPlus = escAttr(JSON.stringify({ [String(pid)]: 1 }));
                    inner = `<div class="quantity-item cart-control" data-basket-assembly-line-delta="1">`
                        + `<button type="button" class="btn-quantity cart-minus" data-basket-deltas="${dMinus}">${svgQtyMinus}</button>`
                        + `<div class="quantity cart-quantity">${q}</div>`
                        + `<button type="button" class="btn-quantity cart-plus" data-basket-deltas="${dPlus}">${svgQtyPlus}</button>`
                        + `</div>`;
                } else {
                    inner = `<div class="quantity-item cart-control"${idAttr}>`
                        + `<button class="btn-quantity cart-minus" type="button">${svgQtyMinus}</button>`
                        + `<div class="quantity cart-quantity">${q}</div>`
                        + `<button class="btn-quantity cart-plus" type="button">${svgQtyPlus}</button>`
                        + `</div>`;
                }
                const removeBtn = removeClearsProduct && pid > 0
                    ? `<button class="btn-remove" type="button" data-basket-remove data-basket-deltas="${escAttr(JSON.stringify({ [String(pid)]: -q }))}">Удалить</button>`
                    : '<button class="btn-remove" type="button">Удалить</button>';
                return `<div class="quantity-container">${removeBtn}`
                    + `<div class="quantity-item-container">${inner}`
                    + `<div class="action-text text" data-catalog-promo-line hidden>- 0%</div>`
                    + `</div></div>`;
            };
            const clearAssemblyNodes = () => {
                list.querySelectorAll('[data-basket-assembly-row]').forEach((n) => n.remove());
            };
            const clearBasketItemRowsInList = () => {
                list.querySelectorAll('[data-basket-item]').forEach((n) => n.remove());
            };
            const clearBtn = list.querySelector('[data-basket-clear]');
            const listInsertAnchor = list.querySelector('[data-basket-list-insert-anchor]');
            const insertHtmlBeforeClear = (html) => {
                if (!html) {
                    return;
                }
                const frag = document.createRange().createContextualFragment(html);
                const ref = listInsertAnchor || clearBtn;
                const parent = ref ? ref.parentNode : list;
                while (frag.firstChild) {
                    if (ref) {
                        parent.insertBefore(frag.firstChild, ref);
                    } else {
                        list.appendChild(frag.firstChild);
                    }
                }
            };
            const insertAssemblyHtml = (html) => {
                clearAssemblyNodes();
                insertHtmlBeforeClear(html);
            };
            const items = Array.isArray(data.items) ? data.items : [];
            const itemMap = new Map();
            items.forEach((it) => {
                const id = Math.max(0, Number(it?.id || 0));
                const q = Math.max(0, Number(it?.quantity || 0));
                if (id > 0) {
                    itemMap.set(id, q);
                }
            });
            clearAssemblyNodes();
            clearBasketItemRowsInList();
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
            const cartImageHtml = (photoUrl, altText) => {
                const alt = escHtml((altText || '').replace(/\s+/g, ' ').trim());
                const u = (photoUrl && String(photoUrl).trim()) ? String(photoUrl).trim() : '';
                if (u) {
                    return `<div class="cart-image"><img src="${escAttr(u)}" alt="${alt}"></div>`;
                }
                const raw = (altText && String(altText).trim()[0]) || '—';
                return `<div class="cart-image">${escHtml(raw)}</div>`;
            };

            const assembly = data.basket_assembly;
            const goods = (assembly && typeof assembly === 'object' && assembly.goods && typeof assembly.goods === 'object')
                ? assembly.goods
                : {};
            const bundleQuantityContainerHtml = (bundleCount, membersForStep) => {
                const removeAll = {};
                const stepMinus = {};
                const stepPlus = {};
                (Array.isArray(membersForStep) ? membersForStep : []).forEach((m) => {
                    const gid = Math.max(0, Number(m?.good_id || 0));
                    const total = Math.max(0, Number(m?.qty_total_in_bundles || 0));
                    const per = Math.max(0, Number(m?.qty_per_bundle_set || 0));
                    if (gid <= 0) {
                        return;
                    }
                    if (total > 0) {
                        removeAll[String(gid)] = -total;
                    }
                    if (per > 0) {
                        stepMinus[String(gid)] = -per;
                        stepPlus[String(gid)] = per;
                    }
                });
                const bc = Math.max(0, Number(bundleCount) || 0);
                const canStep = Object.keys(stepPlus).length > 0;
                const encRem = escAttr(JSON.stringify(removeAll));
                const encMi = escAttr(JSON.stringify(stepMinus));
                const encPl = escAttr(JSON.stringify(stepPlus));
                const minusDisabled = !canStep || bc < 1 ? ' disabled' : '';
                const plusDisabled = !canStep ? ' disabled' : '';
                const removeHtml = Object.keys(removeAll).length > 0
                    ? `<button type="button" class="btn-remove" data-basket-remove data-basket-deltas="${encRem}">Удалить</button>`
                    : '<button type="button" class="btn-remove" disabled>Удалить</button>';
                const inner = `<div class="quantity-item cart-control" data-basket-assembly-bundle-stepper="1">`
                    + `<button type="button" class="btn-quantity cart-minus" data-basket-deltas="${encMi}"${minusDisabled}>${svgQtyMinus}</button>`
                    + `<div class="quantity cart-quantity">${bc}</div>`
                    + `<button type="button" class="btn-quantity cart-plus" data-basket-deltas="${encPl}"${plusDisabled}>${svgQtyPlus}</button>`
                    + `</div>`;
                return `<div class="quantity-container">${removeHtml}`
                    + `<div class="quantity-item-container">${inner}`
                    + `<div class="action-text text" data-catalog-promo-line hidden>- 0%</div>`
                    + `</div></div>`;
            };
            if (assembly && typeof assembly === 'object' && Array.isArray(assembly.rows) && assembly.rows.length > 0) {
                const rows = assembly.rows;
                const chunks = [];
                rows.forEach((row) => {
                    if (!row || typeof row !== 'object') {
                        return;
                    }
                    if (row.kind === 'promo_bundle') {
                        const an = (row.action_name && String(row.action_name).trim()) || '';
                        const titlePlain = an ? `Акция «${an}»` : `Акция #${Math.max(0, Number(row.action_id) || 0)}`;
                        const titleHtml = escHtml(titlePlain);
                        const members = Array.isArray(row.members) ? row.members : [];
                        let bundleCount = Math.max(0, Number(row.bundle_count) || 0);
                        if (bundleCount <= 0 && members.length > 0) {
                            const m0 = members.find((m) => Math.max(0, Number(m?.qty_total_in_bundles || 0)) > 0);
                            const tot = Math.max(0, Number(m0?.qty_total_in_bundles || 0));
                            const per = Math.max(0, Number(m0?.qty_per_bundle_set || 0));
                            if (per > 0) {
                                bundleCount = Math.floor(tot / per);
                            }
                        }
                        const basePairs = [];
                        const unitPairs = [];
                        let leadPhoto = '';
                        let leadAlt = titlePlain;
                        members.forEach((m) => {
                            const gid = Math.max(0, Number(m?.good_id || 0));
                            const q = Math.max(0, Number(m?.qty_total_in_bundles || 0));
                            if (gid <= 0 || q <= 0) {
                                return;
                            }
                            const { base, unit } = rubUnitBase(gid);
                            const uEff = unit != null ? unit : base;
                            basePairs.push({ qty: q, unitRub: base });
                            unitPairs.push({ qty: q, unitRub: uEff != null ? uEff : base });
                            if (!leadPhoto && m.photo_url) {
                                leadPhoto = String(m.photo_url).trim();
                                leadAlt = (m.name && String(m.name).trim()) || leadAlt;
                            }
                        });
                        const baseTot = sumMoney(basePairs);
                        const discTot = sumMoney(unitPairs);
                        const priceStr = discTot != null ? this.formatPrice(discTot) : '—';
                        const oldStr = baseTot != null ? this.formatPrice(baseTot) : '—';
                        const oldHidden = (baseTot == null || discTot == null || baseTot === discTot) ? ' hidden' : '';
                        const membersForStep = members.filter((m) => Math.max(0, Number(m?.good_id || 0)) > 0
                            && Math.max(0, Number(m?.qty_total_in_bundles || 0)) > 0);
                        const setsInner = membersForStep
                            .map((m) => {
                            const nm = escHtml((m.name && String(m.name).trim()) || '');
                            const ar = escHtml((m.article && String(m.article).trim()) || '');
                            const qv = Math.max(0, Number(m?.qty_total_in_bundles || 0));
                            const ph = (m.photo_url && String(m.photo_url).trim()) || '';
                            return `<div class="set-item-container">`
                                + `<div class="set-item">`
                                + (ph ? `<img src="${escAttr(ph)}" alt="${nm}" class="set-image">` : '<div class="set-image"></div>')
                                + `<div class="set-title-container">`
                                + `<div class="set-title">${nm}</div>`
                                + `<div class="set-text">${ar}</div>`
                                + `</div>`
                                + `</div>`
                                + `<div class="text">${qv} шт.</div>`
                                + `</div>`;
                            }).join('');
                        chunks.push(
                            `<div class="cart-item" data-basket-assembly-row data-basket-assembly="promo_bundle">`
                            + `${cartImageHtml(leadPhoto, leadAlt)}`
                            + `<div class="cart-main">`
                            + `<div class="cart-name"><div class="cart-name-title">${titleHtml}</div></div>`
                            + `<div class="cart-price">`
                            + `<div class="price">${priceStr}</div>`
                            + `<div class="old-price" data-catalog-old-price${oldHidden}>${oldStr}</div>`
                            + `</div></div>`
                            + bundleQuantityContainerHtml(bundleCount, membersForStep)
                            + `<div class="sets-container">${setsInner}</div>`
                            + `</div>`,
                        );
                        return;
                    }
                    if (row.kind === 'good_line') {
                        const gid = Math.max(0, Number(row.good_id || 0));
                        const q = Math.max(0, Number(row.quantity || 0));
                        if (gid <= 0 || q <= 0) {
                            return;
                        }
                        const { base, unit } = rubUnitBase(gid);
                        const unitRub = unit != null ? unit : base;
                        let name = (row.name && String(row.name).trim()) || '';
                        const gCard = goods[String(gid)] || goods[gid] || {};
                        if (!name) {
                            name = (gCard.name && String(gCard.name).trim()) || `Товар #${gid}`;
                        }
                        const article = (row.article && String(row.article).trim())
                            || (gCard.article && String(gCard.article).trim()) || '';
                        const photo = (row.photo_url && String(row.photo_url).trim())
                            || (gCard.photo_url && String(gCard.photo_url).trim()) || '';
                        const rub = unitRub != null ? this.formatPrice(unitRub) : '—';
                        const rubOld = base != null ? this.formatPrice(base) : rub;
                        const cartQty = Math.max(0, Number(itemMap.get(gid) || 0));
                        const isFullBasketLine = cartQty > 0 && q === cartQty;
                        const promoQtyAttr = isFullBasketLine
                            ? ''
                            : ` data-basket-assembly-promo-qty="${q}"`;
                        const basketItemAttr = isFullBasketLine ? ' data-basket-item' : '';
                        const unitAttr = unitRub != null ? ` data-basket-unit-price="${Math.round(unitRub)}"` : '';
                        chunks.push(
                            `<div class="cart-item" data-basket-assembly-row data-basket-assembly="good_line" data-basket-assembly-good-id="${gid}" data-catalog-price-root data-catalog-good-id="${gid}" data-catalog-price-state="base"${basketItemAttr}${promoQtyAttr}${unitAttr}>`
                            + `${cartImageHtml(photo, name)}`
                            + `<div class="cart-main">`
                            + `<div class="cart-name">`
                            + `<div class="cart-name-title">${escHtml(name)}</div>`
                            + (article ? `<div class="cart-name-article">${escHtml(article)}</div>` : '')
                            + `</div>`
                            + `<div class="cart-price">`
                            + `<div class="price">${rub}</div>`
                            + `<div class="old-price" data-catalog-old-price hidden>${rubOld}</div>`
                            + `</div></div>`
                            + assemblyQuantityContainerHtml(q, gid, {
                                removeClearsProduct: true,
                                stepperWithBasket: isFullBasketLine,
                                stepperWithDeltas: !isFullBasketLine,
                            })
                            + `</div>`,
                        );
                    }
                });
                insertAssemblyHtml(chunks.join(''));
                void BasketDom.rescanBasketPluginsInList(list).catch(() => {});
                return;
            }

            if (items.length === 0) {
                return;
            }
            const fb = [];
            items.forEach((it) => {
                const gid = Math.max(0, Number(it?.id || 0));
                const q = Math.max(0, Number(it?.quantity || 0));
                if (gid <= 0 || q <= 0) {
                    return;
                }
                const gCard = goods[String(gid)] || goods[gid] || {};
                const name = (gCard.name && String(gCard.name).trim()) || `Товар #${gid}`;
                const article = (gCard.article && String(gCard.article).trim()) || '';
                const photo = (gCard.photo_url && String(gCard.photo_url).trim()) || '';
                const { base, unit } = rubUnitBase(gid);
                const unitRub = unit != null ? unit : base;
                const rub = unitRub != null ? this.formatPrice(unitRub) : '—';
                const rubOld = base != null ? this.formatPrice(base) : rub;
                const unitAttr = unitRub != null ? ` data-basket-unit-price="${Math.round(unitRub)}"` : '';
                fb.push(
                    `<div class="cart-item" data-basket-item data-catalog-price-root data-catalog-good-id="${gid}" data-catalog-price-state="base"${unitAttr}>`
                    + `${cartImageHtml(photo, name)}`
                    + `<div class="cart-main">`
                    + `<div class="cart-name">`
                    + `<div class="cart-name-title">${escHtml(name)}</div>`
                    + (article ? `<div class="cart-name-article">${escHtml(article)}</div>` : '')
                    + `</div>`
                    + `<div class="cart-price">`
                    + `<div class="price">${rub}</div>`
                    + `<div class="old-price" data-catalog-old-price hidden>${rubOld}</div>`
                    + `</div></div>`
                    + assemblyQuantityContainerHtml(q, gid, { removeClearsProduct: true, stepperWithBasket: true })
                    + `</div>`,
                );
            });
            insertHtmlBeforeClear(fb.join(''));
            void BasketDom.rescanBasketPluginsInList(list).catch(() => {});
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
            BasketState.lastPromoByGoodId = (promo && typeof promo === 'object') ? promo : {};
            const ba = data.basket_assembly;
            BasketState.lastBasketAssemblyGoods = (ba && typeof ba === 'object' && ba.goods && typeof ba.goods === 'object')
                ? ba.goods
                : null;
            BasketDom.updateDynamicCartTextSummary(data);
            if (promo && typeof promo === 'object') {
                BasketDom.applyCatalogPriceStates(promo);
            }
            BasketDom.syncBasketAvailabilityFromPayload(data);
            requestAnimationFrame(() => {
                BasketDom.updateDynamicCartTextSummary(data);
                if (promo && typeof promo === 'object') {
                    BasketDom.applyCatalogPriceStates(promo);
                }
                BasketDom.syncBasketAvailabilityFromPayload(data);
            });
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
                const hm = num(st.hint_mincount);
                const hp = num(st.hint_discount_pct);
                const isSingle =
                    Object.prototype.hasOwnProperty.call(st, 'action_is_single') && Number(st.action_is_single) === 1;
                const asmQtyRaw = node.getAttribute('data-basket-assembly-promo-qty');
                const qtyAsm = asmQtyRaw != null && asmQtyRaw !== '' ? num(asmQtyRaw) : null;
                const qty = qtyAsm != null ? qtyAsm : num(st.quantity);
                const belowPromoMin = isSingle && hm != null && hm > 1 && qty != null && qty < hm;
                try {
                node.setAttribute('data-catalog-price-mode', mode);
                node.setAttribute('data-catalog-price-state', state);
                const line = node.querySelector('[data-catalog-promo-line]');
                const oldEl = node.querySelector('[data-catalog-old-price]');
                const priceEl = node.querySelector('.cart-price .price, .price-main .price');
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
                    const basketRow = node.closest('[data-basket-item]')
                        || node.closest('[data-basket-assembly-row][data-basket-assembly="good_line"]');
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

            const num = (v) => {
                if (v == null || v === '') {
                    return null;
                }
                const n = Number(v);
                return Number.isNaN(n) ? null : n;
            };
            const effectiveUnitRub = (st, lineQty) => {
                if (!st || typeof st !== 'object') {
                    return 0;
                }
                const b = num(st.base);
                const u = num(st.unit);
                const qty = num(st.quantity);
                const hm = num(st.hint_mincount);
                const hp = num(st.hint_discount_pct);
                const isSingle = Object.prototype.hasOwnProperty.call(st, 'action_is_single')
                    && Number(st.action_is_single) === 1;
                const belowPromoMin = isSingle && hm != null && hm > 1 && qty != null && lineQty != null && lineQty < hm;
                if (belowPromoMin && b != null) {
                    return Math.max(0, b);
                }
                if (u != null) {
                    return Math.max(0, u);
                }
                if (b != null) {
                    return Math.max(0, b);
                }
                return 0;
            };

            const itemMap = new Map();
            (Array.isArray(items) ? items : []).forEach((it) => {
                const id = Math.max(0, Number(it?.id || 0));
                const quantity = Math.max(0, Number(it?.quantity || 0));
                if (id > 0) {
                    itemMap.set(id, quantity);
                }
            });

            const promo = BasketState.lastPromoByGoodId || {};
            let totalQuantity = 0;
            let totalAmount = 0;
            itemMap.forEach((quantity, id) => {
                if (quantity <= 0) {
                    return;
                }
                totalQuantity += quantity;
                const st = promo[String(id)] ?? promo[id];
                const unitRub = effectiveUnitRub(st, quantity);
                totalAmount += quantity * unitRub;
            });

            if (totalQtyNode) {
                totalQtyNode.textContent = String(totalQuantity);
            }
            if (totalAmountNode) {
                totalAmountNode.textContent = this.formatPrice(totalAmount);
            }

            document.querySelectorAll('.cart-container .cart-list [data-basket-item]').forEach((row) => {
                const idFromCtrl = row.querySelector('[data-basket-product-id]')?.getAttribute('data-basket-product-id');
                const id = Math.max(0, Number(row.getAttribute('data-basket-product-id') || idFromCtrl || 0));
                const quantity = Math.max(0, Number(itemMap.get(id) || 0));
                if (id <= 0 || quantity <= 0) {
                    row.remove();
                }
            });

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
        /** Последняя карта promo для расчёта «Итого» без обхода только .cart-price */
        lastPromoByGoodId: {},
        /** basket_assembly.goods для удаления отсутствующих (stat_available = 0) */
        lastBasketAssemblyGoods: null,
        loaded: false,
        loadingPromise: null,
        /** Серверная метка корзины для jsapi/checkbasketmodify */
        syncAt: '1970-01-01 00:00:00',
        lineCountSnapshot: 0,
        modifyPollTimer: null,
        /** Время последнего тика опроса (для немедленной проверки после возврата на вкладку) */
        modifyPollLastTickAt: null,
        modifyPollVisibilityBound: false,

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
                    if (document.querySelector('.empty-cart') && Math.max(0, +pollData?.basket_line_count | 0) > 0) return void location.reload();
                    if (pollData) {
                        BasketDom.applyBasketClientPayload(pollData);
                    }
                    return this.refreshBasketFromServer().then(() => {
                        this.startModifyPolling();
                    });
                });
        },

        startModifyPollingInterval() {
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
            const list = document.querySelector('.cart-container .cart-list[data-basket-dynamic-lines]');
            if (list) {
                void BasketDom.rescanBasketPluginsInList(list).catch(() => {});
            }
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

