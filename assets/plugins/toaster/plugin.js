/**
 * Контекстные тосты: element.toaster(message, durationMs?)
 * Разметка: .toast-message (стили в проекте, см. button.css).
 */
(function () {
    'use strict';

    class ToastManager {
        constructor() {
            this.activeToasts = new Map();
            this.toastCounter = 0;
        }

        show(message, targetElement, duration) {
            const ms = typeof duration === 'number' && duration > 0 ? duration : 2000;
            const anchor = targetElement && typeof targetElement.getBoundingClientRect === 'function'
                ? targetElement
                : document.documentElement;

            const toastId = ++this.toastCounter;
            const toast = this.createToastElement(message, toastId);
            document.body.appendChild(toast);
            this.positionToast(toast, anchor);
            this.scheduleRemoval(toast, toastId, ms);
        }

        createToastElement(message, toastId) {
            const toast = document.createElement('div');
            toast.className = 'toast-message';
            toast.textContent = message;
            toast.setAttribute('data-toast-id', String(toastId));
            return toast;
        }

        positionToast(toast, targetElement) {
            const apply = () => {
                const rect = targetElement.getBoundingClientRect();
                const w = toast.offsetWidth || toast.getBoundingClientRect().width;
                toast.style.position = 'fixed';
                toast.style.left = (rect.left + rect.width / 2 - w / 2) + 'px';
                toast.style.top = (rect.top - 45) + 'px';
                toast.style.zIndex = '10050';
            };
            requestAnimationFrame(apply);
        }

        scheduleRemoval(toast, toastId, ms) {
            const timeoutId = setTimeout(() => {
                if (toast && toast.parentNode) {
                    toast.remove();
                }
                this.activeToasts.delete(toastId);
            }, ms);
            this.activeToasts.set(toastId, timeoutId);
        }
    }

    let manager = null;

    function getManager() {
        if (!manager) {
            manager = new ToastManager();
        }
        return manager;
    }

    let prototypeInstalled = false;

    /**
     * Якорь для PluginHydrator: создаётся в document.body при загрузке плагина,
     * без разметки в шаблоне.
     */
    function ensureHydratorMount() {
        if (document.getElementById('app-toaster-service')) {
            return;
        }
        const attach = () => {
            if (document.getElementById('app-toaster-service')) {
                return;
            }
            const mount = document.createElement('span');
            mount.id = 'app-toaster-service';
            mount.setAttribute('data-plugin', 'toaster');
            mount.hidden = true;
            mount.setAttribute('aria-hidden', 'true');
            (document.body || document.documentElement).appendChild(mount);
        };
        if (document.body) {
            attach();
        } else {
            document.addEventListener('DOMContentLoaded', attach, { once: true });
        }
    }

    function installPrototype() {
        if (prototypeInstalled) {
            return;
        }
        prototypeInstalled = true;

        Element.prototype.toaster = function (message, duration) {
            const text = message == null ? '' : String(message);
            if (text === '') {
                return;
            }
            getManager().show(text, this, duration);
        };
    }

    class ToasterPlugin {
        constructor(element, hydrator) {
            this.element = element;
            this.hydrator = hydrator;
        }

        async init() {
            installPrototype();
            ensureHydratorMount();
            return this;
        }
    }

    installPrototype();
    ensureHydratorMount();

    if (typeof window.registerProjectPlugin === 'function') {
        window.registerProjectPlugin('toaster', ToasterPlugin);
    }
})();
