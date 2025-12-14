const mongoose = require("mongoose");

const loginEntrySchema = new mongoose.Schema(
  {
    time: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ["local", "google"],
      required: true,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    realName: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    logins: [loginEntrySchema],
    needsPassword: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);

module.exports = User;
