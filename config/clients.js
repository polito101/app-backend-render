const admin = require('firebase-admin');
const { createClient} = require('redis');

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

redisClient.on('error', err => console.error('Redis Client Error', err));

const redisConnectPromise = redisClient.connect().then(() => {
    console.log('Conectado a Redis');
}).catch((err) => {
    console.error('Error al conectar a Redis:', err);
});

module.exports = { firebaseAdmin, redisClient, redisConnectPromise };