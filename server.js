const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let players = {};
let hearts = [];
let score = 0;
let highScore = 0;
let lives = 3;
let gameOver = false;
let heartSpawnTimer = 0;

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
}

function serverLoop() {
    // 🌟 FIXED: Only spawn hearts and process physics if BOTH players are in the lobby!
    const playerCount = Object.keys(players).length;
    
    if (playerCount === 2 && !gameOver) {
        heartSpawnTimer++;
        let spawnRate = Math.max(20, 50 - Math.floor(score / 5) * 5);
        if (heartSpawnTimer > spawnRate) {
            hearts.push({
                x: Math.random() * 300,
                y: -20,
                width: 16,
                height: 16,
                speed: 1.5 + Math.random() * 1.5 + (score * 0.05)
            });
            heartSpawnTimer = 0;
        }

        for (let i = hearts.length - 1; i >= 0; i--) {
            hearts[i].y += hearts[i].speed;
            let caught = false;

            for (let id in players) {
                let p = players[id];
                let bunnyRect = { x: p.x, y: p.y, width: 30, height: 30 };
                if (checkCollision(bunnyRect, hearts[i])) {
                    hearts.splice(i, 1);
                    score++;
                    if (score > highScore) highScore = score;
                    io.emit('heartEffect', 'catch');
                    caught = true;
                    break;
                }
            }
            if (caught) continue;

            if (hearts[i].y > 240) {
                hearts.splice(i, 1);
                lives--;
                io.emit('heartEffect', 'miss');
                if (lives <= 0) gameOver = true;
            }
        }
    }
    
    // Always send the current player count so the client knows whether to show the waiting screen
    io.emit('gameState', { score, highScore, lives, gameOver, hearts, playerCount });
}
setInterval(serverLoop, 1000 / 60);

io.on('connection', (socket) => {
    let assignedRole = Object.keys(players).length === 0 ? 'blue' : 'pink';
    
    players[socket.id] = {
        id: socket.id, role: assignedRole, name: assignedRole === 'blue' ? 'Bluey' : 'Pinky',
        x: assignedRole === 'blue' ? 50 : 240, y: 160
    };

    socket.emit('init', { id: socket.id, role: assignedRole, players });

    socket.on('joinLobby', (data) => {
        if (players[socket.id]) {
            players[socket.id].name = data.name;
            io.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('playerMove', (moveData) => {
        if (players[socket.id] && !gameOver && Object.keys(players).length === 2) {
            players[socket.id].x = moveData.x;
            players[socket.id].y = moveData.y;
            io.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        if (Object.keys(players).length === 0) {
            score = 0; lives = 3; gameOver = false; hearts = [];
        }
    });
});

http.listen(3000, () => { console.log('Multiplayer server active'); });
            
