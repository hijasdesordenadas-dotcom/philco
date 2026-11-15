import { AcMode, AcState, FanSpeed, IrPacketResult, PhilcoProtocolId } from '../types/ac';

function reverseBits(byte: number, bits = 8): number {
  let out = 0;
  for (let i = 0; i < bits; i++) {
    out = (out << 1) | ((byte >> i) & 1);
  }
  return out;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => '0x' + (b & 0xff).toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

function encodeBitsLsbFirst(
  bytes: number[],
  bitLengths: number[] | null,
  oneMark: number,
  oneSpace: number,
  zeroMark: number,
  zeroSpace: number
): number[] {
  const timings: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const bits = bitLengths ? bitLengths[i] : 8;
    const val = bytes[i];
    for (let b = 0; b < bits; b++) {
      const bit = (val >> b) & 1;
      if (bit === 1) {
        timings.push(oneMark, oneSpace);
      } else {
        timings.push(zeroMark, zeroSpace);
      }
    }
  }
  return timings;
}

function encodeBitsMsbFirst(bytes: number[], oneMark: number, oneSpace: number, zeroMark: number, zeroSpace: number): number[] {
  const timings: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const val = bytes[i];
    for (let b = 7; b >= 0; b--) {
      const bit = (val >> b) & 1;
      if (bit === 1) {
        timings.push(oneMark, oneSpace);
      } else {
        timings.push(zeroMark, zeroSpace);
      }
    }
  }
  return timings;
}

/**
 * Converts microsecond mark/space array (alternating +mark, -space) into valid Pronto Hex (38 kHz).
 */
