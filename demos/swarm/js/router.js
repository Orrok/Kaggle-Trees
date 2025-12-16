class Router {
    constructor() {
        this.currentDemo = 'home';
        this.init();
    }

    init() {
        // Navigation menu items
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const demo = item.getAttribute('data-demo');
                this.navigateTo(demo);
            });
        });

        // Demo cards
        const demoCards = document.querySelectorAll('.demo-card');
        demoCards.forEach(card => {
            card.addEventListener('click', () => {
                const demo = card.getAttribute('data-demo');
                this.navigateTo(demo);
            });
        });

        // Home link
        document.getElementById('nav-home').addEventListener('click', (e) => {
            e.preventDefault();
            this.navigateTo('home');
        });

        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            this.navigateTo('home');
        });

        // Handle initial route
        const hash = window.location.hash.slice(1);
        if (hash) {
            this.navigateTo(hash);
        } else {
            this.navigateTo('home');
        }
    }

    navigateTo(demo) {
        // Update current demo
        this.currentDemo = demo;

        // Update URL hash
        window.location.hash = demo;

        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-demo') === demo) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Show/hide landing page
        const landingPage = document.getElementById('landing-page');
        if (demo === 'home') {
            landingPage.style.display = 'flex';
            document.getElementById('back-nav').classList.remove('visible');
        } else {
            landingPage.style.display = 'none';
            document.getElementById('back-nav').classList.add('visible');
        }

        // Show/hide demo containers
        document.querySelectorAll('.demo-container').forEach(container => {
            container.classList.remove('active');
        });

        if (demo !== 'home') {
            const demoContainer = document.getElementById(`demo-${demo}`);
            if (demoContainer) {
                demoContainer.classList.add('active');
                this.loadDemo(demo, demoContainer);
            }
        }
    }

    async loadDemo(demo, container) {
        // Clear container
        container.innerHTML = '';

        // Load demo based on name
        if (demo === 'swarm') {
            await this.loadSwarmDemo(container);
        } else if (demo === 'christmas-tree') {
            await this.loadChristmasTreeDemo(container);
        }
    }

    async loadSwarmDemo(container) {
        // Create iframe to load the swarm demo
        const iframe = document.createElement('iframe');
        iframe.src = 'demos/swarm/index.html';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        container.appendChild(iframe);
    }

    async loadChristmasTreeDemo(container) {
        // Create iframe to load the Christmas tree demo
        const iframe = document.createElement('iframe');
        iframe.src = 'demos/christmas-tree/index.html';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        container.appendChild(iframe);
    }
}

// Initialize router when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new Router();
    });
} else {
    new Router();
}
