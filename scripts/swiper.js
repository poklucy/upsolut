document.addEventListener('DOMContentLoaded', function() {
    initializeSwipers();
});

function initializeSwipers() {
    initSwiperLot();
    initSwiperPost();
    initSwiperSpecial();
    initSwiperMore();
    initSwiperReviews();
    initSwiperTogether();
}

function createSwiper(selector, options) {
    const element = document.querySelector(selector);
    if (!element) return null;

    return new Swiper(selector, options);
}

function initSwiperLot() {
    const swiperLot = createSwiper('.lot-swiper', {
        slidesPerView: 1,
        spaceBetween: 0,
        loop: false,
        speed: 500,
        effect: 'slide',
        allowTouchMove: false,
        grabCursor: false,
        navigation: {
            nextEl: '.lot-swiper-container .swiper-button-next', // Уточняем селектор
            prevEl: '.lot-swiper-container .swiper-button-prev',
        },
    });

    if (!swiperLot) return;

    const previewItems = document.querySelectorAll('.preview-item');
    const previewColumn = document.querySelector('.preview-column');
    const prevBtn = document.querySelector('.swiper-button-prev');
    const nextBtn = document.querySelector('.swiper-button-next');
    const totalSlides = previewItems.length;

    const totalSlidesElement = document.getElementById('total-slides');
    if (totalSlidesElement) {
        totalSlidesElement.textContent = totalSlides;
    }

    // Функция для прокрутки превью к активному элементу (только внутри контейнера)
    function scrollToActivePreview(activeIndex) {
        if (!previewColumn) return;

        const activePreview = previewItems[activeIndex];
        if (!activePreview) return;

        // Вычисляем позицию активного элемента относительно контейнера
        const containerTop = previewColumn.scrollTop;
        const containerHeight = previewColumn.clientHeight;
        const previewTop = activePreview.offsetTop;
        const previewHeight = activePreview.offsetHeight;

        // Если элемент выше видимой области
        if (previewTop < containerTop) {
            previewColumn.scrollTo({
                top: previewTop - 10, // небольшой отступ сверху
                behavior: 'smooth'
            });
        }
        // Если элемент ниже видимой области
        else if (previewTop + previewHeight > containerTop + containerHeight) {
            previewColumn.scrollTo({
                top: previewTop + previewHeight - containerHeight + 10, // небольшой отступ снизу
                behavior: 'smooth'
            });
        }
    }

    function updateNavigationButtons() {
        if (!prevBtn || !nextBtn) return;

        prevBtn.classList.toggle('swiper-button-disabled', swiperLot.isBeginning);
        nextBtn.classList.toggle('swiper-button-disabled', swiperLot.isEnd);
    }

    function updateActivePreview(activeIndex) {
        previewItems.forEach((item, index) => {
            item.classList.toggle('active', index === activeIndex);
        });

        const currentSlideElement = document.getElementById('current-slide');
        if (currentSlideElement) {
            currentSlideElement.textContent = activeIndex + 1;
        }

        updateNavigationButtons();

        // Прокрутить превью к активному элементу
        scrollToActivePreview(activeIndex);
    }

    function initPreviewClickHandlers() {
        previewItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                swiperLot.slideTo(index);
                updateActivePreview(index);
            });
        });
    }

    function initKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            const isInputFocused = document.activeElement && (
                document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.isContentEditable
            );

            const isInsideModal = document.activeElement?.closest('.modal') !== null;

            const lotContainer = document.querySelector('.lot-swiper-container');
            const isLotVisible = lotContainer &&
                lotContainer.offsetParent !== null &&
                window.getComputedStyle(lotContainer).display !== 'none';

            if (isInputFocused || isInsideModal || !isLotVisible) return;

            const activeSwiperWithScroll = document.querySelector('.swiper-container.swiper-initialized:active');
            if (activeSwiperWithScroll && !activeSwiperWithScroll.closest('.lot-swiper-container')) {
                return;
            }

            if (e.key === 'ArrowLeft' && !swiperLot.isBeginning) {
                e.preventDefault();
                swiperLot.slidePrev();
            } else if (e.key === 'ArrowRight' && !swiperLot.isEnd) {
                e.preventDefault();
                swiperLot.slideNext();
            }
        });
    }

    function initResizeHandler() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                swiperLot.update();
                updateNavigationButtons();
                scrollToActivePreview(swiperLot.activeIndex);
            }, 250);
        });
    }

    initPreviewClickHandlers();
    initKeyboardNavigation();
    initResizeHandler();

    swiperLot.on('slideChange', function() {
        updateActivePreview(swiperLot.activeIndex);
    });

    updateActivePreview(0);
    updateNavigationButtons();
}

