class Validator {
    validate(data) {
        return { isValid: true, errors: [] };
    }
}

class DynamicModal {
    constructor(config) {
        this.template = config.template || document.getElementById('dynamicModal');
        this.alias = config.alias;
        this.title = config.title;
        this.inputs = config.inputs || [];
        this.buttonText = config.buttonText || 'Отправить';
        this.nextModal = config.nextModal || null;
        this.validator = config.validator || new Validator();
        this.onSubmit = config.onSubmit || null;
        this.additionalText = config.additionalText || null;
        this.accentText = config.accentText || null;
        this.showSuccess = config.showSuccess || false;
        this.checkboxes = config.checkboxes || [];
        this.customContent = config.customContent || null;

        this.modalElement = null;
        this.data = {};
        this.modalManager = null; // Убираем прямую ссылку на window.modalManager
        this.timerInterval = null;
        this.timerElement = null;
        this.errorElement = null;
    }

    // Добавляем метод для установки modalManager
    setModalManager(manager) {
        this.modalManager = manager;
        return this;
    }
    create() {
        if (!this.template) return null;

        this.modalElement = this.template.cloneNode(true);
        this.modalElement.id = `modal-${this.alias}`;
        this.modalElement.style.display = 'none';
        this.modalElement.style.opacity = '0';

        const titleElement = this.modalElement.querySelector('.modal-title');
        const inputContainer = this.modalElement.querySelector('.input-container');
        const button = this.modalElement.querySelector('.buttonDark');

        if (titleElement) titleElement.textContent = this.title;
        if (inputContainer) inputContainer.innerHTML = '';
        if (button) button.textContent = this.buttonText;

        this.populateContent(inputContainer);
        this.addEventListeners();

        document.body.appendChild(this.modalElement);

        // Регистрируем модалку, если modalManager уже существует
        if (this.modalManager) {
            this.modalManager.registerModal(this.modalElement.id, {
                onOpen: () => this.onModalOpen(),
                onClose: () => this.onModalClose()
            });
        }

        return this.modalElement;
    }

    populateContent(container) {
        if (!container) return;

        if (this.additionalText) {
            const textDiv = document.createElement('div');
            textDiv.className = 'input-text';
            textDiv.textContent = this.additionalText;
            container.appendChild(textDiv);
        }

        this.errorElement = document.createElement('div');
        this.errorElement.className = 'error';
        this.errorElement.style.display = 'none';
        container.appendChild(this.errorElement);

        // Если есть кастомное содержимое, используем его
        if (this.customContent) {
            const customDiv = document.createElement('div');
            customDiv.innerHTML = this.customContent;
            container.appendChild(customDiv);
        } else {
            // Стандартные инпуты
            this.inputs.forEach(input => {
                const inputReview = document.createElement('div');
                inputReview.className = 'input-review';

                const label = document.createElement('label');
                label.htmlFor = input.id;

                const inputElement = document.createElement('input');
                inputElement.type = input.type || 'text';
                inputElement.id = input.id;
                inputElement.name = input.name;
                inputElement.placeholder = input.placeholder;
                inputElement.classList.add('input-field');

                inputReview.appendChild(label);
                inputReview.appendChild(inputElement);
                container.appendChild(inputReview);
            });
        }

        // Добавляем чекбоксы если есть
        if (this.checkboxes.length > 0) {
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'checkbox-container';

            this.checkboxes.forEach(cb => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'checkbox';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = cb.id;
                checkbox.name = cb.name;

                const label = document.createElement('label');
                label.htmlFor = cb.id;
                label.textContent = cb.label;

                checkboxDiv.appendChild(checkbox);
                checkboxDiv.appendChild(label);
                checkboxContainer.appendChild(checkboxDiv);
            });

            container.appendChild(checkboxContainer);
        }

