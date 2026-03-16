class ModalManager {
    constructor() {
        this.modals = new Map();
        this.activeModal = null;
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.closeModal(this.activeModal);
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }

    registerModal(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const config = {
            triggerOnScroll: options.triggerOnScroll || false,
            scrollTarget: options.scrollTarget || null,
            scrollDelay: options.scrollDelay || 500,
            triggerOnClick: options.triggerOnClick || false,
            onClickTarget: options.onClickTarget || null,
            isOpen: false,
            modalElement: modal,
            closeBtn: modal.querySelector('.close'),
            onOpen: options.onOpen || null,
            onClose: options.onClose || null
        };

        if (config.closeBtn) {
            config.closeBtn.addEventListener('click', () => this.closeModal(modalId));
        }

        this.modals.set(modalId, config);
        this.setupTriggers(modalId, config);

        return this;
    }

    setupTriggers(modalId, config) {
        if (config.triggerOnScroll && config.scrollTarget) {
            const targetElement = document.getElementById(config.scrollTarget);
            if (targetElement) {
                this.setupScrollTrigger(modalId, targetElement, config.scrollDelay);
            }
        }

        if (config.triggerOnClick && config.onClickTarget) {
            const buttons = document.querySelectorAll(config.onClickTarget);
            buttons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openModal(modalId);
                });
            });
        }
    }

    setupScrollTrigger(modalId, targetElement, delay) {
        let modalShown = false;
        const modalConfig = this.modals.get(modalId);

        const checkScroll = () => {
            if (modalShown || this.activeModal) return;

            const rect = targetElement.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            if (rect.top < windowHeight && rect.bottom > 0) {
                modalShown = true;
                setTimeout(() => this.openModal(modalId), delay);
            }
        };

        window.addEventListener('scroll', checkScroll);
        setTimeout(checkScroll, 1000);
    }

    openModal(modalId) {
        const modalConfig = this.modals.get(modalId);
        if (!modalConfig || modalConfig.isOpen) return;

        if (this.activeModal) {
            this.closeModal(this.activeModal);
        }

        const modal = modalConfig.modalElement;

        modal.style.display = 'block';
        modalConfig.isOpen = true;
        this.activeModal = modalId;

        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        document.body.style.overflow = 'hidden';

        if (modalConfig.onOpen) {
            modalConfig.onOpen(modal);
        }
    }

    closeModal(modalId) {
        const modalConfig = this.modals.get(modalId);
        if (!modalConfig || !modalConfig.isOpen) return;

        const modal = modalConfig.modalElement;

        modal.classList.remove('show');
        modalConfig.isOpen = false;
        this.activeModal = null;

        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';

            if (modalConfig.onClose) {
                modalConfig.onClose(modal);
            }
        }, 300);
    }

    closeAll() {
        this.modals.forEach((_, modalId) => {
            this.closeModal(modalId);
        });
    }
}

const modalManager = new ModalManager();

document.addEventListener('DOMContentLoaded', function() {
    modalManager.registerModal('hitsModal', {
        triggerOnScroll: true,
        scrollTarget: 'hits-section',
        scrollDelay: 500,
    });

    modalManager.registerModal('changeModal', {
        triggerOnClick: true,
        onClickTarget: '[data-modal="changeModal"]',
    });

    modalManager.registerModal('reviewModal', {
        triggerOnClick: true,
        onClickTarget: '[data-modal="reviewModal"]'
    });

    modalManager.registerModal('formReviewModal', {
        triggerOnClick: true,
        onClickTarget: '[data-modal="formReviewModal"]'
    });

    modalManager.registerModal('formQuestionModal', {
        triggerOnClick: true,
        onClickTarget: '[data-modal="formQuestionModal"]'
    });
});