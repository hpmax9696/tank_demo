
let audioCtx = null;
let engineNodes = null;
let audioStarted = false;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function ensureAudio() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function startEngineSound() {
    ensureAudio();
    if (engineNodes) return;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc1.type = 'sawtooth'; osc1.frequency.value = 35;
    osc2.type = 'sawtooth'; osc2.frequency.value = 70;
    gain.gain.value = 0;
    osc1.connect(gain); osc2.connect(gain);
    gain.connect(audioCtx.destination);
    osc1.start(); osc2.start();

    const bufSize = audioCtx.sampleRate * 2;
    const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;
    const bpFilter = audioCtx.createBiquadFilter();
    bpFilter.type = 'bandpass';
    bpFilter.frequency.value = 600;
    bpFilter.Q.value = 2;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0;
    noiseSrc.connect(bpFilter);
    bpFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noiseSrc.start();

    engineNodes = { osc1, osc2, gain, noiseGain, bpFilter };
}

function updateEngineSound(speed) {
    if (!engineNodes) return;
    const absSpeed = Math.abs(speed);
    const vol = Math.min(0.05, absSpeed * 0.0125);
    engineNodes.gain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
    const freq = 30 + absSpeed * 6;
    engineNodes.osc1.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
    engineNodes.osc2.frequency.setTargetAtTime(freq * 2, audioCtx.currentTime, 0.1);
    engineNodes.noiseGain.gain.setTargetAtTime(
        Math.min(0.03, absSpeed * 0.0075), audioCtx.currentTime, 0.08);
    engineNodes.bpFilter.frequency.setTargetAtTime(
        400 + absSpeed * 80, audioCtx.currentTime, 0.08);
}

function stopEngineSound() {
    if (!engineNodes) return;
    engineNodes.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
    engineNodes.noiseGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
    setTimeout(() => {
        if (engineNodes) {
            try { engineNodes.osc1.stop(); } catch(e){}
            try { engineNodes.osc2.stop(); } catch(e){}
            engineNodes = null;
        }
    }, 500);
}

function playFireSound() {
    ensureAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.45);
    const bufSize = Math.floor(audioCtx.sampleRate * 0.2);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(audioCtx.sampleRate*0.03));
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const g2 = audioCtx.createGain(); g2.gain.value = 0.3;
    src.connect(g2); g2.connect(audioCtx.destination);
    src.start(now);
}

function playExplosionSound() {
    ensureAudio();
    const now = audioCtx.currentTime;
    const bufSize = Math.floor(audioCtx.sampleRate * 0.6);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(audioCtx.sampleRate*0.1));
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const gain = audioCtx.createGain(); gain.gain.value = 0.4;
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(800, now);
    lp.frequency.exponentialRampToValueAtTime(80, now + 0.5);
    src.connect(lp); lp.connect(gain); gain.connect(audioCtx.destination);
    src.start(now);
}

function playHeExplosionSound() {
    ensureAudio();
    const now = audioCtx.currentTime;
    const bufSize = Math.floor(audioCtx.sampleRate * 0.8);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(audioCtx.sampleRate*0.18));
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, now);
    lp.frequency.exponentialRampToValueAtTime(40, now + 0.7);
    src.connect(lp); lp.connect(gain); gain.connect(audioCtx.destination);
    src.start(now);
    const osc = audioCtx.createOscillator();
    const og = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(45, now);
    osc.frequency.exponentialRampToValueAtTime(12, now + 0.6);
    og.gain.setValueAtTime(0.35, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(og); og.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.6);
}

function playSwitchSound() {
    ensureAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.setValueAtTime(180, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.22);
}

function playHitSound() {
    ensureAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.25);
}

function playMGShotSound() {
    ensureAudio();
    if (audioCtx.state !== 'running') audioCtx.resume();
    const now = audioCtx.currentTime;
    for (let p = 0; p < 3; p++) {
        const t = now + p * 0.04;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.03);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(500, t);
        lp.frequency.exponentialRampToValueAtTime(100, t + 0.03);
        osc.connect(lp); lp.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t); osc.stop(t + 0.03);
    }
}

