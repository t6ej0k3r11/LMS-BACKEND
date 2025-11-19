const mongoose = require("mongoose");

const QuestionBankSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
    },
    options: [
      {
        type: String,
        required: true,
      },
    ],
    correctAnswer: {
      type: String,
      required: true,
    },
    explanation: {
      type: String,
    },
    tags: [
      {
        type: String,
      },
    ],
    subject: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Add indexes for frequently queried fields
QuestionBankSchema.index({ subject: 1 });
QuestionBankSchema.index({ difficulty: 1 });
QuestionBankSchema.index({ tags: 1 });
QuestionBankSchema.index({ createdBy: 1 });

module.exports = mongoose.model("QuestionBank", QuestionBankSchema);
