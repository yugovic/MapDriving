export class AudioManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.engineGain = null;
        this.engineSource = null; // BufferSource when loop is available
        this.engineLP = null;     // Buffer chain: lowpass for brightness control
        this.engineShaper = null; // Buffer chain: soft clip for harmonics
        this.engineOsc = null;    // Oscillator fallback
        this.engineMode = 'none'; // 'buffer' | 'osc' | 'none'
        this.started = false;

        this.buffers = new Map();
        this.cooldowns = { brake: 0, collide: 0 };
        this.turbo = false;
        this.engineMode = 'none'; // 'synth' | 'buffer' | 'osc'
        this.preferSynth = true; // 論文ベースの合成を優先

        // スムージング
        this.rpmSmoothed = 0;
        this._lastUpdateTime = 0;

        // エンジンモデル（簡易エンジンオーダー）
        this.model = {
            eventsPerRev: 2,     // 4気筒4ストなら 2回/回転
            idleRPM: 900,
            redlineRPM: 7500,
            harmonics: [1.0, 0.7, 0.45, 0.3, 0.2, 0.12, 0.08, 0.06],
            bodyResonances: [
                { freq: 220, q: 1.2, gain: 3 },
                { freq: 680, q: 1.4, gain: 2 }
            ]
        };

        // シンセグラフ
        this.synth = {
            gain: null,
            shaper: null,
            lp: null,
            peaks: []
        };

        this._initContext();
        this._setupUserGestureResume();
        this._preload();
    }

    _initContext() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(this.ctx.destination);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        this.engineGain.connect(this.master);
    }

    _setupUserGestureResume() {
        const resume = () => {
            if (this.ctx && this.ctx.state !== 'running') {
                this.ctx.resume().catch(()=>{});
            }
        };
        window.addEventListener('pointerdown', resume, { once: false });
        window.addEventListener('keydown', resume, { once: false });
    }

    async _preload() {
        // 期待パス（大文字/小文字の両対応を試行）
        const candidates = {
            engine: [
                // 新規エンジン音（優先）
                'assets/audio/idling-sound-of-a-rotary-engine-with-a-peripheral-port-exhaust_083025.mp3',
                'assets/Audio/idling-sound-of-a-rotary-engine-with-a-peripheral-port-exhaust_083025.mp3',
                // 既存のループ（フォールバック）
                'assets/audio/engine-loop.mp3',
                'assets/Audio/engine-loop.mp3',
            ],
            brake: [
                'assets/audio/brake.wav',
                'assets/Audio/brake.wav',
            ],
            collision: [
                'assets/audio/collision.wav',
                'assets/Audio/collision.wav',
            ],
            screech: [
                'assets/audio/tire-screech.wav',
                'assets/Audio/tire-screech.wav',
            ]
        };

        for (const key of Object.keys(candidates)) {
            const urls = candidates[key];
            for (const url of urls) {
                try {
                    const buf = await this._loadBuffer(url);
                    if (buf) {
                        this.buffers.set(key, buf);
                        break;
                    }
                } catch (_) {
                    // 次の候補へ
                }
            }
        }
        this._ensureEngine();
        if (this.buffers.has('engine')) {
            this._switchToEngineBuffer();
        }
    }

    async _loadBuffer(url) {
        if (!this.ctx) return null;
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const arr = await res.arrayBuffer();
        return await this.ctx.decodeAudioData(arr);
    }

    _ensureEngine() {
        if (!this.ctx) return;
        // バッファが到着していて、オシレータが動作中なら切り替え
        if (this.buffers.has('engine') && this.engineOsc && !this.engineSource) {
            this._switchToEngineBuffer();
            this.started = true;
            return;
        }
        if (this.engineSource || this.engineOsc) return;
        if (this.buffers.has('engine')) {
            this._switchToEngineBuffer();
        } else {
            // フォールバック: オシレータ
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 80; // idle
            osc.connect(this.engineGain);
            osc.start();
            this.engineOsc = osc;
            this.engineMode = 'osc';
        }
        this.started = true;
    }

    _switchToEngineBuffer() {
        if (!this.ctx || !this.buffers.has('engine')) return;
        if (this.engineOsc) {
            try { this.engineOsc.stop(); } catch (_) {}
            try { this.engineOsc.disconnect(); } catch (_) {}
            this.engineOsc = null;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers.get('engine');
        src.loop = true;

        // Filter chain: source -> shaper -> lowpass -> engineGain
        this.engineShaper = this.ctx.createWaveShaper();
        this.engineShaper.curve = this._softClipCurve(0.7);
        this.engineLP = this.ctx.createBiquadFilter();
        this.engineLP.type = 'lowpass';
        this.engineLP.frequency.value = 1200;
        this.engineLP.Q.value = 0.7;

        src.connect(this.engineShaper);
        this.engineShaper.connect(this.engineLP);
        this.engineLP.connect(this.engineGain);
        try { src.start(); } catch (_) {}
        this.engineSource = src;
        this.engineMode = 'buffer';
    }

    // ===== エンジン合成（エンジンオーダーベース） =====
    _buildSynth() {
        if (!this.ctx) return;
        this.synth.gain = this.ctx.createGain();
        this.synth.gain.gain.value = 0.0;

        const osc = this.ctx.createOscillator();
        const wave = this._createEnginePeriodicWave(this.model.harmonics);
        if (wave) osc.setPeriodicWave(wave); else osc.type = 'sawtooth';

        this.synth.shaper = this.ctx.createWaveShaper();
        this.synth.shaper.curve = this._softClipCurve(0.6);

        this.synth.peaks = this.model.bodyResonances.map(r => {
            const f = this.ctx.createBiquadFilter();
            f.type = 'peaking';
            f.frequency.value = r.freq;
            f.Q.value = r.q;
            f.gain.value = r.gain;
            return f;
        });

        this.synth.lp = this.ctx.createBiquadFilter();
        this.synth.lp.type = 'lowpass';
        this.synth.lp.frequency.value = 1000;
        this.synth.lp.Q.value = 0.7;

        osc.connect(this.synth.shaper);
        let last = this.synth.shaper;
        this.synth.peaks.forEach(p => { last.connect(p); last = p; });
        last.connect(this.synth.lp);
        this.synth.lp.connect(this.synth.gain);
        this.synth.gain.connect(this.engineGain);

        osc.start();
        this.engineOsc = osc;
        this.engineMode = 'synth';
    }

    _createEnginePeriodicWave(harmonics) {
        if (!this.ctx || !harmonics || harmonics.length === 0) return null;
        const n = harmonics.length + 1;
        const real = new Float32Array(n);
        const imag = new Float32Array(n);
        real[0] = 0; imag[0] = 0;
        for (let i = 1; i < n; i++) {
            const amp = harmonics[i - 1];
            const phase = Math.PI * 0.1 * (i % 3);
            real[i] = amp * Math.cos(phase);
            imag[i] = amp * Math.sin(phase);
        }
        return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    }

    _softClipCurve(k = 0.6) {
        const samples = 2048;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i / (samples - 1)) * 2 - 1;
            curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
        }
        return curve;
    }

    setEngineIntensity(v) {
        const intensity = Math.max(0, Math.min(1, v));
        this.updateEngine(intensity * 100, intensity, 120);
    }

    updateEngine(speedKmh, throttle, maxSpeedKmh = 120) {
        if (!this.ctx) return;
        this._ensureEngine();
        const now = this.ctx.currentTime;
        const sp = Math.max(0, Math.min(1, speedKmh / Math.max(1, maxSpeedKmh)));
        const th = Math.max(0, Math.min(1, (typeof throttle === 'number' ? (throttle + 1) / 2 : 0)));

        // 速度寄りのRPM推定（自然な上がり）
        const rpmBase = this.model.idleRPM + sp * (this.model.redlineRPM - this.model.idleRPM) * 0.9;
        const rpmTarget = rpmBase + th * (this.model.redlineRPM - rpmBase) * 0.5;

        // スムージング（慣性）
        if (!this.rpmSmoothed) this.rpmSmoothed = rpmTarget;
        const alpha = 0.12; // 0..1（大きいほど追随が速い）
        this.rpmSmoothed = this.rpmSmoothed + (rpmTarget - this.rpmSmoothed) * alpha;

        const ratio = Math.max(0, Math.min(1, (this.rpmSmoothed - this.model.idleRPM) / (this.model.redlineRPM - this.model.idleRPM)));

        // ピッチ（再生速度）レンジを拡大
        const minRate = 0.85;
        const maxRate = this.turbo ? 2.2 : 1.9;
        const rate = minRate + (maxRate - minRate) * ratio;

        const baseGain = 0.05 + (0.22 * sp + 0.18 * th);
        this.engineGain.gain.cancelScheduledValues(now);
        this.engineGain.gain.linearRampToValueAtTime(baseGain, now + 0.05);

        if (this.engineSource && this.engineMode === 'buffer') {
            try {
                this.engineSource.playbackRate.cancelScheduledValues(now);
                this.engineSource.playbackRate.linearRampToValueAtTime(rate, now + 0.05);
                // 明るさ（低域カット）も徐々に開く
                if (this.engineLP) {
                    const lp = 1000 + ratio * 4500 + th * 800;
                    this.engineLP.frequency.cancelScheduledValues(now);
                    this.engineLP.frequency.linearRampToValueAtTime(lp, now + 0.08);
                }
            } catch (_) {}
        }
        if (this.engineOsc) {
            const f0 = (this.rpmSmoothed / 60) * this.model.eventsPerRev;
            this.engineOsc.frequency.cancelScheduledValues(now);
            this.engineOsc.frequency.linearRampToValueAtTime(Math.max(20, f0), now + 0.05);
            const lpBase = 900 + th * 1900 + sp * 800;
            this.synth.lp.frequency.cancelScheduledValues(now);
            this.synth.lp.frequency.linearRampToValueAtTime(lpBase, now + 0.1);
            this.synth.gain.gain.cancelScheduledValues(now);
            this.synth.gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
        }
    }

    setTurbo(active) {
        this.turbo = !!active;
    }

    playBrake(intensity = 1.0) {
        this._oneshot('brake', 0.15, intensity);
    }

    playCollision(intensity = 1.0) {
        // 短いクールダウンで多重再生を抑制
        if (this._onCooldown('collide', 120)) return;
        this._oneshot('collision', 0.2, intensity);
    }

    playScreech(intensity = 1.0) {
        if (this._onCooldown('screech', 80)) return;
        this._oneshot('screech', 0.1, intensity);
    }

    _onCooldown(key, ms) {
        const now = performance.now();
        if (!this.cooldowns[key]) this.cooldowns[key] = 0;
        if (now < this.cooldowns[key]) return true;
        this.cooldowns[key] = now + ms;
        return false;
    }

    _oneshot(key, gain = 0.2, intensity = 1.0) {
        if (!this.ctx) return;
        const g = this.ctx.createGain();
        g.gain.value = Math.max(0, Math.min(1, gain * intensity));
        g.connect(this.master);
        if (this.buffers.has(key)) {
            const src = this.ctx.createBufferSource();
            src.buffer = this.buffers.get(key);
            src.connect(g);
            src.start();
        } else {
            // フォールバック: ノイズ
            const dur = 0.15;
            const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.4;
            }
            const src = this.ctx.createBufferSource();
            src.buffer = buffer;
            const filt = this.ctx.createBiquadFilter();
            filt.type = 'bandpass';
            filt.frequency.value = key === 'brake' ? 1200 : 300;
            src.connect(filt);
            filt.connect(g);
            src.start();
        }
        // フェードアウトして破棄
        const now = this.ctx.currentTime;
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        setTimeout(() => g.disconnect(), 400);
    }
}
