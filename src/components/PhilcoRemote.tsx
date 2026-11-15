import React, { useMemo, useState } from 'react';
import {
  AirVent,
  ArrowLeftRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Droplets,
  Fan,
  Flame,
  Gauge,
  Leaf,
  Lightbulb,
  Lock,
  Moon,
  Power,
  Radio,
  RotateCcw,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  Thermometer,
  ThermometerSnowflake,
  Unlock,
  Wind,
  Zap,
} from 'lucide-react';
import { AcMode, AcState, BridgeConfig, FanSpeed, GearLevel, IrPacketResult, PhilcoProfile } from '../types/ac';
import { encodePhilcoIrPacket, isNativeHuaweiIrAvailable } from '../utils/irEngine';

interface PhilcoRemoteProps {
  profile: PhilcoProfile;
  state: AcState;
  bridgeConfig: BridgeConfig;
  lastActionLabel: string;
  lastTxStatus: string | null;
  txPulseId: number;
  onUpdateState: (updater: (prev: AcState) => AcState, actionLabel: string) => void;
  onResetState: () => void;
  onOpenModels: () => void;
}

const MODE_ORDER: AcMode[] = ['auto', 'cool', 'dry', 'fan', 'heat'];
const FAN_ORDER: FanSpeed[] = ['auto', 'low', 'medium', 'high'];

const MODE_LABELS: Record<AcMode, string> = {
  auto: 'AUTO',
  cool: 'FRÍO',
  dry: 'SECO',
  fan: 'VENT',
  heat: 'CALOR',
};

const FAN_LABELS: Record<FanSpeed, string> = {
  auto: 'AUTO',
  low: 'BAJA',
  medium: 'MEDIA',
  high: 'ALTA',
};

