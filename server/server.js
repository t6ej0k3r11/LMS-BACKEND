require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

// Debug: Check environment variables
console.log("JWT_SECRET set:", !!process.env.JWT_SECRET);
console.log("JWT_REFRESH_SECRET set:", !!process.env.JWT_REFRESH_SECRET);
console.log("MONGO_URI set:", !!process.env.MONGO_URI);

// Routes
const authRoutes = require("./routes/auth-routes/index");
const mediaRoutes = require("./routes/instructor-routes/media-routes");
const instructorCourseRoutes = require("./routes/instructor-routes/course-routes");
const instructorQuizRoutes = require("./routes/instructor-routes/quiz-routes");
const studentViewCourseRoutes = require("./routes/student-routes/course-routes");
const studentViewOrderRoutes = require("./routes/student-routes/order-routes");
const studentCoursesRoutes = require("./routes/student-routes/student-courses-routes");
const studentCourseProgressRoutes = require("./routes/student-routes/course-progress-routes");
const studentQuizRoutes = require("./routes/student-routes/quiz-routes");

const app = express();

// =========================
// 🔧 Basic Configuration
// =========================
const PORT = parseInt(process.env.PORT, 10) || 5000;
const MONGO_URI = process.env.MONGO_URI;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// =========================
// 🧩 Middleware
// =========================
app.use(
  cors({
    origin: [
      "*",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5177",
      "http://localhost:5178",
      "https://lms-rho-swart.vercel.app",
      "https://lms-frontend-omega-sepia.vercel.app",
      "https://lms-frontend-lobm3ytwu-jawaadhossain42-9416s-projects.vercel.app",
    ],
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// =========================
// 🗄️ Database Connection
// =========================
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error.message);
    // Don't exit process, just log the error
  });

// =========================
// 🚏 Routes
// =========================
app.use("/auth", authRoutes);
app.use("/media", mediaRoutes);
app.use("/instructor/course", instructorCourseRoutes);
app.use("/instructor/quiz", instructorQuizRoutes);
app.use("/student/course", studentViewCourseRoutes);
app.use("/student/order", studentViewOrderRoutes);
app.use("/student/courses-bought", studentCoursesRoutes);
app.use("/student/course-progress", studentCourseProgressRoutes);
app.use("/student/quiz", studentQuizRoutes);

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

// =========================
// ⚠️ Global Error Handler
// =========================
const errorHandler = require("./middleware/error-handler");
app.use(errorHandler);

// =========================
// 🚀 Start Server (with auto-port fallback)
// =========================
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    // Store the actual port in environment for file URLs
    process.env.ACTUAL_SERVER_PORT = port.toString();
    // Also expose the port via an endpoint for client discovery
    app.get("/api/server-port", (req, res) => {
      res.json({ port });
    });
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ Port ${port} is busy. Trying ${port + 1}...`);
      startServer(port + 1); // Try next available port
    } else {
      console.error("❌ Server startup error:", err);
    }
  });
}

startServer(PORT);
