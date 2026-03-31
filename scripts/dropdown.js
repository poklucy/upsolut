document.addEventListener('DOMContentLoaded', function() {
    const choicesSingleOpts = {
        searchEnabled: false,
        itemSelectText: '',
        shouldSort: false,
        placeholder: true,
        placeholderValue: 'Сортировать по',
    };
    document.querySelectorAll('.choices-single').forEach(function (el) {
        new Choices(el, choicesSingleOpts);
    });
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


document.addEventListener('DOMContentLoaded', function() {
    const element = document.querySelector('.choices-list');

    const options = Array.from(element.options);
    const hasRealOptions = options.some(option => option.textContent.trim() !== '' && !option.disabled);

    if (!hasRealOptions) {
        const choicesContainer = element.closest('.choices');
        if (choicesContainer) {
            choicesContainer.style.display = 'none';
        } else {
            element.style.display = 'none';
        }
        return;
    }

    const singleList = new Choices(element, {
        searchEnabled: false,
        itemSelectText: '',
        shouldSort: false,
        placeholder: true,
        placeholderValue: element.getAttribute('placeholder') || 'Выберите товар',
        callbackOnCreateTemplates: function(template) {
            return {
                item: (classNames, data) => {
                    return template(`
                        <div class="${classNames.item} ${data.highlighted ? classNames.highlightedState : classNames.itemSelectable} ${data.placeholder ? classNames.placeholder : ''}" data-item data-id="${data.id}" data-value="${data.value}" ${data.active ? 'aria-selected="true"' : ''} ${data.disabled ? 'aria-disabled="true"' : ''}>
                            ${renderCustomContent(data)}
                        </div>
                    `);
                },
                choice: (classNames, data) => {
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
                    return `
                        <div class="choices__item-custom">
                            <img src="${props.image}" alt="">
                            <span class="item-title">${data.label}</span>
                            <span class="item-price">${props.price}</span>
                        </div>
                    `;
                }
                return data.label;
            }
        }
    });
    element._choicesInstance = singleList;
});

document.addEventListener('DOMContentLoaded', function() {
    // Находим ВСЕ дропдауны на странице
    const dropdowns = document.querySelectorAll('.dropdown-set');

    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.dropdown-trigger');

        // Открытие/закрытие при клике на триггер
        if (trigger) {
            trigger.addEventListener('click', function(e) {
                e.stopPropagation();
                // Закрываем другие открытые дропдауны (опционально)
                dropdowns.forEach(d => {
                    if (d !== dropdown && d.classList.contains('active')) {
                        d.classList.remove('active');
                    }
                });
                dropdown.classList.toggle('active');
            });
        }
    });

    // Закрытие всех дропдаунов при клике вне их
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