class ModalManager {
    constructor() {
        this.modals = new Map();
        this.modalStack = [];
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalStack.length > 0) {
                const lastModalId = this.modalStack[this.modalStack.length - 1];
                this.closeModal(lastModalId);
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                const topModalId = this.modalStack[this.modalStack.length - 1];
                const topModal = document.getElementById(topModalId);

                if (topModal && e.target === topModal) {
                    this.closeModal(topModalId);
                }
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
            closeOnClick: options.closeOnClick || null,
            isOpen: false,
            modalElement: modal,
            closeBtn: modal.querySelector('.close'),
            onOpen: options.onOpen || null,
            onClose: options.onClose || null,
            parentModalId: options.parentModalId || null
        };

        if (config.closeBtn) {
            config.closeBtn.addEventListener('click', () => this.closeModal(modalId));
        }

        if (config.closeOnClick) {
            const closeButtons = modal.querySelectorAll(config.closeOnClick);
            closeButtons.forEach(button => {
                button.addEventListener('click', () => this.closeModal(modalId));
            });
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

                    let parentModalId = null;
                    const parentModal = e.target.closest('.modal');
                    if (parentModal) {
                        parentModalId = parentModal.id;
                    }

                    this.openModal(modalId, parentModalId);
                });
            });
        }
    }

    setupScrollTrigger(modalId, targetElement, delay) {
        let modalShown = false;
        const modalConfig = this.modals.get(modalId);

        const checkScroll = () => {
            if (modalShown || this.modalStack.length > 0) return;

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

    openModal(modalId, parentModalId = null) {
        const modalConfig = this.modals.get(modalId);
        if (!modalConfig || modalConfig.isOpen) return;

        const modal = modalConfig.modalElement;

        if (parentModalId) {
            modalConfig.parentModalId = parentModalId;
        }

        this.modalStack.push(modalId);

        if (this.modalStack.length > 1) {
            modal.style.zIndex = 1000 + (this.modalStack.length * 10);
        }

        modal.style.display = 'block';
        modalConfig.isOpen = true;

        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        if (this.modalStack.length === 1) {
            document.body.style.overflow = 'hidden';
        }

        if (modalConfig.onOpen) {
            modalConfig.onOpen(modal);
        }
    }

    closeModal(modalId) {
        const lastModalId = this.modalStack[this.modalStack.length - 1];

        if (modalId !== lastModalId) {
            return;
        }

        const modalConfig = this.modals.get(modalId);
        if (!modalConfig || !modalConfig.isOpen) return;

        const modal = modalConfig.modalElement;

        modal.classList.remove('show');
        modalConfig.isOpen = false;

        this.modalStack.pop();

        setTimeout(() => {
            modal.style.display = 'none';

            if (this.modalStack.length === 0) {
                document.body.style.overflow = '';
            }

            if (modalConfig.onClose) {
                modalConfig.onClose(modal);
            }
        }, 300);
    }

    closeAll() {
        const modalsToClose = [...this.modalStack].reverse();
        modalsToClose.forEach(modalId => {
            this.closeModal(modalId);
        });
    }

    closeUntil(modalId) {
        while (this.modalStack.length > 0) {
            const currentModalId = this.modalStack[this.modalStack.length - 1];
            if (currentModalId === modalId) break;
            this.closeModal(currentModalId);
        }
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

    modalManager.registerModal('mapModal', {
        triggerOnClick: true,
        onClickTarget: '[data-modal="mapModal"]'
    });

    modalManager.registerModal('mapPointModal', {
        triggerOnClick: true,
        onClickTarget: '[data-modal="mapPointModal"]',
        closeOnClick: '.buttonDark',
        onClose: (modal) => {
            console.log('Modal mapPointModal closed');
        }
    });
});