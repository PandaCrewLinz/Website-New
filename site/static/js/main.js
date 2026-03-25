// dccx GmbH - Main JavaScript
(function() {
  'use strict';

  // ==========================================
  // Sticky Header
  // ==========================================
  const header = document.querySelector('.site-header');
  if (header) {
    let lastScroll = 0;
    window.addEventListener('scroll', function() {
      const currentScroll = window.pageYOffset;
      if (currentScroll > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      lastScroll = currentScroll;
    });
  }

  // ==========================================
  // Mobile Navigation
  // ==========================================
  const mobileToggle = document.querySelector('.mobile-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  const body = document.body;

  if (mobileToggle && mobileNav) {
    mobileToggle.addEventListener('click', function() {
      mobileToggle.classList.toggle('active');
      mobileNav.classList.toggle('active');
      body.classList.toggle('nav-open');
    });

    // Close mobile nav when clicking a link
    mobileNav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        mobileToggle.classList.remove('active');
        mobileNav.classList.remove('active');
        body.classList.remove('nav-open');
      });
    });

    // Mobile dropdown toggles
    mobileNav.querySelectorAll('.mobile-nav__toggle').forEach(function(toggle) {
      toggle.addEventListener('click', function(e) {
        e.preventDefault();
        const parent = this.closest('.mobile-nav__item, .mobile-nav__sub-item');
        if (parent) parent.classList.toggle('open');
      });
    });
  }

  // ==========================================
  // Hero Slider
  // ==========================================
  const heroSlider = document.querySelector('.hero-slider');
  if (heroSlider) {
    const slides = heroSlider.querySelectorAll('.hero-slider__slide');
    const indicators = heroSlider.querySelectorAll('.hero-slider__indicator');
    if (slides.length > 1) {
      let currentSlide = 0;

      function showSlide(index) {
        slides.forEach(function(slide, i) {
          slide.classList.toggle('hero-slider__slide--active', i === index);
        });
        indicators.forEach(function(dot, i) {
          dot.classList.toggle('hero-slider__indicator--active', i === index);
        });
      }

      function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
      }

      // Click on indicators
      indicators.forEach(function(dot, i) {
        dot.addEventListener('click', function() {
          currentSlide = i;
          showSlide(currentSlide);
        });
      });

      // Auto-rotate every 5 seconds
      showSlide(0);
      setInterval(nextSlide, 5000);
    }
  }

  // ==========================================
  // Cookie Banner
  // ==========================================
  const cookieOverlay = document.querySelector('.cookie-overlay');
  if (cookieOverlay) {
    const consent = localStorage.getItem('dccx-cookie-consent');

    if (!consent) {
      cookieOverlay.classList.remove('hidden');
    }

    cookieOverlay.querySelectorAll('[data-action]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');

        if (action === 'accept-all') {
          localStorage.setItem('dccx-cookie-consent', 'all');
        } else if (action === 'essential-only') {
          localStorage.setItem('dccx-cookie-consent', 'essential');
        } else if (action === 'settings') {
          // For now, treat as essential only
          localStorage.setItem('dccx-cookie-consent', 'essential');
        }

        cookieOverlay.classList.add('hidden');
      });
    });

    // Close on overlay click
    cookieOverlay.addEventListener('click', function(e) {
      if (e.target === cookieOverlay) {
        localStorage.setItem('dccx-cookie-consent', 'essential');
        cookieOverlay.classList.add('hidden');
      }
    });
  }

  // ==========================================
  // FAQ Accordion (for <details> elements)
  // ==========================================
  document.querySelectorAll('.faq-item details').forEach(function(detail) {
    detail.addEventListener('toggle', function() {
      if (this.open) {
        // Close other open details in same FAQ group
        const parent = this.closest('.faq-list');
        if (parent) {
          parent.querySelectorAll('details[open]').forEach(function(d) {
            if (d !== detail) {
              d.removeAttribute('open');
            }
          });
        }
      }
    });
  });

  // ==========================================
  // Scroll Animations (Intersection Observer)
  // ==========================================
  const animateElements = document.querySelectorAll('.animate-on-scroll');
  if (animateElements.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    animateElements.forEach(function(el) {
      observer.observe(el);
    });
  }

})();
