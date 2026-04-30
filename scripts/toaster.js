/**
 * Тултипы [data-tooltip] и прочие виджеты страницы.
 * Контекстные тосты: element.toaster(message) — плагин project/web/assets/plugins/toaster/plugin.js (гидратор).
 */

class TooltipManager {
    constructor() {
        this.isMobile = this.checkIsMobile();
        this.activeTimers = new Map();
        this.activeTooltips = new Map();

        if (!this.isMobile) {
            this.init();
        }
    }

    checkIsMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }

    init() {
        const elementsWithTooltip = document.querySelectorAll('[data-tooltip]');

        elementsWithTooltip.forEach(element => {
            if (!element.hasAttribute('data-tooltip-initialized')) {
                const tooltipText = element.getAttribute('data-tooltip');
                if (tooltipText) {
                    this.addTooltip(element, tooltipText);
                    element.setAttribute('data-tooltip-initialized', 'true');
                }
            }
        });
    }

    addTooltip(element, text) {
        let hideTimeout = null;
        let showTimeout = null;

        const showTooltip = () => {
            this.hideTooltip(element);

            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = text;
            tooltip.setAttribute('data-for', element.id || Math.random());

            document.body.appendChild(tooltip);

            this.positionTooltip(tooltip, element);

            setTimeout(() => {
                tooltip.classList.add('show');
            }, 10);

            this.activeTooltips.set(element, tooltip);

            hideTimeout = setTimeout(() => {
                this.hideTooltip(element);
            }, 5000);
        };

        const hideTooltip = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            if (showTimeout) {
                clearTimeout(showTimeout);
                showTimeout = null;
            }
            this.hideTooltip(element);
        };

        element.addEventListener('mouseenter', () => {
            if (showTimeout) clearTimeout(showTimeout);
            showTimeout = setTimeout(showTooltip, 300);
        });

        element.addEventListener('mouseleave', hideTooltip);
        element.addEventListener('click', hideTooltip);
    }

    hideTooltip(element) {
        const tooltip = this.activeTooltips.get(element);
        if (tooltip && tooltip.parentNode) {
            tooltip.classList.remove('show');
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.remove();
                }
            }, 200);
            this.activeTooltips.delete(element);
        }
    }

    positionTooltip(tooltip, element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top = rect.top - tooltipRect.height - 8;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        if (top < 10) {
            top = rect.bottom + 8;
            tooltip.setAttribute('data-position', 'bottom');
        } else {
            tooltip.setAttribute('data-position', 'top');
        }

        if (left < 10) {
            left = 10;
        }
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        tooltip.style.position = 'fixed';
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.zIndex = '100000';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.tooltipManager = new TooltipManager();
    let tooltipScanTimer = null;
    const mo = new MutationObserver(() => {
        if (!window.tooltipManager) return;
        clearTimeout(tooltipScanTimer);
        tooltipScanTimer = setTimeout(() => {
            window.tooltipManager.init();
        }, 120);
    });
    mo.observe(document.body, { childList: true, subtree: true });
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

        if (isMobile) {
            const tooltips = document.querySelectorAll('.custom-tooltip');
            tooltips.forEach(tooltip => tooltip.remove());
        } else if (window.tooltipManager) {
            const oldTooltips = document.querySelectorAll('.custom-tooltip');
            oldTooltips.forEach(tooltip => tooltip.remove());
            window.tooltipManager = new TooltipManager();
        }
    }, 250);
});

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.stars-container').forEach((container) => {
        const stars = container.querySelectorAll('.button-stars');
        if (!stars.length) {
            return;
        }
        const form = container.closest('form');
        const rateInput = form ? form.querySelector('input[name="cnt_rate"]') : null;

        function updateStars(rating) {
            stars.forEach((star) => {
                const starIndex = parseInt(star.getAttribute('data-rating'), 10);
                if (starIndex <= rating) {
                    star.classList.add('active');
                } else {
                    star.classList.remove('active');
                }
            });
            if (rateInput) {
                rateInput.value = String(rating);
                if (window.modalManager && typeof window.modalManager.updateSubmitState === 'function') {
                    window.modalManager.updateSubmitState(form);
                }
            }
        }

        stars.forEach((star) => {
            star.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const rating = parseInt(this.getAttribute('data-rating'), 10);
                if (!Number.isFinite(rating)) {
                    return;
                }
                updateStars(rating);
            });
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

