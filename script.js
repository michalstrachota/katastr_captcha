const gridElement = document.getElementById('captcha-grid');
const container = document.querySelector('.captcha-container');
const doneBtn = document.getElementById('done-btn');
const successModal = document.getElementById('success-modal');
const restartBtn = document.getElementById('restart-btn');
const scoreVal = document.getElementById('score-val');
const streakVal = document.getElementById('streak-val');
const timerVal = document.getElementById('timer-val');
const finalTimeDisplay = document.getElementById('final-time');
const earnedPointsDisplay = document.getElementById('earned-points');
const difficultySelect = document.getElementById('difficulty-select');
const pbVal = document.getElementById('pb-val');
const livesVal = document.getElementById('lives-val');

// Leaderboard Elements
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLeaderboard = document.getElementById('close-leaderboard');
const leaderboardList = document.getElementById('leaderboard-list');

const WORKER_URL = "https://katastrcaptchadb.michal-strachota1.workers.dev";

let GRID_SIZE = parseInt(difficultySelect.value);
let TOTAL_TILES = GRID_SIZE * GRID_SIZE;

let remainingLives = 3;

let globalScore = parseInt(localStorage.getItem('captchaGlobalScore')) || 0;
let currentStreak = parseInt(localStorage.getItem('captchaStreak')) || 0;

function updateScoreUI() {
    scoreVal.innerText = globalScore;
    streakVal.innerText = currentStreak;
}
updateScoreUI();

let timerInterval;
let startTime;
let isTimerRunning = false;

// Store the current rotation of each tile (in degrees)
let tileRotations = [];

