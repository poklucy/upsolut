document.addEventListener('DOMContentLoaded', function() {
    initializeSwipers();
});

function initializeSwipers() {
    initSwiperLot();
    initSwiperPost();
    initSwiperSpecial();
    initSwiperMore();
    initSwiperReviews();
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
        loop: true,
        speed: 500,
        effect: 'slide',
        allowTouchMove: false,
        grabCursor: false,
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
    });

    if (!swiperLot) return;

    const previewItems = document.querySelectorAll('.preview-item');
    const prevBtn = document.querySelector('.swiper-button-prev');
    const nextBtn = document.querySelector('.swiper-button-next');
    const totalSlides = previewItems.length;

    const totalSlidesElement = document.getElementById('total-slides');
    if (totalSlidesElement) {
        totalSlidesElement.textContent = totalSlides;
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
            if (e.key === 'ArrowLeft' && !swiperLot.isBeginning) {
                swiperLot.slidePrev();
            } else if (e.key === 'ArrowRight' && !swiperLot.isEnd) {
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
        mousewheel: true,
        allowTouchMove: false,
        grabCursor: false,
        effect: 'fade',
        speed: 800,
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        loop: false,
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
        allowTouchMove: false,
        grabCursor: false,
        mousewheel: {
            forceToAxis: true,
            eventsTarget: 'container',
            sensitivity: 1,
            releaseOnEdges: true,
        },
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
                slidesPerView: 3.2,
                scrollbar: {
                    enabled: false,
                }
            }
        },
        navigation: {
            nextEl: '.swiper-more .swiper-button-next',
            prevEl: '.swiper-more .swiper-button-prev',
        },
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