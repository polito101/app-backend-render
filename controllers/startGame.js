const { createDeck, shuffleDeck, drawCard } = require('../utils/deck');

const startGame = async (io, socket, redisClient) => {
    const roomId = socket.activeRoomId;
    if (!roomId) return;

    try {
        const roomKey = roomId;
        let deck = createDeck();
        deck = shuffleDeck(deck);

        const roomData = await redisClient.hGetAll(roomKey);
        let players = JSON.parse(roomData.players || '[]');

        // 1. Repartir cartas
        players = players.map(p => {
            p.hand = [drawCard(deck), drawCard(deck)];
            p.status = 'ACTIVE'; // Aseguramos que estén activos
            return p;
        });
        const dealer = players.find(p => p.socketId === socket.id);
        let currentTurn = dealer ? dealer.seat: 0;
        // 3. Guardar en Redis
        await redisClient.hSet(roomKey, {
            deck: JSON.stringify(deck),
            players: JSON.stringify(players),
            status: 'PLAYING',
            turn: currentTurn.toString()
        });

        // 4. Notificar a todos (INCLUYENDO EL TURNO)
        io.to(roomId).emit('game_started', { 
            status: 'PLAYING',
            players: players.map(p => ({ ...p, hand: null })),
            turn: parseInt(currentTurn) // ✅ IMPORTANTE: Enviamos el turno al Frontend
        });

        // 5. Enviar cartas privadas
        for (const p of players) {
            io.to(p.socketId).emit('your_cards', { cards: p.hand });
        }
        
        console.log(`🃏 Partida iniciada en ${roomId}. Turno: ${currentTurn}`);

    } catch (error) {
        console.error('Error en startGame:', error);
    }
};

module.exports = startGame;