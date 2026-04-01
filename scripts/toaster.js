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
        toast.style.left = (rect.left) + 'px';
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

        // Находим элементы
        this.findStatusElement();
        this.findIcons();

        // Устанавливаем начальное состояние на основе статуса
        this.initStateFromStatus();

        // Обновляем внешний вид кнопки
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
        // Находим обе иконки внутри кнопки
        const icons = this.element.querySelectorAll('svg');
        if (icons.length >= 2) {
            this.playIcon = icons[0];   // Первая иконка (play/активация)
            this.pauseIcon = icons[1];  // Вторая иконка (pause/деактивация)
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
            // Статус активен → показываем иконку паузы и текст "Деактивировать"
            if (this.playIcon) this.playIcon.style.display = 'none';
            if (this.pauseIcon) this.pauseIcon.style.display = 'inline-block';
            this.element.textContent = 'Деактивировать';
            this.message = 'Деактивировано';
        } else {
            // Статус не активен → показываем иконку play и текст "Активировать"
            if (this.playIcon) this.playIcon.style.display = 'inline-block';
            if (this.pauseIcon) this.pauseIcon.style.display = 'none';
            this.element.textContent = 'Активировать';
            this.message = 'Активировано';
        }

        // Возвращаем иконки обратно (они могли быть удалены при textContent)
        this.restoreIcons();
    }

    restoreIcons() {
        // Проверяем, есть ли уже иконки внутри элемента
        const existingIcons = this.element.querySelectorAll('svg');
        if (existingIcons.length === 0 && (this.playIcon || this.pauseIcon)) {
            // Если иконок нет, добавляем их обратно
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
            // Если иконки есть, просто обновляем их видимость
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
        // Переключаем состояние
        this.isActive = !this.isActive;

        // Обновляем статус карточки
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

        // Обновляем внешний вид кнопки
        this.updateButtonAppearance();

        console.log(this.isActive ? 'Активировано' : 'Деактивировано', 'для элемента:', this.element);
    }
}

class ActionManager {
    constructor() {
        this.toastManager = new ToastManager();
        this.actions = new Map();
        this.init();
    }

    init() {
        // Кнопки копирования
        const copyElements = document.querySelectorAll('.copy');
        copyElements.forEach(element => {
            const customMessage = element.getAttribute('data-toast-message') || 'Скопировано';
            const copyAction = new CopyAction(element, this.toastManager, customMessage);
            this.actions.set(element, copyAction);
            this.bindEvent(element);
        });

        // Кнопки удаления
        const removeElements = document.querySelectorAll('.remove');
        removeElements.forEach(element => {
            const customMessage = element.getAttribute('data-toast-message') || 'Удалено';
            const removeAction = new RemoveAction(element, this.toastManager, customMessage);
            this.actions.set(element, removeAction);
            this.bindEvent(element);
        });

        // Кнопки активации
        const activationElements = document.querySelectorAll('.activation');
        activationElements.forEach(element => {
            const activationAction = new ActivationAction(element, this.toastManager);
            this.actions.set(element, activationAction);
            this.bindEvent(element);
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

// Запускаем приложение
document.addEventListener('DOMContentLoaded', () => {
    window.actionManager = new ActionManager();
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