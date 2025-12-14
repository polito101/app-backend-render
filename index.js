require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const { createClient } = redis;
const dataRoutes = require('./routes/dataRoutes');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    }),
});
const firebaseAdmin = admin;

const redisClient = createClient({
    url: process.env.REDIS_URL,
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => {
    console.log('Conectado a Redis');
}).catch((err) => {
    console.error('Error al conectar a Redis:', err);
});

app.use('/api', dataRoutes);

app.get('/', (req, res) => {
    res.send('API de almacenamiento de datos con Redis y Firebase Auth');
});
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
module.exports = { firebaseAdmin, redisClient };