/**
 * Тултипы [data-tooltip] и прочие виджеты страницы.
 * Контекстные тосты: element.toaster(message) — плагин project/web/assets/plugins/toaster/plugin.js (гидратор).
 */

class TooltipManager {
    constructor() {
        this.isMobile = this.checkIsMobile();
        this.activeTimers = new Map();
        this.activeTooltips = new Map();
        this.currentVisibleTooltip = null;

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

    hideCurrentTooltip() {
        if (this.currentVisibleTooltip) {
            const element = this.currentVisibleTooltip;
            this.hideTooltip(element);
            this.currentVisibleTooltip = null;

            const timers = this.activeTimers.get(element);
            if (timers) {
                if (timers.hideTimeout) clearTimeout(timers.hideTimeout);
                if (timers.showTimeout) clearTimeout(timers.showTimeout);
                this.activeTimers.delete(element);
            }
        }
    }

    addTooltip(element, text) {
        let hideTimeout = null;
        let showTimeout = null;
        let isTooltipVisible = false;

        const showTooltip = () => {
            if (isTooltipVisible) return;

            this.hideCurrentTooltip();

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
            this.currentVisibleTooltip = element;
            isTooltipVisible = true;


            this.activeTimers.set(element, { hideTimeout: null, showTimeout });
        };

        const hideTooltipHandler = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            if (showTimeout) {
                clearTimeout(showTimeout);
                showTimeout = null;
            }
            this.hideTooltip(element);
            isTooltipVisible = false;
            if (this.currentVisibleTooltip === element) {
                this.currentVisibleTooltip = null;
            }
            this.activeTimers.delete(element);
        };

        if (!this.isMobile) {
            element.addEventListener('mouseenter', () => {
                if (showTimeout) clearTimeout(showTimeout);
                showTimeout = setTimeout(showTooltip, 300);
            });

            element.addEventListener('mouseleave', hideTooltipHandler);
        }
        else {
            element.addEventListener('click', (e) => {
                e.stopPropagation();

                if (isTooltipVisible) {
                    hideTooltipHandler();
                } else {
                    if (showTimeout) {
                        clearTimeout(showTimeout);
                        showTimeout = null;
                    }
                    showTooltip();
                }
            });
        }
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

        if (this.currentVisibleTooltip === element) {
            this.currentVisibleTooltip = null;
        }
    }

    positionTooltip(tooltip, element) {
        const rect = element.getBoundingClientRect();
        const isMobile = this.isMobile || window.innerWidth <= 768;

        tooltip.style.maxWidth = isMobile ? '200px' : '400px';

        requestAnimationFrame(() => {
            const tooltipRect = tooltip.getBoundingClientRect();

            let top, left;

            if (isMobile) {
                left = rect.left - tooltipRect.width - 12;
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);

                if (left < 10) {
                    left = rect.right + 12;
                    tooltip.setAttribute('data-position', 'right');
                } else {
                    tooltip.setAttribute('data-position', 'left');
                }

                if (top < 10) {
                    top = 10;
                }
                if (top + tooltipRect.height > window.innerHeight - 10) {
                    top = window.innerHeight - tooltipRect.height - 10;
                }

                if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipRect.width - 10;
                }

            } else {
                top = rect.top - tooltipRect.height - 8;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

                if (left < 10) {
                    left = 10;
                }
                if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipRect.width - 10;
                }
                if (top < 10) {
                    top = rect.bottom + 8;
                    tooltip.setAttribute('data-position', 'bottom');
                } else {
                    tooltip.setAttribute('data-position', 'top');
                }

                const centerOffset = (rect.left + rect.width / 2) - left;
                tooltip.style.setProperty('--arrow-offset', `${centerOffset}px`);
            }

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        });
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

// function enableEditing(textElement) {
//     if (textElement.isEditing) return;
//
//     textElement.isEditing = true;
//     textElement.contentEditable = 'true';
//     textElement.focus();
//
//     const originalText = textElement.textContent;
//
//     function saveChanges() {
//         textElement.contentEditable = 'false';
//         textElement.isEditing = false;
//
//         const newText = textElement.textContent;
//         if (newText !== originalText) {
//             console.log(`Новый текст для ${textElement.dataset.id}:`, newText);
//             localStorage.setItem(`text_${textElement.dataset.id}`, newText);
//         }
//
//         textElement.removeEventListener('blur', saveChanges);
//         textElement.removeEventListener('keypress', onEnter);
//     }
//
//     function onEnter(e) {
//         if (e.key === 'Enter') {
//             e.preventDefault();
//             textElement.blur();
//         }
//     }
//
//     function onEscape(e) {
//         if (e.key === 'Escape') {
//             e.preventDefault();
//             textElement.textContent = originalText;
//             textElement.blur();
//         }
//     }
//
//     textElement.addEventListener('blur', saveChanges);
//     textElement.addEventListener('keypress', onEnter);
//     textElement.addEventListener('keydown', onEscape);
// }

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

