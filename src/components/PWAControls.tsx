import React, { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    return null;
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleCopyUrl = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#005EB8] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#004C97] active:scale-[0.98] whitespace-nowrap shrink-0 sm:min-h-[44px] sm:px-4 sm:text-sm"
      >
        <Download className="h-4 w-4" />
        <span>{compact ? 'Instalar' : 'Instalar App'}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 sm:min-h-[44px] sm:px-3.5 sm:text-sm"
      >
        <Smartphone className="h-4 w-4 text-[#005EB8] dark:text-sky-400" />
        <span>{compact ? 'Instalar' : 'Instalar en Pura 80'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <h3 id="pwa-guide-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Instalar en su Huawei Pura 80
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Cerrar guía de instalación"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <li>1. Toque el botón <strong>Compartir</strong> en la barra de Safari.</li>
                <li>2. Deslice hacia abajo y seleccione <strong>Añadir a pantalla de inicio</strong>.</li>
              </ol>
            ) : (
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {isInIframe && (
                  <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                    Para que aparezca la opción de instalar, primero abra la aplicación directamente en el navegador de su teléfono (fuera de esta vista previa).
                  </p>
                )}
                <ol className="space-y-2 text-xs sm:text-sm">
                  <li>
                    <strong>1.</strong> Copie el enlace y ábralo en <strong>Chrome</strong> o <strong>Navegador Huawei</strong> en su Pura 80.
                  </li>
                  <li>
                    <strong>2.</strong> Toque el menú del navegador (tres puntos <strong>⋮</strong> o <strong>≡</strong> arriba o abajo).
                  </li>
                  <li>
                    <strong>3.</strong> Seleccione <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
                  </li>
                  <li>
                    <strong>4.</strong> Se creará el icono <strong>Philco AC</strong> en su pantalla para usar sin conexión.
                  </li>
                </ol>
              </div>
            )}

            {appUrl && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {appUrl}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedUrl ? 'Enlace copiado' : 'Copiar enlace'}</span>
                  </button>
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-[#005EB8] px-3 text-xs font-semibold text-white hover:bg-[#004C97]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir fuera</span>
                  </a>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-200 lg:bottom-4 lg:left-auto lg:right-4">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Modo sin conexión: base de códigos y mandos Philco disponibles localmente.</span>
    </div>
  );
};