function playPickupSound() {
    ensureAudio();
    if (audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc1.type = 'sine'; osc2.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
    osc2.frequency.setValueAtTime(660, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
    osc1.start(now); osc1.stop(now + 0.3);
    osc2.start(now); osc2.stop(now + 0.3);
}

function playGroundHitSound() {
    ensureAudio();
    const now = audioCtx.currentTime;
    const bufSize = Math.floor(audioCtx.sampleRate * 0.25);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(audioCtx.sampleRate*0.04));
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const gain = audioCtx.createGain(); gain.gain.value = 0.25;
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, now);
    lp.frequency.exponentialRampToValueAtTime(60, now + 0.2);
    src.connect(lp); lp.connect(gain); gain.connect(audioCtx.destination);
    src.start(now);
}

function playDebrisSound() {
    ensureAudio();
    const now = audioCtx.currentTime;
    for (let i = 0; i < 6; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 600 + Math.random() * 1800;
        const t = now + Math.random() * 0.2;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t); osc.stop(t + 0.07);
    }
}

// ── 六足导弹发射音效 (嗖——长音+噪声) ──
function playMissileLaunchSound() {
    ensureAudio();
    const now = audioCtx.currentTime;
    // 噪声嗖声 → bandpass扫频 2000→400Hz, 持续0.6s
    const bufSize = audioCtx.sampleRate * 0.7;
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buf;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(2000, now);
    bp.frequency.exponentialRampToValueAtTime(300, now + 0.6);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    noise.connect(bp); bp.connect(gain); gain.connect(audioCtx.destination);
    noise.start(now); noise.stop(now + 0.7);
    // 叠加低频轰鸣
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
    const og = audioCtx.createGain();
    og.gain.setValueAtTime(0.1, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(og); og.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.6);
}

// ── 加特林卡壳音效 (短促金属声, 过热时按键触发) ──
function playGatlingJamSound() {
	if (!audioCtx) return;
	var now = audioCtx.currentTime;
	// 第一声: 高频方波短脉冲, 模拟击针空撞
	var osc = audioCtx.createOscillator();
	osc.type = 'square';
	osc.frequency.setValueAtTime(1200, now);
	osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);
	var gain = audioCtx.createGain();
	gain.gain.setValueAtTime(0.12, now);
	gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
	osc.connect(gain); gain.connect(audioCtx.destination);
	osc.start(now); osc.stop(now + 0.08);
	// 第二声: 三角波弱余响, 模拟机匣回振
	var osc2 = audioCtx.createOscillator();
	osc2.type = 'triangle';
	osc2.frequency.setValueAtTime(600, now + 0.05);
	var g2 = audioCtx.createGain();
	g2.gain.setValueAtTime(0.06, now + 0.05);
	g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
	osc2.connect(g2); g2.connect(audioCtx.destination);
	osc2.start(now + 0.05); osc2.stop(now + 0.15);
}

// ── 导弹锁定成功音效 (短促电子嘀声) ──
function playLockOnSound() {
	if (!audioCtx) return;
	var now = audioCtx.currentTime;
	var osc = audioCtx.createOscillator();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(800, now);
	osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
	var gain = audioCtx.createGain();
	gain.gain.setValueAtTime(0.15, now);
	gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
	osc.connect(gain); gain.connect(audioCtx.destination);
	osc.start(now); osc.stop(now + 0.15);
	// 第二声确认音
	var osc2 = audioCtx.createOscillator();
	osc2.type = 'sine';
	osc2.frequency.setValueAtTime(1200, now + 0.15);
	osc2.frequency.setValueAtTime(1200, now + 0.25);
	var g2 = audioCtx.createGain();
	g2.gain.setValueAtTime(0.12, now + 0.15);
	g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
	osc2.connect(g2); g2.connect(audioCtx.destination);
	osc2.start(now + 0.15); osc2.stop(now + 0.3);
}
