const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    code: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["signup", "reset"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumed: {
      type: Boolean,
      default: false,
    },
    // extra data for signup flow
    signupData: {
      realName: String,
      username: String,
      passwordHash: String,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model("Otp", otpSchema);

module.exports = Otp;
