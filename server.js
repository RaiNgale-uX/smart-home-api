require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const mqtt = require("mqtt");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


const mqttClient = mqtt.connect({
  host: process.env.MQTT_HOST,
  port: Number(process.env.MQTT_PORT || 8883),
  protocol: "mqtts",
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  reconnectPeriod: 5000,
  connectTimeout: 15000
});

mqttClient.on("connect", () => {
  console.log("MQTT conectado ao HiveMQ");
});

mqttClient.on("reconnect", () => {
  console.log("MQTT a reconectar...");
});

mqttClient.on("error", (error) => {
  console.error("MQTT erro:", error.message);
});



app.get("/", (req, res) => {
  res.json({
    message: "Smart Home API online",
    status: "OK"
  });
});

app.get("/api/v1/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      database: "connected",
      time: result.rows[0].now
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      database: "error",
      message: error.message
    });
  }
});

app.get("/api/v1/dashboard", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM sensor_readings
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "No sensor data found"
      });
    }

    const data = result.rows[0];

    res.json({
  mode: "AUTO",
  online: true,
  temperature: Number(data.temperature),
  humidity: Number(data.humidity),
  pressure: Number(data.pressure),
  lux: Number(data.lux),
  gasValue: data.gas_value,
  gasAlarm: data.gas_alarm,
  roomOccupied: data.room_occupied,
  coolingDemand: data.cooling_demand,
  timestamp: data.created_at
});

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Database error",
      error: error.message
    });
  }
});

app.post("/api/v1/sensors", async (req, res) => {
  try {
    const {
  temperature,
  humidity,
  pressure,
  lux,
  gasValue,
  gasAlarm,
  roomOccupied,
  coolingDemand
} = req.body;

    const result = await pool.query(
  `
  INSERT INTO sensor_readings (
    temperature,
    humidity,
    pressure,
    lux,
    gas_value,
    gas_alarm,
    room_occupied,
    cooling_demand
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
  `,
  [
    temperature,
    humidity,
    pressure,
    lux,
    gasValue,
    gasAlarm,
    roomOccupied,
    coolingDemand
  ]
);

    res.status(201).json({
      message: "Sensor data saved successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to save sensor data",
      error: error.message
    });
  }
});

const allowedCommands = {
  "casa/cmd/iluminacao": ["ON", "OFF"],
  "casa/cmd/luz_interior": ["ON", "OFF"],
  "casa/cmd/lampada_sala": ["ON", "OFF"],
  "casa/cmd/lampada_quarto": ["ON", "OFF"],
  "casa/cmd/alarme": ["ON", "OFF"],
  "casa/cmd/ar": ["ON", "OFF"],
  "casa/cmd/modo": ["AUTO", "MANUAL"]
};

app.post("/api/v1/commands", (req, res) => {
  const { topic, payload } = req.body;

  if (!topic || payload === undefined) {
    return res.status(400).json({
      message: "topic and payload are required"
    });
  }

  if (!allowedCommands[topic]) {
    return res.status(400).json({
      message: "Invalid MQTT topic"
    });
  }

  const command = String(payload).toUpperCase();

  if (!allowedCommands[topic].includes(command)) {
    return res.status(400).json({
      message: "Invalid payload for this topic"
    });
  }

  if (!mqttClient.connected) {
    return res.status(503).json({
      message: "MQTT broker unavailable"
    });
  }

  mqttClient.publish(topic, command, { qos: 1 }, (error) => {
    if (error) {
      console.error("MQTT publish error:", error);

      return res.status(500).json({
        message: "Failed to publish MQTT command"
      });
    }

    console.log(`MQTT → ${topic}: ${command}`);

    res.json({
      message: "Command published successfully",
      topic,
      payload: command
    });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});