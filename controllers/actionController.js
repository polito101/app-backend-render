const handleAction = async (io, socket, redisClient, actionData) => {
    const { action, amount } = actionData; // action: 'fold' | 'check' | 'bet' | 'call'
    const roomId = socket.activeRoomId;
    const userId = socket.uid;

    if (!roomId) return;

    try {
        const roomKey = roomId;
        const roomData = await redisClient.hGetAll(roomKey);
        let players = JSON.parse(roomData.players || '[]');

        // Identificar al jugador actual
        const playerIndex = players.findIndex(p => p.uid === userId);
        const player = players[playerIndex];

        if (!player) return socket.emit('error', { message: 'Jugador no encontrado' });

        // VALIDACIÓN: ¿Es su turno?
        // El turno en Redis lo guardamos como un número (índice del array)
        const currentTurnIndex = parseInt(roomData.turn);

        // Comprobación de seguridad: ¿Está intentando jugar fuera de turno?
        if (player.seat !== currentTurnIndex && playerIndex !== currentTurnIndex) {
            return socket.emit('error', { message: '¡No es tu turno!' });
        }

        console.log(`🕹️ Acción de ${userId}: ${action} (${amount || 0})`);

        // PROCESAR LA ACCIÓN
        switch (action) {
            case 'fold':
                player.status = 'FOLDED';
                player.hand = null;
                break;

            case 'check':
                // En póker real, solo puedes hacer check si no hay apuestas pendientes.
                // Por ahora lo permitimos siempre para simplificar.
                player.status = 'CHECK';
                break;

            case 'call':
                // Lógica simplificada: Igualar la apuesta más alta (High Bet)
                // Aquí necesitaríamos guardar el 'currentHighBet' en la sala.
                // Por ahora asumimos que call es poner 0 fichas extra si no hay apuestas.
                player.status = 'CALL';
                break;

            case 'bet':
            case 'raise':
                const betAmount = parseInt(amount || 0);
                if (player.chips < betAmount) {
                    return socket.emit('error', { message: 'No tienes suficientes fichas' });
                }
                player.chips -= betAmount;
                player.bet = (player.bet || 0) + betAmount; // Acumular apuesta de la ronda

                // Actualizar Bote Global
                let currentPot = parseInt(roomData.pot || 0);
                currentPot += betAmount;
                roomData.pot = currentPot.toString();

                player.status = 'BET';
                break;
        }

        // CALCULAR SIGUIENTE TURNO (Lógica Circular)
        // Buscamos el siguiente asiento que NO esté 'FOLDED' ni 'BUSTED' (eliminado)
        let nextTurnIndex = currentTurnIndex;
        let loopCount = 0;

        do {
            nextTurnIndex = (nextTurnIndex + 1) % players.length;
            loopCount++;
        } while (
            (players[nextTurnIndex].status === 'FOLDED' || players[nextTurnIndex].status === 'BUSTED')
            && loopCount < players.length
        );

        // Actualizamos el array de jugadores con los cambios
        players[playerIndex] = player;

        // GUARDAR EN REDIS
        await redisClient.hSet(roomKey, {
            players: JSON.stringify(players),
            pot: roomData.pot,
            turn: nextTurnIndex.toString()
        });

        // NOTIFICAR A TODOS
        // Enviamos el estado actualizado.
        // Importante: Volvemos a ocultar las manos de los rivales
        io.to(roomId).emit('game_update', {
            pot: roomData.pot,
            turn: nextTurnIndex,
            players: players.map(p => ({ ...p, hand: null })), // Información pública
            lastAction: { player: player.seat, action: action } // Para animaciones
        });

        // Solo al jugador que actuó le enviamos sus datos actualizados (fichas)
        socket.emit('player_update', { chips: player.chips, seat: player.seat });

    } catch (error) {
        console.error('Error en handleAction:', error);
    }
};

module.exports = handleAction;