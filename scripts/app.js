class Product {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.price = data.price;
        this.image = data.image;
        this.points = data.points;
        this.isHit = data.isHit || false;
        this.isAction = data.isAction || false;
        this.isNew = data.isNew || false;
        this.hasGift = data.hasGift || false;
        this.category = data.category;
        this.url = data.url;
    }

    get formattedPrice() {
        return `${this.price.toLocaleString()}₽`;
    }

    get markers() {
        const markers = [];
        if (this.isHit) markers.push('hit');
        if (this.isAction) markers.push('action');
        if (this.isNew) markers.push('new');
        return markers;
    }
}

class FavoriteManager {
    constructor(storageKey = 'favorites') {
        this.storageKey = storageKey;
        this.favorites = [];
        this.observers = [];
        this.initialized = false;
    }

    async init() {
        try {
            const response = await fetch('/basket-favorites.json');
            const data = await response.json();

            if (data.favorites && Array.isArray(data.favorites)) {
                this.favorites = data.favorites;
            } else {
                this.favorites = this.loadFromCache();
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
            this.favorites = this.loadFromCache();
        }

        this.initialized = true;
        this.notifyObservers();
        return this.favorites;
    }

    loadFromCache() {
        return JSON.parse(localStorage.getItem(this.storageKey)) || [];
    }

    saveToCache() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.favorites));
    }

    add(productId) {
        if (!this.favorites.includes(productId)) {
            this.favorites.push(productId);
            this.saveToCache();
            this.notifyObservers();
            return true;
        }
        return false;
    }

    remove(productId) {
        const index = this.favorites.indexOf(productId);
        if (index > -1) {
            this.favorites.splice(index, 1);
            this.saveToCache();
            this.notifyObservers();
            return true;
        }
        return false;
    }

    toggle(productId) {
        return this.favorites.includes(productId) ? this.remove(productId) : this.add(productId);
    }

    isFavorite(productId) {
        return this.favorites.includes(productId);
    }

    get count() {
        return this.favorites.length;
    }

    subscribe(callback) {
        this.observers.push(callback);
        if (this.initialized) {
            callback(this.favorites);
        }
    }

    notifyObservers() {
        this.observers.forEach(callback => callback(this.favorites));
    }
}

class CartItem {
    constructor(product, quantity = 1) {
        this.id = product.id;
        this.name = product.name;
        this.price = product.price;
        this.image = product.image;
        this.points = product.points;
        this.hasGift = product.hasGift;
        this.quantity = quantity;
        this.addedAt = new Date().toISOString();
    }

    get totalPrice() {
        return this.price * this.quantity;
    }

    get totalPoints() {
        return this.points * this.quantity;
    }

    increment(amount = 1) {
        this.quantity += amount;
        return this.quantity;
    }

    decrement(amount = 1) {
        this.quantity = Math.max(1, this.quantity - amount);
        return this.quantity;
    }
}

class CartManager {
    constructor(storageKey = 'cart') {
        this.storageKey = storageKey;
        this.items = [];
        this.observers = [];
        this.initialized = false;
    }

    async init() {
        try {
            const response = await fetch('/basket-favorites.json');
            const data = await response.json();

            if (data.cart && Array.isArray(data.cart)) {
                this.items = data.cart;
            } else {
                this.items = this.loadFromCache();
            }
        } catch (error) {
            console.error('Error loading cart:', error);
            this.items = this.loadFromCache();
        }

        this.initialized = true;
        this.notifyObservers();
        return this.items;
    }

    loadFromCache() {
        return JSON.parse(localStorage.getItem(this.storageKey)) || [];
    }

    saveToCache() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    }

    add(product, quantity = 1) {
        const existingItem = this.items.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push(new CartItem(product, quantity));
        }
        this.saveToCache();
        this.notifyObservers();
        return this.getItem(product.id);
    }

    remove(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.saveToCache();
        this.notifyObservers();
    }

    updateQuantity(productId, quantity) {
        const item = this.items.find(item => item.id === productId);
        if (item) {
            item.quantity = Math.max(1, quantity);
            this.saveToCache();
            this.notifyObservers();
            return item;
        }
        return null;
    }

    getItem(productId) {
        return this.items.find(item => item.id === productId);
    }

    get totalItems() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    get totalPrice() {
        return this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    }

    get totalPoints() {
        return this.items.reduce((sum, item) => sum + item.totalPoints, 0);
    }

    clear() {
        this.items = [];
        this.saveToCache();
        this.notifyObservers();
    }

    subscribe(callback) {
        this.observers.push(callback);
        if (this.initialized) {
            callback(this.items);
        }
    }

    notifyObservers() {
        this.observers.forEach(callback => callback(this.items));
    }
}

