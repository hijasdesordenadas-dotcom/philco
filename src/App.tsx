import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Cpu, Layers, Moon, SlidersHorizontal, Smartphone, Sun } from 'lucide-react';
import { PHILCO_PROFILES } from './data/philcoDatabase';
import { AcState, BridgeConfig, PhilcoProfile, SavedRoom } from './types/ac';
import {
  encodePhilcoIrPacket,
  isNativeHuaweiIrAvailable,
  playAudioIrSignal,
  playTactileClick,
  transmitNativeHuaweiIr,
} from './utils/irEngine';
import { PhilcoRemote } from './components/PhilcoRemote';
import { ModelsView } from './components/ModelsView';
import { CodesView } from './components/CodesView';
import { Pura80GuideView } from './components/Pura80GuideView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';

type ActiveTab = 'remote' | 'models' | 'codes' | 'pura80';

const DEFAULT_AC_STATE: AcState = {
  power: true,
  mode: 'cool',
  temp: 24,
  fan: 'auto',
  swingV: true,
  swingH: false,
  turbo: false,
  eco: false,
  gearLevel: 'off',
  breezeAway: false,
  freezeProtect: false,
  sleep: false,
  displayLed: true,
  healthIon: false,
  iFeel: false,
  selfClean: false,
  timerOnHours: 0,
  timerOffHours: 0,
  lock: false,
  backlight: true,
};

const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  enabled: false,
  type: 'tasmota',
  endpointUrl: '',
  authToken: '',
  audioIrEnabled: false,
  soundClickEnabled: true,
  hapticEnabled: true,
};

const DEFAULT_ROOMS: SavedRoom[] = [
  {
    id: 'room-living',
    roomName: 'Living',
    profileId: 'philco-rg10b-bgef',
    customModel: 'RG10B(F)/BGEF',
    lastTemp: 24,
    lastMode: 'cool',
  },
];

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

