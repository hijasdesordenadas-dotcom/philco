import { buildZipBlob } from './zipBuilder';

export function getNativeAndroidKotlinSource(): string {
  return `package com.philco.acremote.pura80

import android.content.Context
import android.hardware.ConsumerIrManager
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private var irManager: ConsumerIrManager? = null
    private var state = IrEncoder.AcState()
    private val modes = listOf("auto", "cool", "dry", "fan", "heat")
    private val fans = listOf("auto", "low", "medium", "high")
    private val gears = listOf("off", "75", "50")

    private lateinit var tvLcdTemp: TextView
    private lateinit var tvLcdMeta: TextView
    private lateinit var tvStatus: TextView
    private lateinit var spModel: Spinner

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        irManager = getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager

        tvLcdTemp = findViewById(R.id.tvLcdTemp)
        tvLcdMeta = findViewById(R.id.tvLcdMeta)
        tvStatus = findViewById(R.id.tvStatus)
        spModel = findViewById(R.id.spModel)

        val profiles = listOf(
            "RG10B(F)/BGEF - Philco Inverter",
            "YAP1F - Philco Gree Eco Plus",
            "DG11J1 - Philco Hisense Clásico",
            "GYKQ-03 - Philco Portátil TCL",
            "YKR-H - Philco Piso-Techo AUX"
        )
        spModel.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, profiles)

        val hasIr = irManager?.hasIrEmitter() == true
        tvStatus.text = if (hasIr) {
            "Emisor IR Huawei Pura 80 listo (38 kHz)"
        } else {
            "Sin sensor IR detectado en este dispositivo"
        }

        findViewById<Button>(R.id.btnPower).setOnClickListener {
            state = state.copy(power = !state.power)
            transmit(it, if (state.power) "Encender" else "Apagar")
        }
        findViewById<Button>(R.id.btnMode).setOnClickListener {
            val next = modes[(modes.indexOf(state.mode) + 1) % modes.size]
            state = state.copy(power = true, freezeProtect = false, mode = next)
            transmit(it, "Modo \${next.uppercase()}")
        }
        findViewById<Button>(R.id.btnBoost).setOnClickListener {
            state = state.copy(power = true, turbo = !state.turbo, eco = false, gear = "off")
            transmit(it, "Boost")
        }
        findViewById<Button>(R.id.btnTempMinus).setOnClickListener {
            state = state.copy(power = true, freezeProtect = false, temp = (state.temp - 1).coerceIn(16, 30))
            transmit(it, "Temp -")
        }
        findViewById<Button>(R.id.btnTempPlus).setOnClickListener {
            state = state.copy(power = true, freezeProtect = false, temp = (state.temp + 1).coerceIn(16, 30))
            transmit(it, "Temp +")
        }
        findViewById<Button>(R.id.btnFan).setOnClickListener {
            val next = fans[(fans.indexOf(state.fan) + 1) % fans.size]
            state = state.copy(power = true, turbo = false, fan = next)
            transmit(it, "Fan \${next.uppercase()}")
        }
        findViewById<Button>(R.id.btnSwing).setOnClickListener {
            state = state.copy(power = true, swingV = !state.swingV)
            transmit(it, "Swing")
        }
        findViewById<Button>(R.id.btnBreeze).setOnClickListener {
            state = state.copy(power = true, breezeAway = !state.breezeAway)
            transmit(it, "Breeze Away")
        }
        findViewById<Button>(R.id.btnSleep).setOnClickListener {
            state = state.copy(power = true, sleep = !state.sleep)
            transmit(it, "Sleep")
        }
        findViewById<Button>(R.id.btnEco).setOnClickListener {
            state = state.copy(power = true, eco = !state.eco, turbo = false)
            transmit(it, "Eco")
        }
        findViewById<Button>(R.id.btnGear).setOnClickListener {
            val next = gears[(gears.indexOf(state.gear) + 1) % gears.size]
            state = state.copy(power = true, gear = next, turbo = false)
            transmit(it, "Gear")
        }
        findViewById<Button>(R.id.btnFollowMe).setOnClickListener {
            state = state.copy(power = true, iFeel = !state.iFeel)
            transmit(it, "Follow Me")
        }
        findViewById<Button>(R.id.btnLed).setOnClickListener {
            state = state.copy(displayLed = !state.displayLed)
            transmit(it, "Display LED")
        }
        findViewById<Button>(R.id.btnClean).setOnClickListener {
            state = state.copy(selfClean = !state.selfClean)
            transmit(it, "Auto-Limpieza")
        }
        findViewById<Button>(R.id.btnFp8).setOnClickListener {
            state = state.copy(power = true, mode = "heat", freezeProtect = !state.freezeProtect)
            transmit(it, "Protección 8°C")
        }

        renderLcd()
    }

    private fun transmit(view: android.view.View, action: String) {
        view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
        renderLcd()
        val protocolIdx = spModel.selectedItemPosition
        val pattern = IrEncoder.encode(protocolIdx, state, action)
        val ir = irManager
        if (ir != null && ir.hasIrEmitter()) {
            ir.transmit(38000, pattern)
            tvStatus.text = "IR 38kHz enviado: \$action (\${pattern.size} pulsos)"
        } else {
            tvStatus.text = "Trama \$action generada (sin hardware IR)"
            Toast.makeText(this, "Este teléfono no reporta sensor IR", Toast.LENGTH_SHORT).show()
        }
    }

    private fun renderLcd() {
        tvLcdTemp.text = when {
            !state.power -> "OFF"
            state.freezeProtect -> "FP 8°C"
            state.mode == "fan" -> "-- °C"
            else -> "\${state.temp}°C"
        }
        val modeEs = when (state.mode) {
            "cool" -> "FRÍO"
            "heat" -> "CALOR"
            "dry" -> "SECO"
            "fan" -> "VENT"
            else -> "AUTO"
        }
        val extras = buildList {
            if (state.turbo) add("BOOST")
            if (state.eco) add("ECO")
            if (state.gear != "off") add("GEAR \${state.gear}%")
            if (state.swingV) add("SWING")
            if (state.sleep) add("SLEEP")
            if (state.breezeAway) add("BREEZE")
        }.joinToString(" · ")
        tvLcdMeta.text = if (state.power) {
            "\$modeEs · FAN \${state.fan.uppercase()}" + if (extras.isNotEmpty()) " · \$extras" else ""
        } else {
            "Equipo apagado"
        }
    }
}
`;
}

