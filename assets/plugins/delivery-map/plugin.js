;(function () {
    'use strict';

    class DeliveryMapPlugin {
        constructor(element) {
            this.element = element;
            this.modalId = this.element.getAttribute('data-modal') || 'mapModal';
            this.modalEl = document.getElementById(this.modalId);
            this.map = null;
            this.cdekManager = null;
            this.postManager = null;
            this.cdekLoaded = false;
            this.postLoadTimer = null;
            this.searchTimer = null;
            this.lastSelectedPoint = null;
            /** @type {Array<Record<string, unknown>>|null} */
            this.lastTariffsList = null;
            this.onOpenClick = this.onOpenClick.bind(this);
            this.onCloseClick = this.onCloseClick.bind(this);
            this.onMapBoundsChanged = this.onMapBoundsChanged.bind(this);
        }

        async init() {
            if (!this.modalEl) return this;
            this.element.addEventListener('click', this.onOpenClick);
            const closeBtn = this.modalEl.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', this.onCloseClick);
            }
            const pointModal = document.getElementById('mapPointModal');
            const pointCloseBtn = pointModal ? pointModal.querySelector('.close') : null;
            if (pointCloseBtn) {
                pointCloseBtn.addEventListener('click', (e) => this.closeModalById('mapPointModal', e));
            }
            if (pointModal) {
                pointModal.addEventListener('click', (e) => {
                    const btn = e.target && e.target.closest ? e.target.closest('[data-delivery-tariff-choose]') : null;
                    if (!btn) return;
                    e.preventDefault();
                    const idx = parseInt(btn.getAttribute('data-tariff-index') || '', 10);
                    if (Number.isNaN(idx)) return;
                    this.onTariffChoose(idx);
                });
            }
            return this;
        }

        onCloseClick(e) {
            this.closeModalById(this.modalId, e);
        }

        closeModalById(modalId, e) {
            if (e && typeof e.preventDefault === 'function') {
                e.preventDefault();
            }
            const mgr = window.modalManager;
            if (mgr && typeof mgr.closeModal === 'function') {
                mgr.closeModal(modalId);
                return;
            }
            this.fallbackCloseModal(modalId);
        }

        /** Без ModalScenarioManager: только класс .show (см. modal.css). */
        fallbackCloseModal(modalId) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            modal.classList.remove('show', 'open');
            modal.style.zIndex = '';
            modal.style.display = '';
            if (!document.querySelector('.modal.show')) {
                const body = document.body;
                body.style.overflow = '';
                if (body.dataset.modalOriginalPaddingRight !== undefined) {
                    const original = parseFloat(body.dataset.modalOriginalPaddingRight) || 0;
                    body.style.paddingRight = original ? `${original}px` : '';
                    delete body.dataset.modalOriginalPaddingRight;
                }
            }
        }

        fallbackOpenModal(modalId, stack) {
            const el = document.getElementById(modalId);
            if (!el) return;
            const body = document.body;
            const hadOpenModal = !!document.querySelector('.modal.show');
            if (!stack) {
                document.querySelectorAll('.modal.show').forEach((m) => {
                    m.classList.remove('show');
                    m.style.zIndex = '';
                });
            }
            if (!hadOpenModal) {
                const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
                if (scrollBarWidth > 0) {
                    const pr = parseFloat(getComputedStyle(body).paddingRight) || 0;
                    body.dataset.modalOriginalPaddingRight = String(pr);
                    body.style.paddingRight = `${pr + scrollBarWidth}px`;
                }
            }
            if (stack) {
                const n = document.querySelectorAll('.modal.show').length;
                el.style.zIndex = String(1000 + (n + 1) * 10);
            } else {
                el.style.zIndex = '';
            }
            el.classList.remove('open');
            el.style.display = '';
            el.classList.add('show');
            body.style.overflow = 'hidden';
        }

        async onOpenClick(e) {
            e.preventDefault();
            const mgr = window.modalManager;
            if (mgr && typeof mgr.openModal === 'function') {
                mgr.openModal(this.modalId);
            } else {
                this.fallbackOpenModal(this.modalId, false);
            }
            await this.ensureMap();
        }

        async ensureMap() {
            if (typeof ymaps === 'undefined') {
                await this.loadYandexMaps();
            }
            // initMap() подписывается на ymaps.ready — без await точки СДЭК могут прийти раньше,
            // чем создан cdekManager, и add() просто не выполнится (cdekLoaded уже true).
            if (!this.map) {
                await this.initMap();
            }
            if (!this.cdekLoaded) {
                await this.loadCdekPointsOnce();
                // Не отмечаем «загружено», если менеджер так и не создан — иначе точки не появятся до перезагрузки страницы
                this.cdekLoaded = !!this.cdekManager;
            }
            this.schedulePostRussiaReload();
        }

        loadYandexMaps() {
            return new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-yamaps]');
                if (existing) {
                    existing.addEventListener('load', () => resolve());
                    if (typeof ymaps !== 'undefined') resolve();
                    return;
                }
                const apiKey = (window.CONFIG && window.CONFIG.modules && window.CONFIG.modules.delivery && window.CONFIG.modules.delivery.yandex_maps && window.CONFIG.modules.delivery.yandex_maps.api_key) || '';
                const src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU' + (apiKey ? '&apikey=' + encodeURIComponent(apiKey) : '');
                const s = document.createElement('script');
                s.src = src;
                s.async = true;
                s.defer = true;
                s.setAttribute('data-yamaps', '1');
                s.onload = () => resolve();
                s.onerror = (e) => reject(e);
                document.head.appendChild(s);
            });
        }

        /** @returns {Promise<void>} */
        initMap() {
            const container = this.modalEl.querySelector('#map');
            if (!container) {
                // создадим контейнер карты, если вёрстка не добавила
                const mc = document.createElement('div');
                mc.id = 'map';
                mc.style.width = '100%';
                mc.style.height = '600px';
                this.modalEl.querySelector('.modal-content')?.appendChild(mc);
            }
            return new Promise((resolve, reject) => {
                try {
                    ymaps.ready(() => {
                        try {
                            const mapContainer = this.modalEl.querySelector('#map');
                            this.map = new ymaps.Map(mapContainer, {
                                center: [55.7558, 37.6173],
                                zoom: 12,
                                controls: ['zoomControl', 'fullscreenControl', 'geolocationControl', 'typeSelector', 'searchControl']
                            });
                            this.cdekManager = new ymaps.ObjectManager({
                                clusterize: true,
                                gridSize: 64,
                                clusterDisableClickZoom: false
                            });
                            this.cdekManager.clusters.options.set('preset', 'islands#invertedOrangeClusterIcons');
                            this.map.geoObjects.add(this.cdekManager);
                            this.cdekManager.objects.events.add('click', (event) => this.onPointClick(event, this.cdekManager));

                            this.postManager = new ymaps.ObjectManager({
                                clusterize: true,
                                gridSize: 64,
                                clusterDisableClickZoom: false
                            });
                            this.postManager.clusters.options.set('preset', 'islands#invertedBlueClusterIcons');
                            this.map.geoObjects.add(this.postManager);
                            this.postManager.objects.events.add('click', (event) => this.onPointClick(event, this.postManager));

                            this.map.events.add(['boundschange', 'actionend', 'moveend'], this.onMapBoundsChanged);
                            this.bindFilterEvents();
                            this.bindAddressSearch();
                            // Первый запрос Почты России сразу после инициализации карты
                            this.schedulePostRussiaReload();
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }

        async onPointClick(event, manager) {
            const objectId = event && event.get ? event.get('objectId') : null;
            if (objectId === null || !manager || !manager.objects || typeof manager.objects.getById !== 'function') {
                return;
            }
            const object = manager.objects.getById(objectId);
            const props = object && object.properties ? object.properties : {};
            const point = {
                id: objectId,
                serviceCode: String(props.serviceCode || ''),
                type: String(props.pointType || 'pvz'),
                name: String(props.pointName || ''),
                city: String(props.pointCity || ''),
                address: String(props.pointAddress || ''),
                metadata: props.pointMeta && typeof props.pointMeta === 'object' ? props.pointMeta : {}
            };

            try {
                const ctx = window.ORDER_DELIVERY_CONTEXT || {};
                const response = await window.ApiService.post('/jsapi/delivery.calculate', {
                    serviceCode: point.serviceCode,
                    point,
                    from_location: (ctx && ctx.from_location) ? ctx.from_location : {},
                    items: Array.isArray(ctx.items) ? ctx.items : [],
                    packages: Array.isArray(ctx.packages) ? ctx.packages : []
                });
                if (!response || response.status !== 'success' || !response.data) {
                    return;
                }

                let data = response.data;
                const sc = String((data && data.serviceCode) || point.serviceCode || '');
                if (sc === 'post_russia' && data.point) {
                    const lines = await this.fetchPostRussiaWorkTime(data.point.id);
                    if (lines && lines.length) {
                        data = {
                            ...data,
                            delivery: {
                                ...(data.delivery || {}),
                                work_time_html: this.workTimeLinesToDivMarkup(lines),
                            },
                        };
                    }
                }

                this.lastSelectedPoint = data;
                this.renderPointModalDetails(data);
                this.openPointModal();
            } catch (e) {
                // noop
            }
        }

        openPointModal() {
            const modalId = 'mapPointModal';
            const mgr = window.modalManager;
            if (mgr && typeof mgr.openModal === 'function') {
                mgr.openModal(modalId, { stack: true });
                return;
            }
            this.fallbackOpenModal(modalId, true);
        }

        /** Только модалка предпросмотра пункта (после клика по карте). */
        renderPointModalDetails(data) {
            const point = (data && data.point) || {};
            const delivery = (data && data.delivery) || {};
            const serviceCode = String(data && data.serviceCode ? data.serviceCode : point.serviceCode || '');
            const serviceLabel = serviceCode === 'post_russia' ? 'Почта России' : 'СДЭК';

            const pointText = this.formatDeliveryPointCaption(serviceLabel, point);

            const storageDaysText = delivery.storage_days ? `${delivery.storage_days} дней` : '—';
            const daysText = delivery.days_description
                ? delivery.days_description
                : ((delivery.days_min && delivery.days_max)
                    ? `${delivery.days_min}-${delivery.days_max} дней`
                    : (delivery.days_min ? `${delivery.days_min} дней` : '—'));
            const costText = this.formatRub(delivery.cost || 0);

            const mapPointModal = document.getElementById('mapPointModal');
            if (mapPointModal) {
                this.setText(mapPointModal, '[data-delivery-point-text]', pointText);
                this.setText(mapPointModal, '[data-delivery-storage-days]', storageDaysText);
                this.setText(mapPointModal, '[data-delivery-days-text]', daysText);
                this.setWorkTimeBlock(mapPointModal, '[data-delivery-work-time]', delivery);
                this.setText(mapPointModal, '[data-delivery-modal-cost]', costText);
                this.renderTariffListBlock(mapPointModal, data);
            }
        }

        /**
         * Тарифы из ответа delivery.calculate (массив) или fallback на единственный delivery/tariff.
         */
        normalizeTariffsFromData(data) {
            const raw = data && data.tariffs;
            if (Array.isArray(raw) && raw.length) {
                return raw.map((t) => ({
                    tariff_code: Number(t.tariff_code ?? t.tariffCode ?? 0),
                    tariff_name: String(t.tariff_name ?? t.tariffName ?? ''),
                    delivery_sum: Number(t.delivery_sum ?? t.deliverySum ?? t.cost ?? 0),
                    period_min: t.period_min != null ? Number(t.period_min) : null,
                    period_max: t.period_max != null ? Number(t.period_max) : null,
                }));
            }
            const d = (data && data.delivery) || {};
            const t = (data && data.tariff) || {};
            if (d && Object.keys(d).length) {
                return [{
                    tariff_code: Number(t.code ?? 0),
                    tariff_name: String(t.name ?? ''),
                    delivery_sum: Number(d.cost ?? 0),
                    period_min: d.days_min != null ? Number(d.days_min) : null,
                    period_max: d.days_max != null ? Number(d.days_max) : null,
                }];
            }
            return [];
        }

        formatTariffPeriodLine(row, deliveryFallback) {
            const cost = this.formatRub(row.delivery_sum || 0);
            if (deliveryFallback && deliveryFallback.days_description) {
                return `${cost}, срок: ${deliveryFallback.days_description}`;
            }
            const min = row.period_min;
            const max = row.period_max;
            if (min != null && max != null) {
                return `${cost}, срок: ${min === max ? `${min} дн.` : `${min}-${max} дн.`}`;
            }
            if (min != null) {
                return `${cost}, срок: ${min} дн.`;
            }
            return `${cost}`;
        }

        renderTariffListBlock(mapPointModal, data) {
            const listEl = mapPointModal.querySelector('[data-delivery-tariff-list]');
            if (!listEl) return;

            const tariffs = this.normalizeTariffsFromData(data);
            this.lastTariffsList = tariffs;

            const delivery = (data && data.delivery) || {};
            const showMulti = tariffs.length > 1;

            const estH = mapPointModal.querySelector('[data-delivery-estimate-heading]');
            const estD = mapPointModal.querySelector('[data-delivery-days-text]');
            if (estH) estH.style.display = showMulti ? 'none' : '';
            if (estD) estD.style.display = showMulti ? 'none' : '';

            const singleH = mapPointModal.querySelector('[data-delivery-single-cost-heading]');
            const singleC = mapPointModal.querySelector('[data-delivery-modal-cost]');
            const showTariffList = tariffs.length > 0;
            if (singleH) singleH.style.display = showTariffList ? 'none' : '';
            if (singleC) singleC.style.display = showTariffList ? 'none' : '';

            const th = mapPointModal.querySelector('[data-delivery-tariffs-heading]');
            if (th) th.style.display = showTariffList ? '' : 'none';

            if (!tariffs.length) {
                listEl.innerHTML = '';
                return;
            }

            listEl.innerHTML = tariffs
                .map((row, index) => {
                    const code = row.tariff_code;
                    const name = row.tariff_name || '—';
                    const accent = name ? `${code} (${name})` : String(code);
                    const sub = this.formatTariffPeriodLine(row, delivery);
                    return (
                        `<div class="list-item">` +
                        `<div class="list-item-text">` +
                        `<div class="list-item-text-accent">${this.escapeHtml(accent)}</div>` +
                        `<div class="text-list">${this.escapeHtml(sub)}</div>` +
                        `</div>` +
                        `<div class="buttonDark" type="button" data-delivery-tariff-choose data-tariff-index="${index}">Выбрать</div>` +
                        `</div>`
                    );
                })
                .join('');
        }

        buildDataWithTariff(baseData, row) {
            const d0 = (baseData && baseData.delivery) ? { ...baseData.delivery } : {};
            const delivery = {
                ...d0,
                cost: Number(row.delivery_sum || 0),
                days_min: row.period_min != null ? row.period_min : d0.days_min,
                days_max: row.period_max != null ? row.period_max : d0.days_max,
            };
            const tariff = {
                code: Number(row.tariff_code || 0),
                name: String(row.tariff_name || ''),
            };

            let point;
            try {
                point = JSON.parse(JSON.stringify(baseData.point || {}));
            } catch (e) {
                point = { ...(baseData.point || {}) };
            }
            if (!point.metadata || typeof point.metadata !== 'object') {
                point.metadata = {};
            }
            point.metadata.tariff_code = tariff.code;

            return {
                ...baseData,
                point,
                delivery,
                tariff,
            };
        }

        onTariffChoose(index) {
            const list = this.lastTariffsList;
            if (!Array.isArray(list) || !list[index]) return;
            const base = this.lastSelectedPoint;
            if (!base) return;
            this.lastSelectedPoint = this.buildDataWithTariff(base, list[index]);
            this.confirmDeliverySelection();
        }

        confirmDeliverySelection() {
            if (!this.lastSelectedPoint) {
                this.closeModalById('mapPointModal');
                this.closeModalById(this.modalId);
                return;
            }
            this.applySelectedPointToAddressSelect(this.lastSelectedPoint);
            this.renderOrderPageDelivery(this.lastSelectedPoint);
            this.closeModalById('mapPointModal');
            this.closeModalById(this.modalId);
        }

        /** Блок доставки на странице заказа — после выбора тарифа («Выбрать»). */
        renderOrderPageDelivery(data) {
            const delivery = (data && data.delivery) || {};
            const daysText = delivery.days_description
                ? delivery.days_description
                : ((delivery.days_min && delivery.days_max)
                    ? `${delivery.days_min}-${delivery.days_max} дней`
                    : (delivery.days_min ? `${delivery.days_min} дней` : '—'));
            const costText = this.formatRub(delivery.cost || 0);

            this.setText(document, '[data-delivery-days]', daysText);
            this.setText(document, '[data-delivery-cost]', costText);
            this.setText(document, '[data-delivery-cost-total]', costText);
            if (typeof window !== 'undefined') {
                window.__orderRawDeliveryCost = Number(delivery.cost || 0);
                window.__orderHasDeliveryQuote = true;
                if (typeof window.orderRecalcTotals === 'function') {
                    window.orderRecalcTotals();
                } else {
                    this.updateTotalPayable(delivery.cost || 0);
                }
            } else {
                this.updateTotalPayable(delivery.cost || 0);
            }
        }

        /**
         * Селект заказа: сохранённые id + уже добавленные с карты (value с ':'), выбран — новая точка с карты.
         */
        buildOrderSavedAddressChoicesMerged(choicesApi, selectedValue, selectedLabel) {
            const saved = Array.isArray(window.ORDER_SAVED_ADDRESSES) ? window.ORDER_SAVED_ADDRESSES : [];
            const selKey = String(selectedValue);
            const byValue = new Map();
            saved.forEach((row) => {
                const v = String(row.id);
                byValue.set(v, { value: v, label: String(row.label || '') });
            });
            const store = choicesApi._store && choicesApi._store.choices;
            if (Array.isArray(store)) {
                store.forEach((c) => {
                    if (c.placeholder) return;
                    const v = String(c.value);
                    if (v.indexOf(':') !== -1 && !byValue.has(v)) {
                        byValue.set(v, { value: v, label: String(c.label || v) });
                    }
                });
            }
            if (!byValue.has(selKey)) {
                byValue.set(selKey, { value: selectedValue, label: selectedLabel });
            } else {
                const row = byValue.get(selKey);
                row.label = selectedLabel;
            }
            const out = [];
            byValue.forEach((o) => {
                out.push({
                    value: o.value,
                    label: o.label,
                    selected: String(o.value) === selKey,
                });
            });
            return out;
        }

        applySelectedPointToAddressSelect(data) {
            const point = (data && data.point) || {};
            const delivery = (data && data.delivery) || {};
            const tariff = data && data.tariff ? data.tariff : {};
            const serviceCode = String(data && data.serviceCode ? data.serviceCode : point.serviceCode || '');
            const serviceLabel = serviceCode === 'post_russia' ? 'Почта России' : 'СДЭК';
            const idCandidate = (point.metadata && (point.metadata.code || point.metadata.deliveryPointIndex)) || point.id || '';
            const value = `${serviceCode}:${String(idCandidate)}`;
            const label = this.formatDeliveryPointCaption(serviceLabel, point);

            if (typeof window.orderRememberDeliveryPoint === 'function') {
                window.orderRememberDeliveryPoint(value, point);
            }

            const select =
                document.getElementById('order-saved-address-select') ||
                document.querySelector('.choices-list');
            if (!select) {
                if (typeof window.orderWriteDeliveryPointJsonField === 'function') {
                    const hasPoint = point && typeof point === 'object' && !Array.isArray(point) && Object.keys(point).length > 0;
                    window.orderWriteDeliveryPointJsonField(hasPoint ? point : null);
                } else {
                    this.updateDebugDeliveryPointTextarea(data);
                }
                if (typeof window.orderRunAutoDeliveryCalculate === 'function') {
                    window.orderRunAutoDeliveryCalculate();
                }
                return;
            }

            const choicesApi = select._choicesInstance;
            const canSetChoices = choicesApi && typeof choicesApi.setChoices === 'function';

            if (select.id === 'order-saved-address-select' && canSetChoices) {
                const merged = this.buildOrderSavedAddressChoicesMerged(choicesApi, value, label);
                choicesApi.setChoices(merged, 'value', 'label', true);
                const rebuilt = Array.from(select.options).find((o) => o.value === value);
                if (rebuilt) {
                    try {
                        rebuilt.dataset.serviceCode = serviceCode;
                        rebuilt.dataset.pointId = String(idCandidate || '');
                        rebuilt.dataset.point = JSON.stringify(point);
                        rebuilt.dataset.delivery = JSON.stringify(delivery);
                        rebuilt.dataset.tariff = JSON.stringify(tariff);
                    } catch (e) {
                        // ignore
                    }
                }
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }

            // После инициализации Choices в нативном select остаётся только текущая опция; полный список — в store
            let choicesData = canSetChoices
                ? this.buildChoicesDataFromChoicesStore(choicesApi, value, label)
                : null;

            if (!choicesData) {
                let option = Array.from(select.options).find((o) => o.value === value);
                if (!option) {
                    option = document.createElement('option');
                    option.value = value;
                    select.appendChild(option);
                }
                option.textContent = label;
                select.value = value;
                if (canSetChoices) {
                    choicesData = this.buildChoicesDataDedupedFromSelect(select, value);
                    choicesApi.setChoices(choicesData, 'value', 'label', true);
                }
            } else {
                choicesApi.setChoices(choicesData, 'value', 'label', true);
            }

            const rebuilt = Array.from(select.options).find((o) => o.value === value);
            if (rebuilt) {
                try {
                    rebuilt.dataset.serviceCode = serviceCode;
                    rebuilt.dataset.pointId = String(idCandidate || '');
                    rebuilt.dataset.point = JSON.stringify(point);
                    rebuilt.dataset.delivery = JSON.stringify(delivery);
                    rebuilt.dataset.tariff = JSON.stringify(tariff);
                } catch (e) {
                    // ignore serialization issues
                }
            }

            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
        }

        updateDebugDeliveryPointTextarea(data) {
            // Тестовое поле в order.php: сюда кладём payload.point, чтобы можно было повторно дернуть расчет.
            const textarea = document.getElementById('delivery-point-json');
            if (!textarea) return;
            const point = (data && data.point) ? data.point : {};
            if (!point || typeof point !== 'object' || Array.isArray(point)) return;
            try {
                textarea.value = JSON.stringify(point, null, 2);
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (e) {
                // ignore
            }
        }

        /**
         * Полный набор пунктов из внутреннего store Choices + upsert адреса с карты (без дублей по value).
         */
        buildChoicesDataFromChoicesStore(choicesApi, selectedValue, selectedLabel) {
            const list = choicesApi._store && choicesApi._store.choices;
            if (!Array.isArray(list) || list.length === 0) {
                return null;
            }
            const byValue = new Map();
            for (let i = 0; i < list.length; i++) {
                const c = list[i];
                const key = String(c.value);
                if (!byValue.has(key)) {
                    byValue.set(key, {
                        value: c.value,
                        label: c.label,
                        disabled: !!c.disabled,
                        placeholder: !!c.placeholder,
                        customProperties: c.customProperties,
                    });
                }
            }
            const selKey = String(selectedValue);
            const prev = byValue.get(selKey) || {};
            byValue.set(selKey, {
                value: selectedValue,
                label: selectedLabel,
                disabled: false,
                placeholder: false,
                customProperties: prev.customProperties,
            });
            const out = [];
            byValue.forEach((o) => {
                out.push({
                    value: o.value,
                    label: o.label,
                    selected: String(o.value) === selKey,
                    disabled: !!o.disabled,
                    placeholder: !!o.placeholder,
                    customProperties: o.customProperties,
                });
            });
            return out;
        }

        /** Резерв: текущий DOM с дедупликацией по value (на случай пустого store). */
        buildChoicesDataDedupedFromSelect(select, selectedValue) {
            const selKey = String(selectedValue);
            const seen = new Set();
            const out = [];
            Array.from(select.options).forEach((o) => {
                if (seen.has(o.value)) {
                    return;
                }
                seen.add(o.value);
                out.push({
                    value: o.value,
                    label: o.innerHTML,
                    selected: String(o.value) === selKey,
                    disabled: o.disabled,
                });
            });
            return out;
        }

        /**
         * Подпись пункта: как в балуне карты — только `point.address` (полная строка из API).
         * Не дублируем city: у Почты России в address уже есть region/place/улица.
         */
        formatDeliveryPointCaption(serviceLabel, point) {
            const addr = String(point.address || '').trim();
            if (addr) {
                return `${serviceLabel}: ${addr}`;
            }
            const tail = [point.city || '', point.name || ''].filter(Boolean).join(' ').trim();
            return tail ? `${serviceLabel}: ${tail}` : `${serviceLabel}`;
        }

        setText(root, selector, value) {
            if (!root || !selector) return;
            const el = root.querySelector(selector);
            if (!el) return;
            el.textContent = String(value || '');
        }

        /**
         * Режим работы: строки в отдельных div (родитель с flex + column в вёрстке).
         */
        setWorkTimeBlock(root, selector, delivery) {
            if (!root || !selector) return;
            const el = root.querySelector(selector);
            if (!el) return;
            if (delivery.work_time_html) {
                el.innerHTML = delivery.work_time_html;
                return;
            }
            const wt = delivery.work_time || '';
            const lines = this.splitWorkTimeLinesFromString(wt);
            if (lines.length === 0) {
                el.textContent = '—';
                return;
            }
            el.innerHTML = this.workTimeLinesToDivMarkup(lines);
        }

        /**
         * Разбивает режим работы на строки по дням (СДЭК отдаёт подряд без пробела: «…21:00вт, …»).
         */
        splitWorkTimeLinesFromString(wt) {
            const s = String(wt || '').trim();
            if (!s) {
                return [];
            }
            if (s.indexOf('\n') !== -1) {
                return s.split(/\n/).map((x) => x.trim()).filter(Boolean);
            }
            const re = /(?=(?:пн|вт|ср|чт|пт|сб|вс),)/i;
            const parts = s.split(re).map((x) => x.trim()).filter(Boolean);
            return parts.length > 1 ? parts : [s];
        }

        escapeHtml(s) {
            return String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        workTimeLinesToDivMarkup(lines) {
            return (Array.isArray(lines) ? lines : [])
                .map((line) => `<div>${this.escapeHtml(line)}</div>`)
                .join('');
        }

        /**
         * Публичный GET: https://widget.pochta.ru/api/pvz/{id} — массив workTime (дни недели).
         */
        async fetchPostRussiaWorkTime(pvzId) {
            try {
                const id = String(pvzId == null ? '' : pvzId).trim();
                if (!id) {
                    return null;
                }
                const res = await fetch(`https://widget.pochta.ru/api/pvz/${encodeURIComponent(id)}`, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: {
                        accept: 'application/json',
                    },
                    referrerPolicy: 'strict-origin-when-cross-origin',
                });
                if (!res.ok) {
                    return null;
                }
                const json = await res.json();
                if (json && Array.isArray(json.workTime)) {
                    return json.workTime;
                }
            } catch (e) {
                // noop
            }
            return null;
        }

        formatRub(value) {
            const num = Number(value || 0);
            return `${num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
        }

        updateTotalPayable(deliveryCost) {
            const totalEl = document.querySelector('[data-delivery-total-payable]');
            if (!totalEl) return;
            const goodsTotal = Number(totalEl.getAttribute('data-goods-total') || 0);
            const total = goodsTotal + Number(deliveryCost || 0);
            totalEl.textContent = this.formatRub(total);
        }

        bindFilterEvents() {
            ['filter-type-pvz', 'filter-type-postamat', 'filter-service-cdek', 'filter-service-post-russia'].forEach((id) => {
                const el = this.modalEl.querySelector(`#${id}`);
                if (!el) return;
                el.addEventListener('change', () => this.applyVisibilityFilters());
            });
        }

        bindAddressSearch() {
            const input = this.modalEl.querySelector('.search-input');
            if (!input) return;

            input.addEventListener('input', () => {
                const query = String(input.value || '').trim();
                if (this.searchTimer) {
                    clearTimeout(this.searchTimer);
                }
                this.searchTimer = setTimeout(() => {
                    this.searchAddress(query).catch(() => {});
                }, 400);
            });
        }

        async searchAddress(query) {
            if (!this.map || typeof ymaps === 'undefined') return;
            if (!query || query.length < 3) return;

            try {
                const res = await ymaps.geocode(query, { results: 1 });
                const first = res && res.geoObjects ? res.geoObjects.get(0) : null;
                if (!first) return;
                const coords = first.geometry && first.geometry.getCoordinates
                    ? first.geometry.getCoordinates()
                    : null;
                if (!Array.isArray(coords) || coords.length < 2) return;

                this.map.setCenter(coords, 15, { duration: 300 });
            } catch (e) {
                // noop
            }
        }

        onMapBoundsChanged() {
            this.schedulePostRussiaReload();
        }

        schedulePostRussiaReload() {
            if (this.postLoadTimer) {
                clearTimeout(this.postLoadTimer);
            }
            this.postLoadTimer = setTimeout(() => {
                this.loadPostRussiaPointsByBounds().catch(() => {});
            }, 450);
        }

        applyVisibilityFilters() {
            const showPvz = !!(this.modalEl.querySelector('#filter-type-pvz')?.checked);
            const showPostamat = !!(this.modalEl.querySelector('#filter-type-postamat')?.checked);
            const showCdek = !!(this.modalEl.querySelector('#filter-service-cdek')?.checked);
            const showPostRussia = !!(this.modalEl.querySelector('#filter-service-post-russia')?.checked);

            if (this.cdekManager) {
                this.cdekManager.setFilter((obj) => {
                    const type = String(obj?.properties?.pointType || 'pvz');
                    if (!showCdek) return false;
                    if (type === 'pvz' && !showPvz) return false;
                    if (type === 'postamat' && !showPostamat) return false;
                    return true;
                });
            }
            if (this.postManager) {
                this.postManager.setFilter((obj) => {
                    const type = String(obj?.properties?.pointType || 'pvz');
                    if (!showPostRussia) return false;
                    if (type === 'pvz' && !showPvz) return false;
                    if (type === 'postamat' && !showPostamat) return false;
                    return true;
                });
            }
        }

        async loadCdekPointsOnce() {
            try {
                const resp = await window.ApiService.post('/jsapi/delivery.points', { action: 'cdek' });
                const payload = (resp && resp.status === 'success') ? (resp.data || {}) : {};
                const cdekPoints = Array.isArray(payload.points) ? payload.points : [];
                if (!cdekPoints.length) {
                    const rebuilt = await window.ApiService.post('/jsapi/delivery.points', { action: 'cdek_build' });
                    const rebuiltPayload = (rebuilt && rebuilt.status === 'success') ? (rebuilt.data || {}) : {};
                    cdekPoints.push(...(Array.isArray(rebuiltPayload.points) ? rebuiltPayload.points : []));
                }

                const features = this.toFeatures(cdekPoints, 'cdek');
                if (this.cdekManager) {
                    this.cdekManager.removeAll();
                    if (features.length) {
                        this.cdekManager.add({ type: 'FeatureCollection', features });
                    }
                } else {
                    // Не должно случаться после await initMap; на всякий случай не фиксируем cdekLoaded снаружи без менеджера
                    console.warn('[delivery-map] cdekManager отсутствует после загрузки точек СДЭК');
                }
                this.applyVisibilityFilters();
            } catch (e) {
                // noop
            }
        }

        async loadPostRussiaPointsByBounds() {
            if (!this.map || !this.postManager) return;

            const postChecked = !!(this.modalEl.querySelector('#filter-service-post-russia')?.checked);
            if (!postChecked) {
                this.postManager.removeAll();
                this.applyVisibilityFilters();
                return;
            }

            const bounds = this.map.getBounds();
            if (!Array.isArray(bounds) || bounds.length < 2) return;

            const bottomLeft = bounds[0];
            const topRight = bounds[1];
            const payload = {
                settings_id: 52427,
                pageSize: 200,
                page: 1,
                currentTopRightPoint: [topRight[1], topRight[0]], // [lon, lat]
                currentBottomLeftPoint: [bottomLeft[1], bottomLeft[0]], // [lon, lat]
                pvzType: ['russian_post', 'additional_pvz', 'postamat']
            };

            try {
                const response = await fetch('https://widget.pochta.ru/api/pvz', {
                    method: 'POST',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: {
                        'accept': '*/*',
                        'content-type': 'application/json',
                        'cache-control': 'no-cache',
                        'pragma': 'no-cache'
                    },
                    referrerPolicy: 'strict-origin-when-cross-origin',
                    body: JSON.stringify(payload)
                });
                const responseData = await response.json();
                const rawPoints = (responseData && Array.isArray(responseData.data)) ? responseData.data : [];
                const points = rawPoints.map((point) => {
                    const geo = point && point.geo && point.geo.coordinates;
                    if (!Array.isArray(geo) || geo.length < 2) return null;
                    const addr = (point && point.address && typeof point.address === 'object') ? point.address : {};
                    const addressParts = [];
                    const pushAddrPart = (v) => {
                        const t = String(v || '').trim();
                        if (!t) return;
                        const norm = t.replace(/\s+/g, ' ').toLowerCase();
                        const last = addressParts.length
                            ? String(addressParts[addressParts.length - 1]).replace(/\s+/g, ' ').toLowerCase()
                            : '';
                        if (norm === last) return;
                        addressParts.push(t);
                    };
                    if (addr.region) pushAddrPart(addr.region);
                    if (addr.place) pushAddrPart(addr.place);
                    if (addr.street) pushAddrPart(addr.street);
                    if (addr.house) pushAddrPart(addr.house);
                    if (addr.building) pushAddrPart(`стр. ${addr.building}`);
                    if (addr.corpus) pushAddrPart(`корп. ${addr.corpus}`);
                    const type = point.type === 'postamat' ? 'postamat' : 'pvz';
                    let name = 'Отделение почтовой связи';
                    if (point.type === 'postamat') name = 'Постамат';
                    if (point.type === 'additional_pvz') name = 'Дополнительное отделение';
                    const builtAddress = addressParts.join(', ');
                    const fromApiString = point.addressString && String(point.addressString).trim();
                    return {
                        id: point.id || point.deliveryPointIndex || `POST_${Math.random().toString(36).slice(2)}`,
                        serviceCode: 'post_russia',
                        name,
                        city: addr.place || '',
                        address: fromApiString || builtAddress,
                        latitude: Number(geo[1] || 0),
                        longitude: Number(geo[0] || 0),
                        type,
                        metadata: {
                            postal_code: addr.index || null,
                            code: addr.index || point.deliveryPointIndex || null,
                            deliveryPointIndex: point.deliveryPointIndex || null
                        }
                    };
                }).filter(Boolean);
                const features = this.toFeatures(points, 'post_russia');
                this.postManager.removeAll();
                if (features.length) {
                    this.postManager.add({ type: 'FeatureCollection', features });
                }
                this.applyVisibilityFilters();
            } catch (e) {
                // noop
            }
        }

        toFeatures(points, serviceCode) {
            return (Array.isArray(points) ? points : []).map((point) => {
                if (!point || !point.latitude || !point.longitude) return null;
                const id = point.id || Math.random().toString(36).slice(2);
                const name = point.name || (serviceCode === 'cdek' ? 'ПВЗ СДЭК' : 'Точка выдачи');
                const addr = point.address || '';
                const type = point.type || 'pvz';
                return {
                    type: 'Feature',
                    id,
                    geometry: { type: 'Point', coordinates: [point.latitude, point.longitude] },
                    properties: {
                        balloonContentHeader: name,
                        balloonContentBody: addr,
                        hintContent: name,
                        pointName: name,
                        pointCity: point.city || '',
                        pointAddress: addr,
                        serviceCode: serviceCode,
                        pointType: type,
                        pointMeta: point.metadata || {}
                    },
                    options: {
                        preset: serviceCode === 'cdek'
                            ? (type === 'postamat' ? 'islands#blueCircleDotIcon' : 'islands#orangeCircleDotIcon')
                            : (type === 'postamat' ? 'islands#blueCircleDotIcon' : 'islands#darkBlueCircleDotIcon')
                    }
                };
            }).filter(Boolean);
        }
    }

    window.registerProjectPlugin('delivery-map', DeliveryMapPlugin);
})();

