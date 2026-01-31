const startScreen = document.getElementById('start-screen');
const loadingScreen = document.getElementById('loading-screen');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');

const playBtn = document.getElementById('play-btn');

let playerId;
let players = {};
let role = null; // 'player1' или 'player2'

// === СТАРТЫЙ ЭКРАН ===
playBtn.addEventListener('click', () => {
  startScreen.classList.remove('active');
  loadingScreen.classList.add('active');

  // Отправляем запрос на присоединение
  const socket = io();
  socket.emit('requestToPlay');

  socket.on('startGame', () => {
    loadingScreen.classList.remove('active');
    gameCanvas.style.display = 'block';
    initGame(socket);
  });

  socket.on('setPlayerData', (data) => {
    playerId = data.id;
    role = data.role;
    console.log('Вы —', role);
  });

  socket.on('opponentDisconnected', () => {
    alert('Противник покинул игру!');
    window.location.reload();
  });
});

// === ИГРОВАЯ ЛОГИКА ===
function initGame(socket) {
  socket.on('currentPlayers', (currentPlayers) => {
    players = currentPlayers;
    draw();
  });

  socket.on('playerMoved', (movedPlayer) => {
    players[movedPlayer.id] = movedPlayer;
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

    socket.emit('playerMove', { x: p.x, y: p.y, id: playerId });
  }

  function draw() {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    for (const id in players) {
      const player = players[id];
      ctx.fillStyle = player.color;
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
