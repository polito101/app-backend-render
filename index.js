require('dotenv').config();
const express = require('express');
const redis = require('redis');
const admin = require('firebase-admin');
const cors = require('cors');

// 1. Configurar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Esto es CLAVE: Reemplazar saltos de línea para que funcione con la variable de entorno
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

// 2. Conectar Redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});
redisClient.on('connect', () => console.log('Redis conectado.'));
redisClient.on('error', (err) => console.error('Redis Error:', err));
redisClient.connect();

const app = express();
app.use(cors());
app.use(express.json());

// 3. Middleware de Autenticación REST
const verifyToken = async (req, res, next) => {
  // Espera el token en el formato "Bearer [token]"
  const token = req.headers.authorization?.split('Bearer ')[1]; 
  
  if (!token) return res.status(401).send('Token requerido');

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Guardamos info del usuario (email, uid, etc.)
    next();
  } catch (error) {
    console.error("Error de verificación de token:", error);
    return res.status(403).send('Token inválido o expirado');
  }
};

// 4. Rutas
app.get('/', (req, res) => res.send('Backend REST con Firebase Auth y Redis Funcionando 🚀'));

// Ruta Protegida: Escribe en Redis usando el UID del usuario
app.post('/api/data', verifyToken, async (req, res) => {
  const { key, value } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: "Faltan 'key' o 'value' en el cuerpo." });
  }

  try {
    // Clave única basada en el usuario para evitar conflictos
    const userKey = `${req.user.uid}:${key}`; 
    await redisClient.set(userKey, value);
    res.json({ success: true, message: `Guardado en Redis para ${req.user.email}` });
  } catch (error) {
    console.error("Error al escribir en Redis:", error);
    res.status(500).json({ error: "Fallo interno al procesar la petición." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));