const startScreen = document.getElementById('start-screen');
const loadingScreen = document.getElementById('loading-screen');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');

const playBtn = document.getElementById('play-btn');

let playerId;
let players = {};

// === СТАРТЫЙ ЭКРАН ===
playBtn.addEventListener('click', () => {
  startScreen.classList.remove('active');
  loadingScreen.classList.add('active');

  // Имитируем загрузку (можно заменить на реальную, если нужно)
  setTimeout(() => {
    loadingScreen.classList.remove('active');
    gameCanvas.style.display = 'block';

    // Запуск игры
    initGame();
  }, 3000); // 3 секунды загрузки
});

// === ИГРОВАЯ ЛОГИКА ===
function initGame() {
  const socket = io();

  socket.on('connect', () => {
    playerId = socket.id;
    console.log('Connected as:', playerId);
  });

  socket.on('currentPlayers', (currentPlayers) => {
    players = currentPlayers;
    draw();
  });

  socket.on('newPlayer', (newPlayer) => {
    players[newPlayer.id] = newPlayer;
    draw();
  });

  socket.on('playerMoved', (movedPlayer) => {
    players[movedPlayer.id] = movedPlayer;
    draw();
  });

  socket.on('playerDisconnected', (id) => {
    delete players[id];
    draw();
  });

  // Клавиши
  const keys = {};
  window.addEventListener('keydown', (e) => keys[e.key] = true);
  window.addEventListener('keyup', (e) => keys[e.key] = false);

  function update() {
    if (!players[playerId]) return;

    const speed = 5;
    const p = players[playerId];

    if (keys['ArrowUp'] && p.y > 0) p.y -= speed;
    if (keys['ArrowDown'] && p.y < gameCanvas.height - 20) p.y += speed;
    if (keys['ArrowLeft'] && p.x > 0) p.x -= speed;
    if (keys['ArrowRight'] && p.x < gameCanvas.width - 20) p.x += speed;

    socket.emit('playerMove', { x: p.x, y: p.y });
  }

  function draw() {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // Используем gameCanvas
    for (const id in players) {
      const player = players[id];
      ctx.fillStyle = player.color || '#4CAF50';
      ctx.fillRect(player.x, player.y, 20, 20);
    }
  }

  function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }

  gameLoop();
}
