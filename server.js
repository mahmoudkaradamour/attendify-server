const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connectDB } = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

let db;

// ✅ تشغيل السيرفر + اتصال DB
connectDB().then(database => {
  db = database;

  app.listen(3000, () => {
    console.log("🚀 Server running on port 3000");
  });
});

// =========================
// ✅ Routes
// =========================

// ✅ اختبار
app.get("/", (req, res) => {
  res.json({ message: "Attendify Backend Running 🚀" });
});

// ✅ تسجيل شركة
app.post("/register-company", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Missing data" });
    }

    const existing = await db.collection("companies").findOne({ name });

    if (existing) {
      return res.status(409).json({ message: "Company exists" });
    }

    const company = {
      id: crypto.randomUUID(),
      name,
      email,
      apiKey: crypto.randomUUID(),
      createdAt: new Date()
    };

    await db.collection("companies").insertOne(company);

    res.json({
      success: true,
      company
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});