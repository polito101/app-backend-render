const { v4: uuidv4 } = require('uuid');

const joinGame = async (io, socket, redisClient) => {
    const userId = socket.uid;
    if (!userId) return;

    try {
        let roomId = null;
        const keys = await redisClient.keys('room:*');
        
        for (const key of keys) {
            const roomData = await redisClient.hGetAll(key);
            const players = JSON.parse(roomData.players || '[]');

            if (players.find(p => p.uid === userId)) {
                roomId = roomData.id;
                break;
            }
            if (!roomId && roomData.status === 'WAITING' && players.length < 5) {
                roomId = roomData.id;
            }
        }

        if (!roomId) {
            const uniqueId = uuidv4();
            roomId = `room:${uniqueId}`;
            await redisClient.hSet(roomId, {
                id: roomId,
                status: 'WAITING',
                players: '[]',
                pot: '0',
                turn: '0' // Turno inicial
            });
        }

        const roomKey = roomId;
        const roomData = await redisClient.hGetAll(roomKey);
        let players = JSON.parse(roomData.players || '[]');

        const existingPlayerIndex = players.findIndex(p => p.uid === userId);

        if (existingPlayerIndex !== -1) {
            players[existingPlayerIndex].socketId = socket.id; 
        } else {
            players.push({
                uid: userId,
                socketId: socket.id,
                chips: 1000,
                seat: players.length, // Se guarda como número
                status: 'ACTIVE',
                hand: null
            });
        }

        await redisClient.hSet(roomKey, 'players', JSON.stringify(players));
        socket.join(roomId);
        socket.activeRoomId = roomId;

        // ✅ ENVIAR DATOS LIMPIOS A FLUTTER
        socket.emit('joined_room', { 
            roomId: roomId,
            playerid: userId,
            players: players,
            pot: parseInt(roomData.pot || 0),
            turn: parseInt(roomData.turn || 0) // Forzamos que sea un Número
        });

        io.to(roomId).emit('player_joined', { 
            players: players 
        });

    } catch (error) {
        console.error("Error joinGame:", error);
    }
};

module.exports = { joinGame };