/**
 * Text Effects System
 * 1. ScrambleText: Decodes text from random characters
 * 2. RevealText: Observes elements and triggers reveal animations
 */

class ScrambleText {
    constructor(element) {
        this.element = element;
        this.originalText = element.innerText;
        this.chars = '!<>-_\\/[]{}—=+*^?#________';
        this.frame = 0;
        this.queue = [];
        this.resolve = null;

        this.update = this.update.bind(this);
    }

    setText(newText) {
        const oldText = this.originalText;
        const length = Math.max(oldText.length, newText.length);
        const promise = new Promise((resolve) => this.resolve = resolve);

        this.queue = [];
        for (let i = 0; i < length; i++) {
            const from = oldText[i] || '';
            const to = newText[i] || '';
            // Faster scramble: reduced range from 40 to 15
            const start = Math.floor(Math.random() * 15);
            const end = start + Math.floor(Math.random() * 15);
            this.queue.push({ from, to, start, end });
        }

        cancelAnimationFrame(this.frameRequest);
        this.frame = 0;
        this.update();
        return promise;
    }

    update() {
        let output = '';
        let complete = 0;

        for (let i = 0, n = this.queue.length; i < n; i++) {
            let { from, to, start, end, char } = this.queue[i];

            if (this.frame >= end) {
                complete++;
                output += to;
            } else if (this.frame >= start) {
                if (!char || Math.random() < 0.28) {
                    char = this.randomChar();
                    this.queue[i].char = char;
                }
                output += `<span class="dud">${char}</span>`;
            } else {
                output += from;
            }
        }

        this.element.innerHTML = output;

        if (complete === this.queue.length) {
            this.resolve();
        } else {
            this.frameRequest = requestAnimationFrame(this.update);
            this.frame++;
        }
    }

    randomChar() {
        return this.chars[Math.floor(Math.random() * this.chars.length)];
    }
}

export function initTextEffects() {
    // 1. Hero Scramble Effect
    const heroTitle = document.querySelector('#hero-text h1');
    if (heroTitle) {
        const scrambler = new ScrambleText(heroTitle);
        // Wait a bit then scramble
        setTimeout(() => {
            scrambler.setText(heroTitle.innerText);
        }, 500);

        // Glitch on hover - Subtle Twitch
        heroTitle.addEventListener('mouseenter', () => {
            // Only scramble a few characters quickly
            const original = heroTitle.innerText;
            let iterations = 0;
            const interval = setInterval(() => {
                heroTitle.innerText = original.split('')
                    .map((letter, index) => {
                        if (index < 3) return letter; // Keep first few chars stable
                        return Math.random() > 0.8 ? scrambler.randomChar() : letter;
                    })
                    .join('');

                if (iterations > 5) { // Very short duration
                    clearInterval(interval);
                    heroTitle.innerText = original;
                }
                iterations++;
            }, 30);
        });
    }

    // 2. Section Header Reveal (Intersection Observer)
    const observerOptions = {
        threshold: 0.5
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.content-section h2').forEach(el => {
        observer.observe(el);
    });
}
