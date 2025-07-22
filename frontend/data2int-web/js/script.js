// Progress bar functionality
window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / documentHeight) * 100;
    document.getElementById('progressBar').style.width = scrollPercent + '%';
    
    // Back to top button
    const backToTop = document.getElementById('backToTop');
    if (scrollTop > 300) {
        backToTop.classList.add('show');
    } else {
        backToTop.classList.remove('show');
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Toggle expanded content
function toggleExpanded(contentId) {
    const content = document.getElementById(contentId);
    const button = content.previousElementSibling;
    
    if (content.classList.contains('show')) {
        content.classList.remove('show');
        button.textContent = 'More';
    } else {
        content.classList.add('show');
        button.textContent = 'Less';
    }
}

// Scroll to top function
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Add intersection observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all sections and cards
document.querySelectorAll('.section, .card').forEach(element => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(element);
});

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Add any initialization code here
    console.log('Strategic Planning Page Loaded');
    
    // Initialize progress bar
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = '0%';
    }
    
    // Initialize back to top button
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
        backToTopBtn.classList.remove('show');
    }
    
    // Add keyboard navigation support
    document.addEventListener('keydown', function(e) {
        // Press 'b' to scroll back to top
        if (e.key === 'b' || e.key === 'B') {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                scrollToTop();
            }
        }
        
        // Press 'Escape' to close expanded content
        if (e.key === 'Escape') {
            const expandedElements = document.querySelectorAll('.expanded-content.show');
            expandedElements.forEach(element => {
                element.classList.remove('show');
                const button = element.previousElementSibling;
                if (button && button.classList.contains('expand-btn')) {
                    button.textContent = 'More';
                }
            });
        }
    });
    
    // Add mobile menu toggle functionality (if needed in future)
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
    }
    
    // Add smooth scroll offset for sticky navigation
    const navHeight = document.querySelector('.nav').offsetHeight;
    document.documentElement.style.setProperty('--nav-height', navHeight + 'px');
});

// Additional utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounced scroll handler for better performance
const debouncedScrollHandler = debounce(() => {
    // Add any additional scroll-based functionality here
    const scrollTop = window.pageYOffset;
    const sections = document.querySelectorAll('section[id]');
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        const sectionBottom = sectionTop + section.offsetHeight;
        
        if (scrollTop >= sectionTop && scrollTop < sectionBottom) {
            const navLinks = document.querySelectorAll('.nav-links a');
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#' + section.id) {
                    link.classList.add('active');
                }
            });
        }
    });
}, 100);

window.addEventListener('scroll', debouncedScrollHandler);

// Error handling for missing elements
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
});

// Handle resize events
window.addEventListener('resize', debounce(() => {
    // Recalculate any size-dependent elements
    const navHeight = document.querySelector('.nav')?.offsetHeight || 0;
    document.documentElement.style.setProperty('--nav-height', navHeight + 'px');
}, 250));
