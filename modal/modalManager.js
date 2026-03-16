// Универсальный менеджер сценариев модалок
// Логика:
// - каждая форма описывается data-* атрибутами (data-scenario, data-step-id, data-action, data-required, data-validate, data-mask)
// - submit уходит AJAX-ом на data-action
// - ожидаемый ответ: { status: 'success' | 'fail', error?: string, data?: object, nextModalId?: string }
// - при success обновляем состояние сценария в localStorage и переходим на следующую модалку
// - при fail показываем текст ошибки в текущей модалке

const ModalScenarioStorage = {
    storageKey: 'modalScenarioState',

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('Cannot load modal scenario state', e);
            return null;
        }
    },

    save(state) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (e) {
            console.warn('Cannot save modal scenario state', e);
        }
    },

    clear() {
        localStorage.removeItem(this.storageKey);
    }
};

const ModalError = {
    show(form, message) {
        if (!form) return;
        const errorDiv = form.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    },

    clear(form) {
        if (!form) return;
        const errorDivs = form.querySelectorAll('.error-message');
        errorDivs.forEach(div => {
            div.textContent = '';
            div.style.display = 'none';
        });
        form.querySelectorAll('.input-error').forEach(i => i.classList.remove('input-error'));
    }
};

const ModalHooks = {
    globalTimerInterval: null,
    
    // Храним оставшееся время в секундах в localStorage: timer_${modalId} = seconds
    // 0 означает, что таймер истек
    getTimerRemaining(modalId) {
        const key = `timer_${modalId}`;
        const stored = localStorage.getItem(key);
        return stored !== null ? parseInt(stored, 10) : null;
    },
    
    setTimerRemaining(modalId, seconds) {
        const key = `timer_${modalId}`;
        if (seconds !== null && seconds !== undefined) {
            localStorage.setItem(key, seconds.toString());
        } else {
            localStorage.removeItem(key);
        }
    },
    
    startResendTimer(seconds = 5) {
        // Определяем модалку из контекста - ищем активную модалку
        const modal = document.querySelector('.modal.show');
        if (!modal) return;
        
        const btn = modal.querySelector('.resend-link[data-resend-timer="true"]');
        if (!btn) return;
        
        const modalId = modal.id;
        
        // Сохраняем начальный текст кнопки, если еще не сохранен
        if (!btn.getAttribute('data-initial-text')) {
            const currentText = btn.textContent.trim();
            // Если текущий текст не содержит таймер, сохраняем его
            if (!currentText.includes('можно через')) {
                btn.setAttribute('data-initial-text', currentText);
            } else {
                // Иначе используем дефолтный текст
                btn.setAttribute('data-initial-text', 'Запросить новый код');
            }
        }
        
        // Устанавливаем новое оставшееся время в секундах (это перезапускает таймер)
        this.setTimerRemaining(modalId, seconds);
        
        // Запускаем глобальный таймер, если еще не запущен
        if (!this.globalTimerInterval) {
            this.globalTimerInterval = setInterval(() => {
                this.updateAllTimers();
            }, 1000);
        }
        
        // Сразу обновляем текущую модалку
        this.updateTimerForModal(modalId);
    },
    
    updateTimerForModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        const btn = modal.querySelector('.resend-link[data-resend-timer="true"]');
        if (!btn) return;
        
        const remaining = this.getTimerRemaining(modalId);
        
        if (remaining === null) {
            // Таймер не был запущен
            btn.disabled = false;
            const initialText = btn.getAttribute('data-initial-text') || 'Запросить новый код';
            btn.textContent = initialText;
            return;
        }
        
        if (remaining <= 0) {
            // Таймер истек (remaining === 0) - показываем активную кнопку
            btn.disabled = false;
            const initialText = btn.getAttribute('data-initial-text') || 'Запросить новый код';
            btn.textContent = initialText;
        } else {
            // Таймер активен
            btn.disabled = true;
            const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
            const ss = String(remaining % 60).padStart(2, '0');
            btn.textContent = `Запросить новый код можно через ${mm}:${ss}`;
        }
    },
    
    updateAllTimers() {
        // Уменьшаем оставшееся время для всех активных таймеров
        document.querySelectorAll('.modal').forEach(modal => {
            const modalId = modal.id;
            const remaining = this.getTimerRemaining(modalId);
            
            if (remaining !== null) {
                if (remaining > 0) {
                    // Уменьшаем оставшееся время на 1 секунду
                    this.setTimerRemaining(modalId, remaining - 1);
                }
                // Обновляем отображение (даже если таймер истек, чтобы показать активную кнопку)
                this.updateTimerForModal(modalId);
            }
        });
    },
    
    clearTimers(modal) {
        // Таймеры теперь работают глобально и не очищаются при закрытии модалки
        // Они очищаются только при новом запросе SMS (в startResendTimer)
        // Эта функция оставлена для обратной совместимости, но ничего не делает
        if (!modal) return;
        // Не удаляем таймер из localStorage - он должен работать глобально
    }
};