export function timingsToProntoHex(rawTimingsUs: number[], carrierKhz = 38): string {
  const carrierPeriodUs = 1000 / carrierKhz;
  const freqWord = Math.round(1000000 / (carrierKhz * 1000 * 0.241246));
  const pairsCount = Math.floor(rawTimingsUs.length / 2);

  const header = [0x0000, freqWord, pairsCount, 0x0000];

  const words: number[] = [...header];
  for (let i = 0; i < pairsCount * 2; i++) {
    const us = Math.abs(rawTimingsUs[i]);
    const cycles = Math.max(1, Math.round(us / carrierPeriodUs));
    words.push(cycles);
  }

  return words.map((w) => w.toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

function greeModeCode(mode: AcMode): number {
  switch (mode) {
    case 'auto': return 0;
    case 'cool': return 1;
    case 'dry': return 2;
    case 'fan': return 3;
    case 'heat': return 4;
  }
}

function greeFanCode(fan: FanSpeed): number {
  switch (fan) {
    case 'auto': return 0;
    case 'low': return 1;
    case 'medium': return 2;
    case 'high': return 3;
  }
}

function mideaModeCode(mode: AcMode): number {
  switch (mode) {
    case 'cool': return 0b0000;
    case 'dry': return 0b0100;
    case 'auto': return 0b1000;
    case 'heat': return 0b1100;
    case 'fan': return 0b0100;
  }
}

function mideaFanCode(fan: FanSpeed): number {
  switch (fan) {
    case 'auto': return 0b101;
    case 'low': return 0b100;
    case 'medium': return 0b010;
    case 'high': return 0b001;
  }
}

const MIDEA_TEMP_MAP: Record<number, number> = {
  17: 0x0, 18: 0x1, 19: 0x3, 20: 0x2, 21: 0x6, 22: 0x7, 23: 0x5, 24: 0x4,
  25: 0xc, 26: 0xd, 27: 0x9, 28: 0x8, 29: 0xa, 30: 0xb,
};

/**
 * Generates real protocol-accurate IR frames for Philco AC OEM protocols including RG10B(F)/BGEF.
 */
export function encodePhilcoIrPacket(
  protocol: PhilcoProtocolId,
  state: AcState,
  lastAction?: string
): IrPacketResult {
  const clampedTemp = Math.min(32, Math.max(16, Math.round(state.temp)));
  let rawTimingsUs: number[] = [];
  let bytes: number[] = [];
  let protocolName = '';
  let bitsCount = 0;

  if (protocol === 'midea_rg10b') {
    protocolName = 'Midea / Philco RG10B(F)/BGEF (38 kHz)';
    bitsCount = 48;

    // Special extended single-command frames used by RG10B(F)/BGEF
    if (state.power && lastAction === 'Boost' && state.turbo) {
      bytes = [0xb5, 0x4a, 0xf5, 0x0a, 0xa2, 0x5d];
    } else if (state.power && lastAction === 'Breeze Away' && state.breezeAway) {
      bytes = [0xb5, 0x4a, 0xf5, 0x0a, 0xc1, 0x3e];
    } else if (state.power && lastAction === 'Protección 8°C' && state.freezeProtect) {
      bytes = [0xb5, 0x4a, 0xf5, 0x0a, 0xaf, 0x50];
    } else if (state.power && lastAction === 'Gear' && state.gearLevel === '75') {
      bytes = [0xb5, 0x4a, 0xf5, 0x0a, 0xae, 0x51];
    } else if (state.power && lastAction === 'Gear' && state.gearLevel === '50') {
      bytes = [0xb5, 0x4a, 0xf5, 0x0a, 0xad, 0x52];
    } else if (lastAction === 'Auto-Limpieza' && state.selfClean) {
      bytes = [0xb5, 0x4a, 0xf5, 0x0a, 0xaa, 0x55];
    } else if (lastAction === 'Display LED') {
      bytes = [0xb5, 0x4a, 0xf5, 0x0a, 0xa5, 0x5a];
    } else if (!state.power) {
      // RG10B Power OFF frame
      bytes = [0xb2, 0x4d, 0x7b, 0x84, 0xe0, 0x1f];
    } else {
      let A = 0xb2;
      if (state.eco) A = 0xb3;
      if (state.iFeel) A = 0xb4;

      const fanBits = mideaFanCode(state.fan);
      let B = (fanBits << 5) | 0x1f;
      if (state.turbo) B = 0x3f;
      if (state.swingV) B ^= 0x04;
      if (state.sleep) B ^= 0x10;

      const t = Math.max(17, Math.min(30, clampedTemp));
      const tNib = MIDEA_TEMP_MAP[t] ?? 0x4;
      const modeNib = mideaModeCode(state.mode);
      const C = state.mode === 'fan' ? 0xe4 : (tNib << 4) | modeNib;

      bytes = [A, (~A) & 0xff, B, (~B) & 0xff, C, (~C) & 0xff];
    }

    const body = encodeBitsMsbFirst(bytes, 560, 1680, 560, 560);
    rawTimingsUs = [4400, 4400, ...body, 560, 5200, 4400, 4400, ...body, 560, 40000];
  } else if (protocol === 'gree_yap1f') {
    protocolName = 'Gree YAP1F / YB1F2 (67-bit)';
    bitsCount = 67;
    const b0 =
      (greeModeCode(state.mode) & 0x07) |
      ((state.power ? 1 : 0) << 3) |
      ((greeFanCode(state.fan) & 0x03) << 4) |
      (((state.swingV || state.swingH) ? 1 : 0) << 6) |
      ((state.sleep ? 1 : 0) << 7);

    const tempVal = Math.max(16, Math.min(30, clampedTemp)) - 16;
    const timerActive = state.timerOnHours > 0 || state.timerOffHours > 0;
    const timerHours = Math.min(24, Math.round(state.timerOnHours || state.timerOffHours));
    const b1 = (tempVal & 0x0f) | (timerActive ? 0x10 : 0) | ((timerHours & 0x07) << 5);

    const b2 =
      (state.turbo ? 0x10 : 0) |
      (state.displayLed ? 0x20 : 0) |
      (state.healthIon ? 0x40 : 0) |
      (state.selfClean ? 0x80 : 0);

    const b3 = 0x50;

    const b4 = (state.swingV ? 0x01 : 0) | (state.swingH ? 0x10 : 0);
    const b5 = state.iFeel ? 0x04 : 0x00;
    const b6 = state.eco ? 0x80 : 0x00;

    const sum =
      (b0 & 0x0f) +
      (b1 & 0x0f) +
      (b2 & 0x0f) +
      (b3 & 0x0f) +
      ((b4 & 0xf0) >> 4) +
      ((b5 & 0xf0) >> 4) +
      ((b6 & 0xf0) >> 4) +
      0x0a;
    const checksum = (sum & 0x0f) << 4;
    const b7 = checksum;

    bytes = [b0, b1, b2, b3, b4, b5, b6, b7];

    const frame1 = encodeBitsLsbFirst([b0, b1, b2, b3, 0b010], [8, 8, 8, 8, 3], 620, 1680, 620, 560);
    const frame2 = encodeBitsLsbFirst([b4, b5, b6, b7], [8, 8, 8, 8], 620, 1680, 620, 560);
    rawTimingsUs = [9000, 4500, ...frame1, 620, 20000, ...frame2, 620, 40000];
  } else if (protocol === 'midea_rg57') {
    protocolName = 'Midea RG57 / R51M (48-bit)';
    bitsCount = 48;
    let A = 0xb2;
    let B = 0xbf;
    let C = 0x00;

    if (!state.power) {
      A = 0xb2;
      B = 0x7b;
      C = 0xe0;
    } else {
      const fanBits = mideaFanCode(state.fan);
      B = (fanBits << 5) | 0x1f;
      if (state.turbo) B = 0x3f;
      if (state.swingV) B ^= 0x04;

      const t = Math.max(17, Math.min(30, clampedTemp));
      const tNib = MIDEA_TEMP_MAP[t] ?? 0x4;
      const modeNib = mideaModeCode(state.mode);
      C = state.mode === 'fan' ? 0xe4 : (tNib << 4) | modeNib;
      if (state.eco) A = 0xb3;
    }

    bytes = [A, (~A) & 0xff, B, (~B) & 0xff, C, (~C) & 0xff];
    const body = encodeBitsMsbFirst(bytes, 560, 1680, 560, 560);
    rawTimingsUs = [4400, 4400, ...body, 560, 5200, 4400, 4400, ...body, 560, 40000];
  } else if (protocol === 'hisense_dg11') {
    protocolName = 'Hisense / Kelon DG11J1 (112-bit)';
    bitsCount = 112;
    const b0 = 0x83;
    const b1 = 0x06;
    const b2 =
      (state.power ? 0x04 : 0x00) |
      ((Math.max(16, Math.min(30, clampedTemp)) - 16) << 4);
    const modeMap: Record<AcMode, number> = { fan: 0, heat: 1, cool: 2, dry: 3, auto: 4 };
    const fanMap: Record<FanSpeed, number> = { auto: 0, high: 1, medium: 2, low: 3 };
    const b3 = (modeMap[state.mode] & 0x07) | ((fanMap[state.fan] & 0x03) << 4);
    const b4 = (state.swingV ? 0x01 : 0) | (state.swingH ? 0x02 : 0) | (state.turbo ? 0x20 : 0);
    const b5 = (state.sleep ? 0x01 : 0) | (state.eco ? 0x04 : 0) | (state.displayLed ? 0x10 : 0);
    const b6 = Math.min(24, Math.round(state.timerOnHours)) & 0x1f;
    const b7 = Math.min(24, Math.round(state.timerOffHours)) & 0x1f;
    const b8 = state.iFeel ? 0x08 : 0x00;
    const b9 = state.healthIon ? 0x10 : 0x00;
    const b10 = 0x00;
    const b11 = 0x00;
    const b12 = 0x00;
    const sum = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + b7 + b8 + b9 + b10 + b11 + b12) & 0xff;
    bytes = [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, sum];
    const body = encodeBitsLsbFirst(bytes, null, 580, 1650, 580, 550);
    rawTimingsUs = [9000, 4500, ...body, 580, 40000];
  } else if (protocol === 'tcl_gykq') {
    protocolName = 'TCL GYKQ-03 / Portátil (112-bit)';
    bitsCount = 112;
    const header = [0x23, 0xcb, 0x26, 0x01, 0x00];
    const b5 = state.power ? 0x24 : 0x20;
    const modeMap: Record<AcMode, number> = { heat: 1, dry: 2, cool: 3, fan: 7, auto: 8 };
    const b6 = modeMap[state.mode] & 0x0f;
    const b7 = Math.max(0, Math.min(15, 31 - clampedTemp));
    const fanMap: Record<FanSpeed, number> = { auto: 0, low: 2, medium: 3, high: 5 };
    const b8 = (fanMap[state.fan] & 0x07) | (state.swingV ? 0x38 : 0x00);
    const b9 = (state.eco ? 0x80 : 0) | (state.turbo ? 0x40 : 0) | (state.sleep ? 0x01 : 0);
    const b10 = Math.min(24, Math.round(state.timerOnHours || state.timerOffHours));
    const b11 = state.displayLed ? 0x40 : 0x00;
    const b12 = 0x00;
    const partial = [...header, b5, b6, b7, b8, b9, b10, b11, b12];
    const checksum = partial.reduce((acc, n) => (acc + n) & 0xff, 0);
    bytes = [...partial, checksum];
    const body = encodeBitsLsbFirst(bytes, null, 500, 1180, 500, 380);
    rawTimingsUs = [3100, 1650, ...body, 500, 35000];
  } else {
    protocolName = 'AUX YKR-H/102E (104-bit)';
    bitsCount = 104;
    const b0 = 0xc3;
    const b1 = ((Math.max(16, Math.min(32, clampedTemp)) - 8) << 3) | (state.swingV ? 0x00 : 0x07);
    const b2 = state.swingH ? 0x00 : 0xe0;
    const b3 = state.sleep ? 0x08 : 0x00;
    const fanMap: Record<FanSpeed, number> = { auto: 5, high: 1, medium: 2, low: 3 };
    const b4 = (fanMap[state.fan] << 5) | (state.turbo ? 0x10 : 0);
    const b5 = state.eco ? 0x20 : 0x00;
    const modeMap: Record<AcMode, number> = { auto: 0, cool: 1, dry: 2, fan: 3, heat: 4 };
    const b6 = modeMap[state.mode] << 5;
    const b7 = state.healthIon ? 0x40 : 0x00;
    const b8 = state.displayLed ? 0x00 : 0x04;
    const b9 = state.power ? 0x20 : 0x00;
    const b10 = state.selfClean ? 0x08 : 0x00;
    const b11 = 0x00;
    const partial = [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11];
    const checksum = partial.reduce((acc, n) => (acc + reverseBits(n)) & 0xff, 0);
    bytes = [...partial, reverseBits(checksum)];
    const body = encodeBitsLsbFirst(bytes, null, 560, 1600, 560, 540);
    rawTimingsUs = [9000, 4500, ...body, 560, 40000];
  }

  const hexBytes = bytesToHex(bytes);
  const prontoHex = timingsToProntoHex(rawTimingsUs, 38);
  const binarySummary = bytes.slice(0, 4).map((b) => b.toString(2).padStart(8, '0')).join(' ');
  const flipperBlock = [
    'Filetype: IR signals file',
    'Version: 1',
    `# Philco AC State (${protocolName})`,
    `name: ${state.power ? `${state.mode.toUpperCase()}_${clampedTemp}C_${state.fan.toUpperCase()}` : 'POWER_OFF'}`,
    'type: raw',
    'frequency: 38000',
    'duty_cycle: 0.330000',
    `data: ${rawTimingsUs.join(' ')}`,
  ].join('\n');

  return {
    protocolName,
    carrierKhz: 38,
    bitsCount,
    hexBytes,
    binarySummary,
    prontoHex,
    rawTimingsUs,
    flipperBlock,
  };
}

export interface NativeIrBridge {
  transmit: (carrierHz: number, patternCsv: string) => boolean;
  hasIrEmitter?: () => boolean;
}

declare global {
  interface Window {
    HuaweiIRBridge?: NativeIrBridge;
    AndroidIR?: NativeIrBridge;
  }
}

export function isNativeHuaweiIrAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = window.HuaweiIRBridge || window.AndroidIR;
  if (!bridge || typeof bridge.transmit !== 'function') return false;
  return bridge.hasIrEmitter ? bridge.hasIrEmitter() : true;
}

