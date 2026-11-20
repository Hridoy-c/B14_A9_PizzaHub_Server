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

// users relatad api

app.get("/users", async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// menu relatad api
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



// orders relatad api


app.post("/api/orders", async (req, res) => {
  try {
    const { itemId, customerId, deliveryDate, deliveryAddress, message } =
      req.body;

    if (!ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid item id" });
    }
    if (!customerId) {
      return res.status(400).json({ success: false, message: "Missing customer" });
    }

    const date = new Date(deliveryDate);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid delivery date" });
    }
    if (!deliveryAddress || !String(deliveryAddress).trim()) {
      return res.status(400).json({ success: false, message: "Delivery address is required" });
    }

    const item = await menuItemsCollection.findOne({
      _id: new ObjectId(itemId),
      status: "approved",
    });
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const order = {
      itemId: item._id,
      vendorId: item.vendorId,
      customerId,
      deliveryDate: date,
      deliveryAddress: String(deliveryAddress).trim(),
      message: String(message || "").trim(),
      status: "pending", // pending | accepted | rejected | cancelled
      createdAt: new Date(),
    };

    const result = await ordersCollection.insertOne(order);

    res.status(201).json({
      success: true,
      message: "Order placed",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/orders/customer/:customerId", async (req, res) => {
  try {
    const orders = await ordersCollection
      .aggregate([
        { $match: { customerId: req.params.customerId } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "menuItems",
            localField: "itemId",
            foreignField: "_id",
            as: "item",
          },
        },
        { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            itemId: 1,
            vendorId: 1,
            customerId: 1,
            deliveryDate: 1,
            deliveryAddress: 1,
            message: 1,
            status: 1,
            createdAt: 1,
            "item.name": 1,
            "item.image": 1,
            "item.images": 1,
            "item.price": 1,
            "item.category": 1,
            "item.vendorName": 1,
          },
        },
      ])
      .toArray();

    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/orders/vendor/:vendorId", async (req, res) => {
  try {
    const orders = await ordersCollection
      .aggregate([
        { $match: { vendorId: req.params.vendorId } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "menuItems",
            localField: "itemId",
            foreignField: "_id",
            as: "item",
          },
        },
        { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            customerObjectId: {
              $convert: {
                input: "$customerId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "user",
            localField: "customerObjectId",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            itemId: 1,
            vendorId: 1,
            customerId: 1,
            deliveryDate: 1,
            deliveryAddress: 1,
            message: 1,
            status: 1,
            createdAt: 1,
            "item.name": 1,
            "item.image": 1,
            "item.images": 1,
            "item.price": 1,
            "item.category": 1,
            "customer.name": 1,
            "customer.email": 1,
            "customer.image": 1,
          },
        },
      ])
      .toArray();

    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, vendorId } = req.body; // accepted | rejected

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (!vendorId) {
      return res.status(400).json({ success: false, message: "Missing vendor" });
    }

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(id), vendorId, status: "pending" },
      { $set: { status, updatedAt: new Date() } },
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found or already handled" });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Edit
app.patch("/api/menu/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid item id" });
    }
    const _id = new ObjectId(req.params.id);

    const { name, description, price } = req.body;
    const update = { updatedAt: new Date() };

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, message: "Name is required" });
      }
      update.name = String(name).trim();
    }
    if (description !== undefined) {
      if (!String(description).trim()) {
        return res.status(400).json({ success: false, message: "Description is required" });
      }
      update.description = String(description).trim();
    }
    if (price !== undefined) {
      if (!(Number(price) > 0)) {
        return res.status(400).json({ success: false, message: "Price must be greater than 0" });
      }
      update.price = Number(price);
    }

    const result = await menuItemsCollection.updateOne({ _id }, { $set: update });
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.json({ success: true, message: "Item updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete
app.delete("/api/menu/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid item id" });
    }

    const result = await menuItemsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.json({ success: true, message: "Item deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;