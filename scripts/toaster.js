class ToastManager {
    constructor() {
        this.activeToasts = new Map();
        this.toastCounter = 0;
    }

    show(message, targetElement) {
        const toastId = ++this.toastCounter;
        const toast = this.createToastElement(message, toastId);
        this.positionToast(toast, targetElement);
        document.body.appendChild(toast);
        this.scheduleRemoval(toast, toastId);
    }

    createToastElement(message, toastId) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        toast.setAttribute('data-toast-id', toastId);
        return toast;
    }

    positionToast(toast, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        toast.style.position = 'fixed';
        toast.style.left = (rect.left + rect.width / 2 - toast.offsetWidth / 2) + 'px';
        toast.style.top = (rect.top - 45) + 'px';
    }

    scheduleRemoval(toast, toastId) {
        const timeoutId = setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.remove();
            }
            this.activeToasts.delete(toastId);
        }, 2000);
        this.activeToasts.set(toastId, timeoutId);
    }
}

class Action {
    constructor(element, toastManager) {
        this.element = element;
        this.toastManager = toastManager;
        this.message = '';
    }

    execute() {
        this.showToast();
        this.performAction();
    }

    showToast() {
        if (this.message) {
            this.toastManager.show(this.message, this.element);
        }
    }

    performAction() {}
}

class CopyAction extends Action {
    constructor(element, toastManager, customMessage = 'Скопировано') {
        super(element, toastManager);
        this.message = customMessage;
    }

    performAction() {
        console.log('Выполнено копирование для элемента:', this.element);
    }
}

class RemoveAction extends Action {
    constructor(element, toastManager, customMessage = 'Удалено') {
        super(element, toastManager);
        this.message = customMessage;
    }

    performAction() {
        console.log('Выполнено удаление для элемента:', this.element);
        const cart = this.element.closest('.cart');
        const set = this.element.closest('.set');
        const targetCard = cart || set;
        if (targetCard) {
            targetCard.remove();
        }
    }
}

class ActivationAction extends Action {
    constructor(element, toastManager) {
        super(element, toastManager);
        this.statusElement = null;
        this.playIcon = null;
        this.pauseIcon = null;

        this.findStatusElement();
        this.findIcons();
        this.initStateFromStatus();
        this.updateButtonAppearance();
    }

    findStatusElement() {
        const cart = this.element.closest('.cart');
        const set = this.element.closest('.set');
        const targetCard = cart || set;
        if (targetCard) {
            this.statusElement = targetCard.querySelector('.set-status');
        }
    }

    findIcons() {
        const icons = this.element.querySelectorAll('svg');
        if (icons.length >= 2) {
            this.playIcon = icons[0];
            this.pauseIcon = icons[1];
        }
    }

    initStateFromStatus() {
        if (this.statusElement) {
            this.isActive = this.statusElement.classList.contains('active');
        } else {
            this.isActive = false;
        }
    }

    updateButtonAppearance() {
        if (this.isActive) {
            if (this.playIcon) this.playIcon.style.display = 'none';
            if (this.pauseIcon) this.pauseIcon.style.display = 'inline-block';
            this.element.textContent = 'Деактивировать';
            this.message = 'Деактивировано';
        } else {
            if (this.playIcon) this.playIcon.style.display = 'inline-block';
            if (this.pauseIcon) this.pauseIcon.style.display = 'none';
            this.element.textContent = 'Активировать';
            this.message = 'Активировано';
        }
        this.restoreIcons();
    }

