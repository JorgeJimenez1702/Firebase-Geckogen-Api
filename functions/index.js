/* eslint-disable indent */
const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const express = require("express");
const svix = require("svix");
const bodyParser = require("body-parser");

const app = express();
admin.initializeApp({
  credential: admin.credential.cert("./credentials.json"),
});

const db = admin.firestore();

app.get("/hello-world", (req, res) => {
  return res.status(200).json({message: "hello world"});
});

app.post("/api/product", async (req, res) => {
  const {productID, cartID, orderID, productName, description, price} =
    req.body;

  try {
    await db
      .collection("products")
      .doc("/" + productID + "/")
      .create({
        cartID,
        orderID,
        productName,
        description,
        price,
      });
    return res.status(200).json({
      message: "product created successfully",
    });
  } catch (err) {
    return res.status(500).json({
      err: err.message,
    });
  }
});

app.post("/api/user", async (req, res) => {
  const {
    userID,
    cartID,
    subscriptionID,
    name,
    email,
    password,
    city,
    state,
    country,
    address,
    zipcode,
  } = req.body;
  try {
    await db
      .collection("users")
      .doc("/" + userID + "/")
      .create({
        cartID,
        subscriptionID,
        name,
        email,
        password,
        city,
        state,
        country,
        address,
        zipcode,
      });
    return res.status(200).json({
      message: "user created successfully",
    });
  } catch (err) {
    return res.status(500).json({
      err: err.message,
    });
  }
});

app.post(
  "/api/webhook",
  bodyParser.raw({type: "application/json"}),
  async (req, res) => {
    try {
      const secret = "whsec_Jh64iasLgfiGLM56qqDefwgi53XwGy/n";
      const payloadString = JSON.stringify(req.body);
      const svixHeaders = req.headers;
      // {
      //   "svix-id": req.headers["svix-id"],
      //   "svix-timestamp": req.headers["svix-timestamp"],
      //   "svix-signature": req.headers["svix-signature"],
      // };
      console.log(svixHeaders);
      console.log(payloadString);

      const wh = new svix.Webhook(secret);
      // console.log(wh);
      const evt = wh.verify(payloadString, svixHeaders);
      // console.log(evt);
      const {id, ...attributes} = evt.data;
      // Handle the webhooks
      const eventType = evt.type;
      if (eventType === "user.created") {
        console.log(`User ${id} was ${eventType}`);
        console.log(attributes);

        await db
          .collection("users")
          .doc("/" + id + "/")
          .create({
            firstName: attributes.first_name,
            lastName: attributes.last_name,
            emailAddress: attributes.email_addresses[0].email_address,
          });
      }
      res.status(200).json({
        success: true,
        message: "Webhook received",
        attributes,
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
);

exports.app = onRequest(app);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
