const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { redisClient } = require('../config/clients');

// Ruta protegida para obtener datos
router.post('/data', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { key, value } = req.body;

        if (!key || !value) {
            return res.status(400).send({ error: 'Faltan parámetros: key y value son requeridos.' });
        }
        //Clave única por usuario
        const redisKey = `user:${userId}:${key}`;
        //Guardar datos en Redis (3600 segundos = 1 hora)
        await redisClient.set(redisKey, value, { EX: 3600 });

        return res.status(200).send({ message: 'Datos guardados exitosamente.' });
    } catch (error) {
        console.error('Error al guardar datos en Redis:', error);
        return res.status(500).send({ error: 'Error interno del servidor.' });
    }
});

router.get('/status', (req, res) => {
    const status = redisClient.isReady ? 'connected' : 'disconnected';
    res.status(200).send({ redisStatus: status });
});

module.exports = router;