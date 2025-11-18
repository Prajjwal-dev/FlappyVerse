let board;
let boardWidth = 360;
let boardHeight = 640;
let context;
let instructionsVisible = false;
let showingInstructions = false;

let birdWidth = 34;
let birdHeight = 24;
let birdX = boardWidth / 8;
let birdY = boardHeight / 2;
let birdImg;

let bird = {
    x: birdX,
    y: birdY,
    width: birdWidth,
    height: birdHeight
};

let pipeArray = [];
let pipeWidth = 64;
let pipeHeight = 512;
let pipeX = boardWidth;
let pipeY = 0;

let topPipeImg, bottomPipeImg, shieldImg;

// --- clean implementation (time-based physics + difficulty presets) ---
let velocityX = -100; // px/s (negative = left)
let velocityY = 0;    // bird vertical velocity px/s
let gravity = 1000;   // px/s^2
let jumpVelocity = -300; // px/s (upwards negative)
let maxFallSpeed = 900; // px/s
let pipeSpawnMs = 1700; // pipe spawn interval in ms

// runtime timing
let lastTime = null;
let pipeInterval = null;

let gameOver = false;
let score = 0;
let bestScore = localStorage.getItem("bestScore") || 0;
let paused = true;
let shieldCount = 0;
const MAX_SHIELD = 2;
let countdown = 0;
let countdownInterval = null;

let backgrounds = ["url('./flappybirdbg.png')", "url('./nightbg.png')"];
let bgIndex = 0;
let bgScoreThreshold = 5;

let pauseButton, playAgainButton;

// sounds
let flapSound = new Audio('./sfx_wing.wav');
let scoreSound = new Audio('./sfx_point.wav');
let hitSound = new Audio('./sfx_hit.wav');
let shieldSound = new Audio('./sfx_swooshing.wav');

window.onload = function () {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;
    context = board.getContext("2d");

    birdImg = new Image();
    birdImg.src = "./flappybird.png";

    shieldImg = new Image();
    shieldImg.src = "./shield.png";

    topPipeImg = new Image();
    topPipeImg.src = "./toppipe.png";

    bottomPipeImg = new Image();
    bottomPipeImg.src = "./bottompipe.png";

    pauseButton = document.getElementById("pauseButton");
    playAgainButton = document.getElementById("playAgainButton");
    // ensure pause button is always visible in the UI layer
    if (pauseButton) pauseButton.style.display = 'block';

    // wire UI and prevent clicks from bubbling into the instruction overlay
    if (pauseButton) {
        pauseButton.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            togglePause();
        });
    }
    playAgainButton.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        playAgainButton.style.display = "none";
        lastTime = null;
        // Reset state immediately, then show instructions which will start the game
        // when the player clicks/taps the overlay.
        resetGame();
        showInstructions(() => {
            // start gameplay after instructions
            paused = false;
            pauseButton.style.visibility = "visible";
            // ensure pipe spawn interval is restarted with current pipeSpawnMs
            if (pipeInterval) clearInterval(pipeInterval);
            pipeInterval = setInterval(placePipes, pipeSpawnMs);
            // reset timing so update's dt doesn't spike
            lastTime = null;
            requestAnimationFrame(update);
        });
    });

    // difficulty selector removed; game will run in Hard mode by default

    // input
    document.addEventListener("keydown", handleInput);
    document.addEventListener("click", handleClick);
    document.addEventListener("touchstart", handleClick);

    // set default preset to Hard and start
    applyPreset('hard');
    setBackground();
    showInstructions(() => {
        paused = false;
        pauseButton.style.visibility = "visible";
        requestAnimationFrame(update);
        if (pipeInterval) clearInterval(pipeInterval);
        pipeInterval = setInterval(placePipes, pipeSpawnMs);
    });
};

