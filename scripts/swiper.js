document.addEventListener('DOMContentLoaded', function() {
    initializeSwipers();
});

function initializeSwipers() {
    initSwiperLot();
    initSwiperPost();
    initSwiperSpecial();
    initSwiperTogether();
    initSwiperMore();
    initSwiperReviews();
}

function createSwiper(selector, options) {
    const element = document.querySelector(selector);
    if (!element) return null;
    if (element.swiper) return element.swiper;

    const SwiperCtor = window.Swiper;
    if (typeof SwiperCtor !== 'function') {
        console.error('Swiper is not available on window');
        return null;
    }

    return new SwiperCtor(element, options);
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
            nextEl: '.lot-swiper-container .swiper-button-next',
            prevEl: '.lot-swiper-container .swiper-button-prev',
        },
    });

    if (!swiperLot) return;

    const previewItems = document.querySelectorAll('.preview-item');
    const previewColumn = document.querySelector('.preview-column');
    const prevBtn = document.querySelector('.lot-swiper-container .swiper-button-prev');
    const nextBtn = document.querySelector('.lot-swiper-container .swiper-button-next');
    const totalSlides = previewItems.length;

    const totalSlidesElement = document.getElementById('total-slides');
    if (totalSlidesElement) {
        totalSlidesElement.textContent = totalSlides;
    }

    // Функция для определения, мобильное ли устройство
    function isMobile() {
        return window.innerWidth <= 769;
    }

    // Функция для прокрутки превью к активному элементу
    function scrollToActivePreview(activeIndex) {
        if (!previewColumn) return;

        const activePreview = previewItems[activeIndex];
        if (!activePreview) return;

        if (isMobile()) {
            // Горизонтальная прокрутка для мобильных
            const containerLeft = previewColumn.scrollLeft;
            const containerWidth = previewColumn.clientWidth;
            const previewLeft = activePreview.offsetLeft;
            const previewWidth = activePreview.offsetWidth;

            // Если элемент левее видимой области
            if (previewLeft < containerLeft) {
                previewColumn.scrollTo({
                    left: previewLeft - 10,
                    behavior: 'smooth'
                });
            }
            // Если элемент правее видимой области
            else if (previewLeft + previewWidth > containerLeft + containerWidth) {
                previewColumn.scrollTo({
                    left: previewLeft + previewWidth - containerWidth + 10,
                    behavior: 'smooth'
                });
            }
        } else {
            // Вертикальная прокрутка для десктопа
            const containerTop = previewColumn.scrollTop;
            const containerHeight = previewColumn.clientHeight;
            const previewTop = activePreview.offsetTop;
            const previewHeight = activePreview.offsetHeight;

            if (previewTop < containerTop) {
                previewColumn.scrollTo({
                    top: previewTop - 10,
                    behavior: 'smooth'
                });
            }
            else if (previewTop + previewHeight > containerTop + containerHeight) {
                previewColumn.scrollTo({
                    top: previewTop + previewHeight - containerHeight + 10,
                    behavior: 'smooth'
                });
            }
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
            const lotContainer = document.querySelector('.lot-swiper-container');
            const isVisible = lotContainer && window.getComputedStyle(lotContainer).display !== 'none';
            const isInsideModal = e.target.closest('.modal') !== null;

            if (!isVisible || isInsideModal) return;

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
    const moreEl = document.querySelector('.swiper-more');
    if (!moreEl) return null;

    const swiperMore = createSwiper('.swiper-more', {
        slidesPerView: 1,
        spaceBetween: 10,
        allowTouchMove: true,
        grabCursor: false,
        mousewheel: false, // ОТКЛЮЧАЕМ mousewheel
        scrollbar: {
            // Важно: не '.swiper-scrollbar' глобально — на лоте первым идёт scrollbar комплекта.
            el: moreEl.querySelector('.swiper-scrollbar'),
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
            nextEl: moreEl.querySelector('.swiper-button-next'),
            prevEl: moreEl.querySelector('.swiper-button-prev'),
        },
    });
}

function initSwiperTogether() {
    document.querySelectorAll('.swiper-together').forEach((el) => {
        if (!el || el.swiper) return;

        const SwiperCtor = window.Swiper;
        if (typeof SwiperCtor !== 'function') {
            console.error('Swiper is not available on window');
            return;
        }

        const swiperTogether = new SwiperCtor(el, {
            slidesPerView: 1.5,
            spaceBetween: 10,
            allowTouchMove: true,
            grabCursor: false,
            mousewheel: false,
            observer: true,
            observeParents: true,
            scrollbar: {
                el: el.querySelector('.swiper-scrollbar'),
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
                nextEl: el.querySelector('.swiper-button-next'),
                prevEl: el.querySelector('.swiper-button-prev'),
            },
        });

        // Блокируем всплытие событий от кнопок
        const prevBtn = el.querySelector('.swiper-button-prev');
        const nextBtn = el.querySelector('.swiper-button-next');
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

        // После расчёта flex-ширины .together-container — update (иначе часто 0 gaps / мёртвая навигация).
        const refresh = () => {
            if (swiperTogether && typeof swiperTogether.update === 'function') {
                swiperTogether.update();
            }
        };
        requestAnimationFrame(refresh);
        window.addEventListener('load', refresh, { once: true });
    });
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