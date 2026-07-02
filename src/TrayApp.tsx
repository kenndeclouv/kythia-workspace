import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings } from './types';
import { TerminalSquare, Power, Settings as SettingsIcon, Download, Globe, Play, Square, Circle, Loader2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ThemeProvider } from './components/theme-provider';

export function TrayApp() {
  const [loadingServices, setLoadingServices] = useState<Record<string, boolean>>({});
  const [statuses, setStatuses] = useState({
    nginx: { running: false },
    php: { running: false },
    mariadb: { running: false },
    mysql: { running: false },
    postgres: { running: false },
    mongodb: { running: false },
    redis: { running: false },
    mailpit: { running: false },
  });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [installedPhpVersions, setInstalledPhpVersions] = useState<string[]>([]);
  const [installedVersions, setInstalledVersions] = useState<Record<string, string[]>>({
    nginx: [],
    php: [],
    mariadb: [],
    mysql: [],
    postgres: [],
    mongodb: [],
    redis: [],
    mailpit: [],
  });

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlistenFocus: (() => void) | undefined;

    const setup = async () => {
      loadSettings();
      loadInstalledVersions();
      pollStatuses();
      
      unlistenFocus = await appWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) {
          loadSettings();
          loadInstalledVersions();
          pollStatuses();
        }
      });
    };
    setup();
    
    const interval = setInterval(pollStatuses, 3000);

    return () => {
      if (unlistenFocus) unlistenFocus();
      clearInterval(interval);
    };
  }, []);

  const loadSettings = async () => {
    try {
      const s = await invoke<AppSettings>('get_settings');
      setSettings(s);
      if (s.appearance === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      // ignore
    }
  };

  const loadInstalledVersions = async () => {
    try {
      const [nginx, php, mariadb, mysql, postgres, mongodb, redis, mailpit] = await Promise.all([
        invoke<string[]>('get_installed_nginx').catch(() => []),
        invoke<string[]>('get_installed_php').catch(() => []),
        invoke<string[]>('get_installed_mariadb').catch(() => []),
        invoke<string[]>('get_installed_mysql').catch(() => []),
        invoke<string[]>('get_installed_postgres').catch(() => []),
        invoke<string[]>('get_installed_mongodb').catch(() => []),
        invoke<string[]>('get_installed_redis').catch(() => []),
        invoke<string[]>('get_installed_mailpit').catch(() => []),
      ]);
      setInstalledVersions({ nginx, php, mariadb, mysql, postgres, mongodb, redis, mailpit });
      setInstalledPhpVersions(php);
    } catch (e) {
      // ignore
    }
  };

  const pollStatuses = async () => {
    try {
      const result = await invoke<any>('get_all_services_status');
      const newStatuses = {
        nginx: result.nginx,
        php: result.php,
        mariadb: result.mariadb,
        mysql: result.mysql,
        postgres: result.postgres,
        mongodb: result.mongodb,
        redis: result.redis,
        mailpit: result.mailpit,
      };
      
      setStatuses(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newStatuses)) {
          return prev;
        }
        return newStatuses;
      });
    } catch (e) {
      // ignore
    }
  };

  const getVersionToStart = (service: string) => {
    const versions = installedVersions[service] || [];
    if (versions.length === 0) return null;

    if (settings) {
      const activeKey = `active_${service}_version` as keyof typeof settings;
      const activeVersion = settings[activeKey] as string | undefined;

      if (activeVersion && versions.includes(activeVersion)) {
        return activeVersion;
      }
    }

    return versions[0]; // Fallback to first installed version
  };

  const handleStart = async (service: string, optionalVersion?: string) => {
    const version = optionalVersion || getVersionToStart(service);
    if (!version) return;
    
    setLoadingServices(prev => ({ ...prev, [service]: true }));
    try {
      await invoke(`start_${service}`, { version });
      await pollStatuses();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingServices(prev => ({ ...prev, [service]: false }));
    }
  };

  const handleStop = async (service: string, optionalVersion?: string) => {
    const version = optionalVersion || getVersionToStart(service) || 'latest';
    setLoadingServices(prev => ({ ...prev, [service]: true }));
    try {
      await invoke(`stop_${service}`, { version });
      await pollStatuses();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingServices(prev => ({ ...prev, [service]: false }));
    }
  };

  const toggleService = (service: string, isRunning: boolean) => {
    if (isRunning) {
      handleStop(service);
    } else {
      handleStart(service);
    }
  };

  const handleStartAll = async () => {
    setLoadingServices(prev => ({ ...prev, all: true }));
    const promises = [];
    if (!statuses.nginx.running) promises.push(handleStart('nginx'));
    if (!statuses.php.running) promises.push(handleStart('php'));
    if (!statuses.redis.running) promises.push(handleStart('redis'));
    if (!statuses.mailpit.running && installedVersions.mailpit.length > 0) promises.push(handleStart('mailpit'));
    
    if (settings && settings.active_database_engine) {
      const db = settings.active_database_engine as 'mariadb' | 'mysql' | 'postgres' | 'mongodb';
      if (!statuses[db]?.running) promises.push(handleStart(db));
    }
    
    await Promise.all(promises);
    await pollStatuses();
    setLoadingServices(prev => ({ ...prev, all: false }));
  };

  const handleStopAll = async () => {
    setLoadingServices(prev => ({ ...prev, all: true }));
    const promises = [];
    if (statuses.nginx.running) promises.push(handleStop('nginx'));
    if (statuses.php.running) promises.push(handleStop('php'));
    if (statuses.redis.running) promises.push(handleStop('redis'));
    if (statuses.mariadb.running) promises.push(handleStop('mariadb'));
    if (statuses.mysql.running) promises.push(handleStop('mysql'));
    if (statuses.postgres.running) promises.push(handleStop('postgres'));
    if (statuses.mongodb.running) promises.push(handleStop('mongodb'));
    if (statuses.mailpit.running) promises.push(handleStop('mailpit'));
    
    await Promise.all(promises);
    await pollStatuses();
    setLoadingServices(prev => ({ ...prev, all: false }));
  };

  const openMainWindow = async (tab?: string) => {
    try {
      await invoke('show_main_window', { tab: tab || null });
      await getCurrentWindow().hide();
    } catch (e) {
      console.error(e);
    }
  };

  const quitApp = async () => {
    await invoke('quit_app');
  };

  const handlePhpVersionChange = async (version: string) => {
    if (settings) {
      const newSettings = { ...settings, active_php_version: version };
      setSettings(newSettings);
      await invoke('save_settings', { settings: newSettings });
      if (statuses.php.running) {
        await handleStop('php');
        await handleStart('php', version);
      }
    }
  };

  const ServiceItem = ({ name, id, isRunning }: { name: string, id: string, isRunning: boolean }) => {
    const isLoading = loadingServices[id] || loadingServices['all'];
    return (
      <div className="flex items-center justify-between px-4 py-2 hover:bg-accent/50 cursor-pointer transition-colors group" onClick={() => isLoading ? null : toggleService(id, isRunning)}>
        <div className="flex items-center gap-3">
          <Circle className={`w-2.5 h-2.5 fill-current ${isRunning ? 'text-green-500' : 'text-neutral-400'}`} />
          <span className="text-sm font-medium">{name} {id === 'php' ? settings?.active_php_version : ''}</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          ) : isRunning ? (
            <Square className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <Play className="w-3.5 h-3.5 text-green-500" />
          )}
        </div>
      </div>
    );
  };

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden select-none border border-border/50 rounded-xl shadow-2xl">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none py-2">

          <div className="px-4 py-2">
            <h1 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kythia Workspace</h1>
          </div>

          <div className="flex flex-col mt-1">
            <div className="flex items-center gap-3 px-4 py-2 hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => openMainWindow('dashboard')}>
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Open Dashboard</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => openMainWindow('logs')}>
              <TerminalSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">View Logs</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => openMainWindow('packages')}>
              <Download className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Package Manager</span>
            </div>
          </div>

          <div className="h-px bg-border my-2 mx-4" />

          <div className="px-4 py-1">
            <h2 className="text-xs font-semibold text-muted-foreground">Services</h2>
          </div>
          <div className="flex flex-col mt-1">
            <div className="flex items-center gap-3 px-4 py-2 hover:bg-accent/50 cursor-pointer transition-colors group" onClick={() => loadingServices['all'] ? null : handleStartAll()}>
              <div className="flex items-center gap-3 w-full">
                {loadingServices['all'] ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : <Play className="w-3.5 h-3.5 text-green-500" />}
                <span className="text-sm font-medium">Start All Services</span>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 hover:bg-accent/50 cursor-pointer transition-colors group" onClick={() => loadingServices['all'] ? null : handleStopAll()}>
              <div className="flex items-center gap-3 w-full">
                {loadingServices['all'] ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : <Square className="w-3.5 h-3.5 text-red-500" />}
                <span className="text-sm font-medium">Stop All Services</span>
              </div>
            </div>
            
            <div className="h-px bg-border my-2 mx-4" />

            <ServiceItem name="NGINX" id="nginx" isRunning={statuses.nginx.running} />
            <ServiceItem name="PHP" id="php" isRunning={statuses.php.running} />
            {settings && (
              <ServiceItem
                name={settings.active_database_engine === 'mariadb' ? 'MariaDB' : settings.active_database_engine === 'mysql' ? 'MySQL' : settings.active_database_engine === 'postgres' ? 'PostgreSQL' : 'MongoDB'}
                id={settings.active_database_engine}
                isRunning={statuses[settings.active_database_engine as 'mariadb' | 'mysql' | 'postgres' | 'mongodb']?.running}
              />
            )}
            <ServiceItem name="Redis" id="redis" isRunning={statuses.redis.running} />
            <ServiceItem name="Mailpit" id="mailpit" isRunning={statuses.mailpit.running} />
          </div>

          <div className="h-px bg-border my-2 mx-4" />

          <div className="flex flex-col mt-1 mb-2">
            {installedPhpVersions.map(v => (
              <div
                key={v}
                className={`flex items-center gap-3 px-4 py-1.5 hover:bg-accent/50 cursor-pointer transition-colors ${settings?.active_php_version === v ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                onClick={() => handlePhpVersionChange(v)}
              >
                <div className="w-4 flex justify-center">
                  {settings?.active_php_version === v && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
                <span className="text-sm">Use PHP {v}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Bottom Toolbar */}
        <div className="h-12 bg-accent/30 border-t flex items-center justify-end px-4 gap-4">
          <SettingsIcon className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" onClick={() => openMainWindow('settings')} />
          <Download className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" onClick={() => openMainWindow('packages')} />
          <Power className="w-4 h-4 text-muted-foreground hover:text-red-500 cursor-pointer transition-colors" onClick={quitApp} />
        </div>
      </div>
    </ThemeProvider>
  );
}
