class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        if (!this.modal) return;

        this.closeBtn = this.modal.querySelector('.close');
        this.form = this.modal.querySelector('form');
        this.errorMessages = new Map();

        this.init();
    }

    init() {
        this.modal.classList.add('alternate');

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.close();
            });
        }

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleSubmit(new FormData(this.form));
            });
        }

        this.initInputs();
    }

    initInputs() {
        const inputs = this.modal.querySelectorAll('input');
        inputs.forEach(input => {
            if (!input.hasAttribute('autocomplete')) {
                if (input.type === 'tel') {
                    input.setAttribute('autocomplete', 'tel');
                } else if (input.type === 'email') {
                    input.setAttribute('autocomplete', 'email');
                } else if (input.name === 'first_name') {
                    input.setAttribute('autocomplete', 'given-name');
                } else if (input.name === 'last_name') {
                    input.setAttribute('autocomplete', 'family-name');
                } else if (input.name.includes('pin')) {
                    input.setAttribute('autocomplete', 'off');
                }
            }

            input.addEventListener('input', () => {
                this.clearInputError(input);
                input.classList.remove('input-error');
            });

            if (input.type === 'tel' && window.$ && $.fn.inputmask) {
                $(input).inputmask('+7 (999) 999-99-99');
            }
        });
    }

    open() {
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        this.clearAllErrors();

        const firstInput = this.modal.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 300);
        }
    }

    close() {
        this.modal.classList.remove('show');
        document.body.style.overflow = '';
        this.clearAllErrors();
        if (this.form) {
            this.form.reset();
        }
    }

    showError(input, message) {
        this.clearInputError(input);
        input.classList.add('input-error');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;

        input.parentNode.appendChild(errorDiv);
        this.errorMessages.set(input, errorDiv);
    }

    clearInputError(input) {
        if (this.errorMessages.has(input)) {
            this.errorMessages.get(input).remove();
            this.errorMessages.delete(input);
        }
        input.classList.remove('input-error');
    }

    clearAllErrors() {
        this.errorMessages.forEach((errorDiv, input) => {
            errorDiv.remove();
            input.classList.remove('input-error');
        });
        this.errorMessages.clear();
    }

    setFormData(data) {
        if (!this.form) return;

        for (let [key, value] of Object.entries(data)) {
            const input = this.form.querySelector(`[name="${key}"]`);
            if (input) {
                input.value = value;
            }
        }
    }
}