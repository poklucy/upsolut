class ToastManager {
    constructor() {
        this.activeToasts = new Map(); // Храним таймауты для каждого toast
        this.toastCounter = 0;
    }

    /**
     * Показать всплывающее уведомление
     * @param {string} message - Текст сообщения
     * @param {HTMLElement} targetElement - Элемент, относительно которого позиционируется уведомление
     */
    show(message, targetElement) {
        // Создаём уникальный ID для toast
        const toastId = ++this.toastCounter;

        // Создаём новый toast
        const toast = this.createToastElement(message, toastId);

        // Позиционируем относительно целевого элемента
        this.positionToast(toast, targetElement);

        // Добавляем в DOM
        document.body.appendChild(toast);

        // Настраиваем автоматическое удаление
        this.scheduleRemoval(toast, toastId);
    }

    /**
     * Создать DOM-элемент уведомления
     * @param {string} message
     * @param {number} toastId
     * @returns {HTMLElement}
     */
    createToastElement(message, toastId) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        toast.setAttribute('data-toast-id', toastId);
        return toast;
    }

    /**
     * Позиционировать уведомление относительно целевого элемента
     * @param {HTMLElement} toast
     * @param {HTMLElement} targetElement
     */
    positionToast(toast, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        toast.style.left = (rect.left) + 'px';
        toast.style.top = (rect.top - 45) + 'px';
    }

    /**
     * Запланировать удаление уведомления
     * @param {HTMLElement} toast
     * @param {number} toastId
     */
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

/**
 * Базовый класс для всех действий
 */
class Action {
    constructor(element, toastManager) {
        this.element = element;
        this.toastManager = toastManager;
        this.message = '';
    }

    /**
     * Выполнить действие
     */
    execute() {
        this.showToast();
        this.performAction();
    }

    /**
     * Показать уведомление
     */
    showToast() {
        if (this.message) {
            this.toastManager.show(this.message, this.element);
        }
    }

    /**
     * Выполнить специфичную для действия логику (переопределяется в наследниках)
     */
    performAction() {
        // Базовая реализация - ничего не делает
    }
}

/**
 * Класс для действия копирования
 */
class CopyAction extends Action {
    constructor(element, toastManager, customMessage = 'Скопировано') {
        super(element, toastManager);
        this.message = customMessage;
    }

    performAction() {
        // Логика копирования
        console.log('Выполнено копирование для элемента:', this.element);
    }
}

/**
 * Класс для действия удаления
 */
class RemoveAction extends Action {
    constructor(element, toastManager, customMessage = 'Удалено') {
        super(element, toastManager);
        this.message = customMessage;
    }

    performAction() {
        // Логика удаления
        console.log('Выполнено удаление для элемента:', this.element);
    }
}

/**
 * Класс для действия активации/деактивации
 */
class ActivationAction extends Action {
    constructor(element, toastManager, activeMessage = 'Активировано', inactiveMessage = 'Деактивировано') {
        super(element, toastManager);
        this.isActive = false;
        this.activeMessage = activeMessage;
        this.inactiveMessage = inactiveMessage;
        this.message = this.inactiveMessage;
    }

    performAction() {
        // Переключаем состояние
        this.isActive = !this.isActive;

        // Меняем сообщение в зависимости от состояния
        this.message = this.isActive ? this.activeMessage : this.inactiveMessage;

        // Меняем внешний вид кнопки
        this.toggleButtonState();

        // Логика активации/деактивации
        console.log(this.isActive ? 'Активировано' : 'Деактивировано', 'для элемента:', this.element);
    }

    /**
     * Переключить внешний вид кнопки
     */
    toggleButtonState() {
        if (this.isActive) {
            this.element.classList.add('active');
        } else {
            this.element.classList.remove('active');
        }
    }

    /**
     * Сбросить состояние (если нужно программно)
     */
    reset() {
        this.isActive = false;
        this.toggleButtonState();
    }
}

/**
 * Главный класс для управления всеми действиями
 */
class ActionManager {
    constructor() {
        this.toastManager = new ToastManager();
        this.actions = new Map(); // Хранилище action'ов по элементам
        this.init();
    }

    /**
     * Инициализация: находим все элементы и назначаем им действия
     */
    init() {
        // Инициализируем все кнопки копирования
        const copyElements = document.querySelectorAll('.copy');
        copyElements.forEach(element => {
            // Можно задать кастомное сообщение через data-атрибут
            const customMessage = element.getAttribute('data-toast-message') || 'Скопировано';
            const copyAction = new CopyAction(element, this.toastManager, customMessage);
            this.actions.set(element, copyAction);
            this.bindEvent(element);
        });

        // Инициализируем все кнопки удаления
        const removeElements = document.querySelectorAll('.remove');
        removeElements.forEach(element => {
            const customMessage = element.getAttribute('data-toast-message') || 'Удалено';
            const removeAction = new RemoveAction(element, this.toastManager, customMessage);
            this.actions.set(element, removeAction);
            this.bindEvent(element);
        });

        // Инициализируем все кнопки активации
        const activationElements = document.querySelectorAll('.activation');
        activationElements.forEach(element => {
            const activeMessage = element.getAttribute('data-active-message') || 'Активировано';
            const inactiveMessage = element.getAttribute('data-inactive-message') || 'Деактивировано';
            const activationAction = new ActivationAction(element, this.toastManager, activeMessage, inactiveMessage);
            this.actions.set(element, activationAction);
            this.bindEvent(element);
        });
    }

    /**
     * Привязать событие клика к элементу
     * @param {HTMLElement} element
     */
    bindEvent(element) {
        element.addEventListener('click', (event) => {
            event.stopPropagation();
            const action = this.actions.get(element);
            if (action) {
                action.execute();
            }
        });
    }

    /**
     * Получить action для конкретного элемента
     * @param {HTMLElement} element
     * @returns {Action|null}
     */
    getAction(element) {
        return this.actions.get(element) || null;
    }
}

// Запускаем приложение после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.actionManager = new ActionManager();
});

// Запускаем приложение
document.addEventListener('DOMContentLoaded', () => {
    new ActionManager();
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

    // Сохраняем оригинальный текст на случай отмены
    const originalText = textElement.textContent;

    function saveChanges() {
        textElement.contentEditable = 'false';
        textElement.isEditing = false;

        const newText = textElement.textContent;
        if (newText !== originalText) {
            console.log(`Новый текст для ${textElement.dataset.id}:`, newText);
            // Сохраняем в localStorage с уникальным ключом
            localStorage.setItem(`text_${textElement.dataset.id}`, newText);
            // Или отправляем на сервер
            // sendToServer(textElement.dataset.id, newText);
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

// Назначаем обработчики на все иконки редактирования
document.querySelectorAll('.edit-icon').forEach(icon => {
    icon.addEventListener('click', function() {
        const targetId = this.dataset.target;
        const textElement = document.querySelector(`.editable-text[data-id="${targetId}"]`);
        if (textElement) {
            enableEditing(textElement);
        }
    });
});

// Восстанавливаем сохраненные значения при загрузке
document.querySelectorAll('.editable-text').forEach(textElement => {
    const savedText = localStorage.getItem(`text_${textElement.dataset.id}`);
    if (savedText) {
        textElement.textContent = savedText;
    }
});