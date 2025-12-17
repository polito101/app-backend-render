const { v4: uuidv4 } = require('uuid');

/**
 * Maneja la lógica de unirse a una partida
 * @param {Object} io - La instancia global de Socket.IO
 * @param {Object} socket - El socket del usuario actual
 * @param {Object} redisClient - El cliente de Redis conectado
 */

const joinGame = async (io, socket, redisClient) => {
    const userId = socket.uid;

    if (!userId) {
        console.error('Usuario no autenticado intentó unirse al juego.');
        socket.emit('error', { message: 'Usuario no autenticado.' });
        socket.disconnect();
        return;
    }

    console.log('Usuario ${userId} buscando mesa...');

    try {
        let roomId = null;

        // Buscar una sala con espacio disponible
        const keys = await redisClient.keys('room:*');
        for (const key of keys) {
            const roomData = await redisClient.hGetAll(key);
            const players = JSON.parse(roomData.players || '[]');

            if (roomData.status === 'waiting' && players.length < 5) {
                roomId = roomData.id;
                console.log('Mesa encontrada: ${roomId} para el usuario ${userId}');
                break;
            }
        }

        // Si no se encontró una sala, crear una nueva
        if (!roomId) {
            const uniqueRoomId = uuidv4();
            roomId = `room:${uniqueRoomId}`;

            console.log('Creando nueva mesa: ${roomId}');
            const newRoom = {
                id: roomId,
                status: 'WAITING',
                players: '[]',
                deck: '[]',
                communityCards: '[]',
                pot: '0',
                turn: '0',
                createdAt: Date.now().toString(),
            };
            await redisClient.hSet('room:${roomId}', newRoom);
        }

        // Unir al usuario a la sala
        const roomKey = `room:${roomId}`;
        const currentRoomData = await redisClient.hGetAll(roomKey);
        let currentPlayers = JSON.parse(currentRoomData.players || '[]');

        // Verificar si el usuario ya está en la sala
        const alreadyIn = currentPlayers.find(p => p.id === userId);

        if (!alreadyIn) {
            const newPlayer = {
                uid: userId,
                socketId: socket.id,
                chips: 1000,
                seat: currentPlayers.length,
                status: 'ACTIVE',
                hand: [],
                bet: 0,
            };
            currentPlayers.push(newPlayer);
            await redisClient.hSet(roomKey, 'players', JSON.stringify(currentPlayers));
            console.log('Usuario ${userId} se unió a la mesa ${roomId}');
        }

        socket.join(roomId);
        socket.activeRoomId = roomId;

        socket.emit('joinedGame', {
            roomId: roomId,
            playerid: userId,
            players: currentPlayers
        });

        socket.to(roomId).emit('playerJoined', {
            newPlayerId: userId,
            players: currentPlayers
        });

        console.log('Usuario ${userId} unido a la sala ${roomId} exitosamente. Total jugadores: ${currentPlayers.length}');
    } catch (error) {
        console.error('ERROR en joinGame:', error);
        socket.emit('error', { message: 'Error al unirse al juego.' });



    }
};
module.exports = { joinGame };