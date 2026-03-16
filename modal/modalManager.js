const MockData = {
    users: [
        {
            phone: "+79991234567",
            email: "ivan@mail.com",
            firstName: "Иван",
            lastName: "Петров",
            pin: "1234",
            hasTelegram: true
        }
    ],

    verificationCodes: new Map(),

    generateCode() {
        return "1234";
    },

    saveCode(identifier, code) {
        this.verificationCodes.set(identifier, code);
    },

    verifyCode(identifier, code) {
        return this.verificationCodes.get(identifier) === code;
    },

    normalizePhone(phone) {
        const digits = phone.replace(/\D/g, '');
        return '+' + digits;
    },

    findByPhone(phone) {
        const normalized = this.normalizePhone(phone);
        return this.users.find(u => u.phone === normalized);
    },

    findByEmail(email) {
        return this.users.find(u => u.email === email);
    }
};

const TempData = {
    phone: null,
    email: null,
    pin: null,
    mode: null
};

const ErrorMessages = {
    required: 'Обязательное поле',
    phoneRequired: 'Введите номер телефона',
    phoneInvalid: 'Введите корректный номер телефона',
    codeRequired: 'Введите код подтверждения',
    codeInvalid: 'Неверный код подтверждения',
    codeLength: 'Код должен состоять из 4 цифр',
    pinRequired: 'Введите пин-код',
    pinInvalid: 'Неверный пин-код',
    pinLength: 'Пин-код должен состоять из 4 цифр',
    pinMismatch: 'Пин-коды не совпадают',
    pinConfirmRequired: 'Подтвердите пин-код',
    emailRequired: 'Введите email',
    emailInvalid: 'Введите корректный email',
    emailTaken: 'Этот email уже используется',
    firstNameRequired: 'Введите имя',
    lastNameRequired: 'Введите фамилию',
    policyReadRequired: 'Необходимо ознакомиться с политикой',
    policyAgreeRequired: 'Необходимо согласиться с политикой',
    codeResent: 'Новый код отправлен',
    codeResentEmail: 'Новый код отправлен, проверьте почту',
    codeResentEmailRecovery: 'Новый код отправлен на почту'
};

const ErrorHandler = {
    show(form, message) {
        const errorDiv = form.querySelector('.error-message');
        const inputs = form.querySelectorAll('input:not([type="checkbox"])');

        inputs.forEach(input => input.classList.add('input-error'));

        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';

            setTimeout(() => {
                errorDiv.style.display = 'none';
                inputs.forEach(input => input.classList.remove('input-error'));
            }, 3000);
        }
    },

    clear(form) {
        const errorDivs = form.querySelectorAll('.error-message');
        errorDivs.forEach(div => {
            div.style.display = 'none';
            div.textContent = '';
        });

        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => input.classList.remove('input-error'));
    },

    validate(form, validationResult) {
        if (!validationResult.isValid) {
            this.show(form, validationResult.message);
            return false;
        }
        return true;
    }
};

const ModalManager = {
    startFlow() {
        this.open('phoneEnterModal');
    },

    open(modalId) {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
        document.querySelectorAll('.modal form').forEach(form => {
            form.reset();
            ErrorHandler.clear(form);
        });

        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('show');
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('show');
    },

    closeAll() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    },

    transition(fromModal, toModalId, data = {}) {
        const fromForm = fromModal.querySelector('form');
        if (fromForm) ErrorHandler.clear(fromForm);

        if (data.phone) {
            const toModal = document.getElementById(toModalId);
            const phoneSpan = toModal.querySelector('.phone-number');
            if (phoneSpan) phoneSpan.textContent = data.phone;
        }

        if (data.email) {
            const toModal = document.getElementById(toModalId);
            const textSpan = toModal.querySelector('.input-text');
            if (textSpan && data.maskedEmail) {
                textSpan.innerHTML = `Отправили код на почту ${data.maskedEmail}`;
            }
        }

        fromModal.classList.remove('show');
        document.getElementById(toModalId).classList.add('show');
    },

    resetTempData() {
        TempData.phone = null;
        TempData.email = null;
        TempData.pin = null;
        TempData.firstName = null;
        TempData.lastName = null;
        TempData.mode = null;
    }
};

function startRegistrationFlow() {
    ModalManager.startFlow();
}

