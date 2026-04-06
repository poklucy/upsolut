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
    
    getResendSeconds() {
        const cfg = window.APP_CONFIG && window.APP_CONFIG.sms && window.APP_CONFIG.sms.resendSeconds;
        const sec = parseInt(cfg, 10);
        return Number.isFinite(sec) && sec > 0 ? sec : 60;
    },
    
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
            // Не возобновляем регистрацию с середины
            resumeFromLastStep: false,
            startModalId: 'phoneEnterModal',
            steps: {
                phoneEnterModal: {
                    onSubmitNext: 'phoneConfirmationModalSecondStep'
                },
                phoneConfirmationModal: {
                    onSubmitNext: 'emailEnterModal',
                    onClick: {
                        // При нажатии "код не пришел" сразу дергаем отправку SMS
                        // и переходим на шаг ввода кода из SMS.
                        '[data-link-action="code-not-came"]': {
                            action: '/jsapi/auth.smsphone',
                            type: 'resendCode',
                            nextModalId: 'phoneConfirmationModalSecondStep'
                        }
                    }
                },
                phoneConfirmationModalSecondStep: {
                    onSubmitNext: 'emailEnterModal',
                    onOpen: function(modal) {
                        const remaining = ModalHooks.getTimerRemaining(modal.id);
                        // Если таймер уже активен (оставшееся время > 0) — синхронизируем UI.
                        // Если remaining === 0 (или значение устарело) — запускаем заново,
                        // чтобы не показывать "Отправить новый код" вместо таймера.
                        if (remaining !== null && remaining > 0) {
                            ModalHooks.updateTimerForModal(modal.id);
                            return;
                        }
                        // Если таймер еще не запускали - запускаем один раз
                        const resendSec =
                            (window.APP_CONFIG && window.APP_CONFIG.sms && window.APP_CONFIG.sms.resendSeconds) ||
                            ModalHooks.getResendSeconds();
                        ModalHooks.startResendTimer(resendSec);
                    },
                    onClick: {
                        '[data-link-action="resend-sms-code"]': {
                            action: '/jsapi/auth.smsphone',
                            type: 'resendCode',
                            nextModalId: null
                        }
                    }
                },
                emailEnterModal: {
                    onSubmitNext: 'emailConfirmationModal'
                },
                emailConfirmationModal: {
                    onSubmitNext: 'registrationModal',
                    onClick: {
                        '[data-link-action="resend-code"]': {
                            action: '/jsapi/auth.email',
                            type: 'resendCode',
                            nextModalId: 'emailConfirmationModalSecondStep'
                        }
                    }
                },
                emailConfirmationModalSecondStep: {
                    onSubmitNext: 'registrationModal',
                    onOpen: function(modal) {
                        // Для e-mail повторной отправки таймер не запускаем
                    },
                    onClick: {
                        '[data-link-action="resend-email-code"]': {
                            action: '/jsapi/auth.email',
                            nextModalId: null
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
                        window.location.href="/";
                    }
                }
            }
        },
        authorization: {
            // Для авторизации всегда начинаем сценарий с первого шага,
            // без возобновления из localStorage
            resumeFromLastStep: false,
            startModalId: 'phoneCheckModal',
            steps: {
                phoneCheckModal: {
                    onSubmitNext: 'authorizationModal',
                },
                authorizationModal: {
                    onSubmitNext: 'authSuccessModal',
                    onClick: {
                        '[data-link-action="forgot-pin"]': {
                            action: '/jsapi/auth.telegramcode',
                            type: 'resendCode',
                            nextModalId: 'telegramCodeCheck'
                        }
                    }
                },
                telegramCodeCheck: {
                    onSubmitNext: 'pinCreateModal',
                    onClick: {
                        '[data-link-action="code-not-received"]': {
                            action: '/jsapi/auth.emailcode',
                            type: 'resendCode',
                            nextModalId: 'emailCodeCheck'
                        }
                    }
                },
                emailCodeCheck: {
                    onSubmitNext: 'pinCreateModal',
                    onOpen: function(modal) {
                        // Подставляем e-mail пользователя из сохранённого состояния сценария
                        const state = ModalScenarioStorage.load();
                        const email = state && state.data && state.data.email;
                        if (!email) {
                            return;
                        }

                        const label = modal.querySelector('.input-text');
                        if (!label) {
                            return;
                        }

                        // Простая маскировка e-mail: первая буква, затем *** и домен
                        let masked = email;
                        const atPos = email.indexOf('@');
                        if (atPos > 1) {
                            const namePart = email.slice(0, atPos);
                            const domainPart = email.slice(atPos);
                            const firstChar = namePart.charAt(0);
                            const lastChar = namePart.length > 1 ? namePart.charAt(namePart.length - 1) : '';
                            masked = firstChar + '***' + lastChar + domainPart;
                        }

                        // Меняем текст "Отправили код на почту ..." на актуальный адрес
                        label.textContent = 'Отправили код на почту ' + masked;
                    },
                    onClick: {
                        '[data-link-action="resend-pin-code"]': {
                            action: '/jsapi/auth.emailcode',
                            type: 'resendCode'
                        }
                    }
                },
                pinCreateModal: {
                    onSubmitNext: 'pinConfirmModal'
                },
                pinConfirmModal: {
                    onSubmitNext: 'authSuccessModal'
                },
                authSuccessModal: {
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
                    onOpen: function(modal) {
                        modal.querySelectorAll('.stars-container .button-stars.active').forEach((btn) => {
                            btn.classList.remove('active');
                        });
                        const rateInput = modal.querySelector('input[name="cnt_rate"]');
                        if (rateInput) {
                            rateInput.value = '';
                        }
                        const form = modal.querySelector('form');
                        if (form) {
                            ModalScenarioManager.updateSubmitState(form);
                        }
                    },
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
        },
        invite: {
            startModalId: 'inviteModal',
            steps: {
                inviteModal: {

                }
            }
        },
        remittance: {
            startModalId: 'remittanceModal',
            steps: {
                remittanceModal: {
                    onSubmitNext: 'remittanceSuccessModal'
                },
                remittanceSuccessModal: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                    }
                }
            }
        },
        payout: {
            startModalId: 'payoutModal',
            resumeFromLastStep: false,
            steps: {
                payoutModal: {
                    onSubmitNext: 'payoutConfirmationEmail'
                },
                payoutConfirmationModal: {
                    onSubmitNext: 'payoutSuccessModal',
                    onClick: {
                        '[data-link-action="code-not-came"]': {
                            action: '/jsapi/auth.smsphone',
                            type: 'resendCode',
                            nextModalId: 'payoutConfirmationEmail'
                        }
                    }
                },
                payoutSuccessModal: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                    }
                }
            }
        },
        changeEmail: {
            resumeFromLastStep: false,
            startModalId: 'changeEmailNew',
            steps: {
                changeEmailNew: {
                    onSubmitNext: 'changeSuccess'
                },
                changeSuccess: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                        const emailInput = document.querySelector('#email');
                        if (emailInput) {
                            const savedState = ModalScenarioStorage.load();
                            const newEmail = savedState?.data?.email;
                            if (newEmail) {
                                emailInput.value = newEmail;
                            }
                        }
                    }
                }
            }
        },

        changePassword: {
            resumeFromLastStep: false,
            startModalId: 'changePasswordNew',
            steps: {
                changePasswordNew: {
                    onSubmitNext: 'changeSuccess'
                },
                changeSuccess: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                    }
                }
            }
        },

        changeAddress: {
            resumeFromLastStep: false,
            startModalId: 'changeAddress',
            steps: {
                changeAddress: {
                    onSubmitNext: 'changeSuccess'
                },
                changeSuccess: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                        const addressInputs = document.querySelectorAll('#text');
                        if (addressInputs.length >= 2) {
                            const savedState = ModalScenarioStorage.load();
                            const newAddress = savedState?.data?.address;
                            if (newAddress) {
                                addressInputs.forEach(input => {
                                    input.value = newAddress;
                                });
                            }
                        }
                    }
                }
            }
        },

        changePhoto: {
            resumeFromLastStep: false,
            startModalId: 'changePhoto',
            steps: {
                changePhoto: {
                    onSubmitNext: 'changeSuccess'
                },
                changeSuccess: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                        const photoImage = document.querySelector('#photoImage');
                        const savedState = ModalScenarioStorage.load();
                        const newPhoto = savedState?.data?.photo;
                        if (newPhoto && photoImage) {
                            photoImage.src = newPhoto;
                        }
                    }
                }
            }
        },

        invitePersonalChoice: {
            resumeFromLastStep: false,
            startModalId: 'invitePersonalChoice',
            steps: {
                invitePersonalChoice: {
                    onSubmitNext: 'inviteModalPersonal',
                },
                inviteModalPersonal: {
                    onClose: function() {
                        ModalScenarioManager.finishScenario();
                    }
                }
            }
        },
    },

    currentScenarioName: null,

    /**
     * Активный сценарий для шага: опционально data-scenario на форме,
     * иначе память менеджера, иначе modalScenarioState (localStorage), если
     * сохранённый шаг совпадает с открытой модалкой или id есть в steps сценария.
     */
    resolveActiveScenarioName(form, modal) {
        const modalId = modal && modal.id;
        if (!modalId) return null;

        if (form && form.dataset.scenario) {
            return form.dataset.scenario;
        }

        const saved = ModalScenarioStorage.load();
        if (saved && saved.scenario && saved.currentModalId === modalId) {
            const scen = this.scenarios[saved.scenario];
            if (scen && scen.steps && scen.steps[modalId]) {
                return saved.scenario;
            }
        }

        if (this.currentScenarioName) {
            const scen = this.scenarios[this.currentScenarioName];
            if (scen && scen.steps && scen.steps[modalId]) {
                return this.currentScenarioName;
            }
        }

        if (saved && saved.scenario) {
            const scen = this.scenarios[saved.scenario];
            if (scen && scen.steps && scen.steps[modalId]) {
                return saved.scenario;
            }
        }

        return null;
    },

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

        const canResume = scenario.resumeFromLastStep !== false;

        // Если сценарий разрешает резюмирование и в localStorage уже есть сохранённый шаг
        // ЭТОГО ЖЕ сценария — продолжаем с него
        if (canResume && saved && saved.scenario === scenarioName && saved.currentModalId) {
            targetModalId = saved.currentModalId;
            data = saved.data || {};
            resumed = true;
        } else if (!canResume) {
            // Для сценариев без резюмирования очищаем состояние
            ModalScenarioStorage.clear();
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
        const scenarioName = this.resolveActiveScenarioName(form, modal);
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
        const mapModalEl = document.getElementById('mapModal');
        const stack =
            options.stack === true ||
            (modalId === 'mapPointModal' &&
                mapModalEl &&
                mapModalEl.classList.contains('show'));

        if (!stack) {
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
        }

        const modal = document.getElementById(modalId);
        if (!modal) return;

        const form = modal.querySelector('form');
        if (!stack) {
            const resolvedScenario = this.resolveActiveScenarioName(form, modal);
            if (resolvedScenario) {
                this.currentScenarioName = resolvedScenario;
            }
        }

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

        if (stack) {
            const n = document.querySelectorAll('.modal.show').length;
            modal.style.zIndex = String(1000 + (n + 1) * 10);
        } else {
            modal.style.zIndex = '';
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
            modal.querySelectorAll('input[data-mask="phone"]').forEach((input) => {
                if (typeof window.applyRuPhoneInputmask === 'function') {
                    window.applyRuPhoneInputmask($(input));
                } else {
                    $(input).inputmask('+7 (999) 999-99-99');
                }
            });
        }

        const scenarioName = this.currentScenarioName || null;
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

        if (!stack) {
            const saved = ModalScenarioStorage.load() || {};
            if (this.currentScenarioName) {
                saved.scenario = this.currentScenarioName;
                saved.currentModalId = modalId;
                ModalScenarioStorage.save(saved);
            }
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const form = modal.querySelector('form');
        const scenarioName = this.currentScenarioName || null;
        const scenario = scenarioName && this.scenarios[scenarioName];
        const stepCfg =
            scenario && scenario.steps && scenario.steps[modalId];
        if (stepCfg && typeof stepCfg.onClose === 'function') {
            stepCfg.onClose(modal);
        }

        // НЕ очищаем таймеры - они должны работать глобально независимо от состояния модалки
        modal.classList.remove('show');
        modal.style.zIndex = '';

        if (modalId === 'mapModal') {
            const pointModal = document.getElementById('mapPointModal');
            if (pointModal && pointModal.classList.contains('show')) {
                pointModal.classList.remove('show');
                pointModal.style.zIndex = '';
            }
        }

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
        const scenarioName = this.currentScenarioName;
        ModalScenarioStorage.clear();
        this.currentScenarioName = null;

        // Асинхронно сообщаем бэкенду, что сценарий завершён,
        // чтобы он мог удалить cookie modal_scenario_<scenario>.
        if (scenarioName) {
            const fd = new FormData();
            fd.append('_scenario', scenarioName);
            fetch('/jsapi/auth.scenario-reset', {
                method: 'POST',
                body: fd
            }).catch(() => {
                // Тихо игнорируем ошибки сброса сценария на бэке,
                // т.к. это вспомогательная очистка.
            });
        }
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
                    case 'pin_confirm':
                        // Проверку совпадения PIN выполняем на бэке (auth.pin-confirm),
                        // фронт только проверяет, что поле не пустое.
                        result = { isValid: true, message: '' };
                        break;
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

        // Пробрасываем в запрос служебное поле сценария, чтобы бэкенд мог
        // восстанавливать состояние шага (для кук и др. логики)
        const scenarioName = this.resolveActiveScenarioName(form, modal);
        if (scenarioName) {
            this.currentScenarioName = scenarioName;
            fd.append('_scenario', scenarioName);
        }
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
                const errorText = (response && response.error) || 'Ошибка при отправке формы';
                let nextId = response && response.nextModalId;
                if (!nextId && scenarioName) {
                    nextId = this.getNextModalId(modal.id, scenarioName);
                }

                if (!response || response.status === 'fail') {
                    ModalError.show(form, errorText);
                    return;
                }

                const saved = ModalScenarioStorage.load() || {};
                if (scenarioName) {
                    saved.scenario = scenarioName;
                }
                saved.currentModalId = modal.id;
                saved.data = Object.assign({}, saved.data || {}, response.data || {});
                ModalScenarioStorage.save(saved);

                if (nextId) {
                    if (scenarioName) {
                        this.currentScenarioName = scenarioName;
                    }
                    this.openModal(nextId);
                } else {
                    this.finishScenario();
                    this.closeModal(modal.id);
                }
            })
            .catch(() => {
                const errorText = 'Нет соединения с сервером, попробуйте позже';
                ModalError.show(form, errorText);
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
        const form = modal.querySelector('form');
        const scenarioName = this.resolveActiveScenarioName(form, modal);
        if (scenarioName) {
            this.currentScenarioName = scenarioName;
        }
        const nextId = this.getNextModalId(modal.id, scenarioName);
        if (nextId) {
            this.openModal(nextId);
        } else {
            this.finishScenario();
            this.closeModal(modal.id);
        }
    },

    handleResendLinkClick(btn, event) {
        event.preventDefault();
        const modal = btn.closest('.modal');
        if (!modal) return;

        const form = modal.querySelector('form');
        if (!form) return;

        // Сначала пробуем найти конфиг по селекторам, заданным прямо в сценарии (steps[modalId].onClick)
        let eventConfig = null;
        const scenario = this.currentScenarioName && this.scenarios[this.currentScenarioName];
        const stepCfg = scenario && scenario.steps && scenario.steps[modal.id];
        if (stepCfg && stepCfg.onClick) {
            Object.entries(stepCfg.onClick).some(([selector, cfg]) => {
                if (btn.matches(selector)) {
                    eventConfig = cfg;
                    return true;
                }
                return false;
            });
        }

        // Если в сценарии не нашлось onClick-конфига, используем старый fallback на data-* атрибуты
        if (!eventConfig) {
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
                    // На success сообщение в UI не показываем (ошибки показываются только при status=fail).
                    ModalError.clear(form);
                    if (response && response.message) {
                        console.log('[Modal] resend success:', response.message);
                    }
                    })
                    .catch(() => {
                        btn.disabled = false;
                        ModalError.show(form, 'Нет соединения с сервером, попробуйте позже');
                    });
            }
            return;
        }

        // Используем конфиг из сценария
        if (eventConfig.action) {
            btn.disabled = true;
            const isJsonMock = eventConfig.action.endsWith('.json');
            const fetchOptions = { method: isJsonMock ? 'GET' : 'POST' };

            // Если это не мок и требуется POST — отправляем данные формы,
            // чтобы на бекенд ушли phone / code / request_id и т.п.
            if (!isJsonMock && fetchOptions.method === 'POST' && form) {
                const fd = new FormData(form);
                if (this.currentScenarioName) {
                    fd.append('_scenario', this.currentScenarioName);
                }
                // Если в форме нет телефона (повторная отправка со второго шага),
                // подставляем phone из сохранённого состояния сценария
                const hasPhoneField = Array.from(fd.keys()).some(k => k === 'phone');
                if (!hasPhoneField) {
                    const saved = ModalScenarioStorage.load();
                    const phoneFromState = saved && saved.data && saved.data.phone;
                    if (phoneFromState) {
                        fd.append('phone', phoneFromState);
                    }
                }
                fetchOptions.body = fd;
            }

            fetch(eventConfig.action, fetchOptions)
                .then(r => {
                    if (!r.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return r.json();
                })
                .then(response => {
                    btn.disabled = false;
                    const targetModalId = eventConfig.nextModalId || null;
                    const errorText = (response && response.error) || 'Не удалось отправить код';

                    if (!response || response.status === 'fail') {
                        // При ошибке всё равно открываем следующую модалку (если она есть)
                        // и показываем ошибку уже там.
                        if (targetModalId) {
                            this.openModal(targetModalId);
                            const targetModal = document.getElementById(targetModalId);
                            const targetForm = targetModal && targetModal.querySelector('form');
                            if (targetForm) {
                                ModalError.show(targetForm, errorText);
                            }
                        } else {
                            // Если следующей модалки нет — показываем ошибку в текущей
                            ModalError.show(form, errorText);
                        }
                        return;
                    }

                    // На success сообщение в UI не показываем (ошибки показываются только при status=fail).
                    ModalError.clear(form);
                    if (response && response.message) {
                        console.log('[Modal] resend success:', response.message);
                    }
                    
                    // Если это запрос нового кода (resendCode), перезапускаем таймер
                    if (eventConfig.type === 'resendCode' && btn.dataset.resendTimer === 'true') {
                        ModalHooks.startResendTimer(ModalHooks.getResendSeconds());
                    }

                    // Если после успешного запроса нужно открыть следующую модалку — делаем это здесь
                    if (targetModalId) {
                        this.openModal(targetModalId);
                    }
                })
                .catch(() => {
                    btn.disabled = false;
                    const targetModalId = eventConfig.nextModalId || null;
                    const errorText = 'Нет соединения с сервером, попробуйте позже';

                    if (targetModalId) {
                        this.openModal(targetModalId);
                        const targetModal = document.getElementById(targetModalId);
                        const targetForm = targetModal && targetModal.querySelector('form');
                        if (targetForm) {
                            ModalError.show(targetForm, errorText);
                        }
                    } else {
                        ModalError.show(form, errorText);
                    }
                });
            return;
        }

        // Конфиг без action, но только с nextModalId — локальный переход
        if (eventConfig.nextModalId) {
            this.openModal(eventConfig.nextModalId);
            return;
        }
    }
};

window.modalManager = ModalScenarioManager;
ModalScenarioManager.open = (id, opts) => ModalScenarioManager.openModal(id, opts);
ModalScenarioManager.close = (id) => ModalScenarioManager.closeModal(id);

function startRegistrationFlow() {
    try {
        // Локально очищаем сохранённый шаг
        ModalScenarioStorage.clear();
        // Сообщаем бэкенду очистить cookie сценария
        const fd = new FormData();
        fd.append('_scenario', 'registration');
        fetch('/jsapi/auth.scenario-reset', { method: 'POST', body: fd }).catch(() => {});
    } catch (e) {}
    ModalScenarioManager.startScenario('registration');
}

function startAuthorizationFlow() {
    ModalScenarioManager.startScenario('authorization');
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

function startPayoutFlow() {
    ModalScenarioManager.startScenario('payout');
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
            const scenarioName = ModalScenarioManager.resolveActiveScenarioName(form, modal);
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

        // Кнопка "Ок/Отлично" в успешных модалках:
        // просто закрывает текущую модалку через closeModal.
        // Логика завершения сценария (finishScenario, reload и т.п.)
        // реализуется в onClose шага сценария.
        const modalCloseBtn = e.target.closest('[data-modal-close]');
        if (modalCloseBtn) {
            const modal = modalCloseBtn.closest('.modal');
            if (modal) {
                ModalScenarioManager.closeModal(modal.id);
            }
            return;
        }
    });

    const modalTriggers = document.querySelectorAll('[data-modal]');
    modalTriggers.forEach(trigger => {
        trigger.removeEventListener('click', handleModalTriggerClick);
        trigger.addEventListener('click', handleModalTriggerClick);
    });

    function handleModalTriggerClick(e) {
        e.preventDefault();
        const modalId = this.getAttribute('data-modal');
        if (modalId) {
            openModal(modalId);
        }
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const openModals = Array.from(document.querySelectorAll('.modal.show'));
            if (!openModals.length) return;
            const topModal = openModals.reduce((a, b) => {
                const za = parseInt(getComputedStyle(a).zIndex, 10) || 1000;
                const zb = parseInt(getComputedStyle(b).zIndex, 10) || 1000;
                return zb >= za ? b : a;
            });
            ModalScenarioManager.closeModal(topModal.id);
        }
    });

    function handleFieldChange(e) {
        const target = e.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
            return;
        }
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

    window.modalInstances = {};
    document.querySelectorAll('.modal').forEach(modal => {
        const modalId = modal.id;
        const hasScenario = Object.values(ModalScenarioManager.scenarios).some(
            scenario => scenario.startModalId === modalId ||
                (scenario.steps && scenario.steps[modalId])
        );
        const skipLegacyModal =
            modalId === 'mapModal' || modalId === 'mapPointModal';
        if (!hasScenario && !skipLegacyModal) {
            window.modalInstances[modalId] = new Modal(modalId);
        }
    });

    document.addEventListener('input', handleFieldChange);
    document.addEventListener('keyup', handleFieldChange);
});

