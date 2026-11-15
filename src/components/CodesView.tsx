import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Download, Info, OctagonAlert, Search } from 'lucide-react';
import { PHILCO_ERROR_CODES, UNIVERSAL_CODE_DIRECTORY } from '../data/philcoDatabase';
import { AcState, PhilcoProfile } from '../types/ac';
import { encodePhilcoIrPacket } from '../utils/irEngine';

interface CodesViewProps {
  profile: PhilcoProfile;
  currentState: AcState;
}

type CodesSubTab = 'universal' | 'ir_table' | 'errors';

interface PresetCommand {
  id: string;
  name: string;
  description: string;
  patch: Partial<AcState>;
}

const PRESET_COMMANDS: PresetCommand[] = [
  {
    id: 'power_on_cool_24',
    name: 'Encender Frío 24°C (Auto)',
    description: 'Modo Frío estándar de bajo consumo',
    patch: { power: true, mode: 'cool', temp: 24, fan: 'auto', eco: false, turbo: false },
  },
  {
    id: 'power_on_cool_18_turbo',
    name: 'Encender Frío 18°C Turbo',
    description: 'Máxima potencia de enfriamiento',
    patch: { power: true, mode: 'cool', temp: 18, fan: 'high', turbo: true, eco: false },
  },
  {
    id: 'power_on_eco_24',
    name: 'Modo Eco 24°C',
    description: 'Ahorro energético nocturno o diurno',
    patch: { power: true, mode: 'cool', temp: 24, fan: 'auto', eco: true, turbo: false },
  },
  {
    id: 'power_on_heat_25',
    name: 'Encender Calor 25°C',
    description: 'Calefacción media confortable',
    patch: { power: true, mode: 'heat', temp: 25, fan: 'medium', turbo: false, eco: false },
  },
  {
    id: 'mode_dry',
    name: 'Deshumidificador (Seco)',
    description: 'Reduce humedad ambiental sin enfriar en exceso',
    patch: { power: true, mode: 'dry', temp: 24, fan: 'low', turbo: false, eco: false },
  },
  {
    id: 'mode_fan',
    name: 'Solo Ventilador',
    description: 'Circulación de aire sin compresor',
    patch: { power: true, mode: 'fan', temp: 24, fan: 'medium', turbo: false, eco: false },
  },
  {
    id: 'swing_toggle',
    name: 'Activar Oscilación Vertical',
    description: 'Movimiento automático de aleta deflectora',
    patch: { power: true, swingV: true },
  },
  {
    id: 'power_off',
    name: 'Apagar Aire (Power OFF)',
    description: 'Trama completa de apagado',
    patch: { power: false },
  },
];

