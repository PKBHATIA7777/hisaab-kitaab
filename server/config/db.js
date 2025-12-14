const mongoose = require("mongoose");

async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined in .env");
    }

    await mongoose.connect(mongoUri, {
      // options are optional in latest mongoose, but safe to keep basic ones
    });

    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
