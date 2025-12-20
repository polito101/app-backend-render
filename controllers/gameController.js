// controllers/gameController.js
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
            if (roomData.status === 'WAITING' && players.length < 5) {
                roomId = roomData.id;
                break;
            }
        }

        if (!roomId) {
            const id = uuidv4();
            roomId = `room:${id}`;
            await redisClient.hSet(roomId, { // ✅ Clave corregida
                id: roomId,
                status: 'WAITING',
                players: '[]',
                pot: '0'
            });
        }

        const roomKey = roomId;
        const roomData = await redisClient.hGetAll(roomKey);
        let players = JSON.parse(roomData.players || '[]');

        if (!players.find(p => p.uid === userId)) {
            players.push({
                uid: userId,
                socketId: socket.id,
                chips: 1000,
                seat: players.length,
                hand: null
            });
            await redisClient.hSet(roomKey, 'players', JSON.stringify(players));
        }

        socket.join(roomId);
        socket.activeRoomId = roomId;

        // ✅ IMPORTANTE: El evento debe ser 'joined_room' como en Flutter
        io.to(roomId).emit('joined_room', { 
            roomId: roomId,
            players: players 
        });

    } catch (error) {
        console.error('Error en joinGame:', error);
    }
};

module.exports = { joinGame };