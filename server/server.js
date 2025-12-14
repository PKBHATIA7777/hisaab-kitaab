require("dotenv").config(); // load .env first
const authRoutes = require("./routes/authRoutes");


const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

// connect to MongoDB
connectDB();

// middlewares
app.use(express.json());
app.use(cookieParser());

// configure CORS so frontend can talk to backend
app.use(
  cors({
    origin: process.env.CLIENT_URL, // frontend origin
    credentials: true,              // allow cookies
  })
);


app.use("/api/auth", authRoutes);

// simple health route to test server
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Hisaab-Kitaab backend is running" });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});