export function downloadAndroidIrProjectZip(): void {
  const irEncoderKt = `package com.philco.acremote.pura80

object IrEncoder {
    data class AcState(
        val power: Boolean = true,
        val mode: String = "cool",
        val temp: Int = 24,
        val fan: String = "auto",
        val swingV: Boolean = true,
        val turbo: Boolean = false,
        val eco: Boolean = false,
        val gear: String = "off",
        val breezeAway: Boolean = false,
        val freezeProtect: Boolean = false,
        val sleep: Boolean = false,
        val displayLed: Boolean = true,
        val iFeel: Boolean = false,
        val selfClean: Boolean = false
    )

    private val mideaTempMap = mapOf(
        17 to 0x0, 18 to 0x1, 19 to 0x3, 20 to 0x2, 21 to 0x6, 22 to 0x7, 23 to 0x5,
        24 to 0x4, 25 to 0xC, 26 to 0xD, 27 to 0x9, 28 to 0x8, 29 to 0xA, 30 to 0xB
    )

    fun encode(protocolIdx: Int, state: AcState, action: String): IntArray {
        return when (protocolIdx) {
            1 -> encodeGree(state)
            2 -> encodeHisense(state)
            3 -> encodeTcl(state)
            4 -> encodeAux(state)
            else -> encodeMideaRg10b(state, action)
        }
    }

    private fun encodeMideaRg10b(state: AcState, action: String): IntArray {
        val bytes: IntArray = when {
            state.power && action == "Boost" && state.turbo -> intArrayOf(0xB5, 0x4A, 0xF5, 0x0A, 0xA2, 0x5D)
            state.power && action == "Breeze Away" && state.breezeAway -> intArrayOf(0xB5, 0x4A, 0xF5, 0x0A, 0xC1, 0x3E)
            state.power && action == "Protección 8°C" && state.freezeProtect -> intArrayOf(0xB5, 0x4A, 0xF5, 0x0A, 0xAF, 0x50)
            state.power && action == "Gear" && state.gear == "75" -> intArrayOf(0xB5, 0x4A, 0xF5, 0x0A, 0xAE, 0x51)
            state.power && action == "Gear" && state.gear == "50" -> intArrayOf(0xB5, 0x4A, 0xF5, 0x0A, 0xAD, 0x52)
            action == "Auto-Limpieza" && state.selfClean -> intArrayOf(0xB5, 0x4A, 0xF5, 0x0A, 0xAA, 0x55)
            action == "Display LED" -> intArrayOf(0xB5, 0x4A, 0xF5, 0x0A, 0xA5, 0x5A)
            !state.power -> intArrayOf(0xB2, 0x4D, 0x7B, 0x84, 0xE0, 0x1F)
            else -> {
                var a = 0xB2
                if (state.eco) a = 0xB3
                if (state.iFeel) a = 0xB4
                val fanBits = when (state.fan) {
                    "low" -> 0b100
                    "medium" -> 0b010
                    "high" -> 0b001
                    else -> 0b101
                }
                var b = (fanBits shl 5) or 0x1F
                if (state.turbo) b = 0x3F
                if (state.swingV) b = b xor 0x04
                if (state.sleep) b = b xor 0x10
                val t = state.temp.coerceIn(17, 30)
                val tNib = mideaTempMap[t] ?: 0x4
                val modeNib = when (state.mode) {
                    "cool" -> 0b0000
                    "dry" -> 0b0100
                    "auto" -> 0b1000
                    "heat" -> 0b1100
                    else -> 0b0100
                }
                val c = if (state.mode == "fan") 0xE4 else (tNib shl 4) or modeNib
                intArrayOf(a, a.inv() and 0xFF, b, b.inv() and 0xFF, c, c.inv() and 0xFF)
            }
        }
        val body = msbBits(bytes, 560, 1680, 560, 560)
        return (listOf(4400, 4400) + body + listOf(560, 5200, 4400, 4400) + body + listOf(560, 40000)).toIntArray()
    }

    private fun encodeGree(state: AcState): IntArray {
        val m = when (state.mode) { "cool" -> 1; "dry" -> 2; "fan" -> 3; "heat" -> 4; else -> 0 }
        val f = when (state.fan) { "low" -> 1; "medium" -> 2; "high" -> 3; else -> 0 }
        val b0 = m or ((if (state.power) 1 else 0) shl 3) or (f shl 4) or ((if (state.swingV) 1 else 0) shl 6) or ((if (state.sleep) 1 else 0) shl 7)
        val b1 = (state.temp.coerceIn(16, 30) - 16) and 0x0F
        val b2 = (if (state.turbo) 0x10 else 0) or (if (state.displayLed) 0x20 else 0) or (if (state.selfClean) 0x80 else 0)
        val b3 = 0x50
        val b4 = if (state.swingV) 0x01 else 0x00
        val b5 = if (state.iFeel) 0x04 else 0x00
        val b6 = if (state.eco) 0x80 else 0x00
        val sum = ((b0 and 0x0F) + (b1 and 0x0F) + (b2 and 0x0F) + (b3 and 0x0F) + ((b4 and 0xF0) shr 4) + ((b5 and 0xF0) shr 4) + ((b6 and 0xF0) shr 4) + 0x0A) and 0x0F
        val b7 = sum shl 4
        val f1 = lsbBits(intArrayOf(b0, b1, b2, b3, 0b010), intArrayOf(8, 8, 8, 8, 3), 620, 1680, 620, 560)
        val f2 = lsbBits(intArrayOf(b4, b5, b6, b7), intArrayOf(8, 8, 8, 8), 620, 1680, 620, 560)
        return (listOf(9000, 4500) + f1 + listOf(620, 20000) + f2 + listOf(620, 40000)).toIntArray()
    }

    private fun encodeHisense(state: AcState): IntArray {
        val m = when (state.mode) { "fan" -> 0; "heat" -> 1; "cool" -> 2; "dry" -> 3; else -> 4 }
        val f = when (state.fan) { "high" -> 1; "medium" -> 2; "low" -> 3; else -> 0 }
        val b2 = (if (state.power) 0x04 else 0) or ((state.temp.coerceIn(16, 30) - 16) shl 4)
        val b3 = m or (f shl 4)
        val b4 = (if (state.swingV) 0x01 else 0) or (if (state.turbo) 0x20 else 0)
        val b5 = (if (state.sleep) 0x01 else 0) or (if (state.eco) 0x04 else 0) or (if (state.displayLed) 0x10 else 0)
        val partial = intArrayOf(0x83, 0x06, b2, b3, b4, b5, 0, 0, if (state.iFeel) 8 else 0, 0, 0, 0, 0)
        val sum = partial.sum() and 0xFF
        val body = lsbBits(partial + sum, null, 580, 1650, 580, 550)
        return (listOf(9000, 4500) + body + listOf(580, 40000)).toIntArray()
    }

    private fun encodeTcl(state: AcState): IntArray {
        val m = when (state.mode) { "heat" -> 1; "dry" -> 2; "cool" -> 3; "fan" -> 7; else -> 8 }
        val f = when (state.fan) { "low" -> 2; "medium" -> 3; "high" -> 5; else -> 0 }
        val partial = intArrayOf(0x23, 0xCB, 0x26, 0x01, 0x00, if (state.power) 0x24 else 0x20, m, (31 - state.temp.coerceIn(16, 31)), f or (if (state.swingV) 0x38 else 0), (if (state.eco) 0x80 else 0) or (if (state.turbo) 0x40 else 0) or (if (state.sleep) 1 else 0), 0, if (state.displayLed) 0x40 else 0, 0)
        val sum = partial.sum() and 0xFF
        val body = lsbBits(partial + sum, null, 500, 1180, 500, 380)
        return (listOf(3100, 1650) + body + listOf(500, 35000)).toIntArray()
    }

    private fun encodeAux(state: AcState): IntArray {
        val m = when (state.mode) { "cool" -> 1; "dry" -> 2; "fan" -> 3; "heat" -> 4; else -> 0 }
        val f = when (state.fan) { "high" -> 1; "medium" -> 2; "low" -> 3; else -> 5 }
        val b1 = ((state.temp.coerceIn(16, 32) - 8) shl 3) or (if (state.swingV) 0 else 7)
        val partial = intArrayOf(0xC3, b1, 0xE0, if (state.sleep) 8 else 0, (f shl 5) or (if (state.turbo) 0x10 else 0), if (state.eco) 0x20 else 0, m shl 5, 0, if (state.displayLed) 0 else 4, if (state.power) 0x20 else 0, if (state.selfClean) 8 else 0, 0)
        val sum = partial.sumOf { Integer.reverse(it) ushr 24 } and 0xFF
        val body = lsbBits(partial + (Integer.reverse(sum) ushr 24), null, 560, 1600, 560, 540)
        return (listOf(9000, 4500) + body + listOf(560, 40000)).toIntArray()
    }

    private fun msbBits(bytes: IntArray, oneM: Int, oneS: Int, zeroM: Int, zeroS: Int): List<Int> {
        val out = ArrayList<Int>(bytes.size * 16)
        for (byte in bytes) {
            for (b in 7 downTo 0) {
                if (((byte shr b) and 1) == 1) { out.add(oneM); out.add(oneS) } else { out.add(zeroM); out.add(zeroS) }
            }
        }
        return out
    }

    private fun lsbBits(bytes: IntArray, lengths: IntArray?, oneM: Int, oneS: Int, zeroM: Int, zeroS: Int): List<Int> {
        val out = ArrayList<Int>(bytes.size * 16)
        for (i in bytes.indices) {
            val bits = lengths?.get(i) ?: 8
            val v = bytes[i]
            for (b in 0 until bits) {
                if (((v shr b) and 1) == 1) { out.add(oneM); out.add(oneS) } else { out.add(zeroM); out.add(zeroS) }
            }
        }
        return out
    }
}
`;

  const activityMainXml = `<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#F4F6F8">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="16dp">

        <TextView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="Philco AC Control · Pura 80 IR"
            android:textColor="#0F172A"
            android:textSize="20sp"
            android:textStyle="bold" />

        <Spinner
            android:id="@+id/spModel"
            android:layout_width="match_parent"
            android:layout_height="48dp"
            android:layout_marginTop="8dp" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="10dp"
            android:background="#CBE7F5"
            android:orientation="vertical"
            android:padding="18dp">

            <TextView
                android:id="@+id/tvLcdTemp"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:fontFamily="monospace"
                android:text="24°C"
                android:textColor="#0F172A"
                android:textSize="44sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/tvLcdMeta"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:fontFamily="monospace"
                android:text="FRÍO · FAN AUTO · SWING"
                android:textColor="#1E293B"
                android:textSize="13sp" />
        </LinearLayout>

        <TextView
            android:id="@+id/tvStatus"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:text="Preparado"
            android:textColor="#005EB8"
            android:textSize="12sp" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="12dp"
            android:orientation="horizontal">
            <Button android:id="@+id/btnPower" android:layout_width="0dp" android:layout_height="56dp" android:layout_weight="1" android:text="Encender / Off" />
            <Button android:id="@+id/btnMode" android:layout_width="0dp" android:layout_height="56dp" android:layout_weight="1" android:text="Modo" />
            <Button android:id="@+id/btnBoost" android:layout_width="0dp" android:layout_height="56dp" android:layout_weight="1" android:text="Boost" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:orientation="horizontal">
            <Button android:id="@+id/btnTempMinus" android:layout_width="0dp" android:layout_height="64dp" android:layout_weight="1" android:text="TEMP -" android:textSize="18sp" />
            <Button android:id="@+id/btnTempPlus" android:layout_width="0dp" android:layout_height="64dp" android:layout_weight="1" android:text="TEMP +" android:textSize="18sp" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:orientation="horizontal">
            <Button android:id="@+id/btnFan" android:layout_width="0dp" android:layout_height="52dp" android:layout_weight="1" android:text="Fan" />
            <Button android:id="@+id/btnSwing" android:layout_width="0dp" android:layout_height="52dp" android:layout_weight="1" android:text="Swing" />
            <Button android:id="@+id/btnBreeze" android:layout_width="0dp" android:layout_height="52dp" android:layout_weight="1" android:text="Breeze" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:orientation="horizontal">
            <Button android:id="@+id/btnSleep" android:layout_width="0dp" android:layout_height="50dp" android:layout_weight="1" android:text="Sleep" />
            <Button android:id="@+id/btnEco" android:layout_width="0dp" android:layout_height="50dp" android:layout_weight="1" android:text="Eco" />
            <Button android:id="@+id/btnGear" android:layout_width="0dp" android:layout_height="50dp" android:layout_weight="1" android:text="Gear" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:orientation="horizontal">
            <Button android:id="@+id/btnFollowMe" android:layout_width="0dp" android:layout_height="50dp" android:layout_weight="1" android:text="Follow Me" />
            <Button android:id="@+id/btnLed" android:layout_width="0dp" android:layout_height="50dp" android:layout_weight="1" android:text="LED" />
            <Button android:id="@+id/btnClean" android:layout_width="0dp" android:layout_height="50dp" android:layout_weight="1" android:text="Clean" />
            <Button android:id="@+id/btnFp8" android:layout_width="0dp" android:layout_height="50dp" android:layout_weight="1" android:text="FP 8°C" />
        </LinearLayout>
    </LinearLayout>
</ScrollView>
`;

  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.TRANSMIT_IR" />
    <uses-feature android:name="android.hardware.consumerir" android:required="false" />

    <application
        android:allowBackup="true"
        android:label="Philco AC Pura 80"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;

  const gradleProperties = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`;

  const rootGradle = `plugins {
    id("com.android.application") version "8.5.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
`;

  const settingsGradle = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "PhilcoACControlPura80"
include(":app")
`;

  const appGradle = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.philco.acremote.pura80"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.philco.acremote.pura80"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
}
`;

  const githubWorkflow = `name: Compilar APK Philco Pura 80
on:
  workflow_dispatch:
  push:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.7'
      - name: Compilar APK Debug
        run: gradle assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: PhilcoACControl-Pura80-APK
          path: app/build/outputs/apk/debug/app-debug.apk
`;

  const installBat = `@echo off
echo === Instalador por Cable USB (ADB) para Huawei Pura 80 ===
where adb >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro 'adb'. Instale Android Platform Tools o Android Studio.
    pause
    exit /b 1
)
if exist "app\\build\\outputs\\apk\\debug\\app-debug.apk" (
    adb install -r "app\\build\\outputs\\apk\\debug\\app-debug.apk"
    pause
    exit /b 0
)
if exist "app-debug.apk" (
    adb install -r "app-debug.apk"
    pause
    exit /b 0
)
echo Abra esta carpeta en Android Studio y presione Run con el Pura 80 conectado por cable USB.
pause
`;

  const installSh = `#!/usr/bin/env bash
