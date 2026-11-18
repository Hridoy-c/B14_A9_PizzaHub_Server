import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { MongoClient } from 'mongodb';


const app = express();
const port = process.env.PORT || 3000;
const client = new MongoClient(process.env.MONGODB_URI);


app.use(cors());
app.use(express.json());




export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connection = await connectToMongoDB();
const db= connection.db("Pizza_hub");
const usersCollection = db.collection("user");
const pizzasCollection = db.collection("pizzas");
const ordersCollection = db.collection("orders");





app.get('/', (req, res) => {
    res.send('Hello World!');
});


// users related apis
app.get('/users', async (req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
});





// pizzas related apis
app.post('/pizzas/new', async (req, res) => {
    const newPizza = req.body;
    const result = await pizzasCollection.insertOne(newPizza);
    res.send(result);
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
