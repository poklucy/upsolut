/**
 * ENERGY — простой ассистент: приветствие → вопрос → 4 варианта → рекомендация.
 * Подключение: EnergyChatWidget.mount({ container: document.body });
 */
(function (global) {
  'use strict';

  var TEXT = {
    greet:
      'Здравствуйте! Я помогу подобрать сценарий приёма ENERGY под вашу задачу.',
    question: 'Для каких целей вам нужна энергия?',
    options: [
      {
        id: 'sport',
        label: 'Спорт и тренировки',
        reply: 'Спорт и тренировки',
        recommendation:
          'Для тренировок удобно принять ENERGY за 15–30 минут до нагрузки: так вы успеете оценить самочувствие до старта. Упаковка из 10 флаконов по 50 мл позволяет взять с собой нужное количество. Пейте воду дополнительно к режиму тренировки. Если есть сердечно-сосудистые заболевания или вы не переносите стимуляторы — проконсультируйтесь с врачом.',
      },
      {
        id: 'work',
        label: 'Работа, учёба, концентрация',
        reply: 'Работа, учёба, концентрация',
        recommendation:
          'Для умственной нагрузки лучше выбрать время, когда вам не нужно сразу ложиться спать: эффект может сохраняться несколько часов. Начните с одного флакона и при необходимости подберите дозу под свой ритм. Избегайте сочетания с большим количеством кофеина из других источников в тот же день.',
      },
      {
        id: 'fatigue',
        label: 'Снять усталость в течение дня',
        reply: 'Снять усталость в течение дня',
        recommendation:
          'При дневной усталости ENERGY можно использовать как точечную поддержку, но не замену сну и питанию. Удобный формат флакона — быстро выпить между делами. Не превышайте рекомендуемую суточную норму, указанную на упаковке, и не смешивайте с алкоголем.',
      },
      {
        id: 'trip',
        label: 'Перед дорогой или важным событием',
        reply: 'Перед дорогой или важным событием',
        recommendation:
          'Перед поездкой или важной встречей примите заранее, чтобы оценить реакцию организма в спокойной обстановке. За рулём учитывайте собственную чувствительность к бодрящим компонентам. На упаковке всегда смотрите состав и противопоказания.',
      },
    ],
    disclaimer:
      'Информация носит общий характер и не заменяет консультацию специалиста. Следуйте инструкции на упаковке.',
    again: 'Задать вопрос снова',
  };

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function mount(options) {
    options = options || {};
    var root = options.container || document.body;
    if (!root) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function onEcDomReady() {
          document.removeEventListener('DOMContentLoaded', onEcDomReady);
          mount(options);
        });
      }
      return;
    }

    var title = (options && options.title) || 'ENERGY';
    var subtitle =
      (options && options.subtitle) || 'Подбор сценария приёма';

    var wrap = el('div', 'energy-chat-root');
    var launcher = el('button', 'energy-chat-launcher', '');
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'Открыть чат ENERGY');
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    var panel = el('div', 'energy-chat-panel', '');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Чат ассистента ENERGY');

    var header = el('div', 'energy-chat-header', '');
    var headText = el('div', '', '');
    headText.appendChild(el('p', 'energy-chat-title', title));
    headText.appendChild(el('p', 'energy-chat-sub', subtitle));
    var closeBtn = el('button', 'energy-chat-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Закрыть');
    header.appendChild(headText);
    header.appendChild(closeBtn);

    var messages = el('div', 'energy-chat-messages', '');
    var footer = el('div', 'energy-chat-footer', TEXT.disclaimer);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(footer);

    wrap.appendChild(launcher);
    wrap.appendChild(panel);
    root.appendChild(wrap);

    var state = { step: 'idle', buttonsWrap: null };

    function scrollBottom() {
      messages.scrollTop = messages.scrollHeight;
    }

    function addBot(html) {
      var m = el('div', 'energy-chat-msg energy-chat-msg--bot', html);
      messages.appendChild(m);
      scrollBottom();
      return m;
    }

    function addUser(text) {
      var m = el(
        'div',
        'energy-chat-msg energy-chat-msg--user',
        '<p>' + escapeHtml(text) + '</p>'
      );
      messages.appendChild(m);
      scrollBottom();
    }

    function escapeHtml(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function clearFlow() {
      messages.innerHTML = '';
      state.buttonsWrap = null;
    }

    function showQuestionFlow() {
      clearFlow();
      addBot('<p>' + escapeHtml(TEXT.greet) + '</p>');
      addBot(
        '<p>' +
          escapeHtml(TEXT.question) +
          '</p><div class="energy-chat-actions" id="ec-actions"></div>'
      );
      var actions = wrap.querySelector('#ec-actions');
      state.buttonsWrap = actions;
      TEXT.options.forEach(function (opt) {
        var b = el('button', 'energy-chat-btn', escapeHtml(opt.label));
        b.type = 'button';
        b.dataset.id = opt.id;
        b.addEventListener('click', function () {
          onOption(opt);
        });
        actions.appendChild(b);
      });
      scrollBottom();
    }

    function disableAllButtons() {
      if (!state.buttonsWrap) return;
      var btns = state.buttonsWrap.querySelectorAll('.energy-chat-btn');
      for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
    }

    function onOption(opt) {
      disableAllButtons();
      addUser(opt.reply);
      var rec =
        '<p><strong>Рекомендация</strong></p><p>' +
        escapeHtml(opt.recommendation) +
        '</p><small>' +
        escapeHtml(TEXT.disclaimer) +
        '</small>';
      addBot(rec);
      var again = el(
        'div',
        'energy-chat-actions',
        ''
      );
      var againBtn = el('button', 'energy-chat-btn', TEXT.again);
      againBtn.type = 'button';
      againBtn.addEventListener('click', showQuestionFlow);
      again.appendChild(againBtn);
      messages.appendChild(again);
      scrollBottom();
    }

    function toggle(open) {
      var isOpen = open != null ? open : !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', isOpen);
      launcher.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (!isOpen) {
        state.step = 'idle';
        return;
      }
      if (state.step === 'idle') {
        state.step = 'ready';
        showQuestionFlow();
      }
    }

    launcher.addEventListener('click', function () {
      toggle();
    });
    closeBtn.addEventListener('click', function () {
      toggle(false);
    });

    return {
      open: function () {
        toggle(true);
      },
      close: function () {
        toggle(false);
      },
      restart: showQuestionFlow,
    };
  }

  global.EnergyChatWidget = { mount: mount, TEXT: TEXT };
})(typeof window !== 'undefined' ? window : this);
