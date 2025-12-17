const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

// 1. CORRECCIÓN: Importar también startGame
const { joinGame, startGame } = require('./controllers/gameController');

const dataRoutes = require('./routes/dataRoutes');
const { redisConnectPromise, redisClient } = require('./config/clients');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', dataRoutes);

app.get('/', (req, res) => {
  res.send('BACKEND CORRIENDO CORRECTAMENTE');
});

// Creación del servidor HTTP compartido
const server = http.createServer(app);

// Configuración de Socket.IO
const io = new Server(server, {
  cors: {
    // 💡 CONSEJO: Para probar desde Flutter/Móvil, usa "*" temporalmente.
    // Los móviles no siempre envían el origen 'firebaseapp'.
    origin: "*", 
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  // Aseguramos que el UID esté disponible (si usaste el middleware, si no, manéjalo aquí)
  socket.uid = socket.handshake.auth.token || 'anonimo';
  
  console.log('✅✅ Nuevo usuario conectado:', socket.id, 'UID:', socket.uid);

  // 2. CORRECCIÓN: Usar 'join_game' para coincidir con Flutter
  socket.on('join_game', () => {
    joinGame(io, socket, redisClient);
  });

  socket.on('start_game', () => {
    startGame(io, socket, redisClient);
  });

  socket.on('disconnect', () => {
    console.log('Adiós, usuario desconectado id:', socket.id);
  });
});

// Esperamos a Redis y arrancamos el servidor
redisConnectPromise.then(() => {
  
  // 3. CORRECCIÓN CRÍTICA: Usar server.listen, NO app.listen
  server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP y Socket.IO corriendo en puerto: ${PORT}`);
  });

}).catch(err => {
    console.error("Fallo al conectar a Redis:", err);
});

module.exports = { io };