const FormHandlers = {
    phoneEnter(form, modal) {
        const phoneInput = form.querySelector('input[name="phone"]').value;
        const validation = Validator.validatePhone(phoneInput);

        if (!ErrorHandler.validate(form, validation)) return;

        const normalizedPhone = MockData.normalizePhone(phoneInput);
        const { exists, user } = Validator.checkUserExists(normalizedPhone, MockData.users);

        TempData.phone = normalizedPhone;

        if (exists) {
            ModalManager.transition(modal, 'authorizationModal', { phone: normalizedPhone });
        } else {
            const code = MockData.generateCode();
            MockData.saveCode(normalizedPhone, code);
            ModalManager.transition(modal, 'phoneConfirmationModal', { phone: normalizedPhone });
        }
    },

    phoneConfirm(form, modal) {
        const codeInput = form.querySelector('input[name="code"]').value;
        const validation = Validator.validateCode(codeInput);

        if (!ErrorHandler.validate(form, validation)) return;

        if (codeInput === '1234') {
            ModalManager.transition(modal, 'emailEnterModal');
        } else {
            ErrorHandler.show(form, ErrorMessages.codeInvalid);
        }
    },

    emailEnter(form, modal) {
        const emailInput = form.querySelector('input[name="email"]').value;
        const validation = Validator.validateEmail(emailInput);

        if (!ErrorHandler.validate(form, validation)) return;

        const emailCheck = Validator.checkEmailAvailable(emailInput, TempData.phone, MockData.users);
        if (!emailCheck.isValid) {
            ErrorHandler.show(form, emailCheck.message);
            return;
        }

        TempData.email = emailInput;
        const code = MockData.generateCode();
        MockData.saveCode(emailInput, code);

        ModalManager.transition(modal, 'emailConfirmationModal');
    },

    emailConfirm(form, modal) {
        const codeInput = form.querySelector('input[name="code"]').value;
        const validation = Validator.validateCode(codeInput);

        if (!ErrorHandler.validate(form, validation)) return;

        if (codeInput === '1234') {
            ModalManager.transition(modal, 'registrationModal');
        } else {
            ErrorHandler.show(form, ErrorMessages.codeInvalid);
        }
    },

    registration(form, modal) {
        const firstName = form.querySelector('input[name="first_name"]').value;
        const lastName = form.querySelector('input[name="last_name"]').value;
        const policyRead = form.querySelector('input[name="policy_read"]').checked;
        const policyAgree = form.querySelector('input[name="policy_agree"]').checked;

        const firstNameValidation = Validator.validateName(firstName, 'Имя');
        if (!ErrorHandler.validate(form, firstNameValidation)) return;

        const lastNameValidation = Validator.validateName(lastName, 'Фамилия');
        if (!ErrorHandler.validate(form, lastNameValidation)) return;

        const policyValidation = Validator.validatePolicy(policyRead, policyAgree);
        if (!ErrorHandler.validate(form, policyValidation)) return;

        TempData.firstName = firstName;
        TempData.lastName = lastName;
        TempData.mode = 'registration';

        ModalManager.transition(modal, 'pinCreateModal');
    },

    authorization(form, modal) {
        const pinInput = form.querySelector('input[name="code"]').value;
        const validation = Validator.validatePin(pinInput);

        if (!ErrorHandler.validate(form, validation)) return;

        const user = MockData.findByPhone(TempData.phone);

        if (user && user.pin === pinInput) {
            alert(`Добро пожаловать, ${user.firstName}!`);
            ModalManager.closeAll();
            ModalManager.resetTempData();
        } else {
            ErrorHandler.show(form, ErrorMessages.pinInvalid);
        }
    },

    pinChange(form, modal) {
        const codeInput = form.querySelector('input[name="code"]').value;
        const validation = Validator.validateCode(codeInput);

        if (!ErrorHandler.validate(form, validation)) return;

        if (codeInput === '1234') {
            TempData.mode = 'recovery';
            ModalManager.transition(modal, 'pinCreateModal');
        } else {
            ErrorHandler.show(form, ErrorMessages.codeInvalid);
        }
    },

    pinCreate(form, modal) {
        const pin = form.querySelector('input[name="pin"]').value;
        const validation = Validator.validatePin(pin);

        if (!ErrorHandler.validate(form, validation)) return;

        TempData.pin = pin;
        ModalManager.transition(modal, 'pinConfirmModal');
    },

    pinConfirm(form, modal) {
        const confirmPin = form.querySelector('input[name="pin_confirm"]').value;
        const validation = Validator.validatePinConfirm(TempData.pin, confirmPin);

        if (!ErrorHandler.validate(form, validation)) return;

        if (TempData.mode === 'recovery') {
            const user = MockData.findByPhone(TempData.phone);
            if (user) {
                user.pin = TempData.pin;
            }
            ModalManager.transition(modal, 'pinChangeSuccessModal');
        } else {
            const newUser = {
                phone: TempData.phone,
                email: TempData.email,
                firstName: TempData.firstName,
                lastName: TempData.lastName,
                pin: TempData.pin,
                hasTelegram: true
            };
            MockData.users.push(newUser);
            ModalManager.transition(modal, 'successModal');
        }

        ModalManager.resetTempData();
    }
};

