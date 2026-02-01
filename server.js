const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Очередь ожидания
let waitingPlayers = [];

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    socket.on('requestToPlay', () => {
        waitingPlayers.push(socket.id);
        console.log('Игрок добавлен в очередь. Текущее количество:', waitingPlayers.length);

        if (waitingPlayers.length === 2) {
            const player1Id = waitingPlayers.pop();
            const player2Id = waitingPlayers.pop();

            const player1Socket = io.sockets.sockets.get(player1Id);
            const player2Socket = io.sockets.sockets.get(player2Id);

            // Создаём комнату
            const roomId = `room-${Date.now()}`;

            player1Socket.join(roomId);
            player2Socket.join(roomId);

            // Данные о себе и другом
            const gameState = {
                player1: { id: player1Id, cuts: 0 },
                player2: { id: player2Id, cuts: 0 }
            };

            // Отправляем каждому его роль и начальное состояние
            player1Socket.emit('gameStart', { role: 'player1', roomId, state: gameState });
            player2Socket.emit('gameStart', { role: 'player2', roomId, state: gameState });

            setupGame(io, player1Socket, player2Socket, roomId, gameState);
        }
    });

    socket.on('cutDecision', (data) => {
        const { choice, roomId } = data;
        socket.to(roomId).emit('opponentChose', { choice });
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        const index = waitingPlayers.indexOf(socket.id);
        if (index !== -1) {
            waitingPlayers.splice(index, 1);
        }
    });
});

function setupGame(io, player1Socket, player2Socket, roomId, gameState) {
    // Обработка решений
    player1Socket.on('cutDecision', (data) => {
        if (data.choice === 'self') {
            gameState.player1.cuts += 2;
        } else if (data.choice === 'other') {
            gameState.player2.cuts += 1;
        }
        // Отправляем обновлённое состояние обоим
        io.to(roomId).emit('updateState', gameState);
    });

    player2Socket.on('cutDecision', (data) => {
        if (data.choice === 'self') {
            gameState.player2.cuts += 2;
        } else if (data.choice === 'other') {
            gameState.player1.cuts += 1;
        }
        // Отправляем обновлённое состояние обоим
        io.to(roomId).emit('updateState', gameState);
    });

    // Уведомление об отключении
    player1Socket.once('disconnect', () => {
        io.to(roomId).emit('opponentDisconnected');
    });
    player2Socket.once('disconnect', () => {
        io.to(roomId).emit('opponentDisconnected');
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
