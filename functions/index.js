/* eslint-disable indent */
const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const express = require("express");
const svix = require("svix");
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// process.env.STRIPE_SECRET_KEY
const cors = require("cors");

const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;
// process.env.STRIPE_ENDPOINT_SECRET;

const allowedOrigins = ["https://geckogen-web-app.vercel.app/"];

const app = express();
app.use(
  cors({
    origin: allowedOrigins,
  }),
);

admin.initializeApp({
  credential: admin.credential.cert("./credentials.json"),
});

const db = admin.firestore();

app.get("/hello-world", (req, res) => {
  return res.status(200).send({message: "hello world from cors"});
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
    return res.status(200).send({
      message: "product created successfully",
    });
  } catch (err) {
    return res.status(500).send({
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
    return res.status(200).send({
      message: "user created successfully",
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message,
    });
  }
});

app.post(
  "/api/webhook/clerk",
  bodyParser.raw({type: "application/json"}),
  async (req, res) => {
    try {
      const secret = process.env.CLERK_WEBHOOK_SECRET_KEY;
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
      res.status(200).send({
        success: true,
        message: "Webhook received",
        attributes,
      });
    } catch (err) {
      res.status(400).send({
        success: false,
        message: err.message,
      });
    }
  },
);

app.get("/api/orders/:userID", async (req, res) => {
  try {
    const userID = req.params.userID;

    const ordersSnapshot = await db
      .collection("orders")
      .where("userID", "==", userID)
      .get();
    const orders = [];

    ordersSnapshot.forEach((doc) => {
      orders.push({
        id: doc.id,
        date: doc.data().date,
        productDelivery: doc.data().productDelivery,
        productImageURL: doc.data().productImageURL,
        productName: doc.data().productName,
        status: doc.data().status,
        total: doc.data().total,
      });
    });
    console.log("send orders");

    return res.status(200).send(orders);
  } catch (err) {
    return res.status(400).send({
      error: err.message,
    });
  }
});

app.post(
  "/api/webhook/stripe",
  express.raw({type: "application/json"}),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
      const checkoutSessionCompleted = event.data.object;

      // client reference id (clerk user id)
      const userID = checkoutSessionCompleted.client_reference_id;

      // date
      const datetime = new Date(checkoutSessionCompleted.created * 1000);
      const month = datetime.toLocaleString("en-US", {month: "short"});
      const day = datetime.getDate();
      const year = datetime.getFullYear();
      const date = `${month} ${day} ${year}`;

      // status
      const status = "Order placed";

      // productDelivery
      const customerDetails = checkoutSessionCompleted.customer_details;
      const address = customerDetails.address;
      const productDelivery = `${address.line1}, ${address.city} 
                               ${address.state}, ${address.postal_code}`;

      // total
      const total = checkoutSessionCompleted.amount_total / 100;

      // get checkout session
      const session = await stripe.checkout.sessions.listLineItems(
        checkoutSessionCompleted.id,
      );

      // get product info from the checkout session
      const productId = session.data[0].price.product;
      const product = await stripe.products.retrieve(productId);

      const productImageURL = product.images[0];
      const productName = product.name;

      await db.collection("orders").add({
        userID,
        date,
        productDelivery,
        productImageURL,
        productName,
        status,
        total,
      });

      return res.status(200).send({
        message: "Order successfully placed!",
      });
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  },
);

app.get("/api/users/:user_id", async (req, res) => {
  try {
    const doc = db.collection("users").doc(req.params.user_id);
    const item = await doc.get();
    const response = item.data();

    return res.status(200).send(response);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.put("/api/users/:user_id", async (req, res) => {
  const {
    firstName,
    lastName,
    emailAddress,
    phoneNumber,
    state,
    country,
    city,
    zipcode,
    address,
  } = req.body;

  try {
    const document = db.collection("users").doc(req.params.user_id);
    await document.update({
      firstName,
      lastName,
      emailAddress,
      phoneNumber,
      state,
      country,
      city,
      zipcode,
      address,
    });
    return res.status(200).send(req.body);
  } catch (error) {
    console.log(error);
    return res.status(500).send(error.message);
  }
});

app.post("/api/mygeckos", async (req, res) => {
  const {userId, name, specimen, weight, sex, birth} = req.body;
  const dateObject = new Date(birth);
  try {
    await db.collection("mygeckos").doc().create({
      userId,
      name,
      specimen,
      weight,
      sex,
      dateObject,
    });
    return res.status(200).send({
      message: "mygecko created successfully",
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message,
    });
  }
});

app.get("/api/mygeckos/:userID", async (req, res) => {
  const userID = req.params.userID;
  try {
    const query = await db
      .collection("mygeckos")
      .where("userId", "==", userID)
      .get();

    const doc = query.docs;

    const response = doc.map((doc) => ({
      userId: doc.userId,
      name: doc.data().name,
      specimen: doc.data().specimen,
      weight: doc.data().weight,
      sex: doc.data().sex,
      dateObject: doc.data().dateObject,
    }));
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.post("/api/terrariums", async (req, res) => {
  try {
    await db.collection("terrariums").doc().create({
      id: req.body.id,
      Name: req.body.name,
      Humidity: req.body.humidity,
      Light_Cycle: req.body.light_cycle,
      Oxigenation: req.body.oxigenation,
      Temperature: req.body.temperature,
    });

    return res.status(204).json();
  } catch (error) {
    console.log(error);
    return res.status(500).send(error);
  }
});

app.get("/api/terrariums/", async (req, res) => {
  try {
    const query = db.collection("terrariums");
    const querySnapshot = await query.get();
    const docs = querySnapshot.docs;

    const response = docs.map((doc) => ({
      id: doc.data().id,
      Name: doc.data().Name,
      Humidity: doc.data().Humidity,
      Light_Cycle: doc.data().Light_Cycle,
      Oxigenation: doc.data().Oxigenation,
      Temperature: doc.data().Temperature,
    }));

    return res.status(200).json(response);
  } catch (error) {
    console.log(error);
    return res.status(500).send(error);
  }
});

exports.api = onRequest(app);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
