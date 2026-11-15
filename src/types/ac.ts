export type AcMode = 'auto' | 'cool' | 'dry' | 'fan' | 'heat';
export type FanSpeed = 'auto' | 'low' | 'medium' | 'high';
export type GearLevel = 'off' | '75' | '50';
export type PhilcoProtocolId =
  | 'midea_rg10b'
  | 'gree_yap1f'
  | 'midea_rg57'
  | 'hisense_dg11'
  | 'tcl_gykq'
  | 'aux_ykr';
export type AcCategory = 'Split Inverter' | 'Split On/Off' | 'Portátil' | 'Piso-Techo / Ventana';

export interface AcState {
  power: boolean;
  mode: AcMode;
  temp: number; // 16 - 32 °C
  fan: FanSpeed;
  swingV: boolean;
  swingH: boolean;
  turbo: boolean;
  eco: boolean;
  gearLevel: GearLevel;
  breezeAway: boolean;
  freezeProtect: boolean;
  sleep: boolean;
  displayLed: boolean;
  healthIon: boolean;
  iFeel: boolean;
  selfClean: boolean;
  timerOnHours: number; // 0 = off, 0.5..24
  timerOffHours: number; // 0 = off, 0.5..24
  lock: boolean;
  backlight: boolean;
}

export interface PhilcoProfile {
  id: string;
  name: string;
  category: AcCategory;
  remoteModel: string;
  protocol: PhilcoProtocolId;
  protocolLabel: string;
  carrierKhz: number;
  models: string[];
  minTemp: number;
  maxTemp: number;
  supportsHeat: boolean;
  supportsSwingH: boolean;
  supportsIFeel: boolean;
  supportsSelfClean: boolean;
  supportsHealthIon: boolean;
  supportsGear?: boolean;
  supportsBreezeAway?: boolean;
  supportsFreezeProtect?: boolean;
  huaweiSmartBrand: string[];
  universalCodes: {
    k1028e: string[];
    kt9018e: string[];
    k2080e: string[];
    oneForAll: string[];
  };
  notes: string;
}

export interface SavedRoom {
  id: string;
  roomName: string;
  profileId: string;
  customModel: string;
  lastTemp: number;
  lastMode: AcMode;
}

export interface UniversalCodeBrandEntry {
  brandControl: string;
  codes: string[];
  pairingSteps: string;
}

export interface PhilcoErrorCode {
  code: string;
  series: string;
  meaning: string;
  action: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface IrPacketResult {
  protocolName: string;
  carrierKhz: number;
  bitsCount: number;
  hexBytes: string;
  binarySummary: string;
  prontoHex: string;
  rawTimingsUs: number[];
  flipperBlock: string;
}

export interface BridgeConfig {
  enabled: boolean;
  type: 'tasmota' | 'esphome' | 'homeassistant' | 'webhook';
  endpointUrl: string;
  authToken: string;
  audioIrEnabled: boolean;
  soundClickEnabled: boolean;
  hapticEnabled: boolean;
}
