const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SK);

app.use(cors())
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vmux1xo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log('inside err', err)
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        const categoriesCollection = client.db("recycleZone").collection("categories");
        const productsCollection = client.db("recycleZone").collection("products");
        const usersCollection = client.db("recycleZone").collection("users");
        const ordersCollection = client.db("recycleZone").collection("orders");
        const reportedItemsCollection = client.db("recycleZone").collection("reportedItems");
        const paymentsCollection = client.db("recycleZone").collection("payments");

        // token 
        app.post('/jwt', async (req, res) => {
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN, { expiresIn: '1d' })
            res.send({ token })
        })

        // for stripe payment
        app.post('/create-payment-intent', async (req, res) => {
            const price = req.body.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                "payment_method_types": [
                    "card"
                ],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        // for paid products
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);

            const option = { upsert: true }
            const query1 = { _id: ObjectId(payment.orderId) }
            const updateOrder = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updateOrderCollection = await ordersCollection.updateOne(query1, updateOrder, option)

            const query2 = { _id: ObjectId(payment.productId) }
            const updateProduct = {
                $set: {
                    status: 'sold'
                }
            }

            const updateProductCollection = await productsCollection.updateOne(query2, updateProduct, option)

            res.send(result)
        })

        // loading all categories
        app.get('/categories', async (req, res) => {
            const query = {};
            const result = await categoriesCollection.find(query).toArray();
            res.send(result)
        })

        // loading single category with products
        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                category_id: id,
                status: 'unsold'
            };
            const result = await productsCollection.find(query).toArray();
            res.send(result)
        })

        // get the users through role
        app.get('/users', async (req, res) => {
            const query = { role: req.query.role };
            const result = await usersCollection.find(query).toArray();
            res.send(result)
        });

        // checking a user if admin or not
        app.get('/users/admin/:email', async (req, res) => {
            const query = { email: req.params.email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' })
        })

        // checking a user if seller or not
        app.get('/users/seller/:email', async (req, res) => {
            const query = { email: req.params.email };
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' })
        })

        // getting a certain user by email
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const result = await usersCollection.findOne(query);
            res.send(result)
        })

        // saving a new user
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        // saving a new user with google
        app.put('/users', async (req, res) => {
            const user = req.body;
            const updatedDoc = {
                $set: {
                    role: 'buyer',
                }
            }
            const option = { upsert: true }
            const result = await usersCollection.updateOne(user, updatedDoc, option);
            res.send(result)
        })

        // verify seller
        app.put('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const isVerified = req.body.isVerified;
            const updatedDoc = {
                $set: {
                    isVerified: isVerified,
                }
            }
            console.log(id, isVerified)
            const option = { upsert: true }
            const result = await usersCollection.updateOne(query, updatedDoc, option);
            res.send(result)
        })

        // deleting a user 
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result)
        })

        // adding order from product list in the client site to database
        app.post("/orders", async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order)
            res.send(result)
        })

        // getting all orders of a buyer
        app.get('/orders', async (req, res) => {
            const query = { email: req.query.email };
            const result = await ordersCollection.find(query).toArray();
            res.send(result)
        })


        // getting all buyers of a seller
        app.get('/orders/buyers', async (req, res) => {
            const query = { seller_email: req.query.email };
            const result = await ordersCollection.find(query).toArray();
            res.send(result)
        })

        // get a order for payment
        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.findOne(query);
            res.send(result)
        })


        // getting all products of a seller
        app.get('/products', async (req, res) => {
            const query = { seller_email: req.query.email }
            const result = await productsCollection.find(query).toArray();
            res.send(result)
        })

        // getting all products which are advertised
        app.get('/products/isAdvertised', async (req, res) => {
            const query = {
                isAdvertised: true,
                status: 'unsold'
            }
            const result = await productsCollection.find(query).toArray();
            res.send(result)
        })

        // adding new product 
        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result)
        })

        // advertise product
        app.put('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const isAdvertised = req.body.isAdvertised;
            const updatedDoc = {
                $set: {
                    isAdvertised: isAdvertised,
                }
            }
            const option = { upsert: true }
            const result = await productsCollection.updateOne(query, updatedDoc, option);
            res.send(result)
        })

        // deleting a product
        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(query);
            res.send(result)
        })

        // adding reported items
        app.put('/reportedItems', async (req, res) => {
            const product = req.body;
            const updatedDoc = {
                $set: {
                    reportedBy: 'buyer',
                }
            }
            const option = { upsert: true }
            const result = await reportedItemsCollection.updateOne(product, updatedDoc, option);
            res.send(result)
        })

        // getting all reported items
        app.get('/reportedItems', async (req, res) => {
            const query = {}
            const result = await reportedItemsCollection.find(query).toArray();
            res.send(result)
        })

        // deleting a reported product
        app.delete('/reportedItems/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await reportedItemsCollection.deleteOne(query);
            res.send(result)
        })

    }
    finally {

    }
}
run().catch(err => console.log(err.name, err.message))



app.get('/', (req, res) => {
    res.send('Recycle zone server is running')
})

app.listen(port, () => {
    console.log('This server is running on port:', port)
})