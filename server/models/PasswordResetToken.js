const mongoose = require('mongoose');
const crypto = require('crypto');

const PasswordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 3600000), // 1 hour from now
    expires: '1h', // Document will be automatically deleted after 1 hour
  },
  used: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Generate a secure random token
PasswordResetTokenSchema.statics.generateToken = function() {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(32, (err, buffer) => {
      if (err) {
        reject(err);
        return;
      }
      const token = buffer.toString('hex');
      resolve(token);
    });
  });
};

// Check if token is valid and not expired
PasswordResetTokenSchema.methods.isValid = function() {
  return !this.used && this.expiresAt > new Date();
};

const PasswordResetToken = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);

module.exports = PasswordResetToken;
