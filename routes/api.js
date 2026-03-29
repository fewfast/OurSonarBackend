const express = require("express");
const router = express.Router();

const {
  getHome,
  getStatus,
  setState,
  getReport,
  saveReport,
} = require("../controllers/apiController");

// route
router.get("/", getHome);
router.get("/status", getStatus); // ดู status จาก esp32
router.patch("/state", setState); // สั่งการทำงาน esp32
router.get("/report", getReport); // ดึง list report จาก MongoDB
router.post("/report/save", saveReport); // ESP32 ส่ง report ผ่าน MQTT แล้ว save ลง MongoDB

module.exports = router;
