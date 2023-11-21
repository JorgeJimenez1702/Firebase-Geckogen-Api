const { RuleTester } = require('eslint');
const { Router } = require('express')
const router = Router();

const admin = require("firebase-admin");

const db = admin.firestore();

router.post("/api/terrariums", async (req, res) => {
    try {
        await db
            .collection("terrariums")
            .doc("/" + req.body.id + "/")
            .create({
                Name: req.body.name,
                Humidity: req.body.humidity,
                Light_Cycle: req.body.light_cycle,
                Oxigenation: req.body.oxigenation,
                Temperature: req.body.temperature
            })

        return res.status(204).json();
    } catch (error) {
        console.log(error);
        return res.status(500).send(error);
    }
});

router.get("/api/terrariums/", async (req, res) => {
    try {
        const query = db.collection("terrariums");
        const querySnapshot = await query.get();
        const docs = querySnapshot.docs;

        const response = docs.map((doc) => ({
            id: doc.id,
            Name: doc.data().Name,
            Humidity: doc.data().Humidity,
            Light_Cycle: doc.data().Light_Cycle,
            Oxigenation: doc.data().Oxigenation,
            Temperature: doc.data().Temperature
        }));

        return res.status(200).json(response);
    } catch (error) {
        console.log(error)
        return res.status(500).send(error);
    }
});

router.delete("/api/terrariums/:terrarium_id", async (req, res) => {
    try {
        
        const document = db.collection('terrariums').doc(req.params.terrarium_id);
        await document.delete();
        return res.status(200).json();
    } catch (error) {
        console.log(error);
        return res.status(500).json();
    }
});

router.put("/api/terrariums/:terrarium_id", async (req, res) => {
    const {
        id,
        name,
        humidity,
        light_cycle,
        oxigenation,
        temperature
    } = req.body
    
    try {
        const document = db.collection('terrariums').doc(req.params.terrarium_id)
        document.update({
            id: id,
            Name: name,
            Humidity: humidity,
            Light_Cycle: light_cycle,
            Oxigenation: oxigenation,
            Temperature: temperature
        })
        return res.status(200).json(req.body);
    } catch (error) {
        console.log(error);
        return res.status(500).json;
    }
});

module.exports = router;