function initSwiperPost() {
    const swiperPost = createSwiper('.swiper-post', {
        slidesPerView: 1,
        spaceBetween: 10,
        allowTouchMove: true,
        grabCursor: true,
        scrollbar: {
            el: '.swiper-scrollbar',
            draggable: true,
            snapOnRelease: true
        },
        mousewheel: {
            forceToAxis: true,
            eventsTarget: 'container',
            sensitivity: 1,
            releaseOnEdges: true,
        },
        breakpoints: {
            769: {
                slidesPerView: 3.2,
                allowTouchMove: false,
                grabCursor: false,
            }
        },
    });
}

function initSwiperSpecial() {
    const swiperSpecial = createSwiper('.swiper-special', {
        slidesPerView: 1,
        mousewheel: false,
        allowTouchMove: false,
        grabCursor: false,
        effect: 'fade',
        speed: 800,
        loop: false,
        autoplay: {
            delay: 5000,
            disableOnInteraction: false,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        on: {
            init: function () {
                if (this.slides && this.slides.length) {
                    updateCounter(this);
                } else {
                    const checkSlides = setInterval(() => {
                        if (this.slides && this.slides.length) {
                            updateCounter(this);
                            clearInterval(checkSlides);
                        }
                    }, 10);
                }
            },
            slideChange: function () {
                if (this.slides && this.slides.length) {
                    updateCounter(this);
                }
            }
        },
    });

    if (swiperSpecial) {
        if (swiperSpecial.slides && swiperSpecial.slides.length) {
            updateCounter(swiperSpecial);
        } else {
            setTimeout(() => {
                if (swiperSpecial.slides && swiperSpecial.slides.length) {
                    updateCounter(swiperSpecial);
                }
            }, 100);
        }
    }
}

function initSwiperMore() {
    const swiperMore = createSwiper('.swiper-more', {
        slidesPerView: 1,
        spaceBetween: 10,
        allowTouchMove: true,
        grabCursor: false,
        mousewheel: false, // ОТКЛЮЧАЕМ mousewheel
        scrollbar: {
            el: '.swiper-scrollbar',
            draggable: true,
            hide: false,
            snapOnRelease: true,
            dragSize: 'auto',
            horizontalClass: 'swiper-scrollbar-horizontal',
        },
        breakpoints: {
            769: {
                slidesPerView: 3,
                allowTouchMove: false,
                scrollbar: {
                    enabled: false,
                },
            }
        },
        navigation: {
            nextEl: '.swiper-more .swiper-button-next',
            prevEl: '.swiper-more .swiper-button-prev',
        },
    });
}

function initSwiperTogether() {
    const swiperTogether = createSwiper('.swiper-together', {
        slidesPerView: 1.5,
        spaceBetween: 10,
        allowTouchMove: true,
        grabCursor: false,
        mousewheel: false,
        scrollbar: {
            el: '.swiper-together .swiper-scrollbar', // Уточняем селектор
            draggable: true,
            hide: false,
            snapOnRelease: true,
            dragSize: 'auto',
            horizontalClass: 'swiper-scrollbar-horizontal',
        },
        breakpoints: {
            769: {
                slidesPerView: 3,
                allowTouchMove: false,
                scrollbar: {
                    enabled: false,
                },
            }
        },
        navigation: {
            nextEl: '.swiper-together .swiper-button-next', // Уже есть, но убедитесь
            prevEl: '.swiper-together .swiper-button-prev',
        },
    });

    // Блокируем всплытие событий от кнопок
    const prevBtn = document.querySelector('.swiper-together .swiper-button-prev');
    const nextBtn = document.querySelector('.swiper-together .swiper-button-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

function initSwiperReviews() {
    const swiperReviews = createSwiper('.swiper-reviews', {
        slidesPerView: 1,
        spaceBetween: 10,
        allowTouchMove: false,
        grabCursor: false,
        mousewheel: {
            forceToAxis: true,
            eventsTarget: 'container',
            sensitivity: 1,
            releaseOnEdges: true,
        },
        breakpoints: {
            769: {
                slidesPerView: 3.2,
            }
        },
        navigation: {
            nextEl: '.swiper-reviews .swiper-button-next',
            prevEl: '.swiper-reviews .swiper-button-prev',
        },
    });
}

function updateCounter(swiperInstance) {
    if (!swiperInstance) return;

    const currentSlide = document.querySelector('.current-slide');
    const totalSlides = document.querySelector('.total-slides');

    if (currentSlide && totalSlides) {
        currentSlide.textContent = swiperInstance.realIndex + 1;
        totalSlides.textContent = swiperInstance.slides.length;
    }
}