class ProductCard {
    constructor(product, favoriteManager, cartManager) {
        this.product = product;
        this.favoriteManager = favoriteManager;
        this.cartManager = cartManager;
        this.element = this.createElement();
        this.attachEventListeners();
    }

    createElement() {
        const card = document.createElement('a');
        card.className = 'card';
        card.setAttribute('data-product-id', this.product.id);
        card.href = this.product.url;
        card.innerHTML = this.getTemplate();
        return card;
    }

    getTemplate() {
        const isFavorite = this.favoriteManager.isFavorite(this.product.id);
        const cartItem = this.cartManager.getItem(this.product.id);
        const quantity = cartItem ? cartItem.quantity : 0;

        return `
            <div class="card-info">
                <div class="card-image-container">
                    ${this.getMarkersHTML()}
                   <div class="container-click">
                    <div class="like ${isFavorite ? 'filled' : ''}">
                        ${this.getLikeIcon(isFavorite)}
                    </div>
                    <div class="copy">
                        ${this.getCopyIcon()}
                    </div>
</div>
                    ${this.getGiftHTML()}
                    <img class="card-image" src="${this.product.image}" alt="${this.product.name}">
                </div>
                <div class="card-title">
                    ${this.product.name}
                </div>
                <div class="price-container">
                    <div class="price">${this.product.formattedPrice}</div>
                    <div class="points">${this.product.points} баллов</div>
                </div>
            </div>
            <div class="buttonDark cart-control ${quantity > 0 ? 'filled' : ''}">
                <div class="cart-control-inner">
                    <button class="cart-minus">
                        <svg xmlns="http://www.w3.org/2000/svg" width="23" height="4" viewBox="0 0 23 4" fill="none">
                            <path d="M0 4V0H23V4H0Z" fill="#3834DA"/>
                        </svg>
                    </button>
                    <span class="cart-quantity">${quantity || 1}</span>
                    <button class="cart-plus">
                        <svg xmlns="http://www.w3.org/2000/svg" width="23" height="22" viewBox="0 0 23 22" fill="none">
                            <path d="M9.2342 22V13.1617H0V8.81704H9.2342V0H13.7658V8.81704H23V13.1617H13.7658V22H9.2342Z" fill="#3834DA"/>
                        </svg>
                    </button>
                    <span class="cart-text" style="${quantity > 0 ? 'display: none;' : ''}">Добавить в корзину</span>
                </div>
            </div>
        `;
    }

    getMarkersHTML() {
        const markers = [];
        if (this.product.isHit) markers.push('<div class="special-offers special-offers-hit">Хит продаж</div>');
        if (this.product.isAction) markers.push('<div class="special-offers special-offers-action">Акция</div>');
        if (this.product.isNew) markers.push('<div class="special-offers special-offers-news">Новинка</div>');

        if (markers.length === 0) return '';

        return `
        <div class="markers-container">
            ${markers.join('')}
        </div>
    `;
    }

    getLikeIcon(isFavorite) {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="23" viewBox="0 0 25 23" fill="none">
                <path d="M2.2832 3.1134C3.83154 0.924326 6.83105 0.346033 9.08203 1.80286L12.4639 3.99133L15.8887 1.79407C18.1498 0.342953 21.1546 0.937966 22.6914 3.14172L23.0391 3.64172C24.326 5.48744 24.2219 7.96558 22.7842 9.69641L13.2314 21.1954C13.0415 21.4241 12.7592 21.5568 12.4619 21.5568C12.1646 21.5568 11.8824 21.4241 11.6924 21.1954L2.15332 9.71204C0.707824 7.97159 0.611484 5.47714 1.91797 3.63L2.2832 3.1134Z" 
                stroke="${isFavorite ? '#3834DA' : '#121212'}" 
                fill="${isFavorite ? '#3834DA' : 'none'}"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }

