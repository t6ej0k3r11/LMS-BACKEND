const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      required: true,
      enum: ["student", "instructor", "admin"],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    enrollmentDate: {
      type: Date,
    },
    hireDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ role: 1, status: 1 });

// Pre-save middleware to hash password and set dates
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to set enrollment/hire dates
UserSchema.pre("save", function (next) {
  if (this.isNew) {
    if (this.role === "student" && !this.enrollmentDate) {
      this.enrollmentDate = new Date();
    } else if (this.role === "instructor" && !this.hireDate) {
      this.hireDate = new Date();
    }
  }
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