function loadArrayJson<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('remote');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('philco_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('philco_profile_id');
      return raw ? (JSON.parse(raw) as string) : PHILCO_PROFILES[0].id;
    } catch {
      return PHILCO_PROFILES[0].id;
    }
  });
  const [acState, setAcState] = useState<AcState>(() =>
    loadJson<AcState>('philco_ac_state', DEFAULT_AC_STATE)
  );
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>(() =>
    loadArrayJson<SavedRoom>('philco_saved_rooms', DEFAULT_ROOMS)
  );
  const [bridgeConfig, setBridgeConfig] = useState<BridgeConfig>(() =>
    loadJson<BridgeConfig>('philco_bridge_config', DEFAULT_BRIDGE_CONFIG)
  );
  const [lastActionLabel, setLastActionLabel] = useState<string>('');
  const [lastTxStatus, setLastTxStatus] = useState<string | null>(null);
  const [txPulseId, setTxPulseId] = useState<number>(0);

  const activeProfile: PhilcoProfile = useMemo(
    () => PHILCO_PROFILES.find((p) => p.id === activeProfileId) ?? PHILCO_PROFILES[0],
    [activeProfileId]
  );

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('philco_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem('philco_profile_id', JSON.stringify(activeProfileId));
    } catch {
      // Ignore
    }
  }, [activeProfileId]);

  useEffect(() => {
    try {
      localStorage.setItem('philco_ac_state', JSON.stringify(acState));
    } catch {
      // Ignore
    }
  }, [acState]);

  useEffect(() => {
    try {
      localStorage.setItem('philco_saved_rooms', JSON.stringify(savedRooms));
    } catch {
      // Ignore
    }
  }, [savedRooms]);

  useEffect(() => {
    try {
      localStorage.setItem('philco_bridge_config', JSON.stringify(bridgeConfig));
    } catch {
      // Ignore
    }
  }, [bridgeConfig]);

  const dispatchBridgePayload = async (
    nextState: AcState,
    actionLabel: string,
    profile: PhilcoProfile
  ): Promise<{ ok: boolean; message: string }> => {
    const packet = encodePhilcoIrPacket(profile.protocol, nextState, actionLabel);
    if (!bridgeConfig.endpointUrl.trim()) {
      return { ok: false, message: 'Ingrese la URL del emisor Wi-Fi IR.' };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (bridgeConfig.authToken.trim()) {
        headers['Authorization'] = `Bearer ${bridgeConfig.authToken.trim()}`;
      }

      if (bridgeConfig.type === 'tasmota') {
        const cmnd = encodeURIComponent(
          `IRSend {"Protocol":"RAW","Bits":${packet.bitsCount},"Data":[${packet.rawTimingsUs.join(',')}]}`
        );
        const sep = bridgeConfig.endpointUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${bridgeConfig.endpointUrl}${sep}cmnd=${cmnd}`, {
          method: 'GET',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        const res = await fetch(bridgeConfig.endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: actionLabel,
            brand: 'Philco',
            remoteModel: profile.remoteModel,
            protocol: profile.protocol,
            state: nextState,
            hex: packet.hexBytes,
            prontoHex: packet.prontoHex,
            rawTimingsUs: packet.rawTimingsUs,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      return { ok: true, message: `Enviado (${actionLabel})` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de red';
      return { ok: false, message: `Sin respuesta del puente (${msg})` };
    }
  };

  const handleUpdateAcState = (updater: (prev: AcState) => AcState, actionLabel: string) => {
    const nextState = updater(acState);
    setAcState(nextState);
    setLastActionLabel(actionLabel);
    setTxPulseId((n) => n + 1);

    if (bridgeConfig.hapticEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(18);
    }
    if (bridgeConfig.soundClickEnabled) {
      playTactileClick();
    }

    const packet = encodePhilcoIrPacket(activeProfile.protocol, nextState, actionLabel);

    const nativeSent = isNativeHuaweiIrAvailable()
      ? transmitNativeHuaweiIr(packet.carrierKhz, packet.rawTimingsUs)
      : false;

    if (bridgeConfig.audioIrEnabled) {
      playAudioIrSignal(packet.rawTimingsUs);
    }

    if (nativeSent) {
      setLastTxStatus(`IR Pura 80 emitido · ${actionLabel}`);
    } else if (bridgeConfig.enabled && bridgeConfig.endpointUrl.trim()) {
      setLastTxStatus(`Enviando ${actionLabel}...`);
      dispatchBridgePayload(nextState, actionLabel, activeProfile).then((res) => {
        setLastTxStatus(res.message);
      });
    } else if (bridgeConfig.audioIrEnabled) {
      setLastTxStatus(`Audio-IR 38kHz · ${actionLabel}`);
    } else {
      setLastTxStatus(`Trama lista · ${actionLabel}`);
    }
  };

  const handleResetState = () => {
    handleUpdateAcState(() => DEFAULT_AC_STATE, 'Reiniciar mando');
  };

  const handleSelectProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    const nextProf = PHILCO_PROFILES.find((p) => p.id === profileId) ?? PHILCO_PROFILES[0];
    setAcState((prev) => ({
      ...prev,
      temp: Math.min(nextProf.maxTemp, Math.max(nextProf.minTemp, prev.temp)),
      mode: !nextProf.supportsHeat && prev.mode === 'heat' ? 'cool' : prev.mode,
    }));
    setActiveTab('remote');
  };

  const handleSelectRoom = (room: SavedRoom) => {
    setActiveProfileId(room.profileId);
    setAcState((prev) => ({
      ...prev,
      temp: room.lastTemp,
      mode: room.lastMode,
    }));
    setActiveTab('remote');
  };

  const handleAddRoom = (roomName: string, profileId: string, customModel: string) => {
    const newRoom: SavedRoom = {
      id: `room-${Date.now()}`,
      roomName,
      profileId,
      customModel,
      lastTemp: acState.temp,
      lastMode: acState.mode,
    };
    setSavedRooms((prev) => [...prev, newRoom]);
  };

  const handleDeleteRoom = (roomId: string) => {
    setSavedRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: typeof SlidersHorizontal }> = [
    { id: 'remote', label: 'Control', icon: SlidersHorizontal },
    { id: 'models', label: 'Modelos', icon: Layers },
    { id: 'codes', label: 'Códigos', icon: BookOpen },
    { id: 'pura80', label: 'Pura 80', icon: Smartphone },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-16 lg:gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('remote')}
            className="text-left text-base font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 lg:text-lg"
          >
            Philco AC Control
          </button>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Navegación principal">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[44px] border-b-2 px-1 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[#005EB8] text-[#005EB8] dark:border-sky-400 dark:text-sky-400'
                      : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:min-h-[44px] lg:min-w-[44px]"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <PWAInstallButton compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6 lg:pb-12 lg:pt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-[#005EB8] dark:text-sky-400 shrink-0" />
            <span>
              Equipo activo: <strong className="text-slate-800 dark:text-slate-200">{activeProfile.name}</strong> ·{' '}
              {activeProfile.remoteModel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className="font-semibold text-[#005EB8] hover:underline dark:text-sky-400 whitespace-nowrap"
          >
            Cambiar modelo
          </button>
        </div>

        {activeTab === 'remote' && (
          <PhilcoRemote
            profile={activeProfile}
            state={acState}
            bridgeConfig={bridgeConfig}
            lastActionLabel={lastActionLabel}
            lastTxStatus={lastTxStatus}
            txPulseId={txPulseId}
            onUpdateState={handleUpdateAcState}
            onResetState={handleResetState}
            onOpenModels={() => setActiveTab('models')}
          />
        )}

        {activeTab === 'models' && (
          <ModelsView
            activeProfileId={activeProfile.id}
            savedRooms={savedRooms}
            onSelectProfile={handleSelectProfile}
            onSelectRoom={handleSelectRoom}
            onAddRoom={handleAddRoom}
            onDeleteRoom={handleDeleteRoom}
          />
        )}

        {activeTab === 'codes' && (
          <CodesView profile={activeProfile} currentState={acState} />
        )}

        {activeTab === 'pura80' && (
          <Pura80GuideView
            profile={activeProfile}
            bridgeConfig={bridgeConfig}
            onUpdateBridgeConfig={setBridgeConfig}
            onTestBridge={() => dispatchBridgePayload(acState, 'Prueba Wi-Fi IR', activeProfile)}
          />
        )}
      </main>

      <OfflineIndicator />

      <nav
        aria-label="Navegación inferior"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden pb-safe"
      >
        <div className="mx-auto grid h-[58px] max-w-md grid-cols-4 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? 'text-[#005EB8] dark:text-sky-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