function initPhotoUpload() {
    const dropZone = document.getElementById('dropZone');
    const photoInput = document.getElementById('photoUpload');
    const fileStatus = document.getElementById('fileStatus');

    if (!dropZone || !photoInput) {
        setTimeout(initPhotoUpload, 100);
        return;
    }

    function showPreview(file) {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                let previewImg = document.getElementById('previewImg');
                if (!previewImg) {
                    previewImg = document.createElement('img');
                    previewImg.id = 'previewImg';
                    previewImg.className = 'preview-img';
                    dropZone.appendChild(previewImg);
                }
                previewImg.src = e.target.result;
                fileStatus.innerHTML = file.name;
            };
            reader.readAsDataURL(file);
        }
    }

    function resetPreview() {
        const previewImg = document.getElementById('previewImg');
        if (previewImg) previewImg.remove();
        fileStatus.innerHTML = '';
        photoInput.value = '';
    }

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            photoInput.files = dataTransfer.files;
            showPreview(file);
        } else {
            fileStatus.innerHTML = 'Выберите изображение';
        }
    });

    dropZone.addEventListener('click', () => photoInput.click());

    photoInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            showPreview(e.target.files[0]);
        }
    });
}

initPhotoUpload();


////Таблица на странице Структура

function toggleRows(parentId) {
    const parentRow = document.querySelector(`.table-row[data-id="${parentId}"]`);
    parentRow.classList.toggle('row-closed');

    const allRows = document.querySelectorAll('.table-row');

    allRows.forEach(row => {
        const rowParent = row.getAttribute('data-parent');

        if (rowParent && (rowParent === parentId || rowParent.startsWith(parentId + '-'))) {
            if (parentRow.classList.contains('row-closed')) {
                row.classList.add('is-hidden');
                row.classList.add('row-closed');
            } else {
                if (rowParent === parentId) {
                    row.classList.remove('is-hidden');
                }
            }
        }
    });
}

document.querySelectorAll('.table-row').forEach(row => {
    const level = parseInt(row.getAttribute('data-level') || '0');
    const colName = row.querySelector('.col-name');
    if (colName) {
        colName.style.setProperty('--level', level);
    }
});

///Фавиконка для темной и светлой темы

function setFaviconByTheme() {
    const favicon = document.getElementById('dynamic-favicon');

    if (!favicon) {
        return;
    }

    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isDarkMode) {
        favicon.href = './favicon/favicon-dark.ico';
    } else {
        favicon.href = './favicon/favicon.ico';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setFaviconByTheme);
} else {
    setFaviconByTheme();
}

const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
if (darkModeMediaQuery.addEventListener) {
    darkModeMediaQuery.addEventListener('change', setFaviconByTheme);
}


/////Переключение табов в модалке авторизация (legacy id; актуальная логика — в modalManager)

const legacyPhoneRadio = document.getElementById('tab-phone');
const legacyEmailRadio = document.getElementById('tab-email');
const legacyPhoneBlock = document.querySelector('.telephone');
const legacyEmailBlock = document.querySelector('.email-container');

if (legacyPhoneRadio && legacyEmailRadio && legacyPhoneBlock && legacyEmailBlock) {
    function showPhone() {
        legacyPhoneBlock.style.display = 'block';
        legacyEmailBlock.style.display = 'none';
    }

    function showEmail() {
        legacyPhoneBlock.style.display = 'none';
        legacyEmailBlock.style.display = 'block';
    }

    legacyPhoneRadio.addEventListener('change', function() {
        if (this.checked) showPhone();
    });
    legacyEmailRadio.addEventListener('change', function() {
        if (this.checked) showEmail();
    });
}