require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");
const { Server } = require("socket.io");

// Debug: Check environment variables (only in development)
if (process.env.NODE_ENV !== "production") {
  console.log("JWT_SECRET set:", !!process.env.JWT_SECRET);
  console.log("JWT_REFRESH_SECRET set:", !!process.env.JWT_REFRESH_SECRET);
  console.log("MONGO_URI set:", !!process.env.MONGO_URI);
}

// Routes
const authRoutes = require("./routes/auth-routes/index");
const adminRoutes = require("./routes/admin-routes/index");
const notificationRoutes = require("./routes/notification-routes/index");
const messageRoutes = require("./routes/message-routes/index");
const paymentRoutes = require("./routes/payment-routes/index");
const mediaRoutes = require("./routes/instructor-routes/media-routes");
const instructorCourseRoutes = require("./routes/instructor-routes/course-routes");
const instructorQuizRoutes = require("./routes/instructor-routes/quiz-routes");
const instructorApplyRoutes = require("./routes/instructor-routes/apply-routes");
const studentViewCourseRoutes = require("./routes/student-routes/course-routes");
const studentViewOrderRoutes = require("./routes/student-routes/order-routes");
const studentCoursesRoutes = require("./routes/student-routes/student-courses-routes");
const studentCourseProgressRoutes = require("./routes/student-routes/course-progress-routes");
const studentQuizRoutes = require("./routes/student-routes/quiz-routes");
const profileRoutes = require("./routes/profile-routes/index");

const app = express();

// =========================
// 🔧 Basic Configuration
// =========================
const PORT = parseInt(process.env.PORT, 10) || 5000;
const MONGO_URI = process.env.MONGO_URI;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Export app for testing
module.exports = app;

// =========================
// 🧩 Middleware
// =========================
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        process.env.CLIENT_URL || "http://localhost:3000",
        "http://localhost:5173",
        "https://sandbox.sslcommerz.com",
        "https://securepay.sslcommerz.com",
        "https://sandbox.aamarpay.com",
        "https://secure.aamarpay.com",
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  })
);

app.use(express.json());
app.use(cookieParser());

// =========================
// 🗄️ Database Connection
// =========================
// Skip database connection in test environment - handled by test setup
if (process.env.NODE_ENV !== "test") {
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
}

// =========================
// 🚏 Routes
// =========================
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/notifications", notificationRoutes);
app.use("/messages", messageRoutes);
app.use("/payments", paymentRoutes);
app.use("/media", mediaRoutes);
app.use("/instructor/course", instructorCourseRoutes);
app.use("/instructor/quiz", instructorQuizRoutes);
app.use("/instructor", instructorApplyRoutes);
app.use("/student/course", studentViewCourseRoutes);
app.use("/api/orders", studentViewOrderRoutes);
app.use("/student/courses-bought", studentCoursesRoutes);
app.use("/student/course-progress", studentCourseProgressRoutes);
app.use("/student/quiz", studentQuizRoutes);
app.use("/profile", profileRoutes);

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
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Initialize Socket.io for notification service
  const { setSocketIoInstance } = require("./services/notificationService");
  setSocketIoInstance(io);

  // Initialize Socket.io for message service
  const {
    setSocketIoInstance: setMessageSocketIoInstance,
  } = require("./services/messageService");
  setMessageSocketIoInstance(io);

  // Socket.io authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }

    try {
      const jwt = require("jsonwebtoken");
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  // Socket.io connection handler
  io.on("connection", (socket) => {
    console.log(`User ${socket.user._id} connected`);

    // Join personal room
    socket.join(socket.user._id.toString());

    // Handle send_message
    socket.on("send_message", async (data) => {
      try {
        // Check for duplicate message to prevent re-emitting on reconnect
        if (socket.lastMessageId && data._id === socket.lastMessageId) {
          return; // Skip emitting duplicate message
        }

        const {
          sendMessage: sendMessageService,
        } = require("./services/messageService");
        const message = await sendMessageService({
          senderId: socket.user._id,
          receiverId: data.receiverId,
          courseId: data.courseId || null,
          message: data.message,
        });

        // Track last message ID to prevent duplicates
        socket.lastMessageId = message._id;

        // Emit to both sender and receiver (service already emits to receiver)
        io.to(socket.user._id.toString()).emit("receive_message", {
          _id: message._id,
          senderId: message.senderId,
          receiverId: message.receiverId,
          senderRole: message.senderRole,
          receiverRole: message.receiverRole,
          courseId: message.courseId,
          message: message.message,
          createdAt: message.createdAt,
          isSeen: message.isSeen,
        });
      } catch (error) {
        socket.emit("error", {
          message: error.message || "Failed to send message",
        });
      }
    });

    // Handle typing
    socket.on("typing", (data) => {
      socket.to(data.receiverId).emit("user_typing", {
        senderId: socket.user._id,
        isTyping: data.isTyping,
      });
    });

    // Handle mark as seen
    socket.on("mark_seen", async (data) => {
      try {
        const { markMessagesAsSeen } = require("./services/messageService");
        const result = await markMessagesAsSeen(
          data.senderId,
          socket.user._id,
          data.courseId
        );
        socket.emit("messages_seen", {
          senderId: data.senderId,
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        socket.emit("error", {
          message: error.message || "Failed to mark messages as seen",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`User ${socket.user._id} disconnected`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    // Store the actual port in environment for file URLs
    process.env.ACTUAL_SERVER_PORT = port.toString();
    // Also expose the port via an endpoint for client discovery
    app.get("/api/server-port", (req, res) => {
      res.json({ port });
    });
  });

  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ Port ${port} is busy. Trying ${port + 1}...`);
      startServer(port + 1); // Try next available port
    } else {
      console.error("❌ Server startup error:", err);
    }
  });
}

// Start server only if not in test environment
if (process.env.NODE_ENV !== "test") {
  startServer(PORT);
}
