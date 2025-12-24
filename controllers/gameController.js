const { v4: uuidv4 } = require('uuid');

const joinGame = async (io, socket, redisClient) => {
    const userId = socket.uid;
    
    // Validación de seguridad básica
    if (!userId) {
        console.error('❌ Intento de unirse sin UID');
        socket.emit('error', { message: 'Usuario no autenticado.' });
        return;
    }

    console.log(`🔍 Usuario ${userId} buscando mesa...`);

    try {
        let roomId = null;

        // 1. BUSCAR SALA
        // Primero miramos si el usuario YA está en una sala (Reconexión)
        const keys = await redisClient.keys('room:*');
        
        // Bucle para buscar sala
        for (const key of keys) {
            const roomData = await redisClient.hGetAll(key);
            const players = JSON.parse(roomData.players || '[]');

            // A) Prioridad: Si ya estoy en esta sala, me quedo aquí
            if (players.find(p => p.uid === userId)) {
                roomId = roomData.id;
                console.log(`♻️ Usuario encontrado en sala existente: ${roomId}`);
                break;
            }

            // B) Si no, busco una sala en espera con hueco
            if (!roomId && roomData.status === 'WAITING' && players.length < 5) {
                roomId = roomData.id;
                // No hacemos break aún por si acaso está en otra sala más adelante
            }
        }

        // 2. SI NO HAY SALA, CREAR UNA NUEVA
        if (!roomId) {
            const uniqueId = uuidv4();
            roomId = `room:${uniqueId}`; // Usamos backticks para interpolar
            
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
            
            await redisClient.hSet(roomId, newRoom);
            console.log(`✨ Nueva sala creada: ${roomId}`);
        }

        // 3. GESTIÓN DE JUGADORES (EL FIX DEL SOCKET FANTASMA 👻)
        const roomKey = roomId;
        const roomData = await redisClient.hGetAll(roomKey);
        let players = JSON.parse(roomData.players || '[]');

        // Buscamos si el usuario ya existe en la lista
        const existingPlayerIndex = players.findIndex(p => p.uid === userId);

        if (existingPlayerIndex !== -1) {
            // 🔄 CASO RECONEXIÓN:
            // Actualizamos el socketId antiguo por el nuevo socket.id
            console.log(`🔄 Actualizando socket para ${userId}: ${players[existingPlayerIndex].socketId} -> ${socket.id}`);
            players[existingPlayerIndex].socketId = socket.id; 
            players[existingPlayerIndex].status = 'ACTIVE';    
        } else {
            // 🆕 CASO NUEVO JUGADOR:
            console.log(`➕ Añadiendo nuevo jugador ${userId}`);
            players.push({
                uid: userId,
                socketId: socket.id, // Guardamos el socket actual
                chips: 1000,         // Fichas iniciales
                seat: players.length, // Asignamos asiento secuencial
                status: 'ACTIVE',
                hand: null,          // Mano vacía al entrar
                bet: 0
            });
        }

        // 4. GUARDAR EN REDIS
        await redisClient.hSet(roomKey, 'players', JSON.stringify(players));

        // 5. UNIR EL SOCKET A LA SALA DE SOCKET.IO
        socket.join(roomId);
        socket.activeRoomId = roomId;

        // 6. NOTIFICAR AL FRONTEND
        
        // A) Evento personal para que Flutter cargue la pantalla
        socket.emit('joined_room', { 
            roomId: roomId,
            playerid: userId,
            players: players, // Enviamos la lista actualizada
            pot: roomData.pot,
            turn: parseInt(roomData.turn || 0)
        });

        // B) Evento para avisar al resto de la mesa
        socket.to(roomId).emit('player_joined', { 
            newPlayerId: userId,
            players: players 
        });

        console.log(`✅ Usuario ${userId} unido/actualizado en sala ${roomId}`);

    } catch (error) {
        console.error("❌ Error CRÍTICO en joinGame:", error);
        socket.emit('error', { message: 'Error interno del servidor al unirse.' });
    }
};

module.exports = { joinGame };