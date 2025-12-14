const e = require('express');

const admin = require('./../index').firebaseAdmin;

const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        if (!token || !token.startsWith('Bearer ')) {
            return res.status(401).send({ error: 'Acceso denegado. No hay token proporcionado.' });
        }

        const idToken = token.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Error al verificar el token:', error);
        return res.status(401).send({ error: 'Token inválido o expirado.' });
    }
};

module.exports = { verifyToken };
