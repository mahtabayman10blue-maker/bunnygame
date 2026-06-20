const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve your HTML, CSS, and JS game assets
app.use(express.static(__dirname));

let players = {};
let activeHearts = [];
let sharedScore = 0;
let sharedLives = 3;

io.on('connection', (socket) => {
    console.log('Player connected: ' + socket.id);

    // Assign roles dynamically (First connect = Bluey, Second = Pinky)
    let assignedRole = null;
    const currentCount = Object.keys(players).length;

    if (currentCount === 0) assignedRole = 'blue';
    else if (currentCount === 1) assignedRole = 'pink';

    // Save player state on server
    players[socket.id] = {
        id: socket.id,
        role: assignedRole,
        name: assignedRole === 'blue' ? 'Bluey' : 'Pinky',
        x: assignedRole === 'blue' ? 50 : 240,
        y: 160
    };

    // Send connection details back to the player
    socket.emit('init', { id: socket.id, role: assignedRole, players });
    
    // Tell everyone else a new player joined
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle incoming position updates from players
    socket.on('playerMove', (moveData) => {
        if (players[socket.id]) {
            players[socket.id].x = moveData.x;
            players[socket.id].y = moveData.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Sync custom user name updates across screens
    socket.on('updateName', (data) => {
        if (players[socket.id]) {
            players[socket.id].name = data.name;
            io.emit('nameUpdated', { id: socket.id, name: data.name });
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected: ' + socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Run server on port 3000
http.listen(3000, () => {
    console.log('Server is spinning up on http://localhost:3000');
});
          
