(function () {
    'use strict';

    class AdminGridChromePlugin {
        constructor(element) {
            this.element = element;
        }

        async init() {
            if (document.documentElement.dataset.adminGridChrome === '1') {
                return this;
            }
            document.documentElement.dataset.adminGridChrome = '1';
            document.querySelectorAll('.dynblock-filters').forEach((filters) => {
                this.attachFilters(filters);
            });
            document.querySelectorAll('[data-toolbar-action="table-settings"]').forEach((button) => {
                this.bindColumnSettings(this.hostOf(button), button);
            });
            return this;
        }

        attachFilters(filters) {
            if (filters.dataset.adminGridChrome === '1') {
                return;
            }
            filters.dataset.adminGridChrome = '1';
            const toolbar = this.toolbarNear(filters);
            const button = this.ensureFilterButton(toolbar);
            const host = this.hostOf(filters);
            this.bindFilterToggle(host, filters, button);
            this.bindFilterBadge(filters, button);
            this.bindFilterOverlay(filters);
        }

        toolbarNear(filters) {
            let sibling = filters.nextElementSibling;
            while (sibling) {
                if (sibling.classList && sibling.classList.contains('dynblock-toolbar')) {
                    return sibling;
                }
                sibling = sibling.nextElementSibling;
            }
            const parent = filters.parentElement;
            return parent ? parent.querySelector('.dynblock-toolbar') : null;
        }

        hostOf(node) {
            return node.closest('.admin-table-section') || node.parentElement || document.body;
        }

        ensureFilterButton(toolbar) {
            if (!toolbar) {
                return null;
            }
            let button = toolbar.querySelector('.dynblock-filters-toolbar-toggle');
            if (button) {
                return button;
            }
            const right = toolbar.querySelector('.dynblock-toolbar__right') || toolbar;
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-outline-secondary dynblock-filters-toolbar-toggle';
            button.setAttribute('data-plugin', 'tooltip');
            button.setAttribute('data-tooltip', 'Фильтры');
            button.setAttribute('aria-label', 'Фильтры');
            button.innerHTML = '<span class="nav-item__icon" data-icon="System/filter-line"></span>'
                + '<span class="dynblock-toolbar__btn-label">Фильтры</span>';
            right.insertBefore(button, right.firstChild);
            const icon = button.querySelector('[data-icon]');
            if (icon && window.IconSystem && typeof window.IconSystem.replaceIcon === 'function') {
                window.IconSystem.replaceIcon(icon);
            }
            return button;
        }

        bindFilterToggle(section, filters, button) {
            const coreButton = filters
                ? filters.querySelector('[data-toolbar-action="toggle-filters-collapse"]')
                : null;
            if (!button || !coreButton) {
                return;
            }
            const icon = coreButton.querySelector('[data-icon]');
            const paintClose = () => {
                if (!icon) {
                    return;
                }
                icon.setAttribute('data-icon', 'System/close-line');
                icon.removeAttribute('data-icon-replaced');
                if (window.IconSystem && typeof window.IconSystem.replaceIcon === 'function') {
                    window.IconSystem.replaceIcon(icon);
                }
            };
            paintClose();
            setTimeout(paintClose, 50);
            coreButton.setAttribute('aria-label', 'Закрыть');
            coreButton.setAttribute('data-tooltip', 'Закрыть');
            button.addEventListener('click', () => {
                this.closeColumns(section);
                coreButton.click();
            });
        }

        bindFilterOverlay(filters) {
            if (!filters || !filters.classList || !filters.classList.contains('dynblock-filters')) {
                filters = filters && filters.querySelector ? filters.querySelector('.dynblock-filters') : null;
            }
            if (!filters || filters.dataset.filterOverlay === '1') {
                return;
            }
            filters.dataset.filterOverlay = '1';
            AdminGridChromePlugin.ensureOverlay();
            const observer = new MutationObserver(() => AdminGridChromePlugin.syncOverlay());
            observer.observe(filters, { attributes: true, attributeFilter: ['class'] });
            const resetBtn = filters.querySelector('[data-toolbar-action="reset-filters"]');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => this.closeFilters(filters));
            }
            AdminGridChromePlugin.syncOverlay();
        }

        closeFilters(filters) {
            if (!filters || filters.classList.contains('is-collapsed')) {
                return;
            }
            const coreButton = filters.querySelector('[data-toolbar-action="toggle-filters-collapse"]');
            if (coreButton) {
                coreButton.click();
            }
        }

        static ensureOverlay() {
            if (document.getElementById('dynblock-filters-overlay')) {
                return;
            }
            const overlay = document.createElement('div');
            overlay.id = 'dynblock-filters-overlay';
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => {
                document.querySelectorAll('.dynblock-filters:not(.is-collapsed)').forEach((filters) => {
                    const coreButton = filters.querySelector('[data-toolbar-action="toggle-filters-collapse"]');
                    if (coreButton) {
                        coreButton.click();
                    }
                });
                document.querySelectorAll('.dynblock-columns:not(.is-collapsed)').forEach((panel) => {
                    panel.classList.add('is-collapsed');
                });
                AdminGridChromePlugin.syncOverlay();
            });
        }

        static syncOverlay() {
            const overlay = document.getElementById('dynblock-filters-overlay');
            if (!overlay) {
                return;
            }
            const open = document.querySelector('.dynblock-filters:not(.is-collapsed), .dynblock-columns:not(.is-collapsed)');
            if (open && open.parentNode) {
                open.parentNode.insertBefore(overlay, open);
            }
            overlay.classList.toggle('overlay-visible', !!open);
            const main = document.getElementById('admin-main');
            if (open) {
                document.body.style.overflow = 'hidden';
                if (main && main.dataset.filterScrollLock !== '1') {
                    main.dataset.filterScrollLock = '1';
                    main.style.overflow = 'hidden';
                }
                return;
            }
            if (main && main.dataset.filterScrollLock === '1') {
                main.style.overflow = '';
                delete main.dataset.filterScrollLock;
            }
            const shared = document.getElementById('sidebar-overlay');
            if (!shared || !shared.classList.contains('overlay-visible')) {
                document.body.style.overflow = '';
            }
        }

        bindFilterBadge(filters, button) {
            if (!filters || !button || filters.dataset.filterBadge === '1') {
                return;
            }
            filters.dataset.filterBadge = '1';
            const paint = () => this.paintFilterBadge(filters, button);
            filters.addEventListener('input', paint);
            filters.addEventListener('change', paint);
            paint();
        }

        paintFilterBadge(filters, button) {
            if (!button || !filters) {
                return;
            }
            let count = 0;
            filters.querySelectorAll('.filter-item').forEach((item) => {
                if (this.fieldHasValue(item)) {
                    count += 1;
                }
            });
            let badge = button.querySelector('.filter-active-badge');
            if (count === 0) {
                if (badge) {
                    badge.remove();
                }
                button.setAttribute('aria-label', 'Фильтры');
                return;
            }
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'filter-active-badge';
                badge.setAttribute('aria-hidden', 'true');
                button.appendChild(badge);
            }
            badge.textContent = String(count);
            button.setAttribute('aria-label', 'Фильтры, выбрано ' + count);
        }

        bindColumnSettings(section, button) {
            if (!button) {
                button = section.querySelector('[data-toolbar-action="table-settings"]');
            }
            if (!button || button.dataset.columnSidebar === '1') {
                return;
            }
            button.dataset.columnSidebar = '1';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.openColumns(section);
            }, true);
        }

        columnsPanel(section) {
            let panel = section.querySelector('.dynblock-columns');
            if (panel) {
                return panel;
            }
            panel = document.createElement('div');
            panel.className = 'dynblock-columns is-collapsed';
            panel.innerHTML = ''
                + '<div class="dynblock-columns__header">'
                + '<h4 class="dynblock-columns__title">Настройка таблицы</h4>'
                + '<button type="button" class="btn-icon dynblock-columns__close" aria-label="Закрыть">'
                + '<span class="nav-item__icon" data-icon="System/close-line"></span>'
                + '</button>'
                + '</div>'
                + '<div class="dynblock-columns__body"></div>';
            section.appendChild(panel);
            const close = panel.querySelector('.dynblock-columns__close');
            if (close) {
                close.addEventListener('click', () => this.closeColumns(section));
            }
            const icon = panel.querySelector('[data-icon]');
            if (icon && window.IconSystem && typeof window.IconSystem.replaceIcon === 'function') {
                window.IconSystem.replaceIcon(icon);
            }
            return panel;
        }

        async openColumns(section) {
            const filters = section.querySelector('.dynblock-filters');
            this.closeFilters(filters);
            const panel = this.columnsPanel(section);
            const body = panel.querySelector('.dynblock-columns__body');
            const toolbar = section.querySelector('.dynblock-toolbar');
            const tableName = toolbar ? (toolbar.dataset.table || '') : '';
            const templateAlias = toolbar ? (toolbar.dataset.templateAlias || 'base') : 'base';
            if (!body || tableName === '' || typeof window.loadTableConfigContent !== 'function') {
                return;
            }
            body.innerHTML = '<div class="text-muted">Загрузка…</div>';
            panel.classList.remove('is-collapsed');
            AdminGridChromePlugin.ensureOverlay();
            AdminGridChromePlugin.syncOverlay();
            body.innerHTML = await window.loadTableConfigContent(tableName, templateAlias);
            body.querySelectorAll('[data-icon]').forEach((icon) => {
                if (window.IconSystem && typeof window.IconSystem.replaceIcon === 'function') {
                    window.IconSystem.replaceIcon(icon);
                }
            });
            const cancel = body.querySelector('.table-config-actions .btn-outline-secondary');
            if (cancel) {
                cancel.removeAttribute('onclick');
                cancel.addEventListener('click', () => this.closeColumns(section));
            }
        }

        closeColumns(section) {
            const panel = section.querySelector('.dynblock-columns');
            if (!panel || panel.classList.contains('is-collapsed')) {
                return;
            }
            panel.classList.add('is-collapsed');
            AdminGridChromePlugin.syncOverlay();
        }

        fieldHasValue(item) {
            const boxes = item.querySelectorAll('input[type="checkbox"]');
            for (let i = 0; i < boxes.length; i++) {
                if (boxes[i].checked) {
                    return true;
                }
            }
            const fields = item.querySelectorAll('input:not([type="checkbox"]), select');
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                if (field.tagName === 'SELECT') {
                    const selected = field.selectedOptions || [];
                    for (let j = 0; j < selected.length; j++) {
                        if (selected[j].value !== '') {
                            return true;
                        }
                    }
                    continue;
                }
                if (String(field.value || '').trim() !== '') {
                    return true;
                }
            }
            return false;
        }
    }

    window.registerProjectPlugin('admin-grid-chrome', AdminGridChromePlugin);
})();