    restoreIcons() {
        const existingIcons = this.element.querySelectorAll('svg');
        if (existingIcons.length === 0 && (this.playIcon || this.pauseIcon)) {
            if (this.playIcon) {
                const newPlayIcon = this.playIcon.cloneNode(true);
                newPlayIcon.style.display = this.isActive ? 'none' : 'inline-block';
                this.element.insertBefore(newPlayIcon, this.element.firstChild);
                this.playIcon = newPlayIcon;
            }
            if (this.pauseIcon) {
                const newPauseIcon = this.pauseIcon.cloneNode(true);
                newPauseIcon.style.display = this.isActive ? 'inline-block' : 'none';
                this.element.insertBefore(newPauseIcon, this.element.firstChild);
                this.pauseIcon = newPauseIcon;
            }
        } else {
            const icons = this.element.querySelectorAll('svg');
            if (icons.length >= 2) {
                this.playIcon = icons[0];
                this.pauseIcon = icons[1];
                this.playIcon.style.display = this.isActive ? 'none' : 'inline-block';
                this.pauseIcon.style.display = this.isActive ? 'inline-block' : 'none';
            }
        }
    }

    performAction() {
        this.isActive = !this.isActive;

        if (this.statusElement) {
            if (this.isActive) {
                this.statusElement.classList.remove('archive');
                this.statusElement.classList.add('active');
                this.statusElement.textContent = 'Активна';
            } else {
                this.statusElement.classList.remove('active');
                this.statusElement.classList.add('archive');
                this.statusElement.textContent = 'Архив';
            }
        }

        this.updateButtonAppearance();
        console.log(this.isActive ? 'Активировано' : 'Деактивировано', 'для элемента:', this.element);
    }
}

// Класс для управления тултипами
class TooltipManager {
    constructor() {
        // Проверяем, не мобильное ли устройство
        this.isMobile = this.checkIsMobile();
        this.activeTimers = new Map(); // Храним таймеры для каждого тултипа

        if (!this.isMobile) {
            this.init();
        }
    }

    // Проверка на мобильное устройство
    checkIsMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }

    init() {
        // Находим ВСЕ контейнеры с иконками
        const allContainers = document.querySelectorAll('.set-footer-container');

        allContainers.forEach(container => {
            const footerItems = container.querySelectorAll('.set-footer-item');
            const tooltips = ['Изменить', 'Поделиться', 'QR-код'];

            footerItems.forEach((item, index) => {
                if (index < tooltips.length) {
                    this.addTooltip(item, tooltips[index]);
                }
            });
        });
    }

    addTooltip(element, text) {
        // Создаем элемент подсказки
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.textContent = text;

        element.appendChild(tooltip);
        element.setAttribute('data-tooltip', text);

        element.addEventListener('mouseenter', () => {
            this.clearTimer(element);

            tooltip.classList.add('show');
            this.positionTooltip(tooltip, element);

            const timerId = setTimeout(() => {
                tooltip.classList.remove('show');
                this.activeTimers.delete(element);
            }, 1000);

            this.activeTimers.set(element, timerId);
        });

        element.addEventListener('mouseleave', () => {
            this.clearTimer(element);
            tooltip.classList.remove('show');
        });

        element.addEventListener('click', () => {
            this.hideTooltip(element, tooltip);
        });
    }

    hideTooltip(element, tooltip) {
        this.clearTimer(element);
        tooltip.classList.remove('show');
    }

    clearTimer(element) {
        const existingTimer = this.activeTimers.get(element);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.activeTimers.delete(element);
        }
    }

    positionTooltip(tooltip, element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top = rect.top - tooltipRect.height - 8;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        if (top < 0) {
            top = rect.bottom + 8;
            tooltip.setAttribute('data-position', 'bottom');
        } else {
            tooltip.setAttribute('data-position', 'top');
        }

        if (left < 0) {
            left = 8;
        }
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 8;
        }

        tooltip.style.position = 'fixed';
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }
}

class ActionManager {
    constructor() {
        this.toastManager = new ToastManager();
        this.actions = new Map();
        this.init();
    }

