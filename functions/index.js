/* eslint-disable indent */
const { onRequest } = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const express = require("express");
const svix = require("svix");
const bodyParser = require("body-parser");
const stripe = require("stripe")(
  "sk_test_51O21FAAJTeML29ZUX4D4RHnYYCo228Gp9b6H0qmIIx4drlwefbIisckxJp3Fb38NQgySp4rrUFJpFcKnyvPUpmga00Mux827h8"
);
// process.env.STRIPE_SECRET_KEY

const endpointSecret = "whsec_5TjcVk1Ilnh7HeqyZyJEaDZgm6vrpfj2";
// process.env.STRIPE_ENDPOINT_SECRET;

const app = express();
admin.initializeApp({
  credential: admin.credential.cert("./credentials.json"),
});

const db = admin.firestore();

app.get("/hello-world", (req, res) => {
  return res.status(200).json({ message: "hello world" });
});

app.post("/api/product", async (req, res) => {
  const { productID, cartID, orderID, productName, description, price } =
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
  bodyParser.raw({ type: "application/json" }),
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
      const { id, ...attributes } = evt.data;
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
  }
);

app.get("/api/orders", async (req, res) => {
  try {
    const query = db.collection("orders");
    const querySnapshot = await query.get();
    const docs = querySnapshot.docs;

    const response = docs.map((doc) => ({
      id: doc.id,
      date: doc.data().date,
      productDelivery: doc.data().productDelivery,
      productImageURL: doc.data().productImageURL,
      productName: doc.data().productName,
      status: doc.data().status,
      total: doc.data().total,
    }));

    return res.status(200).json(response);
  } catch (err) {
    return res.status(400).json({
      error: err,
    });
  }
});

app.post(
  "/api/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
      const checkoutSessionCompleted = event.data.object;

      // date
      const datetime = new Date(checkoutSessionCompleted.created * 1000);
      const month = datetime.toLocaleString("en-US", { month: "short" });
      const day = datetime.getDate();
      const year = datetime.getFullYear();
      const date = `${month} ${day} ${year}`;

      // status
      const status = "Order placed";

      // productDelivery
      const customerDetails = checkoutSessionCompleted.customer_details;
      const address = customerDetails.address;
      const productDelivery = `${address.line1}, ${address.city} ${address.state}, ${address.postal_code}`;

      // total
      const total = checkoutSessionCompleted.amount_total / 100;

      // get checkout session
      const session = await stripe.checkout.sessions.listLineItems(
        checkoutSessionCompleted.id
      );

      // get product info from the checkout session
      const productId = session.data[0].price?.product;
      const product = await stripe.products.retrieve(productId);

      const productImageURL = product.images[0];
      const productName = product.name;

      await db.collection("orders").add({
        date,
        productDelivery,
        productImageURL,
        productName,
        status,
        total,
      });

      return res.status(200).json({
        message: "Order successfully placed!"
      })
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

exports.app = onRequest(app);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
