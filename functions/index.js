const { onRequest } = require("firebase-functions/v2/https");
//const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const express = require('express');

const app = express();
admin.initializeApp({
    credential: admin.credential.cert('./credentials.json')
})

const db = admin.firestore();

app.get('/hello-world', (req, res) => {
    return res.status(200).json({ message: 'hello world' })
})

app.post('/api/product', async (req, res) => {
    try {
        await db.collection('products')
            .doc('/' + req.body.id + '/')
            .create({ name: req.body.name })
        return res.status(204).json();
    } catch (err) {
        console.log(err)
        return res.status(500).send(err);
    }
})

exports.app = onRequest(app);


// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
