/**
 * Маска +7 уже содержит код страны; при вставке 7926… все 11 цифр шли в 10 позиций маски,
 * и первая цифра попадала в скобки → +7 (792) … вместо +7 (926) …
 * Перед вставкой и при инициализации убираем ведущую 7 или 8, если всего 11 цифр.
 *
 * Зависимости: jQuery, jquery.inputmask (подключаются в шаблоне раньше этого файла).
 */
(function ($) {
    'use strict';

    window.applyRuPhoneInputmask = function ($input) {
        if (!$input || !$input.length || !$.fn.inputmask) {
            return;
        }
        var maskOpts = {
            mask: '+7 (999) 999-99-99',
            onBeforePaste: function (pastedValue) {
                var digits = String(pastedValue || '').replace(/\D/g, '');
                if (digits.length === 11 && (digits.charAt(0) === '7' || digits.charAt(0) === '8')) {
                    return digits.slice(1);
                }
                return pastedValue;
            }
        };
        var raw = $input.val() || '';
        var digits = String(raw).replace(/\D/g, '');
        if (digits.length === 11 && (digits.charAt(0) === '7' || digits.charAt(0) === '8')) {
            digits = digits.slice(1);
        }
        if (digits.length === 10) {
            $input.val(digits);
        }
        try {
            $input.inputmask('remove');
        } catch (e) {
            // ignore
        }
        $input.inputmask(maskOpts);
    };

    $(document).ready(function () {
        window.applyRuPhoneInputmask($('#phone'));
    });
})(window.jQuery);
