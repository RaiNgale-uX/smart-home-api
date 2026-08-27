const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
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
      roomOccupied
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
        room_occupied
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        temperature,
        humidity,
        pressure,
        lux,
        gasValue,
        gasAlarm,
        roomOccupied
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});