import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  Radio,
  Send,
  Smartphone,
  Vibrate,
  Volume2,
  Wifi,
} from 'lucide-react';
import { BridgeConfig, PhilcoProfile } from '../types/ac';
import {
  downloadAndroidIrProjectZip,
  getNativeAndroidKotlinSource,
} from '../utils/androidProjectGenerator';
import { isNativeHuaweiIrAvailable } from '../utils/irEngine';
import { PWAInstallButton } from './PWAControls';

interface Pura80GuideViewProps {
  profile: PhilcoProfile;
  bridgeConfig: BridgeConfig;
  onUpdateBridgeConfig: (next: BridgeConfig) => void;
  onTestBridge: () => Promise<{ ok: boolean; message: string }>;
}

export const Pura80GuideView: React.FC<Pura80GuideViewProps> = ({
  profile,
  bridgeConfig,
  onUpdateBridgeConfig,
  onTestBridge,
}) => {
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [copiedKotlin, setCopiedKotlin] = useState(false);

  const nativeIrActive = isNativeHuaweiIrAvailable();
  const kotlinCode = getNativeAndroidKotlinSource();

  const handleTest = async () => {
    setTesting(true);
    const res = await onTestBridge();
    setTestResult(res);
    setTesting(false);
  };

  const handleCopyKotlin = async () => {
    try {
      await navigator.clipboard.writeText(kotlinCode);
      setCopiedKotlin(true);
      setTimeout(() => setCopiedKotlin(false), 1800);
    } catch {
      // Ignore
    }
  };

  const handleDownloadKotlin = () => {
    const blob = new Blob([kotlinCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MainActivity.kt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Huawei Pura 80 Hardware Reality & RG10B(F)/BGEF Setup */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-6 w-6 text-[#005EB8] dark:text-sky-400 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Infrarrojo del Huawei Pura 80 y Control RG10B(F)/BGEF
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Estado actual:{' '}
                <strong className={nativeIrActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}>
                  {nativeIrActive
                    ? 'Emisor IR Nativo Conectado (ConsumerIrManager activo)'
                    : 'Ejecutando en navegador web (Chrome / Huawei Browser)'}
                </strong>
                . Los navegadores web bloquean por seguridad el acceso directo al diodo IR del teléfono, por lo que para disparar infrarrojo real desde el Pura 80 dispone de estas opciones:
              </p>
            </div>
          </div>
          <PWAInstallButton />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="text-xs font-bold text-[#005EB8] dark:text-sky-400">
              1. Uso inmediato hoy (Control Inteligente Huawei)
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Para usar el IR del Pura 80 sin compilar nada, abra <strong>Control Inteligente</strong> en su Huawei, elija Aire Acondicionado y pruebe:{' '}
              <strong>{profile.huaweiSmartBrand.join(', ')}</strong>. Para <strong>RG10B(F)/BGEF</strong>, el perfil <strong>Midea (RG10B)</strong> habilita Boost, Eco y Calor completos.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="text-xs font-bold text-[#005EB8] dark:text-sky-400">
              2. APK Nativo con esta misma interfaz (Kotlin IR)
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Esta app ya incorpora el puente JS <code className="font-mono">window.HuaweiIRBridge</code>. Si compila el archivo <strong>MainActivity.kt</strong> de abajo en un APK Android (con permiso <code className="font-mono">TRANSMIT_IR</code>), cada botón de esta app disparará directo el LED IR del Pura 80.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="text-xs font-bold text-[#005EB8] dark:text-sky-400">
              3. Desde el navegador vía Wi-Fi IR o USB-C
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Instale esta app como PWA en su pantalla de inicio y conéctela a un emisor Wi-Fi IR (Tasmota / ESPHome) o use un LED IR pasivo USB-C con <strong>Audio-IR 38 kHz</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Native Android ConsumerIrManager Bridge Code for Huawei Pura 80 APK */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Code2 className="mt-0.5 h-5 w-5 text-[#005EB8] dark:text-sky-400 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                App Android 100% Nativa en Kotlin para Huawei Pura 80
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Proyecto offline sin WebView ni internet: usa directamente <code className="font-mono">ConsumerIrManager</code> con el protocolo RG10B(F)/BGEF y los 5 chasis Philco.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyKotlin}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {copiedKotlin ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copiedKotlin ? 'Copiado' : 'Copiar Kotlin'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadKotlin}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Download className="h-4 w-4" />
              <span>MainActivity.kt</span>
            </button>
            <button
              type="button"
              onClick={() => downloadAndroidIrProjectZip()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#005EB8] px-3.5 text-xs font-semibold text-white hover:bg-[#004C97]"
            >
              <Download className="h-4 w-4" />
              <span>Descargar Proyecto Android (.zip)</span>
            </button>
          </div>
        </div>

        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          <strong>Instalación por cable USB desde PC:</strong> Un sitio web en la nube no tiene acceso físico al puerto USB de su PC ni compila binarios APK en el navegador. El archivo <code className="font-mono">.zip</code> incluye <code className="font-mono">instalar-por-cable.bat</code> (Windows), <code className="font-mono">instalar-por-cable.sh</code> (Mac/Linux) y compilación automática en GitHub Actions para instalar por cable con <strong>Depuración USB (ADB)</strong> o directamente desde <strong>Android Studio (Run ▶)</strong>.
        </p>

        <pre className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          {kotlinCode}
        </pre>
      </section>

      {/* Tactile & Audio-IR Preferences */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Preferencias de Respuesta y Emisión en Pura 80
        </h3>

        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-start gap-3">
              <Vibrate className="mt-0.5 h-5 w-5 text-slate-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Vibración háptica al pulsar
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Pulso corto de confirmación en cada botón del mando.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={bridgeConfig.hapticEnabled}
              onClick={() =>
                onUpdateBridgeConfig({ ...bridgeConfig, hapticEnabled: !bridgeConfig.hapticEnabled })
              }
              className={`min-h-[44px] min-w-[68px] rounded-xl px-3 text-xs font-bold transition-colors ${
                bridgeConfig.hapticEnabled
                  ? 'bg-[#005EB8] text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {bridgeConfig.hapticEnabled ? 'Activo' : 'No'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-start gap-3">
              <Volume2 className="mt-0.5 h-5 w-5 text-slate-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sonido de clic táctil
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Emite un clic discreto estilo control físico al tocar teclas.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={bridgeConfig.soundClickEnabled}
              onClick={() =>
                onUpdateBridgeConfig({
                  ...bridgeConfig,
                  soundClickEnabled: !bridgeConfig.soundClickEnabled,
                })
              }
              className={`min-h-[44px] min-w-[68px] rounded-xl px-3 text-xs font-bold transition-colors ${
                bridgeConfig.soundClickEnabled
                  ? 'bg-[#005EB8] text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {bridgeConfig.soundClickEnabled ? 'Activo' : 'No'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-start gap-3">
              <Radio className="mt-0.5 h-5 w-5 text-slate-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Síntesis Audio-IR 38 kHz (Emisor USB-C / Jack)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Genera señal diferencial de 19 kHz en estéreo para LEDs IR pasivos conectados al USB-C del teléfono.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={bridgeConfig.audioIrEnabled}
              onClick={() =>
                onUpdateBridgeConfig({ ...bridgeConfig, audioIrEnabled: !bridgeConfig.audioIrEnabled })
              }
              className={`min-h-[44px] min-w-[68px] rounded-xl px-3 text-xs font-bold transition-colors ${
                bridgeConfig.audioIrEnabled
                  ? 'bg-[#005EB8] text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {bridgeConfig.audioIrEnabled ? 'Activo' : 'No'}
            </button>
          </div>
        </div>
      </section>

      {/* Wi-Fi IR Bridge Configuration */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Wifi className="h-5 w-5 text-[#005EB8] dark:text-sky-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Puente Wi-Fi IR (Control Real desde el Navegador)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Envía automáticamente cada comando Raw/Pronto/JSON a su emisor IR local en la red Wi-Fi.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={bridgeConfig.enabled}
            onClick={() => onUpdateBridgeConfig({ ...bridgeConfig, enabled: !bridgeConfig.enabled })}
            className={`min-h-[44px] min-w-[80px] rounded-xl px-3 text-xs font-bold transition-colors ${
              bridgeConfig.enabled
                ? 'bg-[#005EB8] text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {bridgeConfig.enabled ? 'Habilitado' : 'Inactivo'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tipo de Emisor / Firmware
            </label>
            <select
              value={bridgeConfig.type}
              onChange={(e) =>
                onUpdateBridgeConfig({
                  ...bridgeConfig,
                  type: e.target.value as BridgeConfig['type'],
                })
              }
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#005EB8] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="tasmota">Tasmota IR (HTTP cmnd IRSend)</option>
              <option value="esphome">ESPHome / ESP32 IR</option>
              <option value="homeassistant">Home Assistant Webhook</option>
              <option value="webhook">Webhook JSON Personalizado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              URL / IP del Emisor en su Wi-Fi
            </label>
            <input
              type="url"
              value={bridgeConfig.endpointUrl}
              onChange={(e) =>
                onUpdateBridgeConfig({ ...bridgeConfig, endpointUrl: e.target.value })
              }
              placeholder="http://192.168.1.50/cm"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#005EB8] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Token de Autorización (opcional para Home Assistant)
            </label>
            <input
              type="password"
              value={bridgeConfig.authToken}
              onChange={(e) =>
                onUpdateBridgeConfig({ ...bridgeConfig, authToken: e.target.value })
              }
              placeholder="Bearer token (solo si su servidor lo solicita)"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#005EB8] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={testing || !bridgeConfig.endpointUrl.trim()}
            onClick={handleTest}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Send className="h-4 w-4" />
            <span>{testing ? 'Enviando prueba...' : 'Probar Envío IR por Wi-Fi'}</span>
          </button>

          {testResult && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                testResult.ok
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{testResult.message}</span>
            </span>
          )}
        </div>
      </section>
    </div>
  );
};
