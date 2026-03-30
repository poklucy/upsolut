document.querySelectorAll('.copy').forEach(button => {
    button.addEventListener('click', function() {
        const existingToast = document.querySelector('.toast-message');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = 'Скопировано';

        const rect = this.getBoundingClientRect();
        toast.style.left = (rect.left + rect.width) + 'px';
        toast.style.top = (rect.top - 45) + 'px';

        document.body.appendChild(toast);

        setTimeout(() => {
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 1700);
    });
});

document.querySelectorAll('.like, .copy').forEach(element => {
    element.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();

        if (this.classList.contains('copy')) {
        }

        if (this.classList.contains('like')) {
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const stars = document.querySelectorAll('.button-stars');
    let currentRating = 0;

    function updateStars(rating) {
        stars.forEach((star, index) => {
            const starIndex = index + 1;
            if (starIndex <= rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
        currentRating = rating;

    }

    stars.forEach(star => {
        star.addEventListener('click', function(e) {
            e.stopPropagation();
            const rating = parseInt(this.getAttribute('data-rating'));
            updateStars(rating);
        });
    });

});