function applyPreset(name) {
    if (name === 'easy') {
        gravity = 900;
        jumpVelocity = -300;
        velocityX = -100;
        pipeSpawnMs = 1700;
        maxFallSpeed = 700;
    } else if (name === 'normal') {
        gravity = 1400;
        jumpVelocity = -360;
        velocityX = -120;
        pipeSpawnMs = 1500;
        maxFallSpeed = 900;
    } else if (name === 'hard') {
        gravity = 1800;
        jumpVelocity = -420;
        velocityX = -140;
        pipeSpawnMs = 1300;
        maxFallSpeed = 1100;
    }
}

let instructionsCallback = null;
let instructionsStartHandler = null;

function showInstructions(callback) {
    showingInstructions = true;
    instructionsCallback = callback || null;
    pauseButton.style.display = "block";
    pauseButton.style.visibility = "hidden";

    // difficulty UI removed; nothing to show here

    context.fillStyle = "rgba(0, 0, 0, 0.7)";
    context.fillRect(0, 0, board.width, board.height);
    context.fillStyle = "white";
    context.font = "20px Courier New";

    const lines = [
        "FlappyVerse Instructions:",
        "- Press Space / Click / Tap",
        "  to Fly",
        "- Avoid Pipes to Score",
        "- Press 'P' or Button",
        "  to Pause/Resume",
        "- Shield auto activates",
        "  every 10 pts",
        "Click / Touch to Start"
    ];

    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], 20, 100 + i * 40);
    }

    instructionsStartHandler = function startAfterInstruction(e) {
        // stop both click and touchstart from staying active
        document.removeEventListener("click", instructionsStartHandler);
        document.removeEventListener("touchstart", instructionsStartHandler);
        pauseButton.style.visibility = "visible";
        showingInstructions = false;
        if (typeof instructionsCallback === 'function') instructionsCallback();
        instructionsStartHandler = null;
    };

    document.addEventListener("click", instructionsStartHandler);
    document.addEventListener("touchstart", instructionsStartHandler);
}

function startFromInstructions() {
    // (removed) startFromInstructions was used by the difficulty selector.
}

function setBackground() {
    board.style.backgroundImage = backgrounds[bgIndex];
}

function changeBackground() {
    bgIndex = (bgIndex + 1) % backgrounds.length;
    setBackground();
}

function handleInput(e) {
    if (showingInstructions) return;
    if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyX") && !paused && !gameOver) {
        if (e.repeat) return;
        e.preventDefault();
        moveBird();
    } else if (e.code === "KeyP") {
        togglePause();
    }
}

function handleClick(e) {
    if (showingInstructions) return;
    if (!paused && !gameOver) moveBird();
}

function togglePause() {
    if (gameOver) return;
    // If currently paused, start a 3..2..1 countdown then resume
    if (paused) {
        // avoid starting multiple countdowns
        if (countdownInterval !== null) return;
        pauseButton.innerText = "Pause";
        countdown = 3;
        // draw initial frame with the number immediately
        context.clearRect(0, 0, board.width, board.height);
        drawScene();
        context.fillStyle = "white";
        context.font = "60px sans-serif";
        context.fillText(countdown, boardWidth / 2 - 15, boardHeight / 2);
        countdown--;

        countdownInterval = setInterval(() => {
            context.clearRect(0, 0, board.width, board.height);
            drawScene();
            context.fillStyle = "white";
            context.font = "60px sans-serif";

            if (countdown <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                paused = false;
                // kickoff the update loop so timing resumes cleanly
                lastTime = null;
                requestAnimationFrame(update);
            } else {
                context.fillText(countdown, boardWidth / 2 - 15, boardHeight / 2);
                countdown--;
            }
        }, 1000);
    } else {
        // Pause the game
        paused = true;
        pauseButton.innerText = "Resume";
        // if a countdown was pending, cancel it
        if (countdownInterval !== null) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }
}

