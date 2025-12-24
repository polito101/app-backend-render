// controllers/startGame.js
const { createDeck, shuffleDeck, drawCard } = require('../utils/deck');

const startGame = async (io, socket, redisClient) => {
    const roomId = socket.activeRoomId;
    if (!roomId) return;

    try {
        const roomKey = roomId;
        console.log(`🎰 Iniciando partida en ${roomId}`);
        
        let deck = createDeck();
        deck = shuffleDeck(deck);

        const roomData = await redisClient.hGetAll(roomKey);
        let players = JSON.parse(roomData.players || '[]');

        // Repartir 2 cartas a cada uno
        players = players.map(p => {
            p.hand = [drawCard(deck), drawCard(deck)];
            return p;
        });

        // Guardar estado en Redis
        await redisClient.hSet(roomKey, {
            deck: JSON.stringify(deck),
            players: JSON.stringify(players),
            status: 'PLAYING'
        });

        // Notificar inicio (público)
        io.to(roomId).emit('game_started', { 
            status: 'PLAYING',
            players: players.map(p => ({...p, hand: null})) 
        });

        // Enviar cartas privadas
        for (const p of players) {
            io.to(p.socketId).emit('your_cards', { cards: p.hand });
        }

        console.log(`✅ Cartas repartidas y partida iniciada en ${roomId}`);
    } catch (e) {
        console.error("Error en startGame:", e);
    }
};

module.exports = startGame;