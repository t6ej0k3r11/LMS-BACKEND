require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

console.log("Testing MongoDB connection...");
console.log("MONGO_URI:", MONGO_URI ? "Set" : "Not set");

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    return mongoose.connection.db.admin().ping();
  })
  .then(() => {
    console.log("✅ Database ping successful");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  });
