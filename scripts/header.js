class HeaderManager {
    constructor() {
        this.isMenuOpen = false;
        this.isHeaderVisible = true;
        this.lastScrollTop = 0;
        this.isMobile = this.checkIsMobile();


        this.header = document.getElementById('header');
        this.burgerBtn = document.getElementById('burgerBtn');
        this.mainMenu = document.getElementById('mainMenu');
        this.overlay = document.getElementById('overlay');
        this.logoLink = document.getElementById('logoLink');


        this.toggleMenu = this.toggleMenu.bind(this);
        this.closeMenu = this.closeMenu.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleEscapeKey = this.handleEscapeKey.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);

        this.init();
    }

    init() {

        this.burgerBtn.addEventListener('click', this.toggleMenu);
        this.overlay.addEventListener('click', this.closeMenu);
        this.logoLink.addEventListener('click', this.closeMenu);


        const navLinks = document.querySelectorAll('.navLink');
        navLinks.forEach(link => {
            link.addEventListener('click', this.closeMenu);
        });


        window.addEventListener('scroll', this.handleScroll);
        window.addEventListener('resize', this.handleResize);
        document.addEventListener('keydown', this.handleEscapeKey);
        document.addEventListener('click', this.handleClickOutside);


        this.updateHeaderVisibility();
    }

    checkIsMobile() {
        return window.innerWidth <= 768;
    }

    toggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;
        this.updateMenuState();
    }

    closeMenu() {
        if (this.isMobile && this.isMenuOpen) {
            this.isMenuOpen = false;
            this.updateMenuState();
        }
    }

    updateMenuState() {
        if (this.isMenuOpen) {
            this.mainMenu.classList.add('navLinksActive');
            this.overlay.classList.add('overlayActive');
            this.burgerBtn.classList.add('burgerActive');
            this.burgerBtn.setAttribute('aria-expanded', 'true');
            this.burgerBtn.setAttribute('aria-label', 'Закрыть меню');
            this.header.classList.add('menuOpen');


            if (this.isMobile) {
                document.body.style.overflow = 'hidden';
            }
        } else {
            this.mainMenu.classList.remove('navLinksActive');
            this.overlay.classList.remove('overlayActive');
            this.burgerBtn.classList.remove('burgerActive');
            this.burgerBtn.setAttribute('aria-expanded', 'false');
            this.burgerBtn.setAttribute('aria-label', 'Открыть меню');
            this.header.classList.remove('menuOpen');

            document.body.style.overflow = '';
        }
    }

    handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;


        if (scrollTop > this.lastScrollTop && scrollTop > 200) {

            if (this.isHeaderVisible) {
                this.isHeaderVisible = false;
                this.header.classList.add('headerHidden');
            }
        } else {

            if (!this.isHeaderVisible && scrollTop < this.lastScrollTop) {
                this.isHeaderVisible = true;
                this.header.classList.remove('headerHidden');
            }
        }

        this.lastScrollTop = scrollTop;
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = this.checkIsMobile();


        if (!this.isMobile && wasMobile && this.isMenuOpen) {
            this.isMenuOpen = false;
            this.updateMenuState();
        }
    }

    handleEscapeKey(event) {
        if (event.key === 'Escape' && this.isMenuOpen) {
            this.closeMenu();
        }
    }

    handleClickOutside(event) {

        if (this.isMenuOpen && this.isMobile) {
            const isClickInsideMenu = this.mainMenu.contains(event.target);
            const isClickOnBurger = this.burgerBtn.contains(event.target);

            if (!isClickInsideMenu && !isClickOnBurger) {
                this.closeMenu();
            }
        }
    }

    updateHeaderVisibility() {

        this.header.style.transform = this.isHeaderVisible ? 'translateY(0)' : 'translateY(-100%)';
    }


    destroy() {
        window.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('keydown', this.handleEscapeKey);
        document.removeEventListener('click', this.handleClickOutside);
    }
}

let headerManager;

document.addEventListener('DOMContentLoaded', () => {
    headerManager = new HeaderManager();
});


//////Фильтр для каталога на мобилке//////


const filterButton = document.getElementById('filterButton');
const filterDropdown = document.getElementById('filterDropdown');
const overlay = document.getElementById('overlay');

if (filterButton && filterDropdown && overlay) {
    function openDropdown() {
        filterDropdown.classList.add('active');
        overlay.classList.add('active');
        filterButton.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDropdownMenu() {
        filterDropdown.classList.remove('active');
        overlay.classList.remove('active');
        filterButton.classList.remove('active');
        document.body.style.overflow = '';
    }

    filterButton.addEventListener('click', function(e) {
        e.stopPropagation();

        if (filterDropdown.classList.contains('active')) {
            closeDropdownMenu();
        } else {
            openDropdown();
        }
    });

    overlay.addEventListener('click', closeDropdownMenu);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && filterDropdown.classList.contains('active')) {
            closeDropdownMenu();
        }
    });

    filterDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}