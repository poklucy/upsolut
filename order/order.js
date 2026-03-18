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