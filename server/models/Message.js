const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
      enum: ["student", "instructor", "admin"],
    },
    receiverRole: {
      type: String,
      required: true,
      enum: ["student", "instructor", "admin"],
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: function () {
        // courseId is required unless sender is admin
        return this.senderRole !== "admin";
      },
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isSeen: {
      type: Boolean,
      default: false,
    },
    seenAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
MessageSchema.index({ senderId: 1, receiverId: 1, courseId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, isSeen: 1 });
MessageSchema.index({ courseId: 1 });
MessageSchema.index({ senderRole: 1 });
MessageSchema.index({ receiverRole: 1 });

// Additional indexes for performance optimization
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ receiverId: 1 });

module.exports = mongoose.model("Message", MessageSchema);