const ResendHandlers = {
    phoneConfirmation(modal) {
        const code = MockData.generateCode();
        MockData.saveCode(TempData.phone, code);
        ModalManager.transition(modal, 'phoneConfirmationModalSecondStep', { phone: TempData.phone });
    },

    phoneConfirmationSecondStep(modal) {
        const code = MockData.generateCode();
        MockData.saveCode(TempData.phone, code);
        ErrorHandler.show(modal.querySelector('form'), ErrorMessages.codeResent);
    },

    emailConfirmation(modal) {
        const code = MockData.generateCode();
        MockData.saveCode(TempData.email, code);
        ModalManager.transition(modal, 'emailConfirmationModalSecondStep');
    },

    emailConfirmationSecondStep(modal) {
        const code = MockData.generateCode();
        MockData.saveCode(TempData.email, code);
        ErrorHandler.show(modal.querySelector('form'), ErrorMessages.codeResentEmail);
    },

    authorization(modal) {
        const code = MockData.generateCode();
        MockData.saveCode(TempData.phone, code);
        ModalManager.transition(modal, 'pinChangeModal', { phone: TempData.phone });
    },

    pinChange(modal) {
        const user = MockData.findByPhone(TempData.phone);
        if (user) {
            const emailParts = user.email.split('@');
            const maskedEmail = emailParts[0].charAt(0) + '*****@' + emailParts[1];

            const code = MockData.generateCode();
            MockData.saveCode(user.email, code);

            ModalManager.transition(modal, 'pinChangeModalEmail', {
                email: user.email,
                maskedEmail: maskedEmail
            });
        }
    },

    pinChangeEmail(modal) {
        const user = MockData.findByPhone(TempData.phone);
        if (user) {
            const code = MockData.generateCode();
            MockData.saveCode(user.email, code);
            ErrorHandler.show(modal.querySelector('form'), ErrorMessages.codeResentEmailRecovery);
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {

    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const modal = this.closest('.modal');
            if (modal) {
                modal.classList.remove('show');
                const form = modal.querySelector('form');
                if (form) ErrorHandler.clear(form);
            }
        });
    });

    document.querySelectorAll('.modal .buttonDark').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const modal = this.closest('.modal');
            if (modal && (modal.id === 'successModal' || modal.id === 'pinChangeSuccessModal')) {
                modal.classList.remove('show');
                const form = modal.querySelector('form');
                if (form) ErrorHandler.clear(form);
            }
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('show');
                const form = this.querySelector('form');
                if (form) ErrorHandler.clear(form);
            }
        });
    });

    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('input-error')) {
            e.target.classList.remove('input-error');
        }
    });

    document.querySelectorAll('.modal form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            const modal = this.closest('.modal');
            if (!modal) return;

            const modalId = modal.id;
            ErrorHandler.clear(this);

            const handlerMap = {
                'phoneEnterModal': FormHandlers.phoneEnter,
                'phoneConfirmationModal': FormHandlers.phoneConfirm,
                'phoneConfirmationModalSecondStep': FormHandlers.phoneConfirm,
                'emailEnterModal': FormHandlers.emailEnter,
                'emailConfirmationModal': FormHandlers.emailConfirm,
                'emailConfirmationModalSecondStep': FormHandlers.emailConfirm,
                'registrationModal': FormHandlers.registration,
                'authorizationModal': FormHandlers.authorization,
                'pinChangeModal': FormHandlers.pinChange,
                'pinChangeModalEmail': FormHandlers.pinChange,
                'pinCreateModal': FormHandlers.pinCreate,
                'pinConfirmModal': FormHandlers.pinConfirm
            };

            const handler = handlerMap[modalId];
            if (handler) {
                handler(this, modal);
            }
        });
    });

    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.resend-link');
        if (!btn) return;

        e.preventDefault();

        const modal = btn.closest('.modal');
        if (!modal) return;

        const modalId = modal.id;

        const resendHandlerMap = {
            'phoneConfirmationModal': ResendHandlers.phoneConfirmation,
            'phoneConfirmationModalSecondStep': ResendHandlers.phoneConfirmationSecondStep,
            'emailConfirmationModal': ResendHandlers.emailConfirmation,
            'emailConfirmationModalSecondStep': ResendHandlers.emailConfirmationSecondStep,
            'authorizationModal': ResendHandlers.authorization,
            'pinChangeModal': ResendHandlers.pinChange,
            'pinChangeModalEmail': ResendHandlers.pinChangeEmail
        };

        const handler = resendHandlerMap[modalId];
        if (handler) {
            handler(modal);
        }
    });

    document.addEventListener('input', function(e) {
        if (e.target.name === 'phone') {
            e.target.value = Validator.formatPhone(e.target.value);
        }
    });

    document.addEventListener('input', function(e) {
        if (e.target.name === 'pin' || e.target.name === 'pin_confirm' || e.target.name === 'code') {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
        }
    });
});