const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Очередь ожидания
const waitingPlayers = [];

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // Игрок нажал Play
  socket.on('requestToPlay', () => {
    // Добавляем игрока в очередь
    waitingPlayers.push(socket.id);
    console.log('Игрок добавлен в очередь. Текущее количество:', waitingPlayers.length);

    // Если игроков двое — начинаем игру
    if (waitingPlayers.length === 2) {
      const player1Id = waitingPlayers.pop();
      const player2Id = waitingPlayers.pop();

      // Создаём комнату для игры
      const roomId = `room-${Date.now()}`;
      socket.to(player1Id).join(roomId);
      socket.to(player2Id).join(roomId);
      io.sockets.in(roomId).emit('startGame');

      // Уведомляем игроков о начале игры
      io.to(player1Id).emit('setPlayerData', { id: player1Id, role: 'player1' });
      io.to(player2Id).emit('setPlayerData', { id: player2Id, role: 'player2' });

      // Начинаем отслеживание игры
      setupGame(io, roomId, player1Id, player2Id);
    }
  });

  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    const index = waitingPlayers.indexOf(socket.id);
    if (index !== -1) {
      waitingPlayers.splice(index, 1);
    }
  });
});

function setupGame(io, roomId, player1Id, player2Id) {
  const players = {
    [player1Id]: { x: 100, y: 200, color: '#FF5722' },
    [player2Id]: { x: 500, y: 200, color: '#2196F3' },
  };

  // Отправляем начальное состояние обоим игрокам
  io.to(player1Id).emit('currentPlayers', players);
  io.to(player2Id).emit('currentPlayers', players);

  // Слушаем движения игроков
  io.sockets.in(roomId).on('playerMove', (data) => {
    if (players[data.id]) {
      players[data.id].x = data.x;
      players[data.id].y = data.y;
      io.to(roomId).emit('playerMoved', { id: data.id, ...data });
    }
  });

  // Обработка отключения одного из игроков
  io.sockets.in(roomId).on('disconnect', (reason) => {
    io.to(roomId).emit('opponentDisconnected');
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});
