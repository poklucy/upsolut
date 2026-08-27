const copyButton = document.getElementById('copy-svg');
const idValue = document.getElementById('id-display').textContent;

copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(idValue)
});


$(document).ready(function(){
    $('#phone').inputmask("+7 (999) 999-99-99");
});