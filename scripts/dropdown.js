document.addEventListener('DOMContentLoaded', function() {
    const choicesOpts = {
        searchEnabled: false,
        itemSelectText: '',
        shouldSort: false,
        placeholder: true,
        placeholderValue: 'Сортировать по',
    };

    const catalogSelect = document.querySelector('#catalogSortSelect');
    if (catalogSelect) {
        if (catalogSelect._choicesInstance) {
            catalogSelect._choicesInstance.destroy();
        }

        const instance = new Choices(catalogSelect, choicesOpts);
        catalogSelect._choicesInstance = instance;

        setTimeout(() => {
            const container = document.querySelector('.choices');
            const inner = document.querySelector('.choices__inner');

            if (inner) {
                inner.style.pointerEvents = 'auto';
                inner.style.cursor = 'pointer';

                inner.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (container.classList.contains('is-open')) {
                        instance.hideDropdown();
                    } else {
                        instance.showDropdown();
                    }
                });
            }
        }, 50);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const choicesOpts = {
        searchEnabled: false,
        itemSelectText: '',
        shouldSort: false,
        placeholder: true,
        placeholderValue: 'Сортировать по',
    };

    function initChoices(selectElement) {
        if (selectElement && !selectElement._choicesInstance) {
            selectElement._choicesInstance = new Choices(selectElement, choicesOpts);
        }
        return selectElement?._choicesInstance;
    }

    document.querySelectorAll('.choices-single, #catalogSortSelect').forEach(initChoices);
});

document.addEventListener('DOMContentLoaded', function() {
    const choicesAddressOpts = {
        searchEnabled: false,
        itemSelectText: '',
        shouldSort: false,
        placeholder: true,
        placeholderValue: 'Сортировать по',
    };
    document.querySelectorAll('.choices-address').forEach(function (el) {
        new Choices(el, choicesAddressOpts);
    });
});

function showAnswer(button) {
    const answer = button.nextElementSibling;
    answer.style.display = 'flex';
    button.remove();
}

function toggleAnswer(button) {
    const container = button.closest('.message-container');
    const answerBlock = container.querySelector('.message-text');

    const isOpen = answerBlock.classList.contains('show');

    if (isOpen) {
        answerBlock.classList.remove('show');
        button.textContent = 'Открыть';
    } else {
        answerBlock.classList.add('show');
        button.textContent = 'Скрыть';
    }
}

window.showAnswer = showAnswer;
window.toggleAnswer = toggleAnswer;

///Аккордеон///

