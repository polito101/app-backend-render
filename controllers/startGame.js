const { joinGame } = require('./gameController');

const { createDeck, shuffleDeck, drawCard } = require('../utils/deck');

/**
 * Inicia la mano: Baraja y reparte 2 cartas a cada jugador
 */
const startGame = async (io, socket, redisClient) => {
    const roomId = socket.activeRoomId;

    if (!roomId) {
        return socket.emit('error', { message: 'No estás en una sala.' });
    }

    console.log(`🎰 Iniciando partida en ${roomId}...`);

    try {
        const roomKey = `room:${roomId}`;
        
        const roomData = await redisClient.hGetAll(roomKey);
        let players = JSON.parse(roomData.players || '[]');

        if (players.length < 2) {
             //return socket.emit('error', { message: 'Se necesitan al menos 2 jugadores.' });
             //Para pruebas, permitamos jugar solo:
             console.log("⚠️ Jugando en modo solitario (Testing)");
        }

        // Crear y Barajar Deck
        let deck = createDeck();
        deck = shuffleDeck(deck);

        // Repartir 2 cartas a cada jugador
        players = players.map(player => {
            const card1 = drawCard(deck);
            const card2 = drawCard(deck);
            
            // Guardamos las cartas EN EL JUGADOR (mano privada)
            // hand: [{rank:'A', suit:'H'}, {rank:'10', suit:'S'}]
            player.hand = [card1, card2]; 
            return player;
        });

        // 4. Actualizar Redis
        // Guardamos el mazo restante (para el Flop/Turn/River) y los jugadores con sus cartas
        await redisClient.hSet(roomKey, {
            'players': JSON.stringify(players),
            'deck': JSON.stringify(deck),
            'status': 'PLAYING',
            'turn': '0'
        });
     
        // OPCIÓN A (Simple): Mandar todo a todos (Inseguro para póker real, bueno para debug)
        // io.to(roomId).emit('game_started', { players });

        // OPCIÓN B (Segura): Cada jugador solo recibe SUS cartas
        // Recorremos los jugadores y enviamos mensaje individual a su socketId
        players.forEach(p => {
            // A este socket específico le mandamos SU mano
            io.to(p.socketId).emit('deal_cards', {
                myHand: p.hand,
                players: players.map(pl => ({...pl, hand: null})) // Ocultamos cartas ajenas
            });
        });

        // Para simplificar tu desarrollo AHORA MISMO, usaremos una mezcla:
        // Enviamos el evento 'game_started' general para avisar que cambió el estado
        // Y dentro mandamos la info pública.
        io.to(roomId).emit('game_started', { 
            status: 'PLAYING',
            playersPublic: players.map(p => ({uid: p.uid, chips: p.chips, seat: p.seat})) // Sin cartas
        });
        
        // Y enviamos las cartas privadas individualmente
        for (const p of players) {
             io.to(p.socketId).emit('your_cards', { cards: p.hand });
        }

        console.log(`🃏 Cartas repartidas en ${roomId}`);

    } catch (error) {
        console.error('❌ Error en startGame:', error);
    }
};

module.exports = { joinGame, startGame };