//////////Функция просмотра пароля при нажатии на кнопку/////

document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        const targetId = this.dataset.target;
        const input = document.getElementById(targetId);

        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        const eyeOpen = this.querySelector('.eye-open');
        const eyeClosed = this.querySelector('.eye-closed');

        if (eyeOpen && eyeClosed) {
            if (isPassword) {
                eyeOpen.style.display = 'none';
                eyeClosed.style.display = 'block';
            } else {
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
            }
        }
    });
});


///////Иерархическое дерево///////

// ─── Data ─────────────────────────────────────────────────────────────────────
// DATA is an array of root nodes loaded from data.json.
// JSON fields: cat→id, fio→name, photo_url→avatar, email, role, lo, go,
//              qualification, activity, children[]

let DATA = [];

function transformNode(n) {
    return {
        id:            String(n.cat),
        name:          n.fio          || '—',
        email:         n.email        || '',
        lo:            n.lo           ?? 0,
        go:            n.go           ?? 0,
        role:          n.role         || '—',
        qualification: n.qualification|| '—',
        activity:      n.activity     || '—',
        avatar:        n.photo_url    || null,
        children:      (n.children || []).map(transformNode),
    };
}

async function loadData() {
    const res  = await fetch('data.json');
    const json = await res.json();
    DATA = json.tree.map(transformNode);
    render(DATA);
    centerTree();
    applyTransform();
    requestAnimationFrame(() => {
        const card = document.querySelector('.detail-card');
        if (card) {
            MODES.detailed.NODE_H = card.offsetHeight;
            if (currentMode === 'detailed') {
                document.getElementById('lines').innerHTML = buildLines(lastItems);
            }
        }
    });
}

// ─── Mode config ──────────────────────────────────────────────────────────────
// DETAIL_THRESHOLD: scale at which we switch from compact → detailed
const DETAIL_THRESHOLD = 1.05;

const MODES = {
    compact: {
        CELL:   114,   // px per leaf column
        ROWH:   100,   // px between level y-tops (reduced; long-name levels get +30 via EXTRA_H_ROWH)
        NODE_H:  70,   // px: node element height (avatar 41 + gap 8 + name ~16 + buffer 5)
        PAD:     55,   // left / top padding
    },
    detailed: {
        CELL:   270,   // px per leaf column (card 250 + 20 margin)
        ROWH:   330,   // px between level y-tops (card ~240 + 90 gap)
        NODE_H: 242,   // px: card element height (measured from CSS)
        PAD:     60,
    },
};

