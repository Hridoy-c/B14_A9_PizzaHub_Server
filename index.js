import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';


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

app.get("/api/pizzas", async (req, res) => {
  try {
    const result = await pizzasCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


app.get("/api/pizza/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ID টা বৈধ ObjectId কিনা আগে যাচাই করুন
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid item id" });
    }

    const result = await pizzasCollection.findOne({ _id: new ObjectId(id) });

    if (!result) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


app.post("/api/pizzas", async (req, res) => {
  try {
    const pizza = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await pizzasCollection.insertOne(pizza);

    res.status(201).json({
      success: true,
      message: "Pizza created",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


export default app;