export const CodesView: React.FC<CodesViewProps> = ({ profile, currentState }) => {
  const [subTab, setSubTab] = useState<CodesSubTab>('universal');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorSearch, setErrorSearch] = useState('');

  const copyValue = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const generatedCommands = useMemo(() => {
    return PRESET_COMMANDS.filter((c) => profile.supportsHeat || c.patch.mode !== 'heat').map((cmd) => {
      const merged: AcState = { ...currentState, ...cmd.patch };
      const packet = encodePhilcoIrPacket(profile.protocol, merged);
      return {
        ...cmd,
        packet,
      };
    });
  }, [profile, currentState]);

  const filteredErrors = useMemo(() => {
    const q = errorSearch.trim().toLowerCase();
    if (!q) return PHILCO_ERROR_CODES;
    return PHILCO_ERROR_CODES.filter(
      (err) =>
        err.code.toLowerCase().includes(q) ||
        err.meaning.toLowerCase().includes(q) ||
        err.series.toLowerCase().includes(q)
    );
  }, [errorSearch]);

  const downloadIrFile = () => {
    const blocks = generatedCommands.map((c) => c.packet.flipperBlock).join('\n#\n');
    const blob = new Blob([blocks], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.id}-philco.ir`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Segmented Sub-Navigation */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800/80">
        <button
          type="button"
          onClick={() => setSubTab('universal')}
          className={`min-h-[44px] rounded-lg px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
            subTab === 'universal'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Códigos Universales
        </button>
        <button
          type="button"
          onClick={() => setSubTab('ir_table')}
          className={`min-h-[44px] rounded-lg px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
            subTab === 'ir_table'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Tramas IR / Hex
        </button>
        <button
          type="button"
          onClick={() => setSubTab('errors')}
          className={`min-h-[44px] rounded-lg px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
            subTab === 'errors'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Códigos de Falla
        </button>
      </div>

      {/* Tab 1: Universal Remote Codes */}
      {subTab === 'universal' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Códigos recomendados para {profile.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Toque cualquier código para copiarlo. Control original de referencia: {profile.remoteModel}.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Chunghop K-1028E / Universal 1000-en-1
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.universalCodes.k1028e.map((code) => (
                    <button
                      key={`k1028-${code}`}
                      type="button"
                      onClick={() => copyValue(code, `k1028-${code}`)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-sm font-bold text-slate-900 hover:border-[#005EB8] dark:border-slate-700 dark:bg-slate-800 dark:text-white tabular-nums"
                    >
                      <span>{code}</span>
                      {copiedKey === `k1028-${code}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Qunda KT-9018E / KT-N828
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.universalCodes.kt9018e.map((code) => (
                    <button
                      key={`kt9018-${code}`}
                      type="button"
                      onClick={() => copyValue(code, `kt9018-${code}`)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-sm font-bold text-slate-900 hover:border-[#005EB8] dark:border-slate-700 dark:bg-slate-800 dark:text-white tabular-nums"
                    >
                      <span>{code}</span>
                      {copiedKey === `kt9018-${code}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Guía Completa por Marca de Control Universal
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {UNIVERSAL_CODE_DIRECTORY.map((item) => (
                <article
                  key={item.brandControl}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.brandControl}
                  </h4>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {item.codes.map((c) => (
                      <button
                        key={`${item.brandControl}-${c}`}
                        type="button"
                        onClick={() => copyValue(c, `${item.brandControl}-${c}`)}
                        className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs font-semibold text-slate-800 hover:border-[#005EB8] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 tabular-nums"
                      >
                        <span>{c}</span>
                        {copiedKey === `${item.brandControl}-${c}` && (
                          <Check className="h-3 w-3 text-emerald-600" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.pairingSteps}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: IR Hex / Pronto / Flipper Table */}
      {subTab === 'ir_table' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Comandos IR — {profile.protocolLabel}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Códigos listos en Pronto Hex y Raw 38 kHz para apps IR externas, Broadlink, ESPHome o Flipper Zero.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadIrFile}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#005EB8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#004C97] whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>Descargar archivo .ir</span>
            </button>
          </div>

          <div className="space-y-3">
            {generatedCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cmd.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{cmd.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyValue(cmd.packet.prontoHex, `pronto-${cmd.id}`)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {copiedKey === `pronto-${cmd.id}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>Pronto Hex</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyValue(cmd.packet.rawTimingsUs.join(', '), `raw-${cmd.id}`)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {copiedKey === `raw-${cmd.id}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>Raw (μs)</span>
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 rounded-xl bg-slate-50 p-2.5 font-mono text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300 break-all">
                  {cmd.packet.hexBytes}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 3: Philco AC Display Error Codes */}
      {subTab === 'errors' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Códigos de Error en Pantalla Philco
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Consulte el significado de códigos como E1, E6, F1, H1 o P0 en el display del split.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={errorSearch}
                onChange={(e) => setErrorSearch(e.target.value)}
                placeholder="Buscar código (E6, H1, sensor...)"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#005EB8] focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredErrors.map((err) => {
              const severityLabel =
                err.severity === 'critical'
                  ? 'Revisión prioritaria'
                  : err.severity === 'warning'
                    ? 'Advertencia'
                    : 'Ciclo informativo';
              const SeverityIcon =
                err.severity === 'critical'
                  ? OctagonAlert
                  : err.severity === 'warning'
                    ? AlertTriangle
                    : Info;
              const severityColor =
                err.severity === 'critical'
                  ? 'text-red-600 dark:text-red-400'
                  : err.severity === 'warning'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-[#005EB8] dark:text-sky-400';

              return (
                <article
                  key={err.code}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                      {err.code}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${severityColor}`}>
                      <SeverityIcon className="h-3.5 w-3.5" />
                      <span>{severityLabel}</span>
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{err.series}</div>
                  <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {err.meaning}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    <strong>Acción recomendada:</strong> {err.action}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
