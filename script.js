const gridElement = document.getElementById('captcha-grid');
const doneBtn = document.getElementById('done-btn');
const successModal = document.getElementById('success-modal');
const restartBtn = document.getElementById('restart-btn');
const container = document.querySelector('.captcha-container');
const scoreVal = document.getElementById('score-val');
const timerVal = document.getElementById('timer-val');
const finalTimeDisplay = document.getElementById('final-time');
const difficultySelect = document.getElementById('difficulty-select');
const captchaIdText = document.getElementById('captcha-id-text');

let GRID_SIZE = parseInt(difficultySelect.value);
let TOTAL_TILES = GRID_SIZE * GRID_SIZE;
let currentScore = 0;

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

    // Reset Timer State
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerVal.innerText = '0.0';

    gridElement.innerHTML = '';
    tileRotations = [];
    
    // Generate new random captcha ID
    captchaIdText.innerText = Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
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
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        currentScore++;
        scoreVal.innerText = currentScore;
        finalTimeDisplay.innerText = `Vyřešeno za: ${totalTime}s`;
        successModal.classList.remove('hidden');
    } else {
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
    currentScore = 0;
    scoreVal.innerText = currentScore;
    initGame();
});

// Initialize on load
initGame();
