const startScreen = document.getElementById('start-screen');
const loadingScreen = document.getElementById('loading-screen');
const gameArea = document.getElementById('game-area');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');

// === Отключаем сглаживание для canvas ===
ctx.imageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;

const playBtn = document.getElementById('play-btn');
let playerId;
let players = {};
let lines = [];
let drawnPoints = []; // === Точки, отображаемые сразу при клике ===
let tempSelectedPoints = []; // === Временные точки до отправки ===
let projectiles = []; // === Анимированные иконки ===
let role = null;
let roomId = null;

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ РАБОТЫ С ЛИНИЕЙ ===
let selectedItem = null;

// === Загрузка изображения иконки ===
const itemIcon = new Image();
itemIcon.src = 'items/item1.png';

// === СТАРТЫЙ ЭКРАН ===
playBtn.addEventListener('click', () => {
    startScreen.classList.remove('active');
    loadingScreen.classList.add('active');
    const socket = io();
    socket.emit('requestToPlay');

    socket.on('gameStart', (data) => {
        role = data.role;
        roomId = data.roomId;
        playerId = socket.id;
        loadingScreen.classList.remove('active');
        gameArea.style.display = 'flex';
        gameCanvas.style.display = 'block';
        initGame(socket);
    });

    socket.on('opponentDisconnected', () => {
        alert('Противник покинул игру!');
        window.location.reload();
    });

    socket.on('currentPlayers', (currentPlayers) => {
        players = currentPlayers;
        draw();
    });

    socket.on('playerMoved', (movedPlayer) => {
        if (movedPlayer.id !== playerId) {
            players[movedPlayer.id] = movedPlayer;
        }
        draw();
    });

    // === ПРИЁМ ЛИНИИ ОТ СЕРВЕРА ===
    socket.on('newLine', (lineData) => {
        lines.push({
            from: lineData.from,
            to: lineData.to,
            timestamp: Date.now()
        });
        // === ДОБАВЛЯЕМ ТОЧКИ ОТ СЕРВЕРА ===
        drawnPoints.push(lineData.from, lineData.to);
        launchProjectile(lineData.from, lineData.to);
    });
});

// === ФУНКЦИЯ ЗАПУСКА АНИМИРОВАННОГО СНАРЯДА ===
function launchProjectile(from, to) {
    projectiles.push({
        x: from.x,
        y: from.y,
        targetX: to.x,
        targetY: to.y,
        speed: 0.1,
        done: false
    });
}

// === ИГРОВАЯ ЛОГИКА ===
function initGame(socket) {
    gameCanvas.width = gameCanvas.clientWidth;
    gameCanvas.height = gameCanvas.clientHeight;

    // Клавиши
    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.key] = true);
    window.addEventListener('keyup', (e) => keys[e.key] = false);

    let lastSentTime = 0;
    const sendInterval = 1000 / 30; // 30 раз в секунду

    function update() {
        if (!players[playerId]) return;
        const speed = 5;
        const p = players[playerId];

        let moved = false;

        if (keys['ArrowUp'] && p.y > 0) {
            p.y -= speed;
            moved = true;
        }
        if (keys['ArrowDown'] && p.y < gameCanvas.height - 20) {
            p.y += speed;
            moved = true;
        }
        if (keys['ArrowLeft'] && p.x > 0) {
            p.x -= speed;
            moved = true;
        }
        if (keys['ArrowRight'] && p.x < gameCanvas.width - 20) {
            p.x += speed;
            moved = true;
        }

        // Отправляем позицию на сервер с интервалом
        const now = Date.now();
        if (moved && now - lastSentTime >= sendInterval) {
            socket.emit('playerMove', { x: p.x, y: p.y, id: playerId });
            lastSentTime = now;
        }

        // === ОБНОВЛЕНИЕ ПОЗИЦИИ СНАРЯДОВ ===
        projectiles.forEach(proj => {
            if (proj.done) return;

            const dx = proj.targetX - proj.x;
            const dy = proj.targetY - proj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5) {
                proj.done = true;
            } else {
                proj.x += dx * proj.speed;
                proj.y += dy * proj.speed;
            }
        });

        draw();
    }

    // === ОБРАБОТКА КЛИКА НА CANVAS ===
    gameCanvas.addEventListener('click', (e) => {
        if (selectedItem !== 'item1') return;

        const rect = gameCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        tempSelectedPoints.push({ x, y });
        drawnPoints.push({ x, y }); // === ДОБАВЛЯЕМ ТОЧКУ СРАЗУ ===

        if (tempSelectedPoints.length === 2) {
            const lineData = { from: tempSelectedPoints[0], to: tempSelectedPoints[1], playerId };
            socket.emit('drawLine', lineData);
            console.log("Отправлено событие drawLine:", lineData);
            tempSelectedPoints = []; // сброс временных точек
        }
    });

    setInterval(update, 1000 / 60); // 60 FPS для отрисовки
}

// === ФУНКЦИЯ ОТРИСОВКИ ===
function draw() {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // Рисуем игроков
    for (const id in players) {
        const player = players[id];
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, 20, 20);
    }

    // Рисуем линии
    lines.forEach((line) => {
        ctx.beginPath();
        ctx.strokeStyle = '#000000'; // === ЧЁРНАЯ ЛИНИЯ ===
        ctx.lineWidth = 3;
        ctx.moveTo(line.from.x, line.from.y);
        ctx.lineTo(line.to.x, line.to.y);
        ctx.stroke();
    });

    // Рисуем точки (включая временные)
    drawnPoints.forEach(point => {
        ctx.beginPath();
        ctx.fillStyle = '#000000'; // чёрный цвет
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); // радиус 5
        ctx.fill();
    });

    // Рисуем снаряды (иконки)
    projectiles.forEach(proj => {
        if (!proj.done && itemIcon.complete) {
            // === Рисуем иконку с оригинальным разрешением ===
            const width = itemIcon.width;
            const height = itemIcon.height;
            ctx.drawImage(itemIcon, proj.x - width / 2, proj.y - height, width, height);
        }
    });
}

// === ФУНКЦИЯ ВЫБОРА ПРЕДМЕТА ===
function selectItem(element) {
    const itemId = element.dataset.itemId;
    selectedItem = itemId;

    if (itemId === 'item1') {
        console.log("Выбран предмет: item1 — режим выбора двух точек");
        tempSelectedPoints = []; // сброс при выборе
        alert("Кликните два раза на поле, чтобы провести линию.");
    } else {
        console.log("Выбран другой предмет:", itemId);
        selectedItem = null;
        tempSelectedPoints = [];
    }
}
