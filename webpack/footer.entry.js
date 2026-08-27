/**
 * Футер-бандл: глобали для legacy-скриптов после сборки в модули.
 */
import Choices from 'choices.js';
import Swiper from 'swiper/bundle';

window.Choices = Choices;
window.Swiper = Swiper;

import '../scripts/dropdown.js';
import '../scripts/header.js';
import '../scripts/swiper.js';
import '../scripts/mockData.js';
import '../scripts/toaster.js';
import '../modal/modal.js';
import '../modal/Validator.js';
import '../modal/modalManager.js';
import '../scripts/phone-inputmask.js';
