const express = require("express");
const {
  sendMessage,
  getChatHistory,
  markMessagesAsSeen,
  getChatPartnersList,
} = require("../../controllers/message-controller/index");
const { authenticate } = require("../../middleware/auth-middleware");
const {
  messageRateLimit,
} = require("../../middleware/message-rate-limit-middleware");

const router = express.Router();

// All message routes require authentication
router.use(authenticate);

// Get all chat partners
router.get("/list", getChatPartnersList);

// Send a message
router.post("/send", messageRateLimit, sendMessage);

// Get chat history between two users
router.get("/history/:userId/:receiverId", getChatHistory);

// Mark messages as seen
router.patch("/seen", markMessagesAsSeen);

module.exports = router;
