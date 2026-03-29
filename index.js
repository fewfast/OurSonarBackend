require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mqtt = require("mqtt");
const connectDB = require("./config/db");
const { saveReportToDB } = require("./controllers/apiController");
const { State } = require("./models/models");

const app = express();
const server = http.createServer(app);

const cors = require("cors");
app.use(cors({ origin: "*" }));

app.use(express.json());

// =====================
// 🔥 MongoDB
// =====================
connectDB();

// =====================
// 🔥 Socket.IO
// =====================
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("message", (data) => {
    console.log("Received from client:", data);
    socket.emit("reply", "Server received your message");
    io.emit("broadcast", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// =====================
// 🔥 MQTT
// =====================
const BASE_TOPIC = process.env.MQTT_TOPIC;

const mqttClient = mqtt.connect({
  host: process.env.MQTT_URL,
  port: parseInt(process.env.MQTT_PORT),
  protocol: "mqtts",
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  clientId: `server_${Math.random().toString(16).slice(2, 8)}`,
  rejectUnauthorized: true,
  keepalive: 60,
  clean: true,
});

mqttClient.on("connect", () => {
  console.log("MQTT connected");

  // subscribe ทุก topic
  const topics = [
    `${BASE_TOPIC}/status`,
    `${BASE_TOPIC}/state`,
    `${BASE_TOPIC}/report`,
  ];

  mqttClient.subscribe(topics, (err) => {
    if (err) {
      console.error("Subscribe error:", err);
    } else {
      console.log("Subscribed to:", topics);
    }
  });
});

// cache status ล่าสุดจาก ESP32
let latestStatus = null;

mqttClient.on("message", async (topic, message) => {
  const raw = message.toString();
  console.log(`MQTT [${topic}]:`, raw);

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { value: raw };
  }

  if (topic === `${BASE_TOPIC}/status`) {
    latestStatus = data;
    io.emit("status", data);

    // ถ้า ESP32 online ให้ดึง state จาก MongoDB แล้วส่งให้ ESP32 ทันที
    if (data.status === "online") {
      try {
        const state = await State.findOne().sort({ updatedAt: -1 });
        if (state) {
          const payload = JSON.stringify({
            isSystemStart: state.isSystemStart,
            isAlert: state.isAlert,
            mode: state.mode,
            pos: state.pos,
            minRotate: state.minRotate,
            maxRotate: state.maxRotate,
            maxRange: state.maxRange,
            RedZone: state.RedZone,
          });
          mqttClient.publish(`${BASE_TOPIC}/state`, payload);
          console.log("ESP32 online — sent state:", payload);
        }
      } catch (err) {
        console.error("Send state on online error:", err.message);
      }
    }
  }

  if (topic === `${BASE_TOPIC}/report`) {
    io.emit("report", data);
    await saveReportToDB(data);
  }

  if (topic === `${BASE_TOPIC}/state`) {
    io.emit("state", data);
  }
});

mqttClient.on("error", (err) => {
  console.error("MQTT error:", err.message);
});

mqttClient.on("reconnect", () => {
  console.log("MQTT reconnecting...");
});

mqttClient.on("offline", () => {
  console.log("MQTT offline");
});

// import route
const apiRoutes = require("./routes/api");
app.use(
  "/",
  (req, res, next) => {
    req.mqttClient = mqttClient;
    req.latestStatus = latestStatus;
    next();
  },
  apiRoutes,
);

// =====================
// 🚀 Start Server
// =====================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
