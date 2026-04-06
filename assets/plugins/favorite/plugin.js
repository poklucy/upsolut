(function () {
    'use strict';

    const FavoriteState = {
        ids: new Set(),
        loaded: false,
        loadingPromise: null,

        async api(payload) {
            const response = await window.ApiService.post('favorite', payload);
            if (!response || response.status !== 'success') {
                throw new Error(response?.error || 'Favorite API error');
            }
            return response.data || {};
        },

        normalizeIds(raw) {
            const list = Array.isArray(raw) ? raw : [];
            const out = new Set();
            list.forEach((id) => {
                const n = Math.max(0, Number(id) || 0);
                if (n > 0) out.add(n);
            });
            return out;
        },

        dispatch() {
            this.updateGlobalCounters();
            this.syncAllLikes();
            document.dispatchEvent(new CustomEvent('favorite:updated', { detail: { ids: [...this.ids] } }));
        },

        updateGlobalCounters() {
            const n = this.ids.size;
            const el = document.querySelector('.favorite-counter');
            if (el) {
                el.textContent = String(n);
                el.style.display = n > 0 ? 'flex' : 'none';
            }
            const icon = document.querySelector('.favorite-icon');
            if (icon) {
                icon.classList.toggle('favorite-icon--active', n > 0);
            }
        },

        syncAllLikes() {
            document.querySelectorAll('.like[data-favorite-product-id]').forEach((node) => {
                const id = Math.max(0, Number(node.getAttribute('data-favorite-product-id') || 0));
                if (!id) return;
                node.classList.toggle('active', this.ids.has(id));
            });
        },

        async ensureLoaded() {
            if (this.loaded) return this.ids;
            if (this.loadingPromise) return this.loadingPromise;
            this.loadingPromise = (async () => {
                const data = await this.api({ action: 'get' });
                this.ids = this.normalizeIds(data.ids || []);
                this.loaded = true;
                this.dispatch();
                return this.ids;
            })().finally(() => {
                this.loadingPromise = null;
            });
            return this.loadingPromise;
        },

        async setInFavorite(productId, inFavorite) {
            await this.ensureLoaded();
            const data = await this.api({
                action: 'set',
                product_id: Number(productId) || 0,
                in_favorite: inFavorite ? 1 : 0
            });
            this.ids = this.normalizeIds(data.ids || []);
            this.dispatch();
            return this.ids;
        }
    };

    function onDocumentClick(e) {
        const like = e.target.closest('.like[data-favorite-product-id]');
        if (!like) return;
        e.preventDefault();
        e.stopPropagation();
        const productId = Math.max(0, Number(like.getAttribute('data-favorite-product-id') || 0));
        if (!productId) return;
        const next = !like.classList.contains('active');
        FavoriteState.setInFavorite(productId, next)
            .then(() => {
                if (typeof like.toaster === 'function') {
                    like.toaster(next ? 'Добавлено в избранное' : 'Удалено из избранного');
                }
            })
            .catch(() => {});
    }

    class FavoritePlugin {
        constructor(element) {
            this.element = element;
            this.onDocClick = onDocumentClick;
        }

        async init() {
            document.addEventListener('click', this.onDocClick, false);
            await FavoriteState.ensureLoaded();
            return this;
        }

        destroy() {
            document.removeEventListener('click', this.onDocClick, false);
        }
    }

    window.registerProjectPlugin('favorite', FavoritePlugin);
})();
