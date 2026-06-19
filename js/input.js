
const keys = {};

window.addEventListener('keyup', (e) => { keys[e.code] = false; });

let prevMouseX = 0, prevMouseY = 0;

let gamepadFireReady = true;
let _gpRbPressed = false;
let mouseFireReady = true;
let mouseDown = false;
let mouseFireRequested = false;
let mouseDownRight = false;
let mouseFireRequestedRight = false;
let spaceDown = false;
let spaceJustPressed = false;
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let useGamepad = false;
let lastGamepadTime = 0;

function getGamepad() {
    const gps = navigator.getGamepads();
    for (const gp of gps) {
        if (gp && gp.connected) return gp;
    }
    return null;
}

function stickToTarget(value) {
    const abs = Math.abs(value);
    const sign = Math.sign(value);
    if (abs > 0.85) return sign;           // 100%
    if (abs > 0.65) return sign * 0.75;    // 75%
    if (abs > 0.45) return sign * 0.50;    // 50%
    if (abs > 0.20) return sign * 0.25;    // 25%
    return 0;
}

function getDriveInput(useGamepad = true) {
    let forward = 0, strafe = 0;

    if (keys['KeyW']) forward += 1;
    if (keys['KeyS']) forward -= 1;
    if (keys['KeyA']) strafe -= 1;
    if (keys['KeyD']) strafe += 1;

    if (useGamepad) {
        const gp = getGamepad();
        if (gp) {
            const gpFwd = stickToTarget(-gp.axes[1]);
            const gpStr = stickToTarget(gp.axes[0]);
            if (Math.abs(gpFwd) > Math.abs(forward)) forward = gpFwd;
            if (Math.abs(gpStr) > Math.abs(strafe)) strafe = gpStr;
            if (Math.abs(gp.axes[0]) > 0.05 || Math.abs(gp.axes[1]) > 0.05) {
                lastGamepadTime = performance.now();
            }
        }
    }

    let targetLeft = forward + strafe;
    let targetRight = forward - strafe;
    targetLeft = Math.max(-1, Math.min(1, targetLeft));
    targetRight = Math.max(-1, Math.min(1, targetRight));

    return { left: targetLeft, right: targetRight, forward, strafe };
}

function isFirePressed() {
    if (mouseDown) return true;
    const gp = getGamepad();
    if (gp && gp.buttons[7] && gp.buttons[7].value > 0.3) { lastGamepadTime = performance.now(); return true; }
    return false;
}