export const PhilcoRemote: React.FC<PhilcoRemoteProps> = ({
  profile,
  state,
  bridgeConfig,
  lastActionLabel,
  lastTxStatus,
  txPulseId,
  onUpdateState,
  onResetState,
  onOpenModels,
}) => {
  const [copiedType, setCopiedType] = useState<'hex' | 'pronto' | 'raw' | null>(null);
  const nativeIrReady = isNativeHuaweiIrAvailable();

  const packet: IrPacketResult = useMemo(
    () => encodePhilcoIrPacket(profile.protocol, state, lastActionLabel),
    [profile.protocol, state, lastActionLabel]
  );

  const availableModes = useMemo(
    () => (profile.supportsHeat ? MODE_ORDER : MODE_ORDER.filter((m) => m !== 'heat')),
    [profile.supportsHeat]
  );

  const handleAction = (label: string, updater: (prev: AcState) => AcState) => {
    if (state.lock && label !== 'Bloqueo' && label !== 'Luz LCD') {
      return;
    }
    onUpdateState(updater, label);
  };

  const cycleMode = () => {
    handleAction('Modo', (prev) => {
      const idx = availableModes.indexOf(prev.mode);
      const next = availableModes[(idx + 1) % availableModes.length];
      return {
        ...prev,
        power: true,
        mode: next,
        freezeProtect: false,
        turbo: next === 'dry' || next === 'fan' ? false : prev.turbo,
        eco: next === 'dry' || next === 'fan' ? false : prev.eco,
      };
    });
  };

  const cycleFan = () => {
    handleAction('Velocidad Ventilador', (prev) => {
      const idx = FAN_ORDER.indexOf(prev.fan);
      const next = FAN_ORDER[(idx + 1) % FAN_ORDER.length];
      return { ...prev, power: true, fan: next, turbo: false };
    });
  };

  const cycleGear = () => {
    handleAction('Gear', (prev) => {
      const order: GearLevel[] = ['off', '75', '50'];
      const next = order[(order.indexOf(prev.gearLevel) + 1) % order.length];
      return { ...prev, power: true, gearLevel: next, turbo: false };
    });
  };

  const stepTemp = (delta: number) => {
    handleAction(delta > 0 ? 'Subir Temperatura' : 'Bajar Temperatura', (prev) => {
      const nextTemp = Math.min(profile.maxTemp, Math.max(profile.minTemp, prev.temp + delta));
      return { ...prev, power: true, freezeProtect: false, temp: nextTemp };
    });
  };

  const cycleTimer = (which: 'on' | 'off') => {
    handleAction(which === 'on' ? 'Timer Encendido' : 'Timer Apagado', (prev) => {
      const current = which === 'on' ? prev.timerOnHours : prev.timerOffHours;
      const steps = [0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12];
      const idx = steps.indexOf(current);
      const next = steps[(idx + 1) % steps.length];
      return which === 'on' ? { ...prev, timerOnHours: next } : { ...prev, timerOffHours: next };
    });
  };

  const applyPreset = (label: string, mode: AcMode, temp: number, fan: FanSpeed, eco = false, turbo = false) => {
    handleAction(label, (prev) => ({
      ...prev,
      power: true,
      mode,
      temp: Math.min(profile.maxTemp, Math.max(profile.minTemp, temp)),
      fan,
      eco,
      turbo,
      freezeProtect: false,
      sleep: false,
    }));
  };

  const copyText = async (text: string, kind: 'hex' | 'pronto' | 'raw') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(kind);
      setTimeout(() => setCopiedType(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const renderModeIcon = (mode: AcMode) => {
    switch (mode) {
      case 'cool':
        return <Snowflake className="h-4 w-4" />;
      case 'heat':
        return <Sun className="h-4 w-4" />;
      case 'dry':
        return <Droplets className="h-4 w-4" />;
      case 'fan':
        return <Fan className="h-4 w-4" />;
      case 'auto':
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const fanBars = state.fan === 'auto' ? 4 : state.fan === 'high' ? 4 : state.fan === 'medium' ? 2 : 1;

  const waveBars = useMemo(() => {
    return packet.rawTimingsUs.slice(0, 28).map((us, i) => ({
      isMark: i % 2 === 0,
      widthPct: Math.max(2, Math.min(18, Math.round((Math.abs(us) / 9000) * 18))),
    }));
  }, [packet.rawTimingsUs]);

  const isRg10b = profile.protocol === 'midea_rg10b';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      {/* Left/Center: Tactile Philco Remote Control Unit */}
      <div className="lg:col-span-6 xl:col-span-5">
        <div className="mx-auto w-full max-w-[410px] rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          {/* Remote Top Header & IR Emitter Indicator */}
          <div className="mb-3 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={onOpenModels}
              className="group flex min-h-[44px] items-center gap-2 text-left"
            >
              <AirVent className="h-5 w-5 text-[#005EB8] dark:text-sky-400 shrink-0" />
              <div>
                <div className="text-sm font-bold tracking-tight text-slate-900 group-hover:text-[#005EB8] dark:text-white dark:group-hover:text-sky-400">
                  PHILCO
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[205px]">
                  {profile.remoteModel}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
              <Radio
                key={txPulseId}
                className={`h-4 w-4 transition-transform duration-150 ${
                  txPulseId > 0 ? 'text-[#005EB8] dark:text-sky-400 scale-110' : 'text-slate-400'
                }`}
              />
              <span>{nativeIrReady ? 'IR ACTIVO' : '38kHz'}</span>
            </div>
          </div>

          {/* Recessed LCD Screen */}
          <div
            className={`relative rounded-2xl border p-4 transition-colors duration-200 ${
              !state.power
                ? 'border-slate-300 bg-[#CBD5CE] text-slate-700/70 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400'
                : state.backlight
                  ? 'border-sky-300 bg-[#CBE7F5] text-slate-950 shadow-inner dark:border-sky-700 dark:bg-[#0E2A3A] dark:text-sky-50'
                  : 'border-emerald-900/20 bg-[#DCE6E0] text-[#142621] shadow-inner dark:border-slate-700 dark:bg-[#192825] dark:text-emerald-100'
            }`}
          >
            {/* Top LCD Status Row */}
            <div className="flex items-center justify-between text-[11px] font-mono font-semibold tracking-wide">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  {renderModeIcon(state.mode)}
                  <span>{state.power ? MODE_LABELS[state.mode] : 'APAGADO'}</span>
                </span>
                {state.power && state.turbo && <span>{isRg10b ? 'BOOST' : 'TURBO'}</span>}
                {state.power && state.eco && <span>ECO</span>}
                {state.power && state.gearLevel !== 'off' && <span>{state.gearLevel}%</span>}
              </div>
              <div className="flex items-center gap-2">
                {state.lock && <Lock className="h-3.5 w-3.5" aria-label="Bloqueado" />}
                {state.power && state.sleep && <Moon className="h-3.5 w-3.5" aria-label="Modo Sueño" />}
                {state.power && state.iFeel && <span>{isRg10b ? 'FOLLOW' : 'I-FEEL'}</span>}
                {txPulseId > 0 && <span className="font-bold">TX</span>}
              </div>
            </div>

            {/* Center Temperature & Fan Matrix */}
            <div className="my-3 flex items-end justify-between">
              <div className="flex items-baseline gap-1">
                {state.power ? (
                  state.freezeProtect ? (
                    <span className="font-mono text-4xl font-bold tracking-tight tabular-nums leading-none">
                      FP 8°C
                    </span>
                  ) : (
                    <>
                      <span className="font-mono text-5xl font-bold tracking-tight tabular-nums leading-none">
                        {state.mode === 'fan' ? '--' : state.temp}
                      </span>
                      <span className="font-mono text-xl font-semibold">°C</span>
                    </>
                  )
                ) : (
                  <span className="font-mono text-3xl font-bold tracking-wider">OFF</span>
                )}
              </div>

              {/* Fan Speed Graphic & Swing Indicators */}
              <div className="flex flex-col items-end gap-1.5 font-mono text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="opacity-75">FAN {FAN_LABELS[state.fan]}</span>
                  <div className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
                    {[1, 2, 3, 4].map((lvl) => (
                      <span
                        key={lvl}
                        className={`w-1 rounded-xs ${
                          state.power && lvl <= fanBars
                            ? 'bg-current opacity-100'
                            : 'bg-current opacity-20'
                        }`}
                        style={{ height: `${lvl * 3 + 2}px` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-80">
                  <span>OSC-V:{state.power && state.swingV ? 'ON' : 'OFF'}</span>
                  {state.power && state.breezeAway && <span>BRISA</span>}
                </div>
              </div>
            </div>

            {/* Bottom LCD Indicators */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-current/15 pt-2 font-mono text-[11px]">
              <div className="flex items-center gap-2.5">
                <span>LED:{state.displayLed ? 'ON' : 'OFF'}</span>
                {profile.supportsHealthIon && <span>ION:{state.healthIon ? 'ON' : 'OFF'}</span>}
                {profile.supportsSelfClean && <span>CLEAN:{state.selfClean ? 'ON' : 'OFF'}</span>}
              </div>
              <div className="flex items-center gap-2 tabular-nums">
                {state.timerOnHours > 0 && <span>ON:{state.timerOnHours}h</span>}
                {state.timerOffHours > 0 && <span>OFF:{state.timerOffHours}h</span>}
                {state.timerOnHours === 0 && state.timerOffHours === 0 && <span>TIMER:--</span>}
              </div>
            </div>
          </div>

          {state.lock && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">
              <span>Mando bloqueado para evitar toques accidentales.</span>
              <button
                type="button"
                onClick={() => onUpdateState((p) => ({ ...p, lock: false }), 'Desbloquear')}
                className="font-semibold underline whitespace-nowrap ml-2"
              >
                Desbloquear
              </button>
            </div>
          )}

          {/* Row 1: Power, Mode, Boost / Turbo */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => handleAction(state.power ? 'Apagar' : 'Encender', (p) => ({ ...p, power: !p.power }))}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.97] whitespace-nowrap ${
                state.power
                  ? 'bg-red-600 text-white shadow-sm hover:bg-red-700'
                  : 'bg-[#005EB8] text-white shadow-sm hover:bg-[#004C97]'
              }`}
            >
              <Power className="h-4 w-4 shrink-0" />
              <span>{state.power ? 'Apagar' : 'Encender'}</span>
            </button>

            <button
              type="button"
              onClick={cycleMode}
              className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Wind className="h-4 w-4 text-[#005EB8] dark:text-sky-400 shrink-0" />
              <span>Modo</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleAction(isRg10b ? 'Boost' : 'Turbo', (p) => ({
                  ...p,
                  power: true,
                  turbo: !p.turbo,
                  eco: false,
                  gearLevel: 'off',
                  fan: !p.turbo ? 'high' : p.fan,
                }))
              }
              className={`flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors active:scale-[0.97] whitespace-nowrap ${
                state.power && state.turbo
                  ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                  : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Zap className="h-4 w-4 shrink-0" />
              <span>{isRg10b ? 'Boost' : 'Turbo'}</span>
            </button>
          </div>

          {/* Row 2: Ergonomic Temperature Rocker */}
          <div className="mt-3 grid grid-cols-12 gap-2.5">
            <button
              type="button"
              onClick={() => stepTemp(-1)}
              aria-label="Bajar temperatura"
              className="col-span-5 flex min-h-[60px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 text-base font-bold text-slate-900 transition-colors hover:bg-slate-200 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              <ChevronDown className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              <span>Temp -</span>
            </button>

            <div className="col-span-2 flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-center dark:border-slate-800 dark:bg-slate-950/60">
              <Thermometer className="h-4 w-4 text-slate-400" />
              <span className="mt-0.5 font-mono text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                {state.temp}°
              </span>
            </div>

            <button
              type="button"
              onClick={() => stepTemp(1)}
              aria-label="Subir temperatura"
              className="col-span-5 flex min-h-[60px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 text-base font-bold text-slate-900 transition-colors hover:bg-slate-200 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              <span>Temp +</span>
              <ChevronUp className="h-6 w-6 text-orange-500 dark:text-orange-400" />
            </button>
          </div>

          {/* Direct Mode Selectors */}
          <div className="mt-3 grid grid-cols-5 gap-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800/80">
            {availableModes.map((m) => {
              const active = state.power && state.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    handleAction(`Modo ${MODE_LABELS[m]}`, (p) => ({
                      ...p,
                      power: true,
                      freezeProtect: false,
                      mode: m,
                    }))
                  }
                  className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-[#005EB8] shadow-xs dark:bg-slate-900 dark:text-sky-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {renderModeIcon(m)}
                  <span>{MODE_LABELS[m]}</span>
                </button>
              );
            })}
          </div>

          {/* Row 3: Fan Speed, Swing V, Swing H / Breeze Away */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={cycleFan}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Fan className="h-4 w-4 shrink-0" />
              <span>Vel. Fan</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('Oscilación Vertical', (p) => ({ ...p, power: true, swingV: !p.swingV }))}
              className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition-colors active:scale-[0.97] whitespace-nowrap ${
                state.power && state.swingV
                  ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                  : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <ArrowUpDown className="h-4 w-4 shrink-0" />
              <span>Swing</span>
            </button>

            {profile.supportsBreezeAway ? (
              <button
                type="button"
                onClick={() => handleAction('Breeze Away', (p) => ({ ...p, power: true, breezeAway: !p.breezeAway }))}
                className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition-colors active:scale-[0.97] whitespace-nowrap ${
                  state.power && state.breezeAway
                    ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Wind className="h-4 w-4 shrink-0" />
                <span>Breeze</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!profile.supportsSwingH}
                onClick={() => handleAction('Oscilación Horizontal', (p) => ({ ...p, power: true, swingH: !p.swingH }))}
                className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition-colors active:scale-[0.97] whitespace-nowrap disabled:opacity-40 ${
                  state.power && state.swingH && profile.supportsSwingH
                    ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <ArrowLeftRight className="h-4 w-4 shrink-0" />
                <span>Osc. Horiz</span>
              </button>
            )}
          </div>

          {/* Row 4: Sleep, Eco, Gear (RG10B) / Follow Me / Ion */}
          <div className="mt-2 grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleAction('Modo Sueño', (p) => ({ ...p, power: true, sleep: !p.sleep }))}
              className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.97] whitespace-nowrap ${
                state.power && state.sleep
                  ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <Moon className="h-4 w-4 mb-0.5" />
              <span>Sleep</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleAction('Modo Eco', (p) => ({
                  ...p,
                  power: true,
                  eco: !p.eco,
                  turbo: false,
                  temp: !p.eco && p.mode === 'cool' && p.temp < 24 ? 24 : p.temp,
                }))
              }
              className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.97] whitespace-nowrap ${
                state.power && state.eco
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <Leaf className="h-4 w-4 mb-0.5" />
              <span>Eco</span>
            </button>

            {profile.supportsGear ? (
              <button
                type="button"
                onClick={cycleGear}
                className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.97] whitespace-nowrap ${
                  state.power && state.gearLevel !== 'off'
                    ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <Gauge className="h-4 w-4 mb-0.5" />
                <span>{state.gearLevel === 'off' ? 'Gear' : `Gear ${state.gearLevel}%`}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!profile.supportsHealthIon}
                onClick={() => handleAction('Salud / Ion', (p) => ({ ...p, power: true, healthIon: !p.healthIon }))}
                className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.97] whitespace-nowrap disabled:opacity-40 ${
                  state.power && state.healthIon && profile.supportsHealthIon
                    ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <ShieldCheck className="h-4 w-4 mb-0.5" />
                <span>Salud</span>
              </button>
            )}

            <button
              type="button"
              disabled={!profile.supportsIFeel}
              onClick={() => handleAction(isRg10b ? 'Follow Me' : 'Sensor I-Feel', (p) => ({ ...p, power: true, iFeel: !p.iFeel }))}
              className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.97] whitespace-nowrap disabled:opacity-40 ${
                state.power && state.iFeel && profile.supportsIFeel
                  ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <Thermometer className="h-4 w-4 mb-0.5" />
              <span>{isRg10b ? 'Follow Me' : 'I-Feel'}</span>
            </button>
          </div>

          {/* Row 5: Timer On, Timer Off, Display LED, Clean / FP 8C */}
          <div className="mt-2 grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => cycleTimer('on')}
              className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.97] whitespace-nowrap ${
                state.timerOnHours > 0
                  ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <Clock className="h-4 w-4 mb-0.5" />
              <span>{state.timerOnHours > 0 ? `On ${state.timerOnHours}h` : 'Timer On'}</span>
            </button>

            <button
              type="button"
              onClick={() => cycleTimer('off')}
              className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.97] whitespace-nowrap ${
                state.timerOffHours > 0
                  ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <Clock className="h-4 w-4 mb-0.5" />
              <span>{state.timerOffHours > 0 ? `Off ${state.timerOffHours}h` : 'Timer Off'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('Display LED', (p) => ({ ...p, displayLed: !p.displayLed }))}
              className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.97] whitespace-nowrap ${
                state.displayLed
                  ? 'border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Lightbulb className="h-4 w-4 mb-0.5" />
              <span>LED</span>
            </button>

            <button
              type="button"
              disabled={!profile.supportsSelfClean}
              onClick={() => handleAction('Auto-Limpieza', (p) => ({ ...p, selfClean: !p.selfClean }))}
              className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-[11px] font-semibold transition-colors active:scale-[0.97] whitespace-nowrap disabled:opacity-40 ${
                state.selfClean && profile.supportsSelfClean
                  ? 'border-[#005EB8] bg-[#005EB8]/10 text-[#005EB8] dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <Sparkles className="h-4 w-4 mb-0.5" />
              <span>Clean</span>
            </button>
          </div>

          {/* Row 6: Utility Strip + FP 8C for RG10B */}
          <div className={`mt-3 grid gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 ${profile.supportsFreezeProtect ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {profile.supportsFreezeProtect && (
              <button
                type="button"
                onClick={() =>
                  handleAction('Protección 8°C', (p) => ({
                    ...p,
                    power: true,
                    mode: 'heat',
                    freezeProtect: !p.freezeProtect,
                  }))
                }
                className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl px-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  state.power && state.freezeProtect
                    ? 'bg-[#005EB8] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <ThermometerSnowflake className="h-3.5 w-3.5" />
                <span>FP 8°C</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onUpdateState((p) => ({ ...p, backlight: !p.backlight }), 'Luz LCD')}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              <span>Luz LCD</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateState((p) => ({ ...p, lock: !p.lock }), 'Bloqueo')}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              {state.lock ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              <span>{state.lock ? 'Desbloq.' : 'Bloquear'}</span>
            </button>

            <button
              type="button"
              onClick={onResetState}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reiniciar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Quick Presets & Real-Time IR Signal Inspector */}
      <div className="space-y-4 lg:col-span-6 xl:col-span-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Accesos Rápidos Philco
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              1 toque envía trama completa
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => applyPreset('Preset 24° Eco', 'cool', 24, 'auto', true, false)}
              className="flex min-h-[48px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition-colors hover:border-[#005EB8] hover:bg-sky-50/50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-sky-500"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">24°C Eco</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Frío · Fan Auto</div>
              </div>
              <Leaf className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => applyPreset('Boost', 'cool', 18, 'high', false, true)}
              className="flex min-h-[48px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition-colors hover:border-[#005EB8] hover:bg-sky-50/50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-sky-500"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isRg10b ? '18°C Boost' : '18°C Turbo'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Enfriamiento rápido</div>
              </div>
              <Snowflake className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
            </button>

            {profile.supportsHeat && (
              <button
                type="button"
                onClick={() => applyPreset('Preset Calor 26°', 'heat', 26, 'medium', false, false)}
                className="flex min-h-[48px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition-colors hover:border-[#005EB8] hover:bg-sky-50/50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-sky-500"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">26°C Calor</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Calefacción media</div>
                </div>
                <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
              </button>
            )}
          </div>
        </section>

        {/* Live IR Frame & Pura 80 Transmission Inspector */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Señal Infrarroja Generada en Vivo
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {packet.protocolName} · {packet.carrierKhz} kHz · {packet.bitsCount} bits
              </p>
            </div>
            {lastTxStatus && (
              <span className="text-xs font-medium text-[#005EB8] dark:text-sky-400">
                {lastTxStatus}
              </span>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>MODULACIÓN 38 kHz</span>
              <span className="tabular-nums">{packet.rawTimingsUs.length} pulsos</span>
            </div>
            <div className="flex h-8 items-end gap-0.5 overflow-hidden" aria-hidden="true">
              {waveBars.map((bar, idx) => (
                <div
                  key={idx}
                  className={`rounded-xs ${
                    bar.isMark
                      ? 'bg-[#005EB8] dark:bg-sky-400'
                      : 'bg-slate-300/60 dark:bg-slate-800'
                  }`}
                  style={{
                    width: `${bar.widthPct}%`,
                    height: bar.isMark ? '100%' : '20%',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Trama Hexadecimal (con Checksum)
                </span>
                <button
                  type="button"
                  onClick={() => copyText(packet.hexBytes, 'hex')}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#005EB8] hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800"
                >
                  {copiedType === 'hex' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedType === 'hex' ? 'Copiado' : 'Copiar Hex'}</span>
                </button>
              </div>
              <code className="mt-1 block break-all font-mono text-xs text-slate-900 dark:text-slate-100">
                {packet.hexBytes}
              </code>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => copyText(packet.prontoHex, 'pronto')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {copiedType === 'pronto' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                <span>{copiedType === 'pronto' ? 'Pronto Hex copiado' : 'Copiar Pronto Hex'}</span>
              </button>

              <button
                type="button"
                onClick={() => copyText(packet.flipperBlock, 'raw')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {copiedType === 'raw' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                <span>{copiedType === 'raw' ? 'IR Raw copiado' : 'Copiar Raw (.ir / ESP)'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Active Profile Huawei Pura 80 & Universal Codes Quick Card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Códigos para {profile.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {profile.notes}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800 sm:grid-cols-2">
            <div>
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                Huawei Control Inteligente (Pura 80)
              </div>
              <div className="mt-1 text-slate-600 dark:text-slate-400">
                {profile.huaweiSmartBrand.join(' · ')}
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                Control Universal K-1028E / KT-9018E
              </div>
              <div className="mt-1 font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                {profile.universalCodes.k1028e.join(' · ')}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>
              IR Nativo Pura 80: {nativeIrReady ? 'Conectado (ConsumerIrManager)' : 'Modo Navegador'} · Puente Wi-Fi: {bridgeConfig.enabled && bridgeConfig.endpointUrl ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};