let currentMode = 'compact';
function cfg() { return MODES[currentMode]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function leafCount(node) {
    return node.children?.length
        ? node.children.reduce((s, c) => s + leafCount(c), 0)
        : 1;
}

function initials(name) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Layout ───────────────────────────────────────────────────────────────────
// y = TOP of node element (not avatar center)
// roots — array of root nodes (forest support)
//
// Simulate CSS word-wrap to count visual lines (compact mode only).
// CHARS_PER_LINE ≈ max-width(105px) / avg-char-width(7.5px) ≈ 14
const CHARS_PER_LINE = 14;
const LINE_H         = 17;  // px per extra text line (13px × 1.3 line-height)
const GAP_PER_LINE   = 10;  // extra connector gap px per extra wrap line

// Returns number of EXTRA lines beyond the first (0 = 1 line, 1 = 2 lines, 2 = 3 lines).
function nameExtraLines(name) {
    const words = name.trim().split(/\s+/);
    let lines = 1, lineLen = 0;
    for (const w of words) {
        if (lineLen === 0) { lineLen = w.length; }
        else if (lineLen + 1 + w.length <= CHARS_PER_LINE) { lineLen += 1 + w.length; }
        else { lines++; lineLen = w.length; }
    }
    return lines - 1;
}

function computeLayout(roots) {
    if (!roots || !roots.length) return [];
    const items = [];
    const c = cfg();

    // Pass 1: max visual lines per depth (compact only — detail cards have fixed width)
    const maxExtraLines = {};
    function scanDepths(node, depth) {
        const el = currentMode === 'compact' ? nameExtraLines(node.name) : 0;
        maxExtraLines[depth] = Math.max(maxExtraLines[depth] || 0, el);
        for (const child of (node.children || [])) scanDepths(child, depth + 1);
    }
    for (const root of roots) scanDepths(root, 0);

    // Pre-compute cumulative Y offsets per depth (based on depth-max → no row overlap)
    const maxDepth = Math.max(...Object.keys(maxExtraLines).map(Number));
    const yAt = [c.PAD];
    for (let d = 0; d <= maxDepth; d++) {
        yAt.push(yAt[d] + c.ROWH + (maxExtraLines[d] || 0) * (LINE_H + GAP_PER_LINE));
    }

    // Pass 2: assign positions
    function walk(node, left, depth) {
        const lc = leafCount(node);
        const x  = c.PAD + (left + lc / 2) * c.CELL;
        const y  = yAt[depth];
        // nodeH per-node (individual name lines) → lineFrom in buildLines is exact
        const el = currentMode === 'compact' ? nameExtraLines(node.name) : 0;
        items.push({ node, x, y, nodeH: c.NODE_H + el * LINE_H, longName: el > 0 });
        let cl = left;
        for (const child of (node.children || [])) {
            walk(child, cl, depth + 1);
            cl += leafCount(child);
        }
    }
    let cl = 0;
    for (const root of roots) {
        walk(root, cl, 0);
        cl += leafCount(root);
    }
    return items;
}

// ─── SVG connector lines ──────────────────────────────────────────────────────
function buildLines(items) {
    const c     = cfg();
    const idMap = new Map(items.map(p => [p.node.id, p]));

    // Arrow marker: rightward triangle, tip at refX
    let svg = `<defs>
    <marker id="arr" markerWidth="9" markerHeight="9" refX="9" refY="4.5"
            orient="auto" markerUnits="userSpaceOnUse">
      <polygon points="0,0 9,4.5 0,9" fill="#121212" fill-opacity="0.35"/>
    </marker>
  </defs>`;

    const S    = 'stroke="#121212" stroke-width="1" stroke-opacity="0.3"';
    const SARR = `${S} marker-end="url(#arr)"`;

    for (const { node, x, y, nodeH } of items) {
        const kids = node.children || [];
        if (!kids.length) continue;

        const lineFrom = y + nodeH;               // below node content
        const kInfos   = kids.map(k => idMap.get(k.id));
        const childTop = kInfos[0].y;             // top of child nodes (same for all at same depth)
        const mid      = (lineFrom + childTop) / 2;

        const kxs  = kInfos.map(k => k.x);
        const minX = Math.min(...kxs);
        const maxX = Math.max(...kxs);

        // Vertical: parent bottom → mid
        svg += `<line x1="${x}"    y1="${lineFrom}" x2="${x}"    y2="${mid}"     ${S}/>`;
        // Horizontal: span all children
        if (kids.length > 1)
            svg += `<line x1="${minX}" y1="${mid}"     x2="${maxX}" y2="${mid}"     ${S}/>`;
        // Vertical with arrowhead: mid → each child top
        for (const kx of kxs)
            svg += `<line x1="${kx}"  y1="${mid}"     x2="${kx}"   y2="${childTop}" ${SARR}/>`;
    }

    return svg;
}

// ─── Render ───────────────────────────────────────────────────────────────────
let lastItems = [];

function render(roots) {
    const canvas = document.getElementById('canvas');
    const svgEl  = document.getElementById('lines');
    const c      = cfg();

    // Clear previous nodes
    canvas.querySelectorAll('.tree-node, .detail-card').forEach(el => el.remove());

    if (!roots || !roots.length) return;

    const items = computeLayout(roots);
    lastItems = items;

    // Canvas dimensions
    const maxX = Math.max(...items.map(p => p.x)) + c.PAD + c.CELL / 2;
    const maxY = Math.max(...items.map(p => p.y + p.nodeH)) + c.PAD;
    canvas.style.width  = maxX + 'px';
    canvas.style.height = maxY + 'px';
    svgEl.setAttribute('width',  maxX);
    svgEl.setAttribute('height', maxY);
    svgEl.innerHTML = buildLines(items);

    // Build node elements
    for (const item of items) {
        if (currentMode === 'compact') {
            renderCompact(item, canvas);
        } else {
            renderDetailed(item, canvas);
        }
    }
}

function renderCompact({ node, x, y, longName }, canvas) {
    const el = document.createElement('div');
    el.className = 'tree-node';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    const av = document.createElement('div');
    av.className = 'node-avatar';
    if (node.avatar) {
        const img = document.createElement('img');
        img.src = node.avatar; img.alt = node.name;
        av.appendChild(img);
    } else {
        av.textContent = initials(node.name);
    }

    const nm = document.createElement('div');
    nm.className  = 'node-name' + (longName ? ' wrap' : '');
    nm.textContent = node.name;

    el.append(av, nm);
    el.addEventListener('mouseenter', e => showTip(node, e));
    el.addEventListener('mouseleave', hideTip);
    canvas.appendChild(el);
}

function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderDetailed({ node, x, y }, canvas) {
    const FIELDS = [
        ['ЛО', node.lo], ['ГО', node.go], ['Роль', node.role],
        ['Email', node.email], ['Квалификация', node.qualification], ['Активность', node.activity],
    ];

    const el = document.createElement('div');
    el.className = 'detail-card';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    const avatarHTML = node.avatar
        ? `<img src="${esc(node.avatar)}" alt="${esc(node.name)}">`
        : esc(initials(node.name));

    el.innerHTML = `
    <div class="dc-header">
      <div class="dc-avatar">${avatarHTML}</div>
      <div class="dc-name">${esc(node.name)}</div>
    </div>
    <div class="dc-fields">
      ${FIELDS.map(([l, v]) =>
        `<div class="dc-row"><span class="dc-label">${esc(l)}</span><span class="dc-value${l==='Email'?' dc-value--email':''}">${esc(v)}</span></div>`
    ).join('')}
    </div>`;

    canvas.appendChild(el);
}

// ─── Tooltip (compact mode only) ──────────────────────────────────────────────
const tipEl     = document.getElementById('tooltip');
const tipAvatar = document.getElementById('ttAvatar');
const tipName   = document.getElementById('ttName');
const tipFields = document.getElementById('ttFields');
let   tipTimer;

function showTip(node, e) {
    if (currentMode !== 'compact') return;
    clearTimeout(tipTimer);

    tipAvatar.textContent = initials(node.name);
    tipName.textContent   = node.name;
    tipFields.innerHTML   = [
        ['ЛО', node.lo], ['ГО', node.go], ['Роль', node.role],
        ['Email', node.email], ['Квалификация', node.qualification], ['Активность', node.activity],
    ].map(([l, v]) =>
        `<div class="tt-row"><span class="tt-label">${esc(l)}</span><span class="tt-value${l==='Email'?' tt-value--email':''}">${esc(v)}</span></div>`
    ).join('');

    const rect = document.getElementById('tree').getBoundingClientRect();
    const TW = 250, TH = 290;
    let tx = e.clientX - rect.left + 16;
    let ty = e.clientY - rect.top  - 20;

    if (tx + TW > rect.width  - 65) tx = e.clientX - rect.left - TW - 16;
    if (ty + TH > rect.height - 10) ty = rect.height - TH - 10;
    if (ty < 10) ty = 10;
    if (tx < 10) tx = 10;

    tipEl.style.left = tx + 'px';
    tipEl.style.top  = ty + 'px';
    tipEl.classList.add('visible');
}

function hideTip() {
    tipTimer = setTimeout(() => tipEl.classList.remove('visible'), 150);
}

tipEl.addEventListener('mouseenter', () => clearTimeout(tipTimer));
tipEl.addEventListener('mouseleave', hideTip);

// ─── Zoom & pan ───────────────────────────────────────────────────────────────
let scale = 1;
let pan   = { x: 0, y: 0 };
const STEP = 0.05, MINZ = 0.1, MAXZ = 1.05;

function centerTree() {
    const canvas  = document.getElementById('canvas');
    const wrapper = document.getElementById('tree');
    const cw = parseFloat(canvas.style.width);
    pan.x = Math.max(10, (wrapper.offsetWidth - cw * scale) / 2);
    pan.y = 20;
}

// pivotX/Y — viewport-relative point to keep fixed during mode switch.
// Passed from zoomAt so the same canvas location stays under the cursor.
function applyTransform(pivotX, pivotY) {
    const canvas  = document.getElementById('canvas');
    const wrapper = document.getElementById('tree');
    canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    document.getElementById('zPct').textContent = Math.round(scale * 100) + '%';

    const newMode = scale >= DETAIL_THRESHOLD ? 'detailed' : 'compact';
    if (newMode !== currentMode) {
        // Pivot defaults to viewport center when no cursor position is known
        const px = pivotX ?? wrapper.offsetWidth  / 2;
        const py = pivotY ?? wrapper.offsetHeight / 2;

        // Canvas-space fraction of the pivot point BEFORE re-render
        const oldW = parseFloat(canvas.style.width)  || 1;
        const oldH = parseFloat(canvas.style.height) || 1;
        const fx = (px - pan.x) / (scale * oldW);
        const fy = (py - pan.y) / (scale * oldH);

        currentMode = newMode;
        if (currentMode === 'compact') tipEl.classList.remove('visible');
        render(DATA);

        // Re-anchor pan so the same canvas fraction sits under the pivot
        const newW = parseFloat(canvas.style.width);
        const newH = parseFloat(canvas.style.height);
        pan.x = px - fx * newW * scale;
        pan.y = py - fy * newH * scale;

        canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    }
}

// Zoom towards a specific point in the viewport (px relative to tree element).
// For button clicks, pass the viewport center.
function zoomAt(newScale, pivotX, pivotY) {
    const canvasX = (pivotX - pan.x) / scale;
    const canvasY = (pivotY - pan.y) / scale;
    scale = newScale;
    pan.x = pivotX - canvasX * scale;
    pan.y = pivotY - canvasY * scale;
    applyTransform(pivotX, pivotY);
}

document.getElementById('zIn').onclick  = () => {
    const w = document.getElementById('tree');
    zoomAt(Math.min(MAXZ, +(scale + STEP).toFixed(2)), w.offsetWidth / 2, w.offsetHeight / 2);
};
document.getElementById('zOut').onclick = () => {
    const w = document.getElementById('tree');
    zoomAt(Math.max(MINZ, +(scale - STEP).toFixed(2)), w.offsetWidth / 2, w.offsetHeight / 2);
};

document.getElementById('tree').addEventListener('wheel', e => {
    e.preventDefault();
    const rect  = document.getElementById('tree').getBoundingClientRect();
    const delta = e.deltaY > 0 ? -STEP : STEP;
    zoomAt(
        Math.max(MINZ, Math.min(MAXZ, +(scale + delta).toFixed(2))),
        e.clientX - rect.left,
        e.clientY - rect.top
    );
}, { passive: false });

// Pan — mouse
let drag = false, ds = { x:0, y:0 }, ps = { x:0, y:0 };
const treeEl = document.getElementById('tree');

treeEl.addEventListener('mousedown', e => {
    if (e.target.closest('.zoom-controls, .node-tooltip')) return;
    drag = true;
    ds = { x: e.clientX, y: e.clientY };
    ps = { ...pan };
    treeEl.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
    if (!drag) return;
    pan = { x: ps.x + (e.clientX - ds.x), y: ps.y + (e.clientY - ds.y) };
    document.getElementById('canvas').style.transform =
        `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
});
window.addEventListener('mouseup', () => {
    drag = false;
    treeEl.classList.remove('dragging');
});

// Pan + pinch-zoom — touch
let lastTouches = null;

function touchMidpoint(touches) {
    const rect = treeEl.getBoundingClientRect();
    return {
        x: ((touches[0].clientX + touches[1].clientX) / 2) - rect.left,
        y: ((touches[0].clientY + touches[1].clientY) / 2) - rect.top,
    };
}
function touchDist(touches) {
    return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
    );
}

treeEl.addEventListener('touchstart', e => {
    if (e.target.closest('.zoom-controls, .node-tooltip')) return;
    e.preventDefault();
    lastTouches = e.touches;
    ps = { ...pan };
    if (e.touches.length === 1) {
        ds = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
}, { passive: false });

treeEl.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!lastTouches) return;

    if (e.touches.length === 1) {
        // Pan with one finger
        pan = {
            x: ps.x + (e.touches[0].clientX - ds.x),
            y: ps.y + (e.touches[0].clientY - ds.y),
        };
        document.getElementById('canvas').style.transform =
            `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    } else if (e.touches.length === 2) {
        // Pinch-zoom
        const prevDist = touchDist(lastTouches.length >= 2 ? lastTouches : e.touches);
        const newDist  = touchDist(e.touches);
        const mid      = touchMidpoint(e.touches);
        const ratio    = newDist / (prevDist || newDist);
        const newScale = Math.max(MINZ, Math.min(MAXZ, +(scale * ratio).toFixed(3)));
        zoomAt(newScale, mid.x, mid.y);
        // Reset pan start so a follow-up single-finger pan is smooth
        ps = { ...pan };
        ds = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    lastTouches = e.touches;
}, { passive: false });

treeEl.addEventListener('touchend', e => {
    lastTouches = e.touches.length ? e.touches : null;
    if (e.touches.length === 1) {
        ps = { ...pan };
        ds = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
}, { passive: false });

// ─── Init ─────────────────────────────────────────────────────────────────────
loadData();