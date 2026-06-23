import { useState, useEffect, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sidebar } from './components/Sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './components/ui/sidebar';
import { TooltipProvider } from './components/ui/tooltip';
import { ServiceStatus, AppSettings } from './types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './components/theme-provider';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';

// Lazy-load all page components so only the active page is loaded
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Nginx = lazy(() => import('./components/Nginx').then(m => ({ default: m.Nginx })));
const Php = lazy(() => import('./components/Php').then(m => ({ default: m.Php })));
const DatabaseManager = lazy(() => import('./components/DatabaseManager').then(m => ({ default: m.DatabaseManager })));
const Packages = lazy(() => import('./components/Packages').then(m => ({ default: m.Packages })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const Logs = lazy(() => import('./components/Logs').then(m => ({ default: m.Logs })));
const Mail = lazy(() => import('./components/Mail').then(m => ({ default: m.Mail })));
const QuickApps = lazy(() => import('./components/QuickApps').then(m => ({ default: m.QuickApps })));
const PhpConfig = lazy(() => import('./components/PhpConfig').then(m => ({ default: m.PhpConfig })));
const Sites = lazy(() => import('./components/Sites').then(m => ({ default: m.Sites })));
const About = lazy(() => import('./components/About').then(m => ({ default: m.About })));
const Projects = lazy(() => import('./components/Projects').then(m => ({ default: m.Projects })));

// Minimal spinner shown while a lazy page is loading
function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}

interface PortConflict {
  service: string;
  port: number;
  process_name: string;
  pid: string;
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [portConflicts, setPortConflicts] = useState<PortConflict[]>([]);
  
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
    const init = async () => {
      await loadSettings();
      await loadInstalledVersions();
      await pollStatuses();
      setIsLoading(false);
    };
    init();
    // Slowed from 2s → 5s: reduces IPC pressure and React re-renders significantly
    const interval = setInterval(pollStatuses, 5000);
    
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<string>('navigate', (e) => {
        setActiveTab(e.payload);
      }).then(f => {
        unlisten = f;
      });
    });

    return () => {
      clearInterval(interval);
      if (unlisten) unlisten();
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
      console.error('Failed to load settings:', e);
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
    } catch (e) {
      console.error('Failed to load installed versions', e);
    }
  };

  const pollStatuses = async () => {
    try {
      const [nginx, php, mariadb, mysql, postgres, mongodb, redis, mailpit, conflicts] = await Promise.all([
        invoke<ServiceStatus>('get_nginx_status'),
        invoke<ServiceStatus>('get_php_status'),
        invoke<ServiceStatus>('get_mariadb_status'),
        invoke<ServiceStatus>('get_mysql_status'),
        invoke<ServiceStatus>('get_postgres_status'),
        invoke<ServiceStatus>('get_mongodb_status'),
        invoke<ServiceStatus>('get_redis_status'),
        invoke<ServiceStatus>('get_mailpit_status'),
        invoke<PortConflict[]>('check_port_conflicts').catch(() => []),
      ]);
      setStatuses({ nginx, php, mariadb, mysql, postgres, mongodb, redis, mailpit });
      setPortConflicts(conflicts as PortConflict[]);
    } catch (e) {
      // ignore
    }
  };

  const getVersionToStart = (service: 'nginx' | 'php' | 'mariadb' | 'mysql' | 'postgres' | 'mongodb' | 'redis' | 'mailpit') => {
    const versions = installedVersions[service];
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

  const handleStart = async (service: 'nginx' | 'php' | 'mariadb' | 'mysql' | 'postgres' | 'mongodb' | 'redis' | 'mailpit') => {
    const version = getVersionToStart(service);
    if (!version) {
      toast.error(`${service.toUpperCase()} is not installed.`);
      return;
    }
    try {
      await invoke(`start_${service}`, { version });
      toast.success(`${service.toUpperCase()} started`);
      pollStatuses();
    } catch (e: any) {
      toast.error(`Failed to start ${service}: ${e}`);
    }
  };

  const handleStop = async (service: 'nginx' | 'php' | 'mariadb' | 'mysql' | 'postgres' | 'mongodb' | 'redis' | 'mailpit') => {
    const version = getVersionToStart(service) || 'latest';
    try {
      await invoke(`stop_${service}`, { version });
      toast.success(`${service.toUpperCase()} stopped`);
      pollStatuses();
    } catch (e: any) {
      toast.error(`Failed to stop ${service}: ${e}`);
    }
  };

  const handleStartAll = async () => {
    const promises = [];
    if (!statuses.nginx.running) promises.push(handleStart('nginx'));
    if (!statuses.php.running) promises.push(handleStart('php'));
    if (!statuses.redis.running) promises.push(handleStart('redis'));
    if (!statuses.mailpit.running && installedVersions.mailpit.length > 0) promises.push(handleStart('mailpit'));
    
    if (settings) {
      const db = settings.active_database_engine as 'mariadb' | 'mysql' | 'postgres' | 'mongodb';
      if (!statuses[db]?.running) promises.push(handleStart(db));
    }
    
    await Promise.all(promises);
  };

  const handleStopAll = async () => {
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
  };

  const handleSettingsSaved = async () => {
    // Record which services were running
    const running = {
      nginx: statuses.nginx.running,
      php: statuses.php.running,
      mariadb: statuses.mariadb.running,
      mysql: statuses.mysql.running,
      postgres: statuses.postgres.running,
      mongodb: statuses.mongodb.running,
      redis: statuses.redis.running,
      mailpit: statuses.mailpit.running,
    };

    const hasRunning = Object.values(running).some(Boolean);
    if (!hasRunning) return;

    toast.info('Applying settings and restarting services...');
    
    // Stop all running services
    const stopPromises = [];
    if (running.nginx) stopPromises.push(handleStop('nginx'));
    if (running.php) stopPromises.push(handleStop('php'));
    if (running.mariadb) stopPromises.push(handleStop('mariadb'));
    if (running.mysql) stopPromises.push(handleStop('mysql'));
    if (running.postgres) stopPromises.push(handleStop('postgres'));
    if (running.mongodb) stopPromises.push(handleStop('mongodb'));
    if (running.redis) stopPromises.push(handleStop('redis'));
    if (running.mailpit) stopPromises.push(handleStop('mailpit'));
    
    await Promise.all(stopPromises);

    // Wait a brief moment for ports to clear
    setTimeout(async () => {
      const startPromises = [];
      if (running.nginx) startPromises.push(handleStart('nginx'));
      if (running.php) startPromises.push(handleStart('php'));
      if (running.mariadb) startPromises.push(handleStart('mariadb'));
      if (running.mysql) startPromises.push(handleStart('mysql'));
      if (running.postgres) startPromises.push(handleStart('postgres'));
      if (running.mongodb) startPromises.push(handleStart('mongodb'));
      if (running.redis) startPromises.push(handleStart('redis'));
      if (running.mailpit) startPromises.push(handleStart('mailpit'));
      
      await Promise.all(startPromises);
      toast.success('Services restarted with new settings');
    }, 1500);
  };

  const handleEngineChange = async (engine: string) => {
    if (statuses.mariadb.running) await handleStop('mariadb');
    if (statuses.mysql.running) await handleStop('mysql');
    if (statuses.postgres.running) await handleStop('postgres');
    if (statuses.mongodb.running) await handleStop('mongodb');
    
    if (settings) {
      const newSettings = { ...settings, active_database_engine: engine };
      setSettings(newSettings);
      await invoke('save_settings', { settings: newSettings });
    }
  };

  const handleActiveVersionChange = async (service: 'php' | 'mariadb' | 'mysql' | 'postgres' | 'mongodb' | 'redis', version: string | null) => {
    if (statuses[service]?.running) {
      await handleStop(service);
    }
    
    if (settings) {
      const activeKey = `active_${service}_version` as keyof AppSettings;
      const newSettings = { ...settings, [activeKey]: version } as unknown as AppSettings;
      setSettings(newSettings);
      await invoke('save_settings', { settings: newSettings });
    }
  };

  const handlePhpVersionChange = async (version: string) => {
    await handleActiveVersionChange('php', version);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full bg-background text-foreground items-center justify-center flex-col space-y-8 relative overflow-hidden">
        {/* Decorative background blurs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-secondary/20 rounded-full blur-2xl" />
        
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* <span className="text-white font-black text-5xl tracking-tighter shadow-sm">K</span> */}
          <img src="https://cdn.kythia.my.id/assets/images/sticker/kythia_hello_512_tiny.png" alt="" />
        </div>
        
        <div className="relative flex flex-col items-center">
          {/* <img src="/logo.webp" alt="Kythia Logo" className="w-16 h-16 rounded-xl mb-4 shadow-2xl" /> */}
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">KYTHIA</h2>
          <div className="text-sm text-muted-foreground uppercase tracking-[0.3em] font-medium mt-2 flex items-center gap-2">
            <span>Initializing Workspace</span>
            <Loader2 className="w-3 h-3 text-primary animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <SidebarProvider>
          <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
            
            <SidebarInset className="flex-1 flex flex-col overflow-hidden bg-background relative">
              {/* Background is handled by styles.css body — no duplicate divs needed */}
              <main className="flex-1 overflow-auto p-8 flex flex-col relative z-10">
                <header className="mb-2 flex items-center">
                  <SidebarTrigger className="-ml-2" />
                </header>

                {portConflicts.length > 0 && (
                  <div className="mb-8 space-y-4">
                    {portConflicts.map((conflict, idx) => (
                      <Alert variant="destructive" key={idx} className="bg-destructive/10 border-destructive/20 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Port Conflict Detected: {conflict.service} (Port {conflict.port})</AlertTitle>
                        <AlertDescription>
                          Port {conflict.port} is currently being used by <strong>{conflict.process_name}</strong> (PID: {conflict.pid}). 
                          This prevents {conflict.service} from starting. Please close the conflicting application.
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}

                <Suspense fallback={<PageSpinner />}>
                  {activeTab === 'dashboard' && settings && (() => {
                    const activeVersions = {
                      nginx: getVersionToStart('nginx') || '',
                      php: getVersionToStart('php') || '',
                      database: getVersionToStart(settings.active_database_engine as any) || '',
                      redis: getVersionToStart('redis') || '',
                      mailpit: getVersionToStart('mailpit') || '',
                    };
                    return (
                      <Dashboard 
                        statuses={statuses} 
                        activeDatabaseEngine={settings.active_database_engine}
                        activeVersions={activeVersions}
                        onStart={handleStart} 
                        onStop={handleStop} 
                        onConfigure={(tab) => setActiveTab(tab)}
                        onStartAll={handleStartAll}
                        onStopAll={handleStopAll}
                        onEngineChange={handleEngineChange}
                      />
                    );
                  })()}
                  {activeTab === 'nginx' && <Nginx />}
                  {activeTab === 'php' && settings && (
                    <Php 
                      activePhpVersion={settings?.active_php_version || ''}
                      onPhpVersionChange={handlePhpVersionChange}
                    />
                  )}
                  {activeTab === 'php-config' && (
                    <PhpConfig
                      activePhpVersion={settings?.active_php_version || ''}
                      installedVersions={installedVersions.php}
                      onPhpVersionChange={handlePhpVersionChange}
                    />
                  )}
                  {activeTab === 'database' && settings && (
                    <DatabaseManager 
                      activeEngine={settings.active_database_engine}
                      onEngineChange={handleEngineChange}
                      activeMariaDbVersion={settings.active_mariadb_version}
                      activeMysqlVersion={settings.active_mysql_version}
                      activePostgresVersion={settings.active_postgres_version}
                      activeMongodbVersion={settings.active_mongodb_version}
                      activeRedisVersion={settings.active_redis_version}
                      onActiveVersionChange={(service, version) => handleActiveVersionChange(service as any, version)}
                    />
                  )}
                  {activeTab === 'packages' && <Packages />}
                  {activeTab === 'sites' && <Sites />}
                  {activeTab === 'quick-apps' && <QuickApps />}
                  {activeTab === 'mail' && settings && (
                    <Mail 
                      status={statuses.mailpit}
                      installedVersions={installedVersions.mailpit}
                      onStart={() => handleStart('mailpit')}
                      onStop={() => handleStop('mailpit')}
                      uiPort={settings.mailpit?.ui_port || 8025}
                    />
                  )}
                  {activeTab === 'logs' && <Logs />}
                  {activeTab === 'settings' && <Settings onSettingsSaved={handleSettingsSaved} />}
                  {activeTab === 'about' && <About />}
                  {activeTab === 'projects' && <Projects />}
                </Suspense>
        </main>
        </SidebarInset>
      </div>
      </SidebarProvider>
    </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
