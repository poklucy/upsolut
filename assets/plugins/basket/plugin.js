(function () {
    'use strict';

    const BasketDom = {
        initialized: false,

        init() {
            if (this.initialized) return;
            this.initialized = true;

            document.addEventListener('click', (e) => {
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

        formatPrice(value) {
            return `${Math.round(Math.max(0, Number(value) || 0)).toLocaleString('ru-RU')} ₽`;
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
            const freeShipRemainder = document.querySelector('[data-basket-free-ship-remainder]');
            if (freeShipThreshold > 0 && freeShipStatus && freeShipRemainder) {
                if (totalAmount >= freeShipThreshold) {
                    freeShipStatus.style.display = 'none';
                } else {
                    freeShipStatus.style.display = '';
                    const remainder = Math.ceil(Math.max(0, freeShipThreshold - totalAmount));
                    freeShipRemainder.textContent = this.formatPrice(remainder);
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

        async api(payload) {
            const response = await window.ApiService.post('basket', payload);
            if (!response || response.status !== 'success') {
                throw new Error(response?.error || 'Basket API error');
            }
            return response.data || {};
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
                const data = await this.api({ action: 'get' });
                this.items = this.normalizeItems(data.items || []);
                this.loaded = true;
                this.dispatch();
                return this.items;
            })().finally(() => {
                this.loadingPromise = null;
            });
            return this.loadingPromise;
        },

        async setItem(productId, quantity) {
            await this.ensureLoaded();
            const data = await this.api({
                action: 'set',
                product_id: Number(productId) || 0,
                quantity: Math.max(0, Number(quantity) || 0)
            });
            this.items = this.normalizeItems(data.items || []);
            this.dispatch();
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

