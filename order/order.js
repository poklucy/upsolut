class PromoManager {
    constructor(inputId, buttonId, validCodes = ['SUMMER2024', 'WINTER2024', 'WELCOME20']) {
        this.input = document.getElementById(inputId);
        this.button = document.getElementById(buttonId);
        this.validCodes = validCodes.map(code => code.toUpperCase());

        this.button.disabled = true;
        this.button.classList.add('disabled');

        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.button.disabled) this.validate();
        });
        this.button.addEventListener('click', () => this.validate());
    }

    handleInput() {
        const hasText = this.input.value.trim().length > 0;
        this.button.disabled = !hasText;
        this.button.classList.toggle('disabled', !hasText);
    }

    validate() {
        const code = this.input.value.trim().toUpperCase();

        if (this.validCodes.includes(code)) {
            this.button.textContent = 'Код применен';
            this.button.classList.add('success');
            this.input.disabled = true;
            this.button.disabled = true;
        } else {
            this.button.textContent = 'Неверный код';
            this.button.classList.add('error');

            setTimeout(() => {
                this.button.textContent = 'Применить';
                this.button.classList.remove('error');
                this.handleInput();
            }, 1500);
        }
    }
}

new PromoManager('promo', 'applyButton');

document.addEventListener('DOMContentLoaded', function() {
    const checkbox = document.getElementById('another');
    const nameInput = document.getElementById('name');
    const lastNameInput = document.getElementById('last-name');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');

    if (checkbox && nameInput && lastNameInput && phoneInput) {

        nameInput.disabled = true;
        lastNameInput.disabled = true;
        phoneInput.disabled = true;

        let storedName = nameInput.value;
        let storedLastName = lastNameInput.value;
        let storedPhone = phoneInput.value;

        nameInput.addEventListener('input', function() {
            if (!checkbox.checked) storedName = nameInput.value;
        });

        lastNameInput.addEventListener('input', function() {
            if (!checkbox.checked) storedLastName = lastNameInput.value;
        });

        phoneInput.addEventListener('input', function() {
            if (!checkbox.checked) storedPhone = phoneInput.value;
        });

        checkbox.addEventListener('change', function() {
            if (checkbox.checked) {
                storedName = nameInput.value;
                storedLastName = lastNameInput.value;
                storedPhone = phoneInput.value;

                nameInput.value = '';
                lastNameInput.value = '';
                phoneInput.value = '';

                nameInput.disabled = false;
                lastNameInput.disabled = false;
                phoneInput.disabled = false;
            } else {
                nameInput.value = storedName;
                lastNameInput.value = storedLastName;
                phoneInput.value = storedPhone;

                nameInput.disabled = true;
                lastNameInput.disabled = true;
                phoneInput.disabled = true;
            }
        });
    }
});