export function transmitNativeHuaweiIr(carrierKhz: number, rawTimingsUs: number[]): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = window.HuaweiIRBridge || window.AndroidIR;
  if (!bridge || typeof bridge.transmit !== 'function') return false;
  try {
    return bridge.transmit(carrierKhz * 1000, rawTimingsUs.join(','));
  } catch {
    return false;
  }
}

export function getAndroidKotlinBridgeSnippet(appUrl: string): string {
  return `// MainActivity.kt — Envoltorio Android Nativo para Huawei Pura 80 (ConsumerIrManager)
// Permiso en AndroidManifest.xml:
// <uses-permission android:name="android.permission.INTERNET" />
// <uses-permission android:name="android.permission.TRANSMIT_IR" />
// <uses-feature android:name="android.hardware.consumerir" android:required="true" />

package com.philco.acremote.pura80

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.ConsumerIrManager
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private var irManager: ConsumerIrManager? = null

    inner class HuaweiIrJsBridge {
        @JavascriptInterface
        fun hasIrEmitter(): Boolean = irManager?.hasIrEmitter() == true

        @JavascriptInterface
        fun transmit(carrierHz: Int, patternCsv: String): Boolean {
            val ir = irManager ?: return false
            if (!ir.hasIrEmitter()) return false
            val pattern = patternCsv.split(",").mapNotNull { it.trim().toIntOrNull() }.toIntArray()
            if (pattern.isEmpty()) return false
            ir.transmit(carrierHz, pattern)
            return true
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        irManager = getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager
        val webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(HuaweiIrJsBridge(), "HuaweiIRBridge")
        webView.loadUrl("${appUrl || 'https://ais-pre-4driyk77oeaotckj2p6hj7-733246845673.us-east1.run.app'}")
        setContentView(webView)
    }
}`;
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playTactileClick(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1150, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.025);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  } catch {
    // Ignore audio restrictions
  }
}

export function playAudioIrSignal(rawTimingsUs: number[]): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    const sampleRate = ctx.sampleRate;
    const totalUs = rawTimingsUs.reduce((acc, n) => acc + Math.abs(n), 0);
    const totalSamples = Math.min(sampleRate * 0.5, Math.ceil((totalUs / 1_000_000) * sampleRate));
    if (totalSamples <= 0) return false;

    const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const carrierFreq = Math.min(19000, sampleRate * 0.43);
    const omega = 2 * Math.PI * carrierFreq;

    let sampleIdx = 0;
    for (let i = 0; i < rawTimingsUs.length && sampleIdx < totalSamples; i++) {
      const isMark = i % 2 === 0;
      const durSamples = Math.max(1, Math.round((Math.abs(rawTimingsUs[i]) / 1_000_000) * sampleRate));
      const end = Math.min(totalSamples, sampleIdx + durSamples);
      for (let s = sampleIdx; s < end; s++) {
        if (isMark) {
          const val = Math.sin(omega * (s / sampleRate)) * 0.95;
          left[s] = val;
          right[s] = -val;
        } else {
          left[s] = 0;
          right[s] = 0;
        }
      }
      sampleIdx = end;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
    return true;
  } catch {
    return false;
  }
}
