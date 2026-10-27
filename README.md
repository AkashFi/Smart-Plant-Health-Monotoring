Smart Plant Health Monitoring Dashboard

A modern, responsive, agricultural IoT web dashboard designed for an **ESP32-based Smart Plant Health Monitoring System**. The system tracks soil moisture, ambient temperature, and light intensity (calibrated lux or raw 12-bit ADC), calculates multi-factor plant health against species-specific physiological thresholds, visualizes historical telemetry trends via Chart.js, and provides actionable recommendations for watering, fertilizing, and integrated pest management (IPM).

---

## 1. Tech Stack & Architecture

- **Frontend**: HTML5, CSS3, JavaScript (ES6+ modular architecture)
- **Charts & Telemetry**: [Chart.js v4](https://www.chartjs.org/) with multi-axis support and optimal threshold boundary indicators
- **Icons**: Lucide SVG Icons & Custom SVG Botanical Illustrations
- **API Integration Layer**: Centralized `api.js` utilizing `fetch()` and `AbortController` timeouts
- **Persistence**: Built-in state engine with `localStorage` fallback and zero-configuration Demo Simulation Mode
- **Backend Compatibility**: Built ready for Java Spring Boot (`@RestController`) + MySQL database

```
smart-plant-dashboard/
├── index.html                  # Semantic single-page application structure
├── css/
│   ├── styles.css              # Agricultural IoT theme (Emerald green & white with sky blue accents)
│   └── responsive.css          # Mobile drawer (<768px), tablet (768-1024px), desktop (>1024px)
├── js/
│   ├── api.js                  # Centralized REST API client & high-fidelity IoT simulator
│   ├── dashboard.js            # Live telemetry cards, status calculation, stale data watchdog
│   ├── plants.js               # Plant catalog CRUD, presets, species threshold configuration
│   ├── charts.js               # Historical graphs with 1h/24h/7d/30d filters & CSV/JSON export
│   ├── alerts.js               # Alert center (watering, temp, light, pest observation, fertilizer)
│   ├── history.js              # Audit trail table with filters, search, and pagination
│   ├── settings.js             # API base URL, polling frequency, calibration, unit toggles
│   └── app.js                  # Routing, digital clock, hardware status pill, modal orchestrator
├── assets/
│   └── images/                 # Crisp vector SVG illustrations (tomato, basil, chilli, spinach, mint)
└── README.md                   # Full documentation, Spring Boot contracts, MySQL schema & ESP32 code
```

---

## 2. How to Run Locally

You can run the dashboard using any local static file server or directly in your browser:

### Option A: Python Built-in Server (Recommended)
Open PowerShell or Terminal in the `smart-plant-dashboard` folder and run:
```bash
python -m http.server 3000
```
Then open: [http://localhost:3000](http://localhost:3000)

### Option B: Node.js `npx serve`
```bash
npx serve .
```

### Option C: VS Code Live Server
Right-click `index.html` in VS Code and select **"Open with Live Server"**.

### Option D: Direct File Opening
Double-click `index.html` directly to open it in Chrome, Edge, or Firefox.

---

## 3. Demo Mode vs. Live Backend Mode

The dashboard features a **clear distinction between Demo Simulation Mode and Live Backend Mode**:

1. **Demo Simulation Mode (Active by default)**:
   - A prominent amber banner displays at the top: `⚡ DEMO SIMULATION MODE ACTIVE`.
   - Generates realistic ESP32 telemetry with random-walk physics (soil slowly dries up over time, diurnal solar cycles for temperature and sunlight).
   - Allows full interactive testing of plant creation, watering logs, threshold alerts, and chart time filters without needing hardware or a database running.
   - All state persists in your browser's `localStorage`.

2. **Live Backend Mode**:
   - In **Settings**, toggle `Demo Simulation Mode` **OFF**.
   - The dashboard makes real HTTP requests via `fetch()` to your configured Spring Boot API URL (default: `http://localhost:8080/api`).
   - If the Spring Boot backend or ESP32 is offline, the status badge turns **Disconnected (Red)** with exact timeout or network error details.
   - **Data integrity guarantee**: In Live Mode, the dashboard **never** fabricates fake sensor values or silently pretends the sensor is online.

---

## 4. Java Spring Boot REST API Specification

To connect your Java Spring Boot backend, implement the following REST endpoints. All timestamps are in standard **ISO 8601 UTC** format (`yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`).

### 4.1 Plant Management Endpoints

#### `GET /api/plants`
Returns all registered plants with their threshold parameters and latest sensor telemetry.

**Response `200 OK`**:
```json
[
  {
    "id": "PLANT-001",
    "name": "Roma Tomato",
    "species": "Solanum lycopersicum",
    "type": "Tomato",
    "stage": "Flowering & Fruiting",
    "environment": "Indoor Smart Greenhouse",
    "image": "assets/images/tomato.svg",
    "lastWatered": "2026-10-23T18:30:00.000Z",
    "lastFertilized": "2026-10-15T10:00:00.000Z",
    "thresholds": {
      "moistureMin": 55.0,
      "moistureMax": 80.0,
      "tempMin": 18.0,
      "tempMax": 28.0,
      "lightMinLux": 15000,
      "lightMaxLux": 35000,
      "lightMinAdc": 1200,
      "lightMaxAdc": 3200
    },
    "liveReading": {
      "moisture": 38.0,
      "temperature": 24.5,
      "lightLux": 18500,
      "lightAdc": 1480,
      "timestamp": "2026-10-23T23:55:00.000Z"
    }
  }
]
```

#### `GET /api/plants/{id}`
Returns details for a single plant.

#### `POST /api/plants`
Registers a new plant.

**Request Payload**:
```json
{
  "name": "Sweet Genovese Basil",
  "species": "Ocimum basilicum",
  "type": "Basil",
  "stage": "Vegetative",
  "environment": "Balcony Container Box",
  "image": "assets/images/basil.svg",
  "thresholds": {
    "moistureMin": 50.0,
    "moistureMax": 75.0,
    "tempMin": 20.0,
    "tempMax": 30.0,
    "lightMinLux": 12000,
    "lightMaxLux": 28000,
    "lightMinAdc": 960,
    "lightMaxAdc": 2400
  }
}
```
**Response `201 Created`**: Returns created plant entity with assigned `id` (e.g. `PLANT-005`).

#### `PUT /api/plants/{id}`
Updates plant attributes and threshold ranges.

#### `DELETE /api/plants/{id}`
Deletes a plant profile (`204 No Content` or `200 OK`).

---

### 4.2 Sensor Telemetry Endpoints

#### `GET /api/plants/{id}/readings/latest`
Returns the most recent reading from the ESP32 for this plant.

**Response `200 OK`**:
```json
{
  "plantId": "PLANT-001",
  "moisture": 62.4,
  "temperature": 23.8,
  "lightLux": 19400,
  "lightAdc": 1552,
  "timestamp": "2026-10-23T23:58:12.000Z"
}
```

#### `GET /api/plants/{id}/readings?from={ISO}&to={ISO}`
Returns historical timeseries points for Chart.js graphing.

**Response `200 OK`**:
```json
[
  {
    "id": 10452,
    "plantId": "PLANT-001",
    "moisture": 59.2,
    "temperature": 22.4,
    "lightLux": 14500,
    "lightAdc": 1160,
    "timestamp": "2026-10-23T20:00:00.000Z"
  },
  {
    "id": 10453,
    "plantId": "PLANT-001",
    "moisture": 58.7,
    "temperature": 22.1,
    "lightLux": 12000,
    "lightAdc": 960,
    "timestamp": "2026-10-23T21:00:00.000Z"
  }
]
```

#### `POST /api/sensor-readings`
Endpoint called by ESP32 node to submit sensor packets.

**Request Payload**:
```json
{
  "plantId": "PLANT-001",
  "moisture": 64.5,
  "temperature": 24.2,
  "lightAdc": 1820,
  "lightLux": 22750
}
```
**Response `201 Created`**:
```json
{
  "status": "SUCCESS",
  "receivedAt": "2026-10-23T23:58:30.000Z"
}
```

---

### 4.3 Alerts & Care Recommendations

#### `GET /api/alerts?plantId={id}&severity={sev}&status={stat}`
Returns alerts. Optional query parameters: `plantId`, `severity` (`Critical`, `Warning`, `Information`), `status` (`Active`, `Resolved`).

**Response `200 OK`**:
```json
[
  {
    "id": "ALT-101",
    "plantId": "PLANT-001",
    "plantName": "Roma Tomato",
    "severity": "Critical",
    "type": "Watering",
    "title": "Low Soil Moisture Warning",
    "message": "Soil moisture has dropped to 38% (threshold: 55%). Tomato is entering root stress.",
    "sensorValue": "38%",
    "threshold": "55% - 80%",
    "actionRecommended": "Water with approximately 300ml of room-temperature water. Ensure drainage holes are unblocked.",
    "actionTaken": null,
    "status": "Active",
    "acknowledged": false,
    "timestamp": "2026-10-23T23:25:00.000Z"
  }
]
```

#### `PATCH /api/alerts/{id}`
Marks an alert acknowledged or resolved with action description.

**Request Payload**:
```json
{
  "status": "Resolved",
  "actionTaken": "Watered 350ml filtered room-temperature water",
  "acknowledged": true
}
```

---

### 4.4 Plant Care Events & History

#### `GET /api/plants/{id}/history` or `GET /api/care-events`
Returns care activity log entries.

**Response `200 OK`**:
```json
[
  {
    "id": "EVT-501",
    "plantId": "PLANT-001",
    "plantName": "Roma Tomato",
    "eventType": "Watering",
    "timestamp": "2026-10-23T18:30:00.000Z",
    "soilMoisture": 42.0,
    "temperature": 23.5,
    "lightReading": "17,200 lux",
    "healthStatus": "Needs Attention",
    "actionTaken": "Applied 400ml filtered water with slow soil drench",
    "userNotes": "Soil was feeling dry on the top 2 inches.",
    "operator": "Akash"
  }
]
```

#### `POST /api/plants/{id}/care-events`
Logs a new manual intervention (Watering, Fertilizer, Pest Treatment, Plant Note).

---

## 5. MySQL Database Schema DDL

Create these tables in your MySQL database (`flora_db`):

```sql
CREATE DATABASE IF NOT EXISTS flora_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flora_db;

-- 1. Plants Table
CREATE TABLE IF NOT EXISTS plants (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    species VARCHAR(120),
    type VARCHAR(60),
    stage VARCHAR(60),
    environment VARCHAR(100),
    image VARCHAR(255),
    moisture_min DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    moisture_max DECIMAL(5,2) NOT NULL DEFAULT 80.00,
    temp_min DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    temp_max DECIMAL(5,2) NOT NULL DEFAULT 28.00,
    light_min_lux INT NOT NULL DEFAULT 10000,
    light_max_lux INT NOT NULL DEFAULT 30000,
    light_min_adc INT DEFAULT 800,
    light_max_adc INT DEFAULT 2600,
    last_watered_at TIMESTAMP NULL,
    last_fertilized_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Sensor Readings (Timeseries) Table
CREATE TABLE IF NOT EXISTS sensor_readings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plant_id VARCHAR(32) NOT NULL,
    moisture DECIMAL(5,2) NOT NULL,
    temperature DECIMAL(5,2) NOT NULL,
    light_adc INT,
    light_lux INT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_readings_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
    INDEX idx_plant_time (plant_id, recorded_at DESC)
);

-- 3. Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(32) PRIMARY KEY,
    plant_id VARCHAR(32) NOT NULL,
    severity ENUM('Critical', 'Warning', 'Information') NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    sensor_value VARCHAR(50),
    threshold_range VARCHAR(80),
    action_recommended TEXT,
    action_taken TEXT,
    status ENUM('Active', 'Resolved') DEFAULT 'Active',
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    CONSTRAINT fk_alerts_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
    INDEX idx_alert_status (status, severity)
);

-- 4. Care Events Audit Table
CREATE TABLE IF NOT EXISTS care_events (
    id VARCHAR(32) PRIMARY KEY,
    plant_id VARCHAR(32) NOT NULL,
    event_type ENUM('Watering', 'Fertilizer', 'Pest Treatment', 'Plant Note', 'Sensor Reading', 'Health Warning') NOT NULL,
    soil_moisture DECIMAL(5,2),
    temperature DECIMAL(5,2),
    light_reading VARCHAR(50),
    health_status VARCHAR(50),
    action_taken TEXT NOT NULL,
    user_notes TEXT,
    operator VARCHAR(80) DEFAULT 'User',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_events_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
    INDEX idx_event_time (plant_id, created_at DESC)
);
```

---

## 6. ESP32 Sensor Ingestion Code Sample

Here is the C++ Arduino snippet for your ESP32 to send readings to `POST /api/sensor-readings`:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://YOUR_SERVER_IP:8080/api/sensor-readings";

const int SOIL_PIN = 34;   // Analog Pin for Capacitive Soil Moisture Sensor
const int LDR_PIN  = 35;   // Analog Pin for LDR Light Sensor

void sendTelemetry(const char* plantId, float moisture, float temp, int lightAdc) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["plantId"]     = plantId;
    doc["moisture"]    = moisture;
    doc["temperature"] = temp;
    doc["lightAdc"]    = lightAdc;
    // Calibrated lux (using 12.5 multiplier for standard 10k LDR divider)
    doc["lightLux"]    = (int)(lightAdc * 12.5);

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    Serial.printf("HTTP Response code: %d\n", httpResponseCode);
    http.end();
  }
}
```

---

## 7. Light Sensor ADC vs. Lux Calibration Note

- ESP32 uses a 12-bit Analog-to-Digital Converter (ADC) yielding raw integer values between `0` and `4095`.
- A raw photoresistor (LDR) in a voltage divider outputs a non-linear resistance change relative to ambient light.
- In **Settings**, you can toggle between **Raw ADC (0-4095)** and **Calibrated Lux**.
- The multiplier `Lux = ADC * 12.5` serves as an initial conversion estimate for typical indoor environments until calibrated against an optical lux meter or dedicated digital sensor like the **BH1750 (I2C)**.
