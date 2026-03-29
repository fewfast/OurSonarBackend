const mongoose = require("mongoose");

// เก็บ report ที่ ESP32 ส่งมา
const reportSchema = new mongoose.Schema(
  {
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

// เก็บ state ของ ESP32
const stateSchema = new mongoose.Schema(
  {
    isSystemStart: { type: Boolean, default: false },
    isAlert: { type: Boolean, default: false },
    mode: { type: String, default: "ROAM" },
    pos: { type: Number, default: 90 },
    minRotate: { type: Number, default: 0 },
    maxRotate: { type: Number, default: 180 },
    maxRange: { type: Number, default: 100 },
    RedZone: { type: Number, default: 30 },
  },
  { timestamps: true },
);

const Report = mongoose.model("Report", reportSchema);
const State = mongoose.model("State", stateSchema);

module.exports = { Report, State };