function update(timestamp) {
    requestAnimationFrame(update);

    if (paused || gameOver) {
        // keep lastTime in sync so dt is reasonable when resuming
        lastTime = timestamp;
        if (paused && !gameOver && countdown === 0 && countdownInterval === null && !showingInstructions) {
            context.fillStyle = "white";
            context.font = "50px sans-serif";
            context.fillText("PAUSED", boardWidth / 2 - 90, boardHeight / 2);
        }
        return;
    }

    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000; // seconds
    if (dt > 0.1) dt = 0.1; // clamp
    lastTime = timestamp;

    context.clearRect(0, 0, board.width, board.height);

    // physics
    velocityY += gravity * dt;
    if (velocityY > maxFallSpeed) velocityY = maxFallSpeed;
    bird.y = Math.max(bird.y + velocityY * dt, 0);
    context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);

    if (bird.y > board.height) {
        endGame();
    }

    for (let i = 0; i < pipeArray.length; i++) {
        let pipe = pipeArray[i];
        pipe.x += velocityX * dt;
        context.drawImage(pipe.img, pipe.x, pipe.y, pipe.width, pipe.height);

        if (!pipe.passed && bird.x > pipe.x + pipe.width) {
            score += 0.5;
            scoreSound.play();
            pipe.passed = true;

            if (Math.floor(score) % bgScoreThreshold === 0 && Math.floor(score) !== 0) {
                changeBackground();
            }

            if (Math.floor(score) % 10 === 0 && Math.floor(score) !== 0 && pipe.img === bottomPipeImg && shieldCount < MAX_SHIELD) {
                shieldCount++;
                shieldSound.play();
            }
        }

        if (detectCollision(bird, pipe)) {
            if (shieldCount > 0) {
                shieldCount--;
                pipeArray.splice(i, 1);
                i--;
                continue;
            }
            endGame();
        }
    }

    while (pipeArray.length > 0 && pipeArray[0].x < -pipeWidth) {
        pipeArray.shift();
    }

    drawScene();

    if (gameOver) {
        context.fillStyle = "white";
        context.font = "40px sans-serif";
        context.fillText("GAME OVER", boardWidth / 2 - 110, boardHeight / 2);
        context.font = "25px sans-serif";
        context.fillText(`You scored: ${Math.floor(score)}`, boardWidth / 2 - 90, boardHeight / 2 + 40);
        playAgainButton.style.display = "block";
        pauseButton.style.visibility = "hidden";
    } else {
        playAgainButton.style.display = "none";
    }
}

function drawScene() {
    context.fillStyle = "white";
    context.font = "45px sans-serif";
    context.fillText(Math.floor(score), 10, 45);

    context.font = "20px sans-serif";
    context.fillText(`Best: ${bestScore}`, 10, 70);

    context.drawImage(shieldImg, 10, 82, 18, 18);
    context.fillText(`Shields: ${shieldCount} (MAX ${MAX_SHIELD})`, 35, 95);
}

function placePipes() {
    if (paused || gameOver) return;

    let randomPipeY = pipeY - pipeHeight / 4 - Math.random() * (pipeHeight / 2);
    let openingSpace = board.height / 4;

    pipeArray.push({
        img: topPipeImg,
        x: pipeX,
        y: randomPipeY,
        width: pipeWidth,
        height: pipeHeight,
        passed: false
    });

    pipeArray.push({
        img: bottomPipeImg,
        x: pipeX,
        y: randomPipeY + pipeHeight + openingSpace,
        width: pipeWidth,
        height: pipeHeight,
        passed: false
    });
}

function moveBird() {
    if (showingInstructions || paused || gameOver) return;
    velocityY = jumpVelocity;
    flapSound.play();
}

function detectCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

function endGame() {
    gameOver = true;
    hitSound.play();
    pauseButton.innerText = "Pause";
    if (score > bestScore) {
        bestScore = Math.floor(score);
        localStorage.setItem("bestScore", bestScore);
    }
}

function resetGame() {
    bird.y = birdY;
    velocityY = 0;
    pipeArray = [];
    score = 0;
    gameOver = false;
    paused = true;
    shieldCount = 0;
    pauseButton.innerText = "Pause";
    playAgainButton.style.display = "none";
    lastTime = null;
    // clear timers and intervals to ensure a clean reset
    if (pipeInterval) {
        clearInterval(pipeInterval);
        pipeInterval = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        countdown = 0;
    }
    setBackground();
}