set -e
if ! command -v adb >/dev/null 2>&1; then
  echo "Instale Android Platform Tools (adb)."
  exit 1
fi
if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
  adb install -r "app/build/outputs/apk/debug/app-debug.apk"
elif [ -f "app-debug.apk" ]; then
  adb install -r "app-debug.apk"
else
  echo "Abra esta carpeta en Android Studio y presione Run con el Pura 80 conectado por USB."
fi
`;

  const readmeTxt = `Philco AC Control (RG10B(F)/BGEF) - App Android 100% Nativa Offline
====================================================================

Esta es una app Android nativa en Kotlin que funciona 100% sin internet usando
directamente el emisor infrarrojo (ConsumerIrManager) del Huawei Pura 80.

Cómo compilar e instalar por cable USB:
1. Abra esta carpeta en Android Studio.
2. Active Depuración USB en su Huawei Pura 80 y conéctelo por cable.
3. Pulse Run (▶) para compilar e instalar automáticamente el APK en su teléfono.
   (O suba la carpeta a GitHub para obtener app-debug.apk desde Actions y usar instalar-por-cable.bat).
`;

  const blob = buildZipBlob([
    { path: 'PhilcoACControlPura80/README-PURA80.txt', content: readmeTxt },
    { path: 'PhilcoACControlPura80/gradle.properties', content: gradleProperties },
    { path: 'PhilcoACControlPura80/settings.gradle.kts', content: settingsGradle },
    { path: 'PhilcoACControlPura80/build.gradle.kts', content: rootGradle },
    { path: 'PhilcoACControlPura80/app/build.gradle.kts', content: appGradle },
    { path: 'PhilcoACControlPura80/app/src/main/AndroidManifest.xml', content: manifestXml },
    { path: 'PhilcoACControlPura80/app/src/main/res/layout/activity_main.xml', content: activityMainXml },
    {
      path: 'PhilcoACControlPura80/app/src/main/java/com/philco/acremote/pura80/MainActivity.kt',
      content: getNativeAndroidKotlinSource(),
    },
    {
      path: 'PhilcoACControlPura80/app/src/main/java/com/philco/acremote/pura80/IrEncoder.kt',
      content: irEncoderKt,
    },
    { path: 'PhilcoACControlPura80/.github/workflows/build-apk.yml', content: githubWorkflow },
    { path: 'PhilcoACControlPura80/instalar-por-cable.bat', content: installBat },
    { path: 'PhilcoACControlPura80/instalar-por-cable.sh', content: installSh },
  ]);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'PhilcoACControl-Pura80-AndroidNativo.zip';
  a.click();
  URL.revokeObjectURL(url);
}
