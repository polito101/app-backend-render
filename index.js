const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

redisConnectPromise.then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}.catch ((error) => {
  console.error('No se pudo iniciar el servidor debido a un error de conexión a Redis:', err);
  console.error(message);
  process.exit(1);
} ));