    getCopyIcon() {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M16.1367 0.00878906C16.9665 0.0930939 17.6141 0.793517 17.6143 1.64551V3.4043H19.2715C20.7326 3.4043 21.9178 4.5887 21.918 6.0498V19.2734C21.9179 20.7347 20.7327 21.9189 19.2715 21.9189H6.0498C4.58872 21.9187 3.40433 20.7346 3.4043 19.2734V17.6162H1.64551L1.47754 17.6074C0.647623 17.5231 0 16.8219 0 15.9697V1.64551C0.000201142 0.736808 0.736808 0.000202235 1.64551 0H15.9688L16.1367 0.00878906ZM17.6143 15.9697C17.6143 16.8219 16.9666 17.5231 16.1367 17.6074L15.9688 17.6162H5.4043V19.2734C5.40433 19.63 5.69329 19.9187 6.0498 19.9189H19.2715C19.6282 19.9189 19.9179 19.6301 19.918 19.2734V6.0498C19.9178 5.69327 19.6281 5.4043 19.2715 5.4043H17.6152L17.6143 5.40332V15.9697ZM2 15.6162H15.6143V2H2V15.6162Z" fill="#121212"/>
            </svg>
        `;
    }

    getGiftHTML() {
        if (!this.product.hasGift) return '';
        return `
            <div class="present">
                <svg width="252" height="138" viewBox="0 0 252 138" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M178.018 234.112C214.448 234.112 220.183 183.413 218.496 158.064C254.758 166.795 329.979 175.639 340.773 141.164C351.567 106.688 288.489 91.3097 255.601 87.9298C271.342 74.6916 297.259 40.9485 274.997 11.881C252.734 -17.1866 228.053 13.8526 218.496 33.0056C215.966 25.6824 204.329 10.529 178.018 8.50102C151.708 6.47305 137.259 45.9621 133.324 65.9601C122.924 53.0037 95.5449 32.1607 69.2343 52.4403C42.9237 72.72 72.3263 96.943 90.3165 106.519C55.1795 118.631 -11.7214 149.614 1.77126 176.653C15.2639 203.693 68.6721 180.597 93.6896 165.669C59.9581 220.424 66.7044 247.632 74.294 254.392C104.652 276.7 140.352 237.211 154.406 214.678C160.478 228.197 172.678 233.267 178.018 234.112Z" fill="#FDCF01"/>
                </svg>
                <div class="present-text">Подарок за покупку</div>
            </div>
        `;
    }

    attachEventListeners() {
        const likeBtn = this.element.querySelector('.like');
        const copyBtn = this.element.querySelector('.copy');
        const cartControl = this.element.querySelector('.cart-control');
        const minusBtn = this.element.querySelector('.cart-minus');
        const plusBtn = this.element.querySelector('.cart-plus');

        likeBtn.addEventListener('click', (e) => this.handleLike(e));
        copyBtn.addEventListener('click', (e) => this.handleCopy(e));
        cartControl.addEventListener('click', (e) => this.handleCartMainClick(e));
        minusBtn.addEventListener('click', (e) => this.handleQuantityChange(e, -1));
        plusBtn.addEventListener('click', (e) => this.handleQuantityChange(e, 1));
    }

    handleLike(e) {
        e.preventDefault();
        e.stopPropagation();
        this.favoriteManager.toggle(this.product.id);
        this.element.querySelector('.like').classList.toggle('filled');
    }

    handleCopy(e) {
        e.preventDefault();
        e.stopPropagation();

        const url = window.location.origin + this.product.url;
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('Ссылка скопирована');
        }).catch(() => {
            this.showNotification('Ошибка при копировании');
        });
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    handleCartMainClick(e) {
        if (e.target.classList.contains('cart-minus') || e.target.classList.contains('cart-plus')) return;
        e.preventDefault();
        e.stopPropagation();
        const cartItem = this.cartManager.add(this.product);
        this.updateCartUI(cartItem.quantity);
    }

    handleQuantityChange(e, delta) {
        e.preventDefault();
        e.stopPropagation();
        const quantityElement = this.element.querySelector('.cart-quantity');
        let currentQuantity = parseInt(quantityElement.textContent);

        if (delta > 0) {
            currentQuantity++;
            const updatedItem = this.cartManager.updateQuantity(this.product.id, currentQuantity);
            if (updatedItem) this.updateCartUI(updatedItem.quantity);
        } else {
            if (currentQuantity > 1) {
                currentQuantity--;
                const updatedItem = this.cartManager.updateQuantity(this.product.id, currentQuantity);
                if (updatedItem) this.updateCartUI(updatedItem.quantity);
            } else {
                this.cartManager.remove(this.product.id);
                this.updateCartUI(0);
            }
        }
    }

    updateCartUI(quantity) {
        const cartControl = this.element.querySelector('.cart-control');
        const quantityElement = this.element.querySelector('.cart-quantity');
        const cartText = this.element.querySelector('.cart-text');

        if (quantity > 0) {
            cartControl.classList.add('filled');
            quantityElement.textContent = quantity;
            cartText.style.display = 'none';
        } else {
            cartControl.classList.remove('filled');
            quantityElement.textContent = '1';
            cartText.style.display = 'block';
        }
    }
}

class CounterManager {
    constructor(favoriteManager, cartManager) {
        this.favoriteManager = favoriteManager;
        this.cartManager = cartManager;
        this.favoriteCounter = document.querySelector('.favorite-counter');
        this.cartCounter = document.querySelector('.cart-counter');
        this.cartIcon = document.querySelector('.cart-icon');
        this.init();
    }

    init() {
        this.favoriteManager.subscribe(() => this.updateFavoriteCounter());
        this.cartManager.subscribe(() => {
            this.updateCartCounter();
            this.updateCartIconState();
        });
        this.updateFavoriteCounter();
        this.updateCartCounter();
        this.updateCartIconState();
    }

    updateFavoriteCounter() {
        if (this.favoriteCounter) {
            const count = this.favoriteManager.count;
            this.favoriteCounter.textContent = count;
            this.favoriteCounter.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    updateCartCounter() {
        if (this.cartCounter) {
            const totalItems = this.cartManager.totalItems;
            this.cartCounter.textContent = totalItems;
            this.cartCounter.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    }

    updateCartIconState() {
        if (this.cartIcon) {
            if (this.cartManager.totalItems > 0) {
                this.cartIcon.classList.add('filled');
            } else {
                this.cartIcon.classList.remove('filled');
            }
        }
    }
}

class CatalogUI {
    constructor(products, favoriteManager, cartManager) {
        this.products = products.map(p => new Product(p));
        this.filteredProducts = [...this.products];
        this.favoriteManager = favoriteManager;
        this.cartManager = cartManager;
        this.cardContainer = document.querySelector('.card-container');

        this.activeCategory = 'all';

        this.filters = {
            isAction: false,
            isHit: false,
            isNew: false
        };

        this.init();
        this.initTabs();
    }

    init() {
        this.renderProducts();
    }

    initTabs() {
        const tabs = document.querySelectorAll('input[name="tabs"]');

        tabs.forEach(tab => {
            tab.addEventListener('change', (e) => {
                const tabId = e.target.id;

                switch(tabId) {
                    case 'tab1':
                        this.activeCategory = 'all';
                        break;
                    case 'tab2':
                        this.activeCategory = 'protein';
                        break;
                    case 'tab3':
                        this.activeCategory = 'nutraceuticals';
                        break;
                    case 'tab4':
                        this.activeCategory = 'sets';
                        break;
                    case 'tab5':
                        this.activeCategory = 'accessories';
                        break;
                    default:
                        this.activeCategory = 'all';
                }

                this.applyFilters();
            });
        });
    }

    applyFilters() {
        let filtered = this.products;

        if (this.activeCategory !== 'all') {
            filtered = filtered.filter(product => product.category === this.activeCategory);
        }

        this.filteredProducts = filtered;
        this.renderProducts();
        this.showNoResultsMessage();
    }

    renderProducts() {
        if (!this.cardContainer) return;
        this.cardContainer.innerHTML = '';

        this.filteredProducts.forEach(product => {
            const card = new ProductCard(product, this.favoriteManager, this.cartManager);
            this.cardContainer.appendChild(card.element);
        });
    }

    showNoResultsMessage() {
        const existingMessage = document.querySelector('.no-results-message');

        if (this.filteredProducts.length === 0) {
            if (!existingMessage) {
                const message = document.createElement('div');
                message.className = 'no-results-message';
                message.textContent = 'По вашему запросу ничего не найдено';
                this.cardContainer.appendChild(message);
            }
        } else {
            if (existingMessage) {
                existingMessage.remove();
            }
        }
    }
}

class HitsSection {
    constructor(products, favoriteManager, cartManager) {
        this.products = products.map(p => new Product(p));
        this.favoriteManager = favoriteManager;
        this.cartManager = cartManager;
        this.container = document.getElementById('hits-container');
        this.hitsCount = 3;
        this.init();
    }

    init() {
        if (!this.container) return;
        const hitProducts = this.getHitProducts();
        this.renderHits(hitProducts);
    }

    getHitProducts() {
        return this.products.filter(product => product.isHit).slice(0, this.hitsCount);
    }

    renderHits(hitProducts) {
        this.container.innerHTML = '';
        hitProducts.forEach(product => {
            const card = new ProductCard(product, this.favoriteManager, this.cartManager);
            this.container.appendChild(card.element);
        });
        this.addMobileCatalogButton();
    }

    addMobileCatalogButton() {
        const mobileButton = document.createElement('div');
        mobileButton.className = 'buttonOpacity only-mobile';
        mobileButton.textContent = 'Смотреть весь каталог';
        mobileButton.addEventListener('click', () => window.location.href = '/catalog');
        this.container.appendChild(mobileButton);
    }
}

async function initializeApp() {
    if (typeof mockProducts === 'undefined') return;

    const favoriteManager = new FavoriteManager();
    const cartManager = new CartManager();

    await Promise.all([
        favoriteManager.init(),
        cartManager.init()
    ]);

    new CounterManager(favoriteManager, cartManager);

    if (document.querySelector('.card-container')) {
        new CatalogUI(mockProducts, favoriteManager, cartManager);
    }

    if (document.getElementById('hits-container')) {
        new HitsSection(mockProducts, favoriteManager, cartManager);
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);