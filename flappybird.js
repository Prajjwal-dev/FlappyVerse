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
let velocityX = -2;
let velocityY = 0;
let gravity = 0.4;

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

// Music elements
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

    pauseButton.addEventListener("click", togglePause);
    playAgainButton.addEventListener("click", () => {
        playAgainButton.style.display = "none";
        showInstructions(() => {
            resetGame();
        });
    });

    document.addEventListener("keydown", handleInput);
    document.addEventListener("click", handleClick);
    document.addEventListener("touchstart", handleClick);

    setBackground();
    showInstructions(() => {
        paused = false;
        pauseButton.style.visibility = "visible";
        requestAnimationFrame(update);
        setInterval(placePipes, 1500);
    });
};

function showInstructions(callback) {
    showingInstructions = true;
    pauseButton.style.display = "block";
    pauseButton.style.visibility = "hidden";

    context.fillStyle = "rgba(0, 0, 0, 0.7)";
    context.fillRect(0, 0, board.width, board.height);
    context.fillStyle = "white";
    context.font = "20px Courier New";

    const lines = [
        "Flappy Bird Instructions:",
        "- Press Space / Click / Tap",
        "  to Fly",
        "- Avoid Pipes to Score",
        "- Press 'P' or Button",
        "  to Pause/Resume",
        "- Shield auto activates",
        "  every 10 pts",
        "Click / Touch to Start"
    ];

    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], 20, 100 + i * 40);
    }

    function startAfterInstruction() {
        document.removeEventListener("click", startAfterInstruction);
        pauseButton.style.visibility = "visible";
        showingInstructions = false;
        callback();
    }

    document.addEventListener("click", startAfterInstruction);
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

    if (paused) {
        pauseButton.innerText = "Pause";
        countdown = 3;
        countdownInterval = setInterval(() => {
            context.clearRect(0, 0, board.width, board.height);
            drawScene();
            context.fillStyle = "white";
            context.font = "60px sans-serif";

            if (countdown === 0) {
                clearInterval(countdownInterval);
                paused = false;
            } else {
                context.fillText(countdown, boardWidth / 2 - 15, boardHeight / 2);
                countdown--;
            }
        }, 1000);
    } else {
        paused = true;
        pauseButton.innerText = "Resume";
    }
}

function update() {
    requestAnimationFrame(update);
    if (paused || gameOver) {
        if (paused && !gameOver && countdown === 0 && countdownInterval === null && !showingInstructions) {
            context.fillStyle = "white";
            context.font = "50px sans-serif";
            context.fillText("PAUSED", boardWidth / 2 - 90, boardHeight / 2);
        }
        return;
    }

    context.clearRect(0, 0, board.width, board.height);

    velocityY += gravity;
    bird.y = Math.max(bird.y + velocityY, 0);
    context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);

    if (bird.y > board.height) {
        endGame();
    }

    for (let i = 0; i < pipeArray.length; i++) {
        let pipe = pipeArray[i];
        pipe.x += velocityX;
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
    velocityY = -6;
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
    setBackground();
    showInstructions(() => {
        paused = false;
    });
}