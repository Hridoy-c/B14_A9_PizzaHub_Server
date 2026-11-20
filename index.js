import express from "express";
import "dotenv/config";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";

const app = express();
const port = process.env.PORT || 8000;

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
const db = connection.db("Pizza_hub");
const usersCollection = db.collection("users");
const menuItemsCollection = db.collection("menuItems");
const ordersCollection = db.collection("orders");
const transactionsCollection = db.collection("transactions");

const MENU_STATUSES = ["pending", "approved", "rejected", "inactive"];

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/users", async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

app.get("/api/menu", async (req, res) => {
  try {
    const { q, category, location } = req.query;

    const query = { status: "approved" };

    if (typeof q === "string" && q.trim()) {
      query.name = { $regex: escapeRegex(q.trim()), $options: "i" };
    }

    if (typeof category === "string" && category) {
      query.category = category;
    }

    if (typeof location === "string" && location) {
      query.location = location;
    }

    const items = await menuItemsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(items);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get("/api/menu/vendor/:vendorId", async (req, res) => {
  try {
    const items = await menuItemsCollection
      .find({ vendorId: req.params.vendorId, status: "approved" })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(items);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/menu/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid item id" });
    }

    const result = await menuItemsCollection.findOne({
      _id: new ObjectId(id),
      status: "approved",
    });

    if (!result) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/menu", async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      price,
      location,
      image,
      images,
      vendorId,
      vendorName,
      vendorEmail,
      vendorImage,
    } = req.body || {};

    if (!name || !category || price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        message: "Name, category and price are required",
      });
    }

    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid positive number",
      });
    }

    const imageList = Array.isArray(images) ? images : [];

    const pizza = {
      name,
      category,
      description: description ?? "",
      price: numericPrice,
      location: location ?? "",
      image: image || imageList[0] || "",
      images: imageList,
      vendorId: vendorId ?? "",
      vendorName: vendorName ?? "",
      vendorEmail: vendorEmail ?? "",
      vendorImage: vendorImage ?? null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await menuItemsCollection.insertOne(pizza);

    return res.status(201).json({
      success: true,
      message: "Pizza created, pending approval",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Create menu error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/api/vendor/menu", async (req, res) => {
  try {
    const { vendorId } = req.query;
    const query = vendorId ? { vendorId } : {};

    const items = await menuItemsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(items);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/admin/menu", async (req, res) => {
  try {
    const { status } = req.query;

    if (status && !MENU_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const query = status ? { status } : {};

    const items = await menuItemsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(items);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/admin/menu/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: `Invalid item id: ${id}` });
    }

    const result = await menuItemsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Menu item not found" });
    }

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;