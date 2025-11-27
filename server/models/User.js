const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    mobile: {
      type: String,
      trim: true,
      match: [
        /^(\+880|880|0)?1[3-9]\d{8}$/,
        "Please enter a valid Bangladeshi mobile number",
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
      enum: ["pending", "approved", "active", "inactive"],
      default: "active",
    },
    instructorStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
    },
    application: {
      bio: {
        type: String,
        maxlength: 1000,
      },
      experience: {
        type: String,
        maxlength: 1000,
      },
      submittedAt: {
        type: Date,
      },
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    enrollmentDate: {
      type: Date,
    },
    hireDate: {
      type: Date,
    },
    refreshTokens: [
      {
        type: String, // Hashed refresh tokens
        required: true,
      },
    ],
    phone: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    location: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    linkedin: {
      type: String,
      trim: true,
    },
    github: {
      type: String,
      trim: true,
    },
    youtube: {
      type: String,
      trim: true,
    },
    facebook: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer-not-to-say"],
    },
    dateOfBirth: {
      type: Date,
    },
    coverImage: {
      type: String, // URL to cover/banner image for instructors
    },
    payoutDetails: {
      method: {
        type: String,
        enum: ["bkash", "nagad", "bank"],
      },
      number: {
        type: String,
        trim: true,
      },
      accountHolder: {
        type: String,
        trim: true,
      },
    },
    expertise: {
      type: String,
      trim: true,
    },
    languagePreference: {
      type: String,
      default: "en",
      trim: true,
    },
    avatar: {
      type: String, // URL to avatar image
    },
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      pushNotifications: {
        type: Boolean,
        default: true,
      },
      courseUpdates: {
        type: Boolean,
        default: true,
      },
      marketingEmails: {
        type: Boolean,
        default: false,
      },
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields
UserSchema.index({ userName: 1 }, { unique: true });
UserSchema.index({ userEmail: 1 }, { unique: true });
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

// Method to add hashed refresh token
UserSchema.methods.addRefreshToken = async function (token) {
  const hashedToken = await bcrypt.hash(token, 12);
  this.refreshTokens.push(hashedToken);
  await this.save();
};

// Method to verify and remove refresh token
UserSchema.methods.verifyAndRemoveRefreshToken = async function (token) {
  for (let i = 0; i < this.refreshTokens.length; i++) {
    const isValid = await bcrypt.compare(token, this.refreshTokens[i]);
    if (isValid) {
      this.refreshTokens.splice(i, 1);
      await this.save();
      return true;
    }
  }
  return false;
};

// Method to clear all refresh tokens
UserSchema.methods.clearRefreshTokens = async function () {
  this.refreshTokens = [];
  await this.save();
};

module.exports = mongoose.model("User", UserSchema);
