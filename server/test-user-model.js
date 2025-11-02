require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const MONGO_URI = process.env.MONGO_URI;

console.log("Testing User model...");

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    // Test creating a user
    try {
      const testUser = new User({
        userName: "testuser",
        userEmail: "test@example.com",
        password: "password123",
        role: "student",
      });

      await testUser.save();
      console.log("✅ User created successfully");

      // Test finding the user
      const foundUser = await User.findOne({ userEmail: "test@example.com" });
      if (foundUser) {
        console.log("✅ User found successfully");
        console.log("User data:", {
          userName: foundUser.userName,
          userEmail: foundUser.userEmail,
          role: foundUser.role,
        });

        // Test password comparison
        const isPasswordValid = await foundUser.comparePassword("password123");
        console.log(
          "✅ Password comparison:",
          isPasswordValid ? "Valid" : "Invalid"
        );

        // Clean up
        await User.deleteOne({ userEmail: "test@example.com" });
        console.log("✅ Test user cleaned up");
      } else {
        console.log("❌ User not found");
      }
    } catch (error) {
      console.error("❌ User model error:", error.message);
      console.error("Full error:", error);
    }

    // Test indexes
    const indexes = await mongoose.connection.db.collection("users").indexes();
    console.log(
      "✅ User collection indexes:",
      indexes.map((idx) => idx.name)
    );

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  });
