;(function () {
    'use strict';

    const DEFAULT_ENDPOINT = '/jsapi/user.cnt-number-lookup';
    const DEFAULT_DIGITS = 9;

    const stripDigits = (value) => String(value ?? '').replace(/\D+/g, '');

    const dispatchChange = (target, detail) => {
        if (!target || typeof target.dispatchEvent !== 'function') {
            return;
        }
        target.dispatchEvent(new CustomEvent('user-cnt-lookup:change', {
            bubbles: true,
            detail,
        }));
    };

    const renderLabel = (labelEl, state) => {
        if (!labelEl) {
            return;
        }
        labelEl.classList.remove('text-color-red');
        if (!state || state.status === 'idle' || state.status === 'loading') {
            labelEl.textContent = state && state.status === 'loading' ? 'Поиск…' : '';
            return;
        }
        if (state.status === 'found') {
            labelEl.textContent = 'Ответственный: ' + String(state.display_name || '');
            return;
        }
        labelEl.textContent = 'Пользователь не найден';
        labelEl.classList.add('text-color-red');
    };

    const lookupCntNumber = async (cntNumber, endpoint) => {
        if (!window.ApiService || typeof window.ApiService.get !== 'function') {
            throw new Error('ApiService недоступен');
        }
        const url = endpoint + (endpoint.includes('?') ? '&' : '?') + 'cnt_number=' + encodeURIComponent(cntNumber);
        const response = await window.ApiService.get(url);
        if (!response || response.status !== 'success' || !response.data) {
            const msg = response && response.error ? String(response.error) : 'Ошибка поиска пользователя';
            throw new Error(msg);
        }
        const data = response.data;
        if (!data.found) {
            return {
                ok: false,
                status: 'not_found',
                user_id: 0,
                cnt_number: cntNumber,
                display_name: '',
            };
        }
        return {
            ok: true,
            status: 'found',
            user_id: Number(data.user_id || 0),
            cnt_number: String(data.cnt_number || cntNumber),
            display_name: String(data.display_name || ''),
        };
    };

    const bindUserCntNumberLookup = (inputEl, labelEl, options = {}) => {
        if (!inputEl) {
            return () => {};
        }
        const digitsRequired = Number(options.digits || inputEl.getAttribute('data-user-cnt-lookup-digits') || DEFAULT_DIGITS);
        const endpoint = String(options.endpoint || inputEl.getAttribute('data-user-cnt-lookup-endpoint') || DEFAULT_ENDPOINT);
        let timer = null;
        let requestSeq = 0;

        const applyState = (state) => {
            renderLabel(labelEl, state);
            dispatchChange(inputEl, state);
        };

        const runLookup = async (digits) => {
            const seq = ++requestSeq;
            applyState({ status: 'loading', ok: false, user_id: 0, cnt_number: digits, display_name: '' });
            try {
                const result = await lookupCntNumber(digits, endpoint);
                if (seq !== requestSeq) {
                    return;
                }
                applyState(result);
            } catch (e) {
                if (seq !== requestSeq) {
                    return;
                }
                applyState({
                    ok: false,
                    status: 'error',
                    user_id: 0,
                    cnt_number: digits,
                    display_name: '',
                    error: e && e.message ? String(e.message) : 'Ошибка поиска',
                });
            }
        };

        const onInput = () => {
            const digits = stripDigits(inputEl.value);
            if (inputEl.value !== digits) {
                inputEl.value = digits;
            }
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            if (digits.length < digitsRequired) {
                requestSeq += 1;
                applyState({ status: 'idle', ok: false, user_id: 0, cnt_number: digits, display_name: '' });
                return;
            }
            if (digits.length > digitsRequired) {
                inputEl.value = digits.slice(0, digitsRequired);
            }
            const normalized = inputEl.value;
            if (normalized.length !== digitsRequired) {
                return;
            }
            timer = setTimeout(() => {
                timer = null;
                runLookup(normalized);
            }, 150);
        };

        inputEl.addEventListener('input', onInput);
        inputEl.addEventListener('paste', () => setTimeout(onInput, 0));

        if (stripDigits(inputEl.value).length === digitsRequired) {
            onInput();
        }

        return () => {
            inputEl.removeEventListener('input', onInput);
            if (timer) {
                clearTimeout(timer);
            }
        };
    };

    window.UserCntNumberLookup = {
        stripDigits,
        lookup: lookupCntNumber,
        bind: bindUserCntNumberLookup,
        renderLabel,
    };

    class UserCntNumberLookupPlugin {
        constructor(element) {
            this.element = element;
            this.unbind = null;
        }

        init() {
            const inputEl = this.element.matches('input')
                ? this.element
                : this.element.querySelector('[data-user-cnt-lookup-input], input[type="text"], input[type="tel"], input[type="number"]');
            const labelEl = this.element.querySelector('[data-user-cnt-lookup-label]');
            const digits = Number(this.element.getAttribute('data-user-cnt-lookup-digits') || DEFAULT_DIGITS);
            const endpoint = this.element.getAttribute('data-user-cnt-lookup-endpoint') || DEFAULT_ENDPOINT;

            if (inputEl && digits > 0) {
                inputEl.setAttribute('maxlength', String(digits));
                inputEl.setAttribute('inputmode', 'numeric');
                inputEl.setAttribute('autocomplete', 'off');
            }

            this.unbind = bindUserCntNumberLookup(inputEl, labelEl, { digits, endpoint });
            return this;
        }

        destroy() {
            if (typeof this.unbind === 'function') {
                this.unbind();
                this.unbind = null;
            }
        }
    }

    window.registerProjectPlugin('user-cnt-lookup', UserCntNumberLookupPlugin);
})();
