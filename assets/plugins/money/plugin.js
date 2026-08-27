/**
 * Форматирование денег на фронте — зеркало {@see Helpers\MoneyHelper} (PHP).
 * Целая сумма после round — без дроби (990 ₽), иначе ровно PRECISION знаков (742,50 ₽).
 */
(function (global) {
    'use strict';

    const PRECISION = 2;

    function round(value) {
        const n = Math.max(0, Number(value) || 0);
        if (!Number.isFinite(n)) {
            return 0;
        }
        const factor = 10 ** PRECISION;

        return Math.round(n * factor) / factor;
    }

    function equals(a, b) {
        return round(a) === round(b);
    }

    function isWholeAmount(rounded) {
        const r = round(rounded);

        return equals(r, Math.trunc(r));
    }

    function displayFractionDigits(rounded) {
        return isWholeAmount(rounded) ? 0 : PRECISION;
    }

    /**
     * @param {object} [options]
     * @param {string} [options.locale='ru-RU']
     * @param {number|null} [options.forceFractionDigits]
     */
    function formatNumber(value, options) {
        const opts = options || {};
        const locale = opts.locale || 'ru-RU';
        const n = round(value);
        const fractionDigits = opts.forceFractionDigits != null
            ? opts.forceFractionDigits
            : displayFractionDigits(n);

        return n.toLocaleString(locale, {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        });
    }

    function formatRub(value) {
        return `${formatNumber(value)} ₽`;
    }

    /** Строка корзины/каталога без пробела перед ₽: «742,50₽» / «990₽» */
    function formatRubInline(value) {
        return `${formatNumber(value)}₽`;
    }

    /** OutSum и прочие шлюзы — всегда PRECISION знаков, без разделителя тысяч */
    function formatGateway(value) {
        return round(value).toFixed(PRECISION);
    }

    function roundScore(value) {
        const n = Math.max(0, Number(value) || 0);
        if (!Number.isFinite(n)) {
            return 0;
        }

        return Math.round(n * 100) / 100;
    }

    /** @param {number} value уже roundScore */
    function scoreWordForValue(value) {
        if (Math.round(value * 100) % 100 > 0) {
            return 'балла';
        }
        const n = Math.trunc(value);
        const mod100 = n % 100;
        const mod10 = n % 10;
        if (mod100 >= 11 && mod100 <= 14) {
            return 'баллов';
        }
        if (mod10 === 1) {
            return 'балл';
        }
        if (mod10 >= 2 && mod10 <= 4) {
            return 'балла';
        }

        return 'баллов';
    }

    function formatScoreAmount(value) {
        const v = roundScore(value);
        const hasFraction = Math.round(v * 100) % 100 > 0;

        return formatNumber(v, { forceFractionDigits: hasFraction ? 2 : 0 });
    }

    function formatScoreLabel(value) {
        const v = roundScore(value);
        if (v <= 0) {
            return '';
        }

        return `${formatScoreAmount(v)} ${scoreWordForValue(v)}`;
    }

    global.MoneyFormat = {
        PRECISION,
        round,
        equals,
        formatNumber,
        formatRub,
        formatRubInline,
        formatGateway,
    };

    global.ScoreFormat = {
        round: roundScore,
        formatScoreAmount,
        formatScoreLabel,
        scoreWordForValue,
    };
})(typeof window !== 'undefined' ? window : globalThis);

class MoneyPlugin {
    async init() {
        /* Сервисный плагин: MoneyFormat уже на window при выполнении скрипта */
    }
}

if (typeof window.registerProjectPlugin === 'function') {
    window.registerProjectPlugin('money', MoneyPlugin);
}
