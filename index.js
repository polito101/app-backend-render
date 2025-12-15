const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');


const dataRoutes = require('./routes/dataRoutes');
// 💡 Importamos la configuración para inicializar las promesas de conexión
const { redisConnectPromise } = require('./config/clients');
const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', dataRoutes);
app.get('/', (req, res) => {
  res.send('BACKEND CORRIENDO CORRECTAMENTE');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://testdezero.firebaseapp.com/',
    methods: ['GET', 'POST'],
  },
});

//socket == usuario
io.on('connection', (socket) => {
  console.log('✅✅Nuevo usuario conectado con ID:', socket.id);

  socket.on('disconnect', () => {
    console.log('Adiós, usuario desconectado id:', socket.id);
  });
});

// 💡 Esperamos a que la conexión a Redis esté lista antes de iniciar el servidor
redisConnectPromise.then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor EXPRESS y Socket.IO en puerto: ${PORT}`);
  });
});

module.exports = { io };