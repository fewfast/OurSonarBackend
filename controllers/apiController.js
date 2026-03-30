const { Report, State } = require("../models/models");

exports.getHome = (req, res) => {
  res.send("Backend running (from controller)");
};

// GET /status — ดึง status ล่าสุดจาก cache (ESP32 ส่งมาใน MQTT)
exports.getStatus = (req, res) => {
  const latest = req.latestStatus;
  if (!latest) {
    return res.status(404).json({ error: "ยังไม่มี status จาก ESP32" });
  }
  res.json({ success: true, data: latest });
};

// PATCH /state — Frontend ส่งเฉพาะ field ที่ต้องการแก้ → update MongoDB → publish ไปให้ ESP32
exports.setState = async (req, res) => {
  const mqttClient = req.mqttClient;
  const topic = `${process.env.MQTT_TOPIC}/state`;

  try {
    const state = await State.findOneAndUpdate(
      {},
      { $set: req.body },
      { upsert: true, new: true },
    );

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

    mqttClient.publish(topic, payload, (err) => {
      if (err) {
        console.error("Publish error:", err.message);
        return res.status(500).json({ error: "publish ไม่สำเร็จ" });
      }
      console.log(`Published to ${topic}:`, payload);
      res.json({ success: true, topic, data: JSON.parse(payload) });
    });
  } catch (err) {
    console.error("setState error:", err.message);
    res.status(500).json({ error: "บันทึก state ไม่สำเร็จ" });
  }
};

// GET /report — ดึง list report จาก MongoDB ส่งให้ frontend
exports.getReport = async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    console.error("getReport error:", err.message);
    res.status(500).json({ error: "ดึง report ไม่สำเร็จ" });
  }
};

// internal function — เรียกจาก MQTT handler ใน index.js
exports.saveReportToDB = async (data) => {
  try {
    const report = await Report.create({ data });
    console.log("Report saved to MongoDB");
    return report;
  } catch (err) {
    console.error("saveReport error:", err.message);
  }
};

// POST /report/save — HTTP endpoint สำรอง
exports.saveReport = async (req, res) => {
  try {
    const report = await Report.create({ data: req.body });
    console.log("Report saved:", report);
    res.json({ success: true, data: report });
  } catch (err) {
    console.error("saveReport error:", err.message);
    res.status(500).json({ error: "บันทึก report ไม่สำเร็จ" });
  }
};

// GET /report/latest — ดึง report ล่าสุดจาก MongoDB
exports.getLatestReport = (req, res) => {
  const latest = req.latestReport;
  if (!latest) {
    return res.status(404).json({ error: "ยังไม่มี report จาก ESP32" });
  }
  res.json({ success: true, data: latest });
};
