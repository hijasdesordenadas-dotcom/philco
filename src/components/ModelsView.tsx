import React, { useMemo, useState } from 'react';
import { AirVent, Check, Plus, Search, Trash2 } from 'lucide-react';
import { PHILCO_PROFILES } from '../data/philcoDatabase';
import { AcCategory, AcMode, PhilcoProfile, SavedRoom } from '../types/ac';

interface ModelsViewProps {
  activeProfileId: string;
  savedRooms: SavedRoom[];
  onSelectProfile: (profileId: string) => void;
  onSelectRoom: (room: SavedRoom) => void;
  onAddRoom: (roomName: string, profileId: string, customModel: string) => void;
  onDeleteRoom: (roomId: string) => void;
}

const CATEGORIES: Array<'Todos' | AcCategory> = [
  'Todos',
  'Split Inverter',
  'Split On/Off',
  'Portátil',
  'Piso-Techo / Ventana',
];

const MODE_TEXT: Record<AcMode, string> = {
  auto: 'Auto',
  cool: 'Frío',
  dry: 'Deshum.',
  fan: 'Ventilador',
  heat: 'Calor',
};

export const ModelsView: React.FC<ModelsViewProps> = ({
  activeProfileId,
  savedRooms,
  onSelectProfile,
  onSelectRoom,
  onAddRoom,
  onDeleteRoom,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'Todos' | AcCategory>('Todos');
  const [roomName, setRoomName] = useState('');
  const [roomModel, setRoomModel] = useState('');
  const [roomProfileId, setRoomProfileId] = useState(activeProfileId);

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PHILCO_PROFILES.filter((p) => {
      if (category !== 'Todos' && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.remoteModel.toLowerCase().includes(q) ||
        p.protocolLabel.toLowerCase().includes(q) ||
        p.models.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [query, category]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    onAddRoom(roomName.trim(), roomProfileId, roomModel.trim() || 'Philco');
    setRoomName('');
    setRoomModel('');
  };

  return (
    <div className="space-y-6">
      {/* Saved Rooms Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Mis Equipos Philco Guardados
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Guarde cada ambiente de su hogar para cambiar de mando con un toque.
            </p>
          </div>
        </div>

        {savedRooms.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {savedRooms.map((room) => {
              const prof = PHILCO_PROFILES.find((p) => p.id === room.profileId);
              const isCurrent = room.profileId === activeProfileId;
              return (
                <div
                  key={room.id}
                  className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                    isCurrent
                      ? 'border-[#005EB8] bg-sky-50/40 dark:border-sky-500 dark:bg-sky-950/30'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectRoom(room)}
                    className="flex min-h-[44px] flex-1 items-center gap-3 text-left"
                  >
                    <AirVent className="h-5 w-5 text-[#005EB8] dark:text-sky-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {room.roomName}
                      </div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {room.customModel} · {room.lastTemp}°C {MODE_TEXT[room.lastMode]}
                        {prof ? ` · ${prof.remoteModel.split('/')[0].trim()}` : ''}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRoom(room.id)}
                    aria-label={`Eliminar ${room.roomName}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleCreateRoom} className="mt-4 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-12">
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Ambiente (ej. Dormitorio)"
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#005EB8] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:col-span-3"
          />
          <input
            type="text"
            value={roomModel}
            onChange={(e) => setRoomModel(e.target.value)}
            placeholder="Modelo (ej. PHIN32HA3AN)"
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#005EB8] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:col-span-3"
          />
          <select
            value={roomProfileId}
            onChange={(e) => setRoomProfileId(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#005EB8] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:col-span-4"
          >
            {PHILCO_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.remoteModel.split('/')[0].trim()})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#005EB8] px-4 text-sm font-semibold text-white hover:bg-[#004C97] sm:col-span-2 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Guardar</span>
          </button>
        </form>
      </section>

      {/* Search & Filter Philco Chassis Profiles */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Modelos y Mandos Philco Compatibles
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar modelo (PHIN32, RG57, YAP1F...)"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#005EB8] focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800/80">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                category === cat
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Profile Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredProfiles.map((p: PhilcoProfile) => {
            const isSelected = p.id === activeProfileId;
            return (
              <article
                key={p.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition-colors sm:p-5 ${
                  isSelected
                    ? 'border-[#005EB8] bg-white shadow-sm dark:border-sky-500 dark:bg-slate-900'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {p.category} · {p.protocolLabel}
                      </div>
                      <h3 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                        {p.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectProfile(p.id)}
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-[#005EB8] text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                      <span>{isSelected ? 'Activo' : 'Usar Mando'}</span>
                    </button>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {p.notes}
                  </p>

                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Control original:{' '}
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-300">{p.remoteModel}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Modelos compatibles:{' '}
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {p.models.join(' · ')}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Huawei Pura 80:{' '}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {p.huaweiSmartBrand.join(' / ')}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {filteredProfiles.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            No se encontraron modelos Philco para "{query}". Pruebe con PHIN32, PHS, PHP, YAP1F o RG57.
          </div>
        )}
      </section>
    </div>
  );
};