document.addEventListener('DOMContentLoaded', function() {
    const accordionButtons = document.querySelectorAll('.accordion-button');

    const accordionType = 'single';

    accordionButtons.forEach(button => {
        button.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const isActive = this.classList.contains('active');

            if (accordionType === 'single') {
                accordionButtons.forEach(otherButton => {
                    if (otherButton !== this) {
                        otherButton.classList.remove('active');
                        const otherContent = otherButton.nextElementSibling;
                        otherContent.style.maxHeight = null;
                    }
                });
            }

            this.classList.toggle('active');

            if (!isActive) {
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                content.style.maxHeight = null;
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const dropdowns = document.querySelectorAll('.diagram-dropdown');

    dropdowns.forEach(function(element) {
        new Choices(element, {
            searchEnabled: false,
            itemSelectText: '',
            shouldSort: false,
            placeholder: true,
            placeholderValue: element.getAttribute('data-placeholder')
        });
    });
});

// ========== ИСПРАВЛЕННЫЙ БЛОК ДЛЯ .choices-list ==========
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.choices-list').forEach(function (element) {
        if (!element || element.tagName !== 'SELECT') return;

        Array.from(element.options).forEach((option, index) => {
            if (!option.value || option.value === '') {
                option.value = `option_${index}`;
            }
        });

        const placeholderText = element.getAttribute('data-placeholder') || 'Выберите товар';
        const searchOff = element.hasAttribute('data-choices-no-search');
        const noPlaceholder = element.getAttribute('data-choices-no-placeholder') === 'true';
        const rsa = element.getAttribute('data-choices-render-selected');
        const renderSelectedChoices = rsa === 'false' || rsa === 'auto' ? false : 'always';

        const singleList = new Choices(element, {
            searchEnabled: !searchOff,
            searchPlaceholderValue: 'Поиск',
            searchResultLimit: 10,
            itemSelectText: '',
            shouldSort: false,
            placeholder: !noPlaceholder,
            placeholderValue: noPlaceholder ? '' : placeholderText,
            renderSelectedChoices: renderSelectedChoices,
            callbackOnCreateTemplates: function(template) {
                return {
                    item: (classNames, data) => {
                        if (data.placeholder) {
                            return template(`
                                <div class="${classNames.item} ${classNames.placeholder}" data-item data-id="${data.id}" data-value="${data.value}" aria-selected="true">
                                    ${data.label}
                                </div>
                            `);
                        }
                        return template(`
                            <div class="${classNames.item} ${data.highlighted ? classNames.highlightedState : classNames.itemSelectable}" data-item data-id="${data.id}" data-value="${data.value}" ${data.active ? 'aria-selected="true"' : ''} ${data.disabled ? 'aria-disabled="true"' : ''}>
                                ${renderCustomContent(data)}
                            </div>
                        `);
                    },
                    choice: (classNames, data) => {
                        if (data.placeholder) {
                            return '';
                        }
                        return template(`
                            <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : classNames.itemSelectable}" data-select-text="${this.config.itemSelectText}" data-choice ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'} data-id="${data.id}" data-value="${data.value}" ${data.groupId > 0 ? 'role="treeitem"' : 'role="option"'}>
                                ${renderCustomContent(data)}
                            </div>
                        `);
                    }
                };

                function renderCustomContent(data) {
                    if (data.customProperties && data.customProperties.image) {
                        const props = data.customProperties;
                        const showPoints = props.show_points === true || props.show_points === 1 || props.show_points === '1';
                        const pointsLabel = props.points ? String(props.points).trim() : '';
                        const pointsHtml = (showPoints && pointsLabel !== '')
                            ? `<div class="points">${pointsLabel}</div>`
                            : '';
                        return `
                            <div class="choices__item-custom">
                                <img src="${props.image}" alt="">
                                <span class="item-title" style="max-width:100%; white-space:normal">${data.label}</span>
                                <div class="cart-price">
                                     <span class="price">${props.price}</span>
                                </div>
                                ${pointsHtml}
                            </div>
                        `;
                    }
                    return data.label;
                }
            },
            callbackOnInit: function() {
                const choicesInstance = this;
                const outer = choicesInstance.containerOuter && choicesInstance.containerOuter.element;
                const container = choicesInstance.containerOuter.element;

                function resetChoicesInlineWidth() {
                    if (!outer) return;
                    outer.style.removeProperty('width');
                    outer.style.removeProperty('min-width');
                    outer.style.removeProperty('max-width');
                    const inner = outer.querySelector('.choices__inner');
                    if (inner) {
                        inner.style.removeProperty('width');
                        inner.style.removeProperty('min-width');
                        inner.style.removeProperty('max-width');
                    }
                }

                resetChoicesInlineWidth();
                ['choice', 'change'].forEach(function (ev) {
                    choicesInstance.passedElement.element.addEventListener(ev, function () {
                        requestAnimationFrame(resetChoicesInlineWidth);
                    });
                });

                // Функция для скрытия плейсхолдера
                function hidePlaceholderOnSelect() {
                    const placeholderEl = container.querySelector('.choices__placeholder');
                    const hasSelectedValue = choicesInstance.getValue(true);

                    if (placeholderEl) {
                        if (hasSelectedValue && hasSelectedValue.length > 0) {
                            placeholderEl.style.display = 'none';
                        } else {
                            placeholderEl.style.display = '';
                        }
                    }
                }

                // Скрываем плейсхолдер при выборе
                choicesInstance.passedElement.element.addEventListener('change', function() {
                    setTimeout(hidePlaceholderOnSelect, 10);
                });

                // Скрываем плейсхолдер при инициализации
                setTimeout(hidePlaceholderOnSelect, 50);
            }
        });

        element._choicesInstance = singleList;
        if (element.id === 'order-saved-address-select' && typeof window.syncOrderSavedAddressChoicesFromSavedList === 'function') {
            window.syncOrderSavedAddressChoicesFromSavedList();
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const dropdowns = document.querySelectorAll('.dropdown-set');

    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.dropdown-trigger');

        if (trigger) {
            trigger.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdowns.forEach(d => {
                    if (d !== dropdown && d.classList.contains('active')) {
                        d.classList.remove('active');
                    }
                });
                dropdown.classList.toggle('active');
            });
        }
    });

    document.addEventListener('click', function(e) {
        const dropdowns = document.querySelectorAll('.dropdown-set');
        let clickedInside = false;

        dropdowns.forEach(dropdown => {
            if (dropdown.contains(e.target)) {
                clickedInside = true;
            }
        });

        if (!clickedInside) {
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
});