// Known good locations - avoiding oceans and deserts
const CITIES = [
    { name: 'Prague', lat: 50.0755, lon: 14.4378 },
    { name: 'Paris', lat: 48.8566, lon: 2.3522 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Berlin', lat: 52.5200, lon: 13.4050 },
    { name: 'Rome', lat: 41.9028, lon: 12.4964 },
    { name: 'Vienna', lat: 48.2082, lon: 16.3738 },
    { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
    { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
    { name: 'Budapest', lat: 47.4979, lon: 19.0402 },
    { name: 'Warsaw', lat: 52.2297, lon: 21.0122 }
];

function lon2tile(lon, zoom) {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
    const latRad = lat * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
}

function initGame() {
    GRID_SIZE = parseInt(difficultySelect.value);
    TOTAL_TILES = GRID_SIZE * GRID_SIZE;
    document.documentElement.style.setProperty('--grid-size', GRID_SIZE);

    // Dynamic Health Pool configuration based on size
    if (GRID_SIZE === 3) remainingLives = 3;
    else if (GRID_SIZE === 4) remainingLives = 4;
    else if (GRID_SIZE === 5) remainingLives = 8;
    
    livesVal.innerText = remainingLives;

    // Load Local PB for this difficulty
    let best = localStorage.getItem(`captchaPB_${GRID_SIZE}`);
    pbVal.innerText = best ? best : '--';

    // Reset Timer State
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerVal.innerText = '0.0';

    gridElement.innerHTML = '';
    tileRotations = [];

    // Randomize zoom level between 14 and 16
    const z = Math.floor(Math.random() * 3) + 14;

    // Pick a random city
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];

    // Add a small random offset (-15 to +15 tiles) to the city center 
    // so we get different parts of the city each time
    const offsetRange = 15;
    const startX = lon2tile(city.lon, z) + Math.floor(Math.random() * (offsetRange * 2)) - offsetRange;
    const startY = lat2tile(city.lat, z) + Math.floor(Math.random() * (offsetRange * 2)) - offsetRange;

    for (let i = 0; i < TOTAL_TILES; i++) {
        // Generate random initial rotation: 0, 90, 180, or 270
        let initialRotation = Math.floor(Math.random() * 4) * 90;

        tileRotations.push(initialRotation);

        const tileWrapper = document.createElement('div');
        tileWrapper.classList.add('tile-wrapper');
        tileWrapper.title = "Kliknutím otočte o 90°";

        const tile = document.createElement('div');
        tile.classList.add('tile');

        const col = i % GRID_SIZE;
        const row = Math.floor(i / GRID_SIZE);

        // Fetch specific map tile from OpenStreetMap
        const tileX = startX + col;
        const tileY = startY + row;
        tile.style.backgroundImage = `url('https://tile.openstreetmap.org/${z}/${tileX}/${tileY}.png')`;

        // Apply initial rotation
        tile.style.transform = `rotate(${initialRotation}deg)`;

        // Set id and data attribute
        tile.dataset.index = i;
        tile.id = `tile-${i}`;

        // Add click event
        tileWrapper.addEventListener('click', () => {
            rotateTile(i, tile);
        });

        tileWrapper.appendChild(tile);
        gridElement.appendChild(tileWrapper);
    }

    // Ensure at least one tile needs rotating
    const allZero = tileRotations.every(r => r % 360 === 0);
    if (allZero) {
        const randIndex = Math.floor(Math.random() * TOTAL_TILES);
        tileRotations[randIndex] = 90;
        document.getElementById(`tile-${randIndex}`).style.transform = `rotate(90deg)`;
    }
}

function rotateTile(index, tileElement) {
    if (!isTimerRunning) {
        startTime = Date.now();
        isTimerRunning = true;
        timerInterval = setInterval(() => {
            const current = (Date.now() - startTime) / 1000;
            timerVal.innerText = current.toFixed(1);
        }, 100);
    }

    // Add 90 degrees
    tileRotations[index] += 90;
    tileElement.style.transform = `rotate(${tileRotations[index]}deg)`;
}

function checkWin() {
    // Check if all rotations are a multiple of 360
    const isWin = tileRotations.every(rotation => rotation % 360 === 0);

    if (isWin) {
        clearInterval(timerInterval);
        isTimerRunning = false;

        // Calculate points based on speed and difficulty
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        const earnedPoints = Math.round((TOTAL_TILES * 2000) / totalTime);

        // PB LocalStorage Update
        let currentPB = localStorage.getItem(`captchaPB_${GRID_SIZE}`);
        if (!currentPB || parseFloat(totalTime) < parseFloat(currentPB)) {
             localStorage.setItem(`captchaPB_${GRID_SIZE}`, totalTime);
             pbVal.innerText = totalTime;
             pbVal.style.color = '#4ade80'; // visually signify a new PB
             setTimeout(() => pbVal.style.color = '', 4000);
        }

        globalScore += earnedPoints;
        currentStreak++;

        localStorage.setItem('captchaGlobalScore', globalScore);
        localStorage.setItem('captchaStreak', currentStreak);
        updateScoreUI();

        // --- LEADERBOARD SUBMISSION LOGIC ---
        // Dynamically configure submission form inside the modal
        const submitForm = document.getElementById('leaderboard-submit-form');
        const nameInput = document.getElementById('player-name-input');
        const submitMsg = document.getElementById('submit-message');
        const submitBtn = document.getElementById('submit-score-btn');

        submitForm.style.display = 'block';
        submitMsg.style.display = 'none';
        submitBtn.disabled = false;

        let savedName = localStorage.getItem('captchaPlayerName');
        if (savedName) nameInput.value = savedName;

        // Remove old listener to prevent exponential triggers on repeat playthroughs
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

        newSubmitBtn.addEventListener('click', () => {
            const playerName = nameInput.value.trim();
            if (!playerName) return;

            localStorage.setItem('captchaPlayerName', playerName);
            newSubmitBtn.disabled = true;
            newSubmitBtn.innerText = 'Ukládám...';

            fetch(`${WORKER_URL}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: playerName,
                    score: earnedPoints,
                    time: parseFloat(totalTime),
                    grid_size: GRID_SIZE
                })
            }).then(() => {
                newSubmitBtn.innerText = 'Uložit';
                newSubmitBtn.disabled = false;

                // Auto-open leaderboard so user can see their rank
                successModal.classList.add('hidden');
                leaderboardBtn.click();
            }).catch(err => {
                console.error("Leaderboard failed", err);
                newSubmitBtn.innerText = 'Chyba';
                setTimeout(() => { newSubmitBtn.innerText = 'Uložit'; newSubmitBtn.disabled = false; }, 2000);
            });
        });

        finalTimeDisplay.innerText = `Vyřešeno za: ${totalTime}s`;
        earnedPointsDisplay.innerText = `Získáno: +${earnedPoints} Bodů`;
        successModal.classList.remove('hidden');
    } else {
        // --- FAILURE LOGIC ---
        remainingLives--;
        
        if (remainingLives < 0) {
            remainingLives = 0; // Lock UI to 0
            
            // Hardcore Penalties trigger
            const penalty = TOTAL_TILES * 25;
            globalScore = Math.max(0, globalScore - penalty);
            currentStreak = 0;
            
            localStorage.setItem('captchaGlobalScore', globalScore);
            localStorage.setItem('captchaStreak', currentStreak);
            updateScoreUI();
            
            // Visual error feedback
            scoreVal.style.color = 'var(--error-color)';
            streakVal.style.color = 'var(--error-color)';
            setTimeout(() => {
                scoreVal.style.color = '';
                streakVal.style.color = '';
            }, 800);
        } else {
            // Free mistake used! Visually flash the remaining lives
            livesVal.style.color = '#fb923c';
            setTimeout(() => livesVal.style.color = '', 800);
        }
        
        livesVal.innerText = remainingLives;
        
        // Shake animation
        container.classList.remove('shake');
        // Trigger reflow to restart animation
        void container.offsetWidth;
        container.classList.add('shake');

        // Visual feedback on the button
        doneBtn.style.backgroundColor = 'var(--error-color)';
        setTimeout(() => {
            doneBtn.style.backgroundColor = '';
        }, 500);
    }
}

doneBtn.addEventListener('click', checkWin);

restartBtn.addEventListener('click', () => {
    successModal.classList.add('hidden');
    initGame();
});

difficultySelect.addEventListener('change', () => {
    // Reset streak on difficulty change, but keep global score
    currentStreak = 0;
    localStorage.setItem('captchaStreak', currentStreak);
    updateScoreUI();
    initGame();
});

// Initialize on load
initGame();

// --- LEADERBOARD DISPLAY LOGIC ---
const tabBtns = document.querySelectorAll('.tab-btn');
let leaderboardCache = null;
let currentTab = '3';

function renderLeaderboardList(gridKey) {
    if (!leaderboardCache) return;
    const tierList = leaderboardCache[gridKey] || [];

    if (tierList.length === 0) {
        leaderboardList.innerHTML = "<p style='text-align:center; padding: 20px 0;'>Nikdo to ještě nezkusil (zatím).<br>Buďte první!</p>";
        return;
    }

    leaderboardList.innerHTML = tierList.map((entry, i) => `
        <div class="leaderboard-row">
            <div>
                <div class="leaderboard-name">${i + 1}. ${entry.name}</div>
                <div class="leaderboard-detail" style="color: var(--text-secondary);">Skóre: ${entry.score} B</div>
            </div>
            <div class="leaderboard-score" style="color: #4ade80; font-size: 18px;">${entry.time.toFixed(1)} s</div>
        </div>
    `).join('');
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.size;
        renderLeaderboardList(currentTab);
    });
});

leaderboardBtn.addEventListener('click', async () => {
    leaderboardModal.classList.remove('hidden');
    leaderboardList.innerHTML = "<p style='text-align:center;'>Načítání skóre...</p>";

    // Auto-switch tab to physically match whatever difficulty they are actively playing
    currentTab = GRID_SIZE.toString();
    tabBtns.forEach(b => {
        if (b.dataset.size === currentTab) b.classList.add('active');
        else b.classList.remove('active');
    });

    try {
        const res = await fetch(`${WORKER_URL}/leaderboard`);
        let data = await res.json();

        // Safety protocol: if the old Cloudflare data format (array) somehow loads, map to dictionary
        if (Array.isArray(data)) data = { "3": [], "4": [], "5": [] };

        leaderboardCache = data;
        renderLeaderboardList(currentTab);
    } catch (e) {
        leaderboardList.innerHTML = "<p style='text-align:center; color: #e57373;'>Nepodařilo se připojit k serveru databáze.</p>";
        console.error(e);
    }
});

closeLeaderboard.addEventListener('click', () => {
    leaderboardModal.classList.add('hidden');
});
