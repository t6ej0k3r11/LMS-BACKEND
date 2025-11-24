const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { createServer } = require("http");
const { Server } = require("socket.io");
const app = require("../../server");

module.exports = async () => {
  // Set test environment
  process.env.NODE_ENV = "test";

  // Start in-memory MongoDB server
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Store mongoServer instance globally so it can be accessed in teardown
  global.__MONGOSERVER__ = mongoServer;

  // Connect to the in-memory database
  await mongoose.connect(mongoUri);

  // Store connection state
  global.__MONGOCONNECTED__ = true;

  // Start the Express server with Socket.io for testing
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Initialize Socket.io for notification service
  const { setSocketIoInstance } = require("../../services/notificationService");
  setSocketIoInstance(io);

  // Initialize Socket.io for message service
  const {
    setSocketIoInstance: setMessageSocketIoInstance,
  } = require("../../services/messageService");
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
    console.log(`Test User ${socket.user._id} connected`);

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
        } = require("../../services/messageService");
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
        const { markMessagesAsSeen } = require("../../services/messageService");
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
      console.log(`Test User ${socket.user._id} disconnected`);
    });
  });

  // Start server on a test port
  const testPort = 5001;
  await new Promise((resolve, reject) => {
    httpServer.listen(testPort, () => {
      console.log(`🚀 Test server running on port ${testPort}`);
      resolve();
    });

    httpServer.on("error", (err) => {
      reject(err);
    });
  });

  // Store server instances globally
  global.__HTTPSERVER__ = httpServer;
  global.__SOCKETIO__ = io;
  global.__TESTPORT__ = testPort;
};
