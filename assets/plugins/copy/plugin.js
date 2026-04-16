// project/web/assets/plugins/copy/plugin.js — копирование в буфер (проектный плагин гидратора)
(function() {
    'use strict';

    class CopyPlugin {
        constructor(element, hydrator) {
            this.element = element;
            this.hydrator = hydrator;
            this.onClick = this.onClick.bind(this);
        }

        async init() {
            if (!this.element) {
                return this;
            }
            this.element.addEventListener('click', this.onClick);
            return this;
        }

        destroy() {
            if (!this.element) {
                return;
            }
            this.element.removeEventListener('click', this.onClick);
        }

        onClick(event) {
            if (!this.element) {
                return;
            }

            if (this.element.disabled || this.element.getAttribute('aria-disabled') === 'true') {
                return;
            }

            const text = this.resolveCopyText();
            if (!text) {
                // Не блокируем обычный переход по ссылке, если копировать нечего (частая ошибка разметки).
                const tag = this.element.tagName ? this.element.tagName.toUpperCase() : '';
                if (tag === 'A' && this.element.getAttribute('href')) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                this.notify(this.element.dataset.copyEmpty || 'Нет данных для копирования', 'warning');
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            this.copyText(text)
                .then(() => {
                    this.notify(this.element.dataset.copySuccess || 'Скопировано', 'success');
                })
                .catch(() => {
                    this.notify(this.element.dataset.copyError || 'Не удалось скопировать', 'error');
                });
        }

        resolveCopyText() {
            const directText = (this.element.dataset.copyText || '').trim();
            if (directText !== '') {
                return directText;
            }

            const selector = (this.element.dataset.copySelector || '').trim();
            if (selector !== '') {
                const sourceElement = document.querySelector(selector);
                if (!sourceElement) {
                    return this.resolveAnchorHrefIfNeeded();
                }

                const attr = (this.element.dataset.copyAttr || '').trim();
                if (attr !== '') {
                    return String(sourceElement.getAttribute(attr) || '').trim();
                }

                if ('value' in sourceElement) {
                    return String(sourceElement.value || '').trim();
                }

                return String(sourceElement.textContent || '').trim();
            }

            return this.resolveAnchorHrefIfNeeded();
        }

        /**
         * Для ссылки без data-copy-text / data-copy-selector — копируем URL (как у обычной «копировать ссылку»).
         */
        resolveAnchorHrefIfNeeded() {
            const tag = this.element.tagName ? this.element.tagName.toUpperCase() : '';
            if (tag !== 'A' || !this.element.href) {
                return '';
            }
            const hrefAttr = (this.element.getAttribute('href') || '').trim();
            if (hrefAttr.toLowerCase().startsWith('javascript:')) {
                return '';
            }
            return String(this.element.href).trim();
        }

        copyText(text) {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                return navigator.clipboard.writeText(text);
            }

            return new Promise((resolve, reject) => {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    ta.style.top = '0';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();

                    const ok = document.execCommand('copy');
                    document.body.removeChild(ta);

                    if (ok) {
                        resolve();
                    } else {
                        reject(new Error('copy'));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        }

        notify(message, type) {
            const duration = parseInt(this.element.dataset.copyDuration || '2000', 10);
            const t = type || 'info';

            // Сначала проектный toasts у кликнутого элемента (позиция у кнопки).
            // Ядерный notify + style.css часто не подключены (например loadCSS: false у гидратора на витрине).
            if (typeof this.element.toaster === 'function') {
                this.element.toaster(message, duration);
                return;
            }

            const notifyService = this.hydrator && typeof this.hydrator.getService === 'function'
                ? this.hydrator.getService('notify')
                : null;

            if (notifyService && typeof notifyService.toaster === 'function') {
                notifyService.toaster(message, t, duration);
                return;
            }

            if (window.Notify && typeof window.Notify.toaster === 'function') {
                window.Notify.toaster(message, t, duration);
            }
        }
    }

    if (typeof window.registerProjectPlugin === 'function') {
        window.registerProjectPlugin('copy', CopyPlugin);
    }
})();
