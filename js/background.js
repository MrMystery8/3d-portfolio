/**
 * Dynamic Background Animation
 * Theme: Slow Gradient Waves
 * Description: Multiple sine waves with low opacity gradients moving slowly across the screen.
 */

export function initBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let waves = [];

    // Configuration
    const config = {
        waveCount: 3,
        waveHeight: 150, // Amplitude
        waveLength: 0.002, // Frequency
        speed: 0.002,
        colors: [
            'rgba(0, 255, 255, 0.03)', // Very subtle cyan
            'rgba(165, 180, 252, 0.03)', // Very subtle indigo
            'rgba(0, 255, 255, 0.02)'
        ]
    };

    class Wave {
        constructor(index) {
            this.index = index;
            this.offset = Math.random() * 100;
            this.color = config.colors[index % config.colors.length];
            this.speed = config.speed + (Math.random() * 0.001);
            this.amplitude = config.waveHeight + (Math.random() * 50);
        }

        draw(time) {
            ctx.fillStyle = this.color;
            ctx.beginPath();

            ctx.moveTo(0, height);

            // Draw wave
            for (let x = 0; x <= width; x += 10) {
                // Combine sine waves for organic look
                const y = height / 2 +
                    Math.sin(x * config.waveLength + time * this.speed + this.offset) * this.amplitude +
                    Math.sin(x * config.waveLength * 0.5 + time * this.speed * 0.5) * (this.amplitude * 0.5);
                ctx.lineTo(x, y);
            }

            ctx.lineTo(width, height);
            ctx.closePath();
            ctx.fill();
        }
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        // Re-init waves
        waves = [];
        for (let i = 0; i < config.waveCount; i++) {
            waves.push(new Wave(i));
        }
    }

    let time = 0;
    function animate() {
        ctx.clearRect(0, 0, width, height);

        time++;

        waves.forEach(wave => {
            wave.draw(time);
        });

        requestAnimationFrame(animate);
    }

    // Event Listeners
    window.addEventListener('resize', resize);

    // Start
    resize();
    animate();
}
