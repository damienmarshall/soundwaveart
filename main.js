class SoundWaveArt {
    constructor() {
        this.canvas = document.getElementById('art-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.recordBtn = document.getElementById('record-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.saveBtn = document.getElementById('save-btn');
        this.prevRowBtn = document.getElementById('prev-row-btn');
        this.nextRowBtn = document.getElementById('next-row-btn');
        this.rowNumDisplay = document.getElementById('current-row-num');
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');

        // Control elements
        this.refImageInput = document.getElementById('ref-image-input');
        this.uploadRefBtn = document.getElementById('upload-ref-btn');
        this.toggleRefBtn = document.getElementById('toggle-ref-btn');
        this.opacityControl = document.getElementById('opacity-control');
        this.opacitySlider = document.getElementById('ref-opacity-slider');
        this.widthSlider = document.getElementById('wave-width-slider');
        this.heightSlider = document.getElementById('wave-height-slider');
        this.themeToggle = document.getElementById('theme-toggle-checkbox');

        // Countdown elements
        this.countdownOverlay = document.getElementById('countdown-overlay');
        this.countdownText = this.countdownOverlay.querySelector('.countdown-text');

        this.isRecording = false;
        this.isCountingDown = false;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;
        this.mediaStream = null;
        this.audioSource = null;

        // Smoothing State
        this.lastAmplitude = 0;
        this.smoothingFactor = 0.15;

        // Human Response Offset (100ms @ ~60fps)
        this.responseOffsetSamples = 6;

        // State
        this.refImage = null;
        this.showRefImage = false;
        this.refOpacity = 0.60;
        this.waveWidthFactor = 1.0;
        this.barHeightValue = 32;
        this.isBlackAndWhite = false;

        // Configuration
        this.rows = 0;
        this.currentRowIndex = 0;
        this.maxSamples = 600;
        this.recordedRows = [];
        this.rowProgress = [];

        this.colors = [
            { bg: '#2d4a22', wave: '#597d35' }, // Green
            { bg: '#3a224a', wave: '#6b357d' }, // Purple
            { bg: '#4a2222', wave: '#7d3535' }, // Red
            { bg: '#224a4a', wave: '#357d7d' }, // Teal
            { bg: '#4a4222', wave: '#7d6e35' }, // Gold
            { bg: '#22324a', wave: '#35537d' }, // Blue
        ];

        this.bwColors = {
            bgA: '#ffffff',
            bgB: '#f5f5f5',
            wave: '#000000'
        };

        this.setupCanvas();
        this.calculateRows();
        this.bindEvents();
        this.loadDefaultReference();
        this.updateUI();
        this.drawArt();
    }

    async loadDefaultReference() {
        try {
            const img = new Image();
            img.onload = () => {
                this.refImage = img;
                this.showRefImage = true;
                this.toggleRefBtn.disabled = false;
                this.toggleRefBtn.classList.add('active');
                this.opacityControl.classList.remove('hidden');

                this.autoAlignToImageWidth();
                this.drawArt();
            };
            img.src = 'default-ref.jpg';
        } catch (err) {
            console.warn('Could not load default reference image:', err);
        }
    }

    setupCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    calculateRows() {
        const height = this.canvas.height / window.devicePixelRatio;
        const newRowCount = Math.max(1, Math.floor(height / this.barHeightValue));

        if (newRowCount !== this.rows) {
            this.rows = newRowCount;
            while (this.recordedRows.length < this.rows) {
                this.recordedRows.push(new Array(this.maxSamples).fill(0));
                this.rowProgress.push(0);
            }
            if (this.currentRowIndex >= this.rows) {
                this.currentRowIndex = this.rows - 1;
            }
            this.updateUI();
        }
    }

    bindEvents() {
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.clearBtn.addEventListener('click', () => this.clearAll());
        this.saveBtn.addEventListener('click', () => this.saveImage());
        this.prevRowBtn.addEventListener('click', () => this.changeRow(-1));
        this.nextRowBtn.addEventListener('click', () => this.changeRow(1));

        // Slider Events
        this.opacitySlider.addEventListener('input', (e) => {
            this.refOpacity = e.target.value / 100;
            this.drawArt();
        });
        this.widthSlider.addEventListener('input', (e) => {
            this.waveWidthFactor = e.target.value / 100;
            this.drawArt();
        });
        this.heightSlider.addEventListener('input', (e) => {
            this.barHeightValue = parseInt(e.target.value);
            this.calculateRows();
            this.drawArt();
        });

        // Theme Toggle
        this.themeToggle.addEventListener('change', (e) => {
            this.isBlackAndWhite = e.target.checked;
            this.drawArt();
        });

        // Reference Image Events
        this.uploadRefBtn.addEventListener('click', () => this.refImageInput.click());
        this.refImageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        this.toggleRefBtn.addEventListener('click', () => this.toggleReference());

        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.calculateRows();
            this.drawArt();
        });
    }

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.refImage = img;
                this.showRefImage = true;
                this.toggleRefBtn.disabled = false;
                this.toggleRefBtn.classList.add('active');
                this.opacityControl.classList.remove('hidden');
                this.statusText.textContent = 'Reference image uploaded';

                this.autoAlignToImageWidth();
                this.drawArt();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    autoAlignToImageWidth() {
        if (!this.refImage) return;

        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        const imgAspect = this.refImage.width / this.refImage.height;
        const canvasAspect = width / height;

        let drawWidth;
        if (imgAspect > canvasAspect) {
            drawWidth = width;
        } else {
            drawWidth = height * imgAspect;
        }

        this.waveWidthFactor = drawWidth / width;
        this.widthSlider.value = Math.round(this.waveWidthFactor * 100);
    }

    toggleReference() {
        this.showRefImage = !this.showRefImage;
        this.toggleRefBtn.classList.toggle('active', this.showRefImage);
        this.opacityControl.classList.toggle('hidden', !this.showRefImage);
        this.drawArt();
    }

    updateUI() {
        this.rowNumDisplay.textContent = this.currentRowIndex + 1;
        this.prevRowBtn.disabled = this.currentRowIndex === 0;
        this.nextRowBtn.disabled = this.currentRowIndex === this.rows - 1;
    }

    changeRow(delta) {
        if (this.isRecording || this.isCountingDown) return;
        this.currentRowIndex = Math.max(0, Math.min(this.rows - 1, this.currentRowIndex + delta));
        this.updateUI();
        this.drawArt();
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else if (!this.isCountingDown) {
            await this.prepareAndStartCountdown();
        }
    }

    async prepareAndStartCountdown() {
        try {
            this.statusText.textContent = 'Requesting microphone access...';

            // Only request if we don't already have an active stream
            if (!this.mediaStream) {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            await this.startCountdown();
        } catch (err) {
            console.error('Error accessing microphone:', err);
            this.isCountingDown = false;
            this.countdownOverlay.classList.add('hidden');
            alert('Could not access microphone. Please ensure you have given permission.');
        }
    }

    async startCountdown() {
        this.isCountingDown = true;
        this.countdownOverlay.classList.remove('hidden');

        const sequence = ['3', '2', '1', 'GO!'];

        for (const msg of sequence) {
            this.countdownText.textContent = msg;
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        this.countdownOverlay.classList.add('hidden');
        this.isCountingDown = false;

        await this.startRecording(this.mediaStream);
    }

    async startRecording(stream) {
        if (!stream) return;

        try {
            // Initialize Audio Context once
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume if suspended (browser requirements)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Setup source and analyser if not already setup (or if stream changed)
            if (!this.audioSource) {
                this.audioSource = this.audioContext.createMediaStreamSource(stream);
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 256;
                this.audioSource.connect(this.analyser);
                this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            }

            this.isRecording = true;
            this.recordBtn.innerHTML = '<span class="icon">⏹️</span><span class="label">Stop Recording</span>';
            this.statusDot.classList.add('recording');
            this.statusText.textContent = `Recording Row ${this.currentRowIndex + 1}...`;

            this.recordedRows[this.currentRowIndex].fill(0);
            this.rowProgress[this.currentRowIndex] = 0;
            this.lastAmplitude = 0;

            this.visualize();
        } catch (err) {
            console.error('Error starting audio processing:', err);
            this.stopRecording();
            alert('Error starting audio processing.');
        }
    }

    stopRecording() {
        this.isRecording = false;

        this.applyPostSmoothing(this.currentRowIndex);

        // Suspend context instead of closing to keep stream alive and efficient
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }

        // We do NOT stop the mediaStream tracks here to maintain persistent permission.
        // The stream remains active but we stop processing its data.

        cancelAnimationFrame(this.animationId);

        this.recordBtn.innerHTML = '<span class="icon">🎙️</span><span class="label">Start Recording</span>';
        this.statusDot.classList.remove('recording');
        this.statusText.textContent = `Row ${this.currentRowIndex + 1} finished`;

        this.drawArt();
    }

    // Optional helper to release mic if ever needed (e.g. on page unload)
    releaseMicrophone() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    applyPostSmoothing(rowIndex) {
        const data = this.recordedRows[rowIndex];
        const progress = this.rowProgress[rowIndex];
        if (!data || progress === 0) return;

        const passes = 3;
        let currentData = [...data];

        for (let p = 0; p < passes; p++) {
            const nextData = new Array(this.maxSamples).fill(0);
            for (let i = 0; i < progress; i++) {
                const prev = i > 0 ? currentData[i - 1] : currentData[i];
                const curr = currentData[i];
                const next = i < progress - 1 ? currentData[i + 1] : currentData[i];

                nextData[i] = (prev + 2 * curr + next) / 4;
            }
            currentData = nextData;
        }

        this.recordedRows[rowIndex] = currentData;
    }

    visualize() {
        if (!this.isRecording) return;

        if (this.rowProgress[this.currentRowIndex] >= this.maxSamples) {
            this.stopRecording();
            if (this.currentRowIndex < this.rows - 1) {
                setTimeout(() => this.changeRow(1), 500);
            }
            return;
        }

        this.analyser.getByteTimeDomainData(this.dataArray);

        let sum = 0;
        for (let k = 0; k < this.dataArray.length; k++) {
            sum += Math.abs(this.dataArray[k] - 128);
        }
        const rawAmplitude = sum / this.dataArray.length;

        this.lastAmplitude = (this.smoothingFactor * rawAmplitude) + ((1 - this.smoothingFactor) * this.lastAmplitude);

        const sampleIndex = this.rowProgress[this.currentRowIndex];
        const offsetIndex = Math.max(0, sampleIndex - this.responseOffsetSamples);

        this.recordedRows[this.currentRowIndex][offsetIndex] = this.lastAmplitude;
        this.rowProgress[this.currentRowIndex]++;

        this.drawArt();
        this.animationId = requestAnimationFrame(() => this.visualize());
    }

    drawArt() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        const rowHeight = this.barHeightValue;
        const totalContentHeight = rowHeight * this.rows;
        const startY = (height - totalContentHeight) / 2;

        this.ctx.clearRect(0, 0, width, height);

        // 1. Draw Reference Image 
        if (this.showRefImage && this.refImage) {
            this.ctx.save();
            this.ctx.globalAlpha = this.refOpacity;

            const imgAspect = this.refImage.width / this.refImage.height;
            const canvasAspect = width / height;
            let drawWidth, drawHeight, x, y;

            if (imgAspect > canvasAspect) {
                drawWidth = width;
                drawHeight = width / imgAspect;
                x = 0;
                y = (height - drawHeight) / 2;
            } else {
                drawHeight = height;
                drawWidth = height * imgAspect;
                y = 0;
                x = (width - drawWidth) / 2;
            }

            this.ctx.drawImage(this.refImage, x, y, drawWidth, drawHeight);
            this.ctx.restore();
        }

        // 2. Draw Sound Waves
        const activeWidth = width * this.waveWidthFactor;
        const offsetX = (width - activeWidth) / 2;

        for (let i = 0; i < this.rows; i++) {
            let bgColor, waveColor;

            if (this.isBlackAndWhite) {
                bgColor = (i % 2 === 0) ? this.bwColors.bgA : this.bwColors.bgB;
                waveColor = this.bwColors.wave;
            } else {
                const colorSet = this.colors[i % this.colors.length];
                bgColor = colorSet.bg;
                waveColor = colorSet.wave;
            }

            const y = startY + (i * rowHeight);
            const rowData = this.recordedRows[i];
            const progress = this.rowProgress[i];

            // Background 
            this.ctx.fillStyle = this.showRefImage ? bgColor + 'CC' : bgColor;
            this.ctx.fillRect(offsetX, y, activeWidth, rowHeight);

            // Highlight active row
            if (i === this.currentRowIndex) {
                this.ctx.strokeStyle = this.isBlackAndWhite ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.4)';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(offsetX, y, activeWidth, rowHeight);

                const playheadX = offsetX + (progress / this.maxSamples) * activeWidth;

                if (this.isRecording) {
                    const playheadColor = this.isBlackAndWhite ? '#000' : '#fff';
                    this.ctx.strokeStyle = playheadColor;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(playheadX, y);
                    this.ctx.lineTo(playheadX, y + rowHeight);
                    this.ctx.stroke();

                    const gradient = this.ctx.createRadialGradient(playheadX, y + rowHeight / 2, 0, playheadX, y + rowHeight / 2, 20);
                    const glowColor = this.isBlackAndWhite ? '0, 0, 0' : '255, 255, 255';
                    gradient.addColorStop(0, `rgba(${glowColor}, 0.3)`);
                    gradient.addColorStop(1, `rgba(${glowColor}, 0)`);
                    this.ctx.fillStyle = gradient;
                    this.ctx.fillRect(playheadX - 20, y, 40, rowHeight);
                }
            }

            if (progress === 0 && rowData.every(v => v === 0)) {
                this.ctx.strokeStyle = this.isBlackAndWhite ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)';
                this.ctx.beginPath();
                this.ctx.moveTo(offsetX, y + rowHeight / 2);
                this.ctx.lineTo(offsetX + activeWidth, y + rowHeight / 2);
                this.ctx.stroke();
                continue;
            }

            // Draw Smoothed & Clipped Waveform
            this.ctx.beginPath();
            this.ctx.fillStyle = waveColor;

            const sliceWidth = activeWidth / this.maxSamples;
            const centerY = y + rowHeight / 2;
            const maxAmp = rowHeight / 2;

            const getAmp = (index) => {
                const rawAmp = rowData[index] * (rowHeight / 32);
                return Math.min(rawAmp, maxAmp);
            };

            const drawLimit = progress === 0 ? this.maxSamples : progress;

            // DRAW TOP
            this.ctx.moveTo(offsetX, centerY);

            if (drawLimit > 2) {
                for (let j = 0; j < drawLimit - 1; j++) {
                    const amp = getAmp(j);
                    const nextAmp = getAmp(j + 1);

                    const curX = offsetX + (j * sliceWidth);
                    const nextX = offsetX + ((j + 1) * sliceWidth);

                    const midX = (curX + nextX) / 2;
                    const midYTop = centerY - (amp + nextAmp) / 2;

                    this.ctx.quadraticCurveTo(curX, centerY - amp, midX, midYTop);
                }

                // DRAW BOTTOM 
                for (let j = drawLimit - 1; j > 0; j--) {
                    const amp = getAmp(j);
                    const prevAmp = getAmp(j - 1);

                    const curX = offsetX + (j * sliceWidth);
                    const prevX = offsetX + ((j - 1) * sliceWidth);

                    const midX = (curX + prevX) / 2;
                    const midYBottom = centerY + (amp + prevAmp) / 2;

                    this.ctx.quadraticCurveTo(curX, centerY + amp, midX, midYBottom);
                }
            } else {
                for (let j = 0; j < drawLimit; j++) {
                    this.ctx.lineTo(offsetX + (j * sliceWidth), centerY - getAmp(j));
                }
                for (let j = drawLimit - 1; j >= 0; j--) {
                    this.ctx.lineTo(offsetX + (j * sliceWidth), centerY + getAmp(j));
                }
            }

            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    clearAll() {
        if (confirm('Are you sure you want to clear the entire canvas?')) {
            this.recordedRows = this.recordedRows.map(() => new Array(this.maxSamples).fill(0));
            this.rowProgress.fill(0);
            this.currentRowIndex = 0;
            this.updateUI();
            this.drawArt();
            this.statusText.textContent = 'Project cleared';
        }
    }

    saveImage() {
        const wasShowingRef = this.showRefImage;
        this.showRefImage = false;
        this.drawArt();

        const link = document.createElement('a');
        link.download = `sound-wave-art-${Date.now()}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();

        this.showRefImage = wasShowingRef;
        this.drawArt();
    }
}

// Initialize the app
window.addEventListener('load', () => {
    new SoundWaveArt();
});
