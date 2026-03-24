document.addEventListener('DOMContentLoaded', function() {
    const heartIcons = document.querySelectorAll('.card .like svg');
    const favoriteCounter = document.querySelector('.favorite-counter');
    const cartButtons = document.querySelectorAll('.cart-control');
    const cartCounter = document.querySelector('.cart-counter');
    const cartIcon = document.querySelector('.cart-icon');

    let favoritesCount = 0;
    let cartCount = 0;

    const savedFavorites = JSON.parse(localStorage.getItem('favorites')) || [];
    favoritesCount = savedFavorites.length;

    const savedCart = JSON.parse(localStorage.getItem('cart')) || [];
    cartCount = savedCart.reduce((total, item) => total + item.quantity, 0);

    updateFavoriteCounter();
    updateCartCounter();
    updateCartIconState();

    savedFavorites.forEach(productId => {
        const heartIcon = document.querySelector(`[data-product-id="${productId}"] .like`);
        if (heartIcon) {
            fillHeart(heartIcon);
        }
    });

    savedCart.forEach(item => {
        const cartButton = document.querySelector(`[data-product-id="${item.id}"] .cart-control`);
        if (cartButton) {
            updateCartButtonState(cartButton, item.quantity);
        }
    });

    heartIcons.forEach(icon => {
        icon.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const likeContainer = this.closest('.like');
            const card = likeContainer.closest('.card');
            const productId = card.dataset.productId;

            const isFilled = likeContainer.classList.contains('filled');

            if (isFilled) {
                removeFromFavorites(productId, likeContainer);
                favoritesCount--;
            } else {
                addToFavorites(productId, likeContainer);
                favoritesCount++;
            }

            saveFavoritesToLocalStorage();
            updateFavoriteCounter();
        });
    });

    cartButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (e.target.classList.contains('cart-minus') ||
                e.target.classList.contains('cart-plus')) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const card = this.closest('.card');
            const productId = card.dataset.productId;
            const productName = card.querySelector('.card-title').textContent.trim();
            const productPrice = card.querySelector('.price').textContent.trim();
            const productImage = card.querySelector('.card-image').src;

            const presentElement = card.querySelector('.present');
            const hasGift = presentElement && window.getComputedStyle(presentElement).display !== 'none';

            const cartItem = addToCart(productId, productName, productPrice, productImage, hasGift);

            updateCartButtonState(this, cartItem.quantity);

            updateCartCounter();
            updateCartIconState();
        });

        const minusBtn = button.querySelector('.cart-minus');
        const plusBtn = button.querySelector('.cart-plus');

        minusBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const card = this.closest('.card');
            const productId = card.dataset.productId;
            const quantityElement = this.nextElementSibling;
            let currentQuantity = parseInt(quantityElement.textContent);

            if (currentQuantity > 1) {
                currentQuantity--;
                quantityElement.textContent = currentQuantity;

                updateCartItemQuantity(productId, currentQuantity);

                if (currentQuantity === 1) {
                    const cartButton = this.closest('.cart-control');
                    updateCartButtonState(cartButton, currentQuantity);
                }
            } else {
                removeFromCart(productId);

                const cartButton = this.closest('.cart-control');
                cartButton.classList.remove('filled');
                cartButton.querySelector('.cart-text').style.display = 'block';
            }

            updateCartCounter();
            updateCartIconState();
        });

        plusBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const card = this.closest('.card');
            const productId = card.dataset.productId;
            const quantityElement = this.previousElementSibling;
            let currentQuantity = parseInt(quantityElement.textContent);

            currentQuantity++;
            quantityElement.textContent = currentQuantity;

            updateCartItemQuantity(productId, currentQuantity);

            updateCartCounter();
            updateCartIconState();
        });
    });

    function fillHeart(likeContainer) {
        likeContainer.classList.add('filled');
    }

    function unfillHeart(likeContainer) {
        likeContainer.classList.remove('filled');
    }

    function addToFavorites(productId, likeContainer) {
        fillHeart(likeContainer);
    }

    function removeFromFavorites(productId, likeContainer) {
        unfillHeart(likeContainer);
    }

    function updateFavoriteCounter() {
        if (favoriteCounter) {
            favoriteCounter.textContent = favoritesCount;
            favoriteCounter.style.display = favoritesCount > 0 ? 'flex' : 'none';

            if (favoritesCount > 0) {
                document.body.classList.add('has-favorites');
            } else {
                document.body.classList.remove('has-favorites');
            }
        }
    }

    function saveFavoritesToLocalStorage() {
        const favoriteIds = [];
        document.querySelectorAll('.card .like.filled').forEach(like => {
            const card = like.closest('.card');
            const productId = card.dataset.productId;
            favoriteIds.push(productId);
        });
        localStorage.setItem('favorites', JSON.stringify(favoriteIds));
    }

    function addToCart(id, name, price, image, hasGift = false) {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];

        const existingItemIndex = cart.findIndex(item => item.id === id);

        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += 1;
        } else {
            const product = {
                id: id,
                name: name,
                price: price,
                image: image,
                quantity: 1,
                hasGift: hasGift,
                date: new Date().toISOString()
            };
            cart.push(product);
        }

        localStorage.setItem('cart', JSON.stringify(cart));
        return cart.find(item => item.id === id) || cart[cart.length - 1];
    }

    function updateCartItemQuantity(productId, quantity) {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        const existingItemIndex = cart.findIndex(item => item.id === productId);

        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity = quantity;
            localStorage.setItem('cart', JSON.stringify(cart));
        }
    }

    function updateCartButtonState(button, quantity) {
        const quantityElement = button.querySelector('.cart-quantity');
        const cartText = button.querySelector('.cart-text');

        if (quantity > 0) {
            button.classList.add('filled');
            quantityElement.textContent = quantity;
            cartText.style.display = 'none';
        } else {
            button.classList.remove('filled');
            quantityElement.textContent = '1';
            cartText.style.display = 'block';
        }
    }

    function updateCartCounter() {
        if (cartCounter) {
            const cart = JSON.parse(localStorage.getItem('cart')) || [];

            let totalItems = 0;
            cart.forEach(item => {
                totalItems += item.quantity;
            });

            cartCount = totalItems;
            cartCounter.textContent = cartCount;
            cartCounter.style.display = cartCount > 0 ? 'flex' : 'none';

            if (cartCount > 0) {
                cartIcon.classList.add('has-items');
            } else {
                cartIcon.classList.remove('has-items');
            }
        }
    }

    function updateCartIconState() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];

        if (cartIcon) {
            if (cart.length > 0) {
                cartIcon.classList.add('filled');
            } else {
                cartIcon.classList.remove('filled');
            }
        }
    }

    function removeFromCart(productId) {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cart = cart.filter(item => item.id !== productId);
        localStorage.setItem('cart', JSON.stringify(cart));

        const cartButton = document.querySelector(`[data-product-id="${productId}"] .cart-control`);
        if (cartButton) {
            updateCartButtonState(cartButton, 0);
        }

        updateCartCounter();
        updateCartIconState();
    }

    window.cartUtils = {
        addToCart,
        removeFromCart,
        updateCartCounter,
        updateCartButton: updateCartButtonState,
        updateCartIconState,
        getCart: () => JSON.parse(localStorage.getItem('cart')) || []
    };
});