const ModalScenarioManager = {
    scenarios: {
        registration: {
            startModalId: 'phoneEnterModal',
            steps: {
                phoneEnterModal: {
                    onSubmitNext: 'phoneConfirmationModal'
                },
                phoneConfirmationModal: {
                    onSubmitNext: 'emailEnterModal',
                    onClick: {
                        '[data-link-action="code-not-came"]': { nextModalId: 'phoneConfirmationModalSecondStep' }
                    }
                },
                phoneConfirmationModalSecondStep: {
                    onSubmitNext: 'emailEnterModal',
                    onOpen: function(modal) {
                        const remaining = ModalHooks.getTimerRemaining(modal.id);
                        // Если таймер уже есть (в том числе равен 0), просто синхронизируем UI
                        if (remaining !== null) {
                            ModalHooks.updateTimerForModal(modal.id);
                            return;
                        }
                        // Если таймер еще не запускали - запускаем
                        ModalHooks.startResendTimer(5);
                    },
                    onClick: {
                        '[data-link-action="resend-sms-code"]': {
                            action: 'mockData/phone-confirm-sms.json',
                            type: 'resendCode'
                        }
                    }
                },
                emailEnterModal: {
                    onSubmitNext: 'emailConfirmationModal'
                },
                emailConfirmationModal: {
                    onSubmitNext: 'registrationModal',
                    onClick: {
                        '[data-link-action="resend-code"]': { nextModalId: 'emailConfirmationModalSecondStep' }
                    }
                },
                emailConfirmationModalSecondStep: {
                    onSubmitNext: 'registrationModal',
                    onOpen: function(modal) {
                        const remaining = ModalHooks.getTimerRemaining(modal.id);
                        if (remaining !== null) {
                            ModalHooks.updateTimerForModal(modal.id);
                            return;
                        }
                        ModalHooks.startResendTimer(5);
                    },
                    onClick: {
                        '[data-link-action="resend-email-code"]': {
                            action: 'mockData/email-confirm-resend.json',
                            type: 'resendCode'
                        }
                    }
                },
                registrationModal: {
                    onSubmitNext: 'pinCreateModal'
                },
                pinCreateModal: {
                    onSubmitNext: 'pinConfirmModal'
                },
                pinConfirmModal: {
                    onSubmitNext: 'successModal'
                },
                successModal: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                        window.location.reload();
                    }
                }
            }
        },
        authorization: {
            startModalId: 'authorizationModal',
            steps: {
                authorizationModal: {
                    onSubmitNext: 'pinChangeSuccessModal',
                    onClick: {
                        '[data-link-action="forgot-pin"]': { nextModalId: 'pinChangeModal' }
                    }
                },
                pinChangeModal: {
                    onSubmitNext: 'pinCreateModal',
                    onClick: {
                        '[data-link-action="code-not-received"]': { nextModalId: 'pinChangeModalEmail' }
                    }
                },
                pinChangeModalEmail: {
                    onSubmitNext: 'pinCreateModal',
                    onOpen: function(modal) {
                        const remaining = ModalHooks.getTimerRemaining(modal.id);
                        if (remaining !== null) {
                            ModalHooks.updateTimerForModal(modal.id);
                            return;
                        }
                        ModalHooks.startResendTimer(5);
                    },
                    onClick: {
                        '[data-link-action="resend-pin-code"]': {
                            action: 'mockData/pin-recovery-email.json',
                            type: 'resendCode'
                        }
                    }
                },
                pinChangeSuccessModal: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                        window.location.reload();
                    }
                }
            }
        },
        reviewForm: {
            startModalId: 'formReviewModal',
            steps: {
                formReviewModal: {
                    onSubmitNext: 'formReviewSuccessModal'
                },
                formReviewSuccessModal: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                    }
                }
            }
        },
        questionForm: {
            startModalId: 'formQuestionModal',
            steps: {
                formQuestionModal: {
                    onSubmitNext: 'formQuestionSuccessModal'
                },
                formQuestionSuccessModal: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                    }
                }
            }
        }
    },

    currentScenarioName: null,

    startScenario(scenarioName) {
        const scenario = this.scenarios[scenarioName];
        if (!scenario) {
            console.warn('Unknown scenario', scenarioName);
            return;
        }

        this.currentScenarioName = scenarioName;
        const startId = scenario.startModalId;

        const saved = ModalScenarioStorage.load();
        let targetModalId = startId;
        let data = {};
        let resumed = false;

        // Если в localStorage уже есть сохранённый шаг ЭТОГО ЖЕ сценария — продолжаем с него
        if (saved && saved.scenario === scenarioName && saved.currentModalId) {
            targetModalId = saved.currentModalId;
            data = saved.data || {};
            resumed = true;
        }

        ModalScenarioStorage.save({
            scenario: scenarioName,
            currentModalId: targetModalId,
            data
        });

        this.openModal(targetModalId, { resumed });
    },

    ensureResumeNote(modal) {
        if (!modal) return;
        const container = modal.querySelector('.input-container');
        if (!container) return;

        const form = modal.querySelector('form');
        const scenarioName = form && form.dataset.scenario;
        if (scenarioName && this.scenarios[scenarioName]) {
            const startId = this.scenarios[scenarioName].startModalId;
            if (startId && startId === modal.id) {
                return;
            }
        }

        let note = modal.querySelector('[data-resume-note]');
        if (!note) {
            note = document.createElement('div');
            note.className = 'resume-note';
            note.setAttribute('data-resume-note', '');
            note.innerHTML = 'Вы остановились на этом шаге. Можете продолжить или ' +
                '<button type="button" class="link-button resend-link" data-resume-restart>начать заново</button>.';
            container.insertBefore(note, container.firstChild);
        }
        note.style.display = 'block';
    },

    resumeScenario() {
        const saved = ModalScenarioStorage.load();
        if (!saved || !saved.scenario || !saved.currentModalId) return;
        this.currentScenarioName = saved.scenario;
        this.openModal(saved.currentModalId, { resumed: true });
    },

    openModal(modalId, options = {}) {
        const body = document.body;
        const hadOpenModal = !!document.querySelector('.modal.show');

        document.querySelectorAll('.modal').forEach(m => {
            if (m.classList.contains('show')) {
                const prevForm = m.querySelector('form');
                const prevScenarioName =
                    (prevForm && prevForm.dataset.scenario) || this.currentScenarioName;
                const prevScenario =
                    prevScenarioName && this.scenarios[prevScenarioName];
                const prevStepCfg =
                    prevScenario && prevScenario.steps && prevScenario.steps[m.id];
                if (prevStepCfg && typeof prevStepCfg.onClose === 'function') {
                    prevStepCfg.onClose(m);
                }
                // При переходе на следующий шаг сценария сбрасываем форму предыдущей модалки
                if (prevForm) {
                    prevForm.reset();
                    ModalError.clear(prevForm);
                }
                // НЕ очищаем таймеры - они должны работать глобально независимо от состояния модалки
            }
            m.classList.remove('show');
        });

        const modal = document.getElementById(modalId);
        if (!modal) return;

        const form = modal.querySelector('form');
        ModalError.clear(form);

        // Если это первое открытие модалки (до этого не было .modal.show),
        // компенсируем исчезновение скроллбара добавлением padding-right на body.
        if (!hadOpenModal) {
            const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
            if (scrollBarWidth > 0) {
                const computedPaddingRight = parseFloat(getComputedStyle(body).paddingRight) || 0;
                body.dataset.modalOriginalPaddingRight = computedPaddingRight.toString();
                body.style.paddingRight = `${computedPaddingRight + scrollBarWidth}px`;
            }
        }

        modal.classList.add('show');
        body.style.overflow = 'hidden';

        if (options.resumed) {
            this.ensureResumeNote(modal);
        } else {
            const note = modal.querySelector('[data-resume-note]');
            if (note) {
                note.style.display = 'none';
            }
        }

        if (window.$ && $.fn.inputmask) {
            modal.querySelectorAll('input[data-mask="phone"]').forEach(input => {
                $(input).inputmask('+7 (999) 999-99-99');
            });
        }

        const scenarioName =
            this.currentScenarioName || (form && form.dataset.scenario) || null;
        const scenario = scenarioName && this.scenarios[scenarioName];
        const stepCfg =
            scenario && scenario.steps && scenario.steps[modalId];
        if (stepCfg && typeof stepCfg.onOpen === 'function') {
            stepCfg.onOpen(modal, { resumed: !!options.resumed });
        }

        // Проверяем состояние таймера для этой модалки (если таймер уже был запущен)
        ModalHooks.updateTimerForModal(modalId);

        this.updateSubmitState(form);

        const firstInput = modal.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 200);
        }

        const saved = ModalScenarioStorage.load() || {};
        if (this.currentScenarioName) {
            saved.scenario = this.currentScenarioName;
            saved.currentModalId = modalId;
            ModalScenarioStorage.save(saved);
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const form = modal.querySelector('form');
        const scenarioName =
            (form && form.dataset.scenario) || this.currentScenarioName || null;
        const scenario = scenarioName && this.scenarios[scenarioName];
        const stepCfg =
            scenario && scenario.steps && scenario.steps[modalId];
        if (stepCfg && typeof stepCfg.onClose === 'function') {
            stepCfg.onClose(modal);
        }

        // НЕ очищаем таймеры - они должны работать глобально независимо от состояния модалки
        modal.classList.remove('show');

        // Если после закрытия не осталось открытых модалок — возвращаем body в исходное состояние
        if (!document.querySelector('.modal.show')) {
            const body = document.body;
            body.style.overflow = '';

            if (body.dataset.modalOriginalPaddingRight !== undefined) {
                const original = parseFloat(body.dataset.modalOriginalPaddingRight) || 0;
                body.style.paddingRight = original ? `${original}px` : '';
                delete body.dataset.modalOriginalPaddingRight;
            }
        }
    },

    finishScenario() {
        ModalScenarioStorage.clear();
        this.currentScenarioName = null;
    },

    getLocalValidationResult(form) {
        const inputs = Array.from(form.querySelectorAll('input, textarea, select'));
        const invalidInputs = [];
        let firstErrorMessage = '';

        inputs.forEach(input => {
            const required = input.dataset.required === 'true';
            const validateType = input.dataset.validate;
            let fieldInvalid = false;
            let fieldMessage = '';

            if (required) {
                if (input.type === 'checkbox') {
                    if (!input.checked) {
                        fieldInvalid = true;
                        fieldMessage = 'Обязательное поле';
                    }
                } else if (!input.value || input.value.trim() === '') {
                    fieldInvalid = true;
                    fieldMessage = 'Обязательное поле';
                }
            }

            if (!fieldInvalid && validateType && window.Validator) {
                let result = { isValid: true, message: '' };
                const value = input.type === 'checkbox' ? input.checked : input.value;

                switch (validateType) {
                    case 'phone':
                        result = Validator.validatePhone(value);
                        break;
                    case 'email':
                        result = Validator.validateEmail(value);
                        break;
                    case 'code':
                        result = Validator.validateCode(value);
                        break;
                    case 'pin':
                        result = Validator.validatePin(value);
                        break;
                    case 'pin_confirm': {
                        const pinInput = form.querySelector('input[name="pin"]');
                        const pinValue = pinInput ? pinInput.value : '';
                        result = Validator.validatePinConfirm(pinValue, value);
                        break;
                    }
                    case 'name':
                        result = Validator.validateName(value);
                        break;
                    case 'checkbox':
                        if (!value) {
                            result = { isValid: false, message: 'Обязательное поле' };
                        }
                        break;
                }

                if (!result.isValid) {
                    fieldInvalid = true;
                    fieldMessage = result.message || 'Некорректное значение';
                }
            }

            if (fieldInvalid) {
                invalidInputs.push(input);
                if (!firstErrorMessage && fieldMessage) {
                    firstErrorMessage = fieldMessage;
                }
            }
        });

        return {
            isValid: invalidInputs.length === 0,
            invalidInputs,
            message: firstErrorMessage
        };
    },

    isFormFilled(form) {
        if (!form) return { filled: false, missing: [] };
        const inputs = Array.from(form.querySelectorAll('input, textarea, select'));
        const missing = [];

        for (const input of inputs) {
            const required = input.dataset.required === 'true';
            if (!required) continue;

            const descriptor = {
                name: input.name || null,
                type: input.type || input.tagName.toLowerCase(),
                placeholder: input.placeholder || null
            };

            if (input.type === 'checkbox') {
                if (!input.checked) {
                    missing.push(descriptor);
                }
            } else if (!input.value || input.value.trim() === '') {
                missing.push(descriptor);
            }
        }

        return {
            filled: missing.length === 0,
            missing
        };
    },

    validateForm(form) {
        ModalError.clear(form);
        const result = this.getLocalValidationResult(form);

        if (!result.isValid) {
            result.invalidInputs.forEach(input => input.classList.add('input-error'));
            if (result.message) {
                ModalError.show(form, result.message);
            }
            return false;
        }
        return true;
    },

    updateSubmitState(form) {
        if (!form) return;
        const submit = form.querySelector('button[type="submit"], input[type="submit"]');
        if (!submit) return;
        const { filled, missing } = this.isFormFilled(form);
        const disabled = !filled;
        submit.disabled = disabled;
        if (disabled) {
            if (missing.length) {
                console.log('[Modal] Submit state', {
                    enabled: false,
                    stepId: form.dataset.stepId || null,
                    scenario: form.dataset.scenario || null,
                    missing
                });
            }
            submit.style.opacity = '0.6';
            submit.style.pointerEvents = 'none';
        } else {
            console.log('[Modal] Submit state', {
                enabled: true,
                stepId: form.dataset.stepId || null,
                scenario: form.dataset.scenario || null
            });
            submit.style.opacity = '';
            submit.style.pointerEvents = '';
        }
    },

    handleFormSubmit(form, event) {
        event.preventDefault();

        const modal = form.closest('.modal');
        if (!modal) return;

        const scenarioName = form.dataset.scenario;
        this.currentScenarioName = scenarioName || this.currentScenarioName;

        if (!this.validateForm(form)) {
            if (!form.querySelector('.error-message')?.textContent) {
                ModalError.show(form, 'Проверьте правильность заполнения формы');
            }
            return;
        }

        const url = form.dataset.action;
        let method = 'POST';

        if (!url) {
            console.warn('No data-action on form, just local transition');
            this.localTransitionAfterSuccess(modal);
            return;
        }

        const fd = new FormData(form);
        const isJsonMock = url.endsWith('.json');

        if (isJsonMock) {
            method = 'GET';
        }

        const fetchOptions = { method };
        if (method !== 'GET' && !isJsonMock) {
            fetchOptions.body = fd;
        }

        fetch(url, fetchOptions)
            .then(r => {
                if (!r.ok) {
                    throw new Error('Network response was not ok');
                }
                return r.json();
            })
            .then(response => {
                if (!response || response.status === 'fail') {
                    const errorText = (response && response.error) || 'Ошибка при отправке формы';
                    ModalError.show(form, errorText);
                    return;
                }

                const saved = ModalScenarioStorage.load() || {};
                saved.scenario = this.currentScenarioName;
                saved.currentModalId = modal.id;
                saved.data = Object.assign({}, saved.data || {}, response.data || {});
                ModalScenarioStorage.save(saved);

                const nextId = response.nextModalId || this.getNextModalId(modal.id, this.currentScenarioName);
                if (nextId) {
                    this.openModal(nextId);
                } else {
                    this.finishScenario();
                    this.closeModal(modal.id);
                }
            })
            .catch(() => {
                ModalError.show(form, 'Нет соединения с сервером, попробуйте позже');
            });
    },

    getNextModalId(currentModalId, scenarioName) {
        if (!scenarioName) return null;
        const scenario = this.scenarios[scenarioName];
        if (!scenario || !scenario.steps) return null;
        const stepCfg = scenario.steps[currentModalId];
        return stepCfg ? stepCfg.onSubmitNext : null;
    },

    localTransitionAfterSuccess(modal) {
        const nextId = this.getNextModalId(modal.id, this.currentScenarioName);
        if (nextId) {
            this.openModal(nextId);
        } else {
            this.finishScenario();
            this.closeModal(modal.id);
        }
    },

    getEventConfig(modalId, scenarioName, selector) {
        if (!scenarioName) return null;
        const scenario = this.scenarios[scenarioName];
        if (!scenario || !scenario.steps) return null;
        const stepCfg = scenario.steps[modalId];
        if (!stepCfg || !stepCfg.onClick) return null;
        return stepCfg.onClick[selector] || null;
    },

    handleResendLinkClick(btn, event) {
        event.preventDefault();
        const modal = btn.closest('.modal');
        if (!modal) return;

        const form = modal.querySelector('form');
        if (!form) return;

        if (!this.currentScenarioName && form.dataset.scenario) {
            this.currentScenarioName = form.dataset.scenario;
        }

        // Ищем data-link-action для определения действия
        const linkAction = btn.dataset.linkAction;
        if (!linkAction) {
            // Fallback на data-атрибуты (для обратной совместимости)
            const nextModalId = btn.dataset.nextModal;
            if (nextModalId) {
                this.openModal(nextModalId);
                return;
            }
            const url = btn.dataset.action;
            if (url) {
                btn.disabled = true;
                const isJsonMock = url.endsWith('.json');
                const fetchOptions = { method: isJsonMock ? 'GET' : 'POST' };
                fetch(url, fetchOptions)
                    .then(r => {
                        if (!r.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return r.json();
                    })
                    .then(response => {
                        btn.disabled = false;
                        if (!response || response.status === 'fail') {
                            const errorText = (response && response.error) || 'Не удалось отправить код';
                            ModalError.show(form, errorText);
                            return;
                        }
                        ModalError.show(form, response.message || 'Код отправлен повторно');
                    })
                    .catch(() => {
                        btn.disabled = false;
                        ModalError.show(form, 'Нет соединения с сервером, попробуйте позже');
                    });
            }
            return;
        }

        // Ищем конфиг события в сценарии по data-link-action
        const eventConfig = this.getEventConfig(
            modal.id,
            this.currentScenarioName,
            `[data-link-action="${linkAction}"]`
        );

        if (eventConfig) {
            // Используем конфиг из сценария
            if (eventConfig.nextModalId) {
                this.openModal(eventConfig.nextModalId);
                return;
            }
            if (eventConfig.action) {
                btn.disabled = true;
                const isJsonMock = eventConfig.action.endsWith('.json');
                const fetchOptions = { method: isJsonMock ? 'GET' : 'POST' };

                fetch(eventConfig.action, fetchOptions)
                    .then(r => {
                        if (!r.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return r.json();
                    })
                    .then(response => {
                        btn.disabled = false;
                        if (!response || response.status === 'fail') {
                            const errorText = (response && response.error) || 'Не удалось отправить код';
                            ModalError.show(form, errorText);
                            return;
                        }
                        ModalError.show(form, response.message || 'Код отправлен повторно');
                        
                        // Если это запрос нового кода (resendCode), перезапускаем таймер
                        if (eventConfig.type === 'resendCode' && btn.dataset.resendTimer === 'true') {
                            ModalHooks.startResendTimer(5);
                        }
                    })
                    .catch(() => {
                        btn.disabled = false;
                        ModalError.show(form, 'Нет соединения с сервером, попробуйте позже');
                    });
                return;
            }
        }

        console.warn(`No config found for data-link-action="${linkAction}" in scenario`);
    }
};

window.modalManager = ModalScenarioManager;

function startRegistrationFlow() {
    ModalScenarioManager.startScenario('registration');
}

function startReviewFormFlow() {
    ModalScenarioManager.startScenario('reviewForm');
}

function startQuestionFormFlow() {
    ModalScenarioManager.startScenario('questionForm');
}

function openModal(modalId) {
    ModalScenarioManager.openModal(modalId);
}

document.addEventListener('DOMContentLoaded', function() {
    // Запускаем глобальный таймер, если есть активные таймеры в localStorage
    const hasActiveTimers = Object.keys(localStorage).some(key => key.startsWith('timer_'));
    if (hasActiveTimers && !ModalHooks.globalTimerInterval) {
        ModalHooks.globalTimerInterval = setInterval(() => {
            ModalHooks.updateAllTimers();
        }, 1000);
    }

    document.addEventListener('submit', function(e) {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.closest('.modal')) return;
        ModalScenarioManager.handleFormSubmit(form, e);
    });

    document.addEventListener('click', function(e) {
        const closeBtn = e.target.closest('.close');
        if (closeBtn) {
        e.preventDefault();
            const modal = closeBtn.closest('.modal');
            if (modal) {
                ModalScenarioManager.closeModal(modal.id);
            }
            return;
        }

        // Проверяем data-resume-restart ПЕРЕД .resend-link, т.к. кнопка "начать заново" имеет оба атрибута
        const restartBtn = e.target.closest('[data-resume-restart]');
        if (restartBtn) {
            const modal = restartBtn.closest('.modal');
        if (!modal) return;
            const form = modal.querySelector('form');
            if (!form) return;
            const scenarioName = form.dataset.scenario;
            if (!scenarioName) return;
            ModalScenarioStorage.clear();
            ModalScenarioManager.startScenario(scenarioName);
            return;
        }

        const resendBtn = e.target.closest('.resend-link');
        if (resendBtn) {
            ModalScenarioManager.handleResendLinkClick(resendBtn, e);
            return;
        }

        // Кнопка "Ок/Отлично" в успешных модалках: завершает сценарий и закрывает текущую модалку
        const modalCloseBtn = e.target.closest('[data-modal-close]');
        if (modalCloseBtn) {
            const modal = modalCloseBtn.closest('.modal');
            if (modal) {
                // Завершаем текущий сценарий (очищаем localStorage и state)
                ModalScenarioManager.finishScenario();
                ModalScenarioManager.closeModal(modal.id);
            }
            return;
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                ModalScenarioManager.closeModal(openModal.id);
            }
        }
    });

    function handleFieldChange(e) {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.classList.contains('input-error')) {
            target.classList.remove('input-error');
        }
        if (target.name === 'phone' && window.Validator) {
            target.value = Validator.formatPhone(target.value);
        }
        if (target.name === 'pin' || target.name === 'pin_confirm' || target.name === 'code') {
            target.value = target.value.replace(/\D/g, '').substring(0, 4);
        }

        const form = target.closest('form');
        if (form && form.closest('.modal')) {
            ModalScenarioManager.updateSubmitState(form);
        }
    }

    document.addEventListener('input', handleFieldChange);
    document.addEventListener('keyup', handleFieldChange);
});