        // Акцентный текст или ссылка для повторной отправки
        if (this.accentText || this.alias === 'phoneConfirmation' || this.alias === 'emailConfirmation') {
            const accentDiv = document.createElement('div');
            accentDiv.className = 'input-accent';

            if (this.alias === 'phoneConfirmation' || this.alias === 'emailConfirmation') {
                const resendLink = document.createElement('span');
                resendLink.className = 'resend-link';
                resendLink.textContent = this.alias === 'phoneConfirmation' ? 'Код не пришел' : 'Выслать код заново';

                resendLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleCodeNotReceived();
                });

                accentDiv.appendChild(resendLink);
            } else if (this.accentText) {
                accentDiv.textContent = this.accentText;
            }

            container.appendChild(accentDiv);
        }

        if (this.showSuccess) {
            const inputs = this.modalElement.querySelectorAll('.input-review');
            inputs.forEach(input => input.style.display = 'none');

            if (this.errorElement) this.errorElement.style.display = 'none';

            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.textContent = 'Регистрация успешно завершена!';

            container.appendChild(successMessage);
        }
    }

    showError(message) {
        if (this.errorElement) {
            this.errorElement.textContent = message;
            this.errorElement.style.display = 'block';

            const inputs = this.modalElement.querySelectorAll('.input-field');
            inputs.forEach(input => {
                input.classList.add('input-error');
            });
        }
    }

    hideError() {
        if (this.errorElement) {
            this.errorElement.style.display = 'none';

            const inputs = this.modalElement.querySelectorAll('.input-field');
            inputs.forEach(input => {
                input.classList.remove('input-error');
            });
        }
    }

    handleCodeNotReceived() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.hideError();

        const accentDiv = this.modalElement.querySelector('.input-accent');
        if (accentDiv) {
            accentDiv.innerHTML = '';

            this.timerElement = document.createElement('span');
            this.timerElement.className = 'timer-text';
            accentDiv.appendChild(this.timerElement);

            this.startResendTimer(10);
        }

        const textElement = this.modalElement.querySelector('.input-text');
        if (textElement) {
            if (this.alias === 'phoneConfirmation') {
                textElement.textContent = 'Ок. Отправили код в SMS. Введите его здесь.';
            } else if (this.alias === 'emailConfirmation') {
                textElement.textContent = 'Отправили код повторно. Введите код подтверждения из вашей электронной почты. Загляните в папку Спам, может письмо там.';
            }
        }

        if (this.alias === 'emailConfirmation') {
            const titleElement = this.modalElement.querySelector('.modal-title');
            if (titleElement) {
                titleElement.textContent = 'Отправили код повторно';
            }
        }
    }

    startResendTimer(seconds) {
        let remainingSeconds = seconds;

        const updateTimer = () => {
            if (!this.timerElement) return;

            const mins = Math.floor(remainingSeconds / 60);
            const secs = remainingSeconds % 60;
            this.timerElement.textContent = `Запросить новый код можно через ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            if (remainingSeconds <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;

                const accentDiv = this.modalElement.querySelector('.input-accent');
                if (accentDiv) {
                    accentDiv.innerHTML = '';

                    const resendLink = document.createElement('span');
                    resendLink.className = 'resend-link';
                    resendLink.textContent = this.alias === 'phoneConfirmation' ? 'Выслать код повторно' : 'Выслать код заново';

                    resendLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.handleResendCode();
                    });

                    accentDiv.appendChild(resendLink);
                }

                if (this.alias === 'emailConfirmation') {
                    const titleElement = this.modalElement.querySelector('.modal-title');
                    if (titleElement) {
                        titleElement.textContent = 'ПОДТВЕРДИТЕ ВАШУ Почту';
                    }
                }

                return;
            }

            remainingSeconds--;
        };

        updateTimer();
        this.timerInterval = setInterval(updateTimer, 1000);
    }

    handleResendCode() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.hideError();

        setTimeout(() => {
            const accentDiv = this.modalElement.querySelector('.input-accent');
            if (accentDiv) {
                accentDiv.innerHTML = '';

                const resendLink = document.createElement('span');
                resendLink.className = 'resend-link';
                resendLink.textContent = this.alias === 'phoneConfirmation' ? 'Код не пришел' : 'Выслать код заново';

                resendLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleCodeNotReceived();
                });

                accentDiv.appendChild(resendLink);
            }

            const codeInput = this.modalElement.querySelector('input[name="code"]');
            if (codeInput) {
                codeInput.value = '';
            }

            if (this.alias === 'emailConfirmation') {
                const textElement = this.modalElement.querySelector('.input-text');
                if (textElement) {
                    textElement.textContent = 'Введите код подтверждения из вашей электронной почты';
                }

                const titleElement = this.modalElement.querySelector('.modal-title');
                if (titleElement) {
                    titleElement.textContent = 'ПОДТВЕРДИТЕ ВАШУ Почту';
                }
            }
        }, 1000);
    }

    onModalOpen() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.hideError();
    }

    onModalClose() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    addEventListeners() {
        if (!this.modalElement) return;

        const closeBtn = this.modalElement.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        const button = this.modalElement.querySelector('.buttonDark');
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }

        const inputs = this.modalElement.querySelectorAll('.input-field');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.hideError();
            });
        });
    }

    handleSubmit() {
        // Собираем данные из инпутов
        this.inputs.forEach(input => {
            const inputElement = this.modalElement.querySelector(`#${input.id}`);
            if (inputElement) {
                this.data[input.name] = inputElement.value;
            }
        });

        // Собираем данные из чекбоксов
        const checkboxes = this.modalElement.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            this.data[cb.name] = cb.checked;
        });

        // Собираем данные из кастомных полей
        const customInputs = this.modalElement.querySelectorAll('.input-field');
        customInputs.forEach(input => {
            if (input.name && !this.data[input.name]) {
                this.data[input.name] = input.value;
            }
        });

        const validation = this.validator.validate(this.data);

        if (validation.isValid) {
            if (this.alias === 'phoneConfirmation') {
                const expectedCode = MockAPI.verificationCodes[this.data.phone] || MockAPI.verificationCodes.default;

                if (this.data.code === expectedCode) {
                    this.hideError();

                    if (this.onSubmit) {
                        this.onSubmit(this.data);
                    }

                    if (this.nextModal) {
                        this.close();
                        if (typeof this.nextModal === 'function') {
                            this.nextModal(this.data);
                        }
                    }
                } else {
                    this.showError('Неверный код, попробуйте еще раз');

                    const codeInput = this.modalElement.querySelector('input[name="code"]');
                    if (codeInput) {
                        codeInput.value = '';
                        codeInput.focus();
                    }
                }
            } else if (this.alias === 'emailConfirmation') {
                const expectedCode = MockAPI.verificationCodes[this.data.email] || MockAPI.verificationCodes.default;

                if (this.data.code === expectedCode) {
                    this.hideError();

                    if (this.onSubmit) {
                        this.onSubmit(this.data);
                    }

                    if (this.nextModal) {
                        this.close();
                        if (typeof this.nextModal === 'function') {
                            this.nextModal(this.data);
                        }
                    }
                } else {
                    this.showError('Неверный код, попробуйте еще раз');

                    const codeInput = this.modalElement.querySelector('input[name="code"]');
                    if (codeInput) {
                        codeInput.value = '';
                        codeInput.focus();
                    }
                }
            } else if (this.alias === 'pinCreate') {
                // Валидация пин-кода (4 цифры)
                const pin = this.data.pin;
                if (pin && pin.length === 4 && /^\d+$/.test(pin)) {
                    if (this.onSubmit) {
                        this.onSubmit(this.data);
                    }

                    if (this.nextModal) {
                        this.close();
                        if (typeof this.nextModal === 'function') {
                            this.nextModal(this.data);
                        }
                    }
                } else {
                    this.showError('Пин-код должен состоять из 4 цифр');

                    const pinInput = this.modalElement.querySelector('#pin-create');
                    if (pinInput) {
                        pinInput.value = '';
                        pinInput.focus();
                    }
                }
            } else if (this.alias === 'pinConfirm') {
                // Проверка совпадения пин-кодов
                if (this.data.pin_confirm === this.data.pin) {
                    if (this.onSubmit) {
                        this.onSubmit(this.data);
                    }

                    if (this.nextModal) {
                        this.close();
                        if (typeof this.nextModal === 'function') {
                            this.nextModal(this.data);
                        }
                    }
                } else {
                    this.showError('Пин-коды не совпадают');

                    const confirmInput = this.modalElement.querySelector('#pin-confirm');
                    if (confirmInput) {
                        confirmInput.value = '';
                        confirmInput.focus();
                    }
                }
            } else if (this.alias === 'registration') {
                // Проверка чекбоксов
                if (this.data.policy_read && this.data.policy_agree) {
                    if (this.onSubmit) {
                        this.onSubmit(this.data);
                    }

                    if (this.nextModal) {
                        this.close();
                        if (typeof this.nextModal === 'function') {
                            this.nextModal(this.data);
                        }
                    }
                } else {
                    this.showError('Необходимо подтвердить согласие с политикой обработки данных');
                }
            } else {
                if (this.onSubmit) {
                    this.onSubmit(this.data);
                }

                if (this.nextModal) {
                    this.close();
                    if (typeof this.nextModal === 'function') {
                        this.nextModal(this.data);
                    }
                }
            }
        }
    }

    open(data = {}) {
        this.data = { ...this.data, ...data };

        if (!this.modalElement) {
            this.create();
        }

        if (this.modalElement) {
            this.modalManager.openModal(this.modalElement.id);
        }
    }

    close() {
        if (this.modalElement) {
            this.modalManager.closeModal(this.modalElement.id);
        }
    }

    updateText(updates) {
        if (!this.modalElement) return;

        if (updates.title) {
            const titleElement = this.modalElement.querySelector('.modal-title');
            if (titleElement) titleElement.textContent = updates.title;
        }

        if (updates.additionalText) {
            const textElement = this.modalElement.querySelector('.input-text');
            if (textElement) textElement.textContent = updates.additionalText;
        }
    }
}

