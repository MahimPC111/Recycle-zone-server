const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors())
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vmux1xo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const categoriesCollection = client.db("recycleZone").collection("categories");
        const productsCollection = client.db("recycleZone").collection("products");
        const usersCollection = client.db("recycleZone").collection("users");
        const ordersCollection = client.db("recycleZone").collection("orders");

        app.get('/categories', async (req, res) => {
            const query = {};
            const result = await categoriesCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category_id: id };
            const result = await productsCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const result = await usersCollection.findOne(query);
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

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

        app.post("/orders", async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order)
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