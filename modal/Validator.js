class Validator {
    static formatPhone(value) {
        let digits = value.replace(/\D/g, '');
        if (digits.length === 0) return '';

        if (digits.startsWith('7') || digits.startsWith('8')) {
            digits = digits.substring(1);
        }

        const match = digits.match(/^(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
        if (match) {
            return '+7' +
                (match[1] ? ' (' + match[1] : '') +
                (match[2] ? ') ' + match[2] : '') +
                (match[3] ? '-' + match[3] : '') +
                (match[4] ? '-' + match[4] : '');
        }
        return value;
    }

    static validatePhone(phone) {
        if (!phone) {
            return { isValid: false, message: 'Введите номер телефона' };
        }

        const digits = phone.replace(/\D/g, '');

        if (digits.length < 11) {
            return { isValid: false, message: 'Введите полный номер телефона' };
        }

        return { isValid: true, message: '' };
    }

    static validateEmail(email) {
        if (!email) {
            return { isValid: false, message: 'Введите email' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { isValid: false, message: 'Введите корректный email' };
        }

        return { isValid: true, message: '' };
    }

    static validateCode(code) {
        if (!code) {
            return { isValid: false, message: 'Введите код подтверждения' };
        }

        if (code.length !== 4) {
            return { isValid: false, message: 'Код должен состоять из 4 цифр' };
        }

        if (!/^\d+$/.test(code)) {
            return { isValid: false, message: 'Код может содержать только цифры' };
        }

        return { isValid: true, message: '' };
    }

    static validatePin(pin) {
        if (!pin) {
            return { isValid: false, message: 'Введите пин-код' };
        }

        if (pin.length !== 4) {
            return { isValid: false, message: 'Пин-код должен состоять из 4 цифр' };
        }

        if (!/^\d+$/.test(pin)) {
            return { isValid: false, message: 'Пин-код может содержать только цифры' };
        }

        return { isValid: true, message: '' };
    }

    static validatePinConfirm(pin, confirmPin) {
        if (!confirmPin) {
            return { isValid: false, message: 'Подтвердите пин-код' };
        }

        if (confirmPin.length !== 4) {
            return { isValid: false, message: 'Пин-код должен состоять из 4 цифр' };
        }

        if (pin !== confirmPin) {
            return { isValid: false, message: 'Пин-коды не совпадают' };
        }

        return { isValid: true, message: '' };
    }

    static validateName(name, fieldName = 'Имя') {
        if (!name || name.trim() === '') {
            return { isValid: false, message: `Введите ${fieldName.toLowerCase()}` };
        }

        if (name.trim().length < 2) {
            return { isValid: false, message: `${fieldName} должно содержать минимум 2 символа` };
        }

        return { isValid: true, message: '' };
    }

    static validatePolicy(policyRead, policyAgree) {
        if (!policyRead) {
            return { isValid: false, message: 'Необходимо ознакомиться с политикой' };
        }

        if (!policyAgree) {
            return { isValid: false, message: 'Необходимо согласиться с политикой' };
        }

        return { isValid: true, message: '' };
    }

    static checkUserExists(phone, users) {
        const user = users.find(u => u.phone === phone);
        return { exists: !!user, user };
    }

    static checkEmailAvailable(email, phone, users) {
        const existingUser = users.find(u => u.email === email);
        if (existingUser && existingUser.phone !== phone) {
            return { isValid: false, message: 'Этот email уже используется' };
        }
        return { isValid: true, message: '' };
    }
}

window.Validator = Validator;