class ModalScenario {
    constructor() {
        this.modals = new Map();
        this.currentModal = null;
        this.scenarioData = {};
    }

    addModal(modal) {
        this.modals.set(modal.alias, modal);
        return this;
    }

    start(initialModalAlias) {
        const modal = this.modals.get(initialModalAlias);
        if (modal) {
            this.currentModal = modal;
            modal.open(this.scenarioData);
        }
    }

    goTo(alias, data = {}) {
        this.scenarioData = { ...this.scenarioData, ...data };
        const nextModal = this.modals.get(alias);

        if (nextModal) {
            this.currentModal = nextModal;

            if (alias === 'phoneConfirmation' && this.scenarioData.phone) {
                nextModal.updateText({
                    additionalText: `На номер ${this.scenarioData.phone} отправлен код подтверждения. Введите его ниже.`
                });
            }

            if (alias === 'emailConfirmation' && this.scenarioData.email) {
                nextModal.updateText({
                    additionalText: `Введите код подтверждения из вашей электронной почты`
                });
            }

            if (alias === 'pinConfirm' && this.scenarioData.pin) {
                nextModal.data.pin = this.scenarioData.pin;
            }

            nextModal.open(this.scenarioData);
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const scenario = new ModalScenario();

    const modalConfigs = [
        {
            alias: 'phoneEnter',
            title: 'Введите номер телефона',
            inputs: [
                {
                    id: 'phone-enter',
                    name: 'phone',
                    type: 'tel',
                    placeholder: '+7 (XXX) XXX-XX-XX'
                }
            ],
            buttonText: 'Отправить',
            nextModal: (data) => scenario.goTo('phoneConfirmation', data)
        },

        {
            alias: 'phoneConfirmation',
            title: 'ПОДТВЕРДИТЕ ВАШ НОМЕР',
            inputs: [
                {
                    id: 'code-phone-confirmation',
                    name: 'code',
                    type: 'tel',
                    placeholder: '_ _ _ _'
                }
            ],
            additionalText: 'Отправили код подтверждения в Telegram через бота Verification Codes. Введите полученный код.',
            buttonText: 'Подтвердить',
            nextModal: (data) => scenario.goTo('emailEnter', data)
        },

        {
            alias: 'emailEnter',
            title: 'Введите Электронную почту',
            inputs: [
                {
                    id: 'email-enter',
                    name: 'email',
                    type: 'email',
                    placeholder: 'example@mail.com'
                }
            ],
            buttonText: 'Отправить',
            nextModal: (data) => scenario.goTo('emailConfirmation', data)
        },

        {
            alias: 'emailConfirmation',
            title: 'ПОДТВЕРДИТЕ ВАШУ Почту',
            inputs: [
                {
                    id: 'code-email-confirmation',
                    name: 'code',
                    type: 'tel',
                    placeholder: '_ _ _ _'
                }
            ],
            additionalText: 'Введите код подтверждения из вашей электронной почты',
            buttonText: 'Подтвердить',
            nextModal: (data) => scenario.goTo('registration', data)
        },

        {
            alias: 'registration',
            title: 'Регистрация',
            additionalText: 'Пожалуйста, заполните данные',
            customContent: `
                <div class="checkbox-modal">
                    <div class="input-review">
                        <label for="first-name"></label>
                        <input type="text" id="first-name" name="first_name" placeholder="Имя" class="input-field">
                    </div>
                    <div class="input-review">
                        <label for="last-name"></label>
                        <input type="text" id="last-name" name="last_name" placeholder="Фамилия" class="input-field">
                    </div>
                </div>
            `,
            checkboxes: [
                {
                    id: 'policy-read',
                    name: 'policy_read',
                    label: 'Ознакомлен(-на) с политикой обработки персональных данных'
                },
                {
                    id: 'policy-agree',
                    name: 'policy_agree',
                    label: 'Согласен(-на) с политикой обработки персональных данных'
                }
            ],
            buttonText: 'Отправить',
            nextModal: (data) => scenario.goTo('pinCreate', data)
        },

        {
            alias: 'pinCreate',
            title: 'Придумайте пин-код',
            additionalText: 'Введите 4-значный пин-код',
            inputs: [
                {
                    id: 'pin-create',
                    name: 'pin',
                    type: 'password',
                    placeholder: '_ _ _ _',
                    maxlength: 4
                }
            ],
            buttonText: 'Далее',
            nextModal: (data) => scenario.goTo('pinConfirm', data)
        },

        {
            alias: 'pinConfirm',
            title: 'Подтвердите пин-код',
            additionalText: 'Введите пин-код еще раз',
            inputs: [
                {
                    id: 'pin-confirm',
                    name: 'pin_confirm',
                    type: 'password',
                    placeholder: '_ _ _ _',
                    maxlength: 4
                }
            ],
            buttonText: 'Завершить',
            nextModal: (data) => scenario.goTo('finalSuccess', data)
        },

        {
            alias: 'finalSuccess',
            title: 'Регистрация успешно завершена!',
            inputs: [],
            additionalText: '',
            buttonText: 'Отлично',
            showSuccess: true,
            nextModal: (data) => {
                const successModal = scenario.modals.get('finalSuccess');
                if (successModal) {
                    successModal.close();
                }
            }
        }
    ];

    modalConfigs.forEach(config => {
        const modal = new DynamicModal({
            template: document.getElementById('dynamicModal'),
            ...config,
            validator: new Validator()
        });

        modal.setModalManager(modalManager);
        scenario.addModal(modal);
    });

    window.verificationScenario = scenario;

    const regButton = document.querySelector('.registration');
    if (regButton) {
        regButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            scenario.start('phoneEnter');
        });
    }
});