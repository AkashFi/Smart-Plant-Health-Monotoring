#include "DHT.h"

// ---------- PIN CONFIGURATION ----------
#define SOIL_PIN 34
#define DHT_PIN 4
#define LDR_PIN 32

#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);

  dht.begin();

  Serial.println("================================");
  Serial.println(" Smart Plant Health Monitoring");
  Serial.println("================================");

  delay(2000);
}

void loop() {

  // Read sensors
  int soilValue = analogRead(SOIL_PIN);
  int lightValue = analogRead(LDR_PIN);
  float temperature = dht.readTemperature();

  // Check DHT11
  if (isnan(temperature)) {
    Serial.println("DHT11 sensor error!");
    delay(2000);
    return;
  }

  // ---------- DISPLAY VALUES ----------
  Serial.println();
  Serial.println("--------- SENSOR DATA ---------");

  Serial.print("Soil Moisture : ");
  Serial.println(soilValue);

  Serial.print("Light Value   : ");
  Serial.println(lightValue);

  Serial.print("Temperature   : ");
  Serial.print(temperature);
  Serial.println(" °C");

  // ---------- SOIL STATUS ----------
  Serial.println();
  Serial.println("--------- PLANT STATUS ---------");

  if (soilValue > 3000) {
    Serial.println("Soil: VERY DRY");
  }
  else if (soilValue > 2000) {
    Serial.println("Soil: DRY");
  }
  else if (soilValue > 1000) {
    Serial.println("Soil: MOIST");
  }
  else {
    Serial.println("Soil: VERY WET");
  }

  // ---------- LIGHT STATUS ----------

  if (lightValue < 1000) {
    Serial.println("Light: LOW");
  }
  else if (lightValue < 2500) {
    Serial.println("Light: MEDIUM");
  }
  else {
    Serial.println("Light: HIGH");
  }

  // ---------- TEMPERATURE STATUS ----------

  if (temperature > 35) {
    Serial.println("Temperature: HIGH");
  }
  else if (temperature < 15) {
    Serial.println("Temperature: LOW");
  }
  else {
    Serial.println("Temperature: NORMAL");
  }

  Serial.println("-------------------------------");

  delay(2000);
}