    init() {
        this.tooltipManager = new TooltipManager();

        const copyElements = document.querySelectorAll('.copy');
        copyElements.forEach(element => {
            const customMessage = element.getAttribute('data-toast-message') || 'Скопировано';
            const copyAction = new CopyAction(element, this.toastManager, customMessage);
            this.actions.set(element, copyAction);
            this.bindEvent(element);
        });

        const removeElements = document.querySelectorAll('.remove');
        removeElements.forEach(element => {
            const customMessage = element.getAttribute('data-toast-message') || 'Удалено';
            const removeAction = new RemoveAction(element, this.toastManager, customMessage);
            this.actions.set(element, removeAction);
            this.bindEvent(element);
        });

        const activationElements = document.querySelectorAll('.activation');
        activationElements.forEach(element => {
            const activationAction = new ActivationAction(element, this.toastManager);
            this.actions.set(element, activationAction);
            this.bindEvent(element);
        });

        this.initFooterIcons();
    }

    initFooterIcons() {
        const allFooterItems = document.querySelectorAll('.set-footer-container .set-footer-item');

        allFooterItems.forEach((item, index) => {
            const container = item.closest('.set-footer-container');
            const itemsInContainer = container ? Array.from(container.querySelectorAll('.set-footer-item')) : [];
            const localIndex = itemsInContainer.indexOf(item);

            item.addEventListener('click', (e) => {
                e.stopPropagation();

                const tooltip = item.querySelector('.custom-tooltip');
                if (tooltip && window.actionManager?.tooltipManager) {
                    window.actionManager.tooltipManager.hideTooltip(item, tooltip);
                }

                switch(localIndex) {
                    case 0:
                        break;
                    case 1:
                        this.toastManager.show('Ссылка скопирована', item);
                        break;
                    case 2:
                        break;
                }
            });
        });
    }

    bindEvent(element) {
        element.addEventListener('click', (event) => {
            event.stopPropagation();
            const action = this.actions.get(element);
            if (action) {
                action.execute();
            }
        });
    }

    getAction(element) {
        return this.actions.get(element) || null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.actionManager = new ActionManager();
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

        if (isMobile) {
            const tooltips = document.querySelectorAll('.custom-tooltip');
            tooltips.forEach(tooltip => tooltip.remove());
        }
    }, 250);
});

document.addEventListener('DOMContentLoaded', function() {
    const stars = document.querySelectorAll('.button-stars');
    let currentRating = 0;

    function updateStars(rating) {
        stars.forEach((star, index) => {
            const starIndex = index + 1;
            if (starIndex <= rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
        currentRating = rating;
    }

    stars.forEach(star => {
        star.addEventListener('click', function(e) {
            e.stopPropagation();
            const rating = parseInt(this.getAttribute('data-rating'));
            updateStars(rating);
        });
    });
});

function enableEditing(textElement) {
    if (textElement.isEditing) return;

    textElement.isEditing = true;
    textElement.contentEditable = 'true';
    textElement.focus();

    const originalText = textElement.textContent;

    function saveChanges() {
        textElement.contentEditable = 'false';
        textElement.isEditing = false;

        const newText = textElement.textContent;
        if (newText !== originalText) {
            console.log(`Новый текст для ${textElement.dataset.id}:`, newText);
            localStorage.setItem(`text_${textElement.dataset.id}`, newText);
        }

        textElement.removeEventListener('blur', saveChanges);
        textElement.removeEventListener('keypress', onEnter);
    }

    function onEnter(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            textElement.blur();
        }
    }

    function onEscape(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            textElement.textContent = originalText;
            textElement.blur();
        }
    }

    textElement.addEventListener('blur', saveChanges);
    textElement.addEventListener('keypress', onEnter);
    textElement.addEventListener('keydown', onEscape);
}

document.querySelectorAll('.edit-icon').forEach(icon => {
    icon.addEventListener('click', function() {
        const targetId = this.dataset.target;
        const textElement = document.querySelector(`.editable-text[data-id="${targetId}"]`);
        if (textElement) {
            enableEditing(textElement);
        }
    });
});

document.querySelectorAll('.editable-text').forEach(textElement => {
    const savedText = localStorage.getItem(`text_${textElement.dataset.id}`);
    if (savedText) {
        textElement.textContent = savedText;
    }
});