const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Smart Home API online",
    status: "OK"
  });
});

app.get("/api/v1/dashboard", (req, res) => {
  res.json({
    mode: "AUTO",
    online: true,
    temperature: 26.4,
    humidity: 61.2,
    pressure: 1012.8,
    lux: 48.5,
    gasAlarm: false,
    roomOccupied: true,
    outsideLight: true,
    insideLight: false
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});