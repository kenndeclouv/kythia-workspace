import { useState, useEffect, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { Sidebar } from './components/Sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './components/ui/sidebar';
import { TooltipProvider } from './components/ui/tooltip';
import { AppSettings } from './types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './components/theme-provider';
import { AlertTriangle, Trophy, Rocket } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { GamificationBadge } from './components/GamificationBadge';
import loadingAnimation from "./assets/loading-animation.webp";

// Intercept all toast calls to forward to OS Native Notification if enabled
const originalSuccess = toast.success;
const originalError = toast.error;
const originalInfo = toast.info;

const sendNative = async (title: string, body: string) => {
  try {
    const settings: any = await invoke('get_settings');
    if (settings.native_notifications) {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
      if (permissionGranted) {
        sendNotification({ title, body });
      }
    }
  } catch(e) {}
};

toast.success = (message: any, data?: any) => {
  sendNative("Kythia Workspace", String(message));
  return originalSuccess(message, data);
};
toast.error = (message: any, data?: any) => {
  sendNative("Kythia Error", String(message));
  return originalError(message, data);
};
toast.info = (message: any, data?: any) => {
  sendNative("Kythia Workspace", String(message));
  return originalInfo(message, data);
};

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
const Achievements = lazy(() => import('./components/Achievements').then(m => ({ default: m.Achievements })));
const Shop = lazy(() => import('./components/Shop').then(m => ({ default: m.Shop })));
const Profile = lazy(() => import('./components/Profile').then(m => ({ default: m.Profile })));
import { SHOP_ITEMS } from './lib/shop';
import { ACHIEVEMENTS } from './lib/achievements';

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
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('kythia-active-tab') || 'dashboard';
  });

  useEffect(() => {
    sessionStorage.setItem('kythia-active-tab', activeTab);
  }, [activeTab]);
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

    const applyTheme = async () => {
      try {
        const gamificationData = await invoke<any>('get_gamification_data');
        const theme = SHOP_ITEMS.find(t => t.id === gamificationData.active_theme);
        if (theme && theme.cssVars) {
          Object.entries(theme.cssVars).forEach(([key, val]) => {
            document.documentElement.style.setProperty(key, val);
          });
        } else {
          document.documentElement.style.removeProperty('--primary');
          document.documentElement.style.removeProperty('--ring');
          document.documentElement.style.removeProperty('--sidebar-ring');
          document.documentElement.style.removeProperty('--sidebar');
          document.documentElement.style.removeProperty('--sidebar-accent');
        }
      } catch (e) {}
    };

    applyTheme();

    const handleUnlockEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id) {
        triggerAchievement(customEvent.detail.id);
      }
    };
    window.addEventListener('unlock-achievement', handleUnlockEvent);
    window.addEventListener('gamification-update', applyTheme);

    const unlistenUnlock = listen<string>('unlock-achievement-server', (e) => {
      const id = e.payload;
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        toast.success(`Achievement Unlocked: ${ach.title}`, {
          duration: 10000,
          description: ach.description,
          icon: <Trophy className="w-5 h-5 text-amber-500" />,
        });
        window.dispatchEvent(new Event('gamification-update'));
      }
    });

    const unlistenUpdate = listen<void>('gamification-update-server', () => {
      window.dispatchEvent(new Event('gamification-update'));
    });

    const unlistenGit = listen('git-commit-detected', async (event: any) => {
      const payload = event.payload as { project: string; message: string };
      
      try {
        await invoke('add_xp', { amount: 500 });
        await invoke('add_coins', { amount: 50 });
        
        toast.success(`Code-to-Earn: +500 XP!`, {
          duration: 8000,
          description: `Commit in ${payload.project}: ${payload.message}`,
          icon: <Rocket className="w-5 h-5 text-primary" />
        });
        
        window.dispatchEvent(new Event('gamification-update'));
      } catch (e) {
        console.error("Failed to process git commit event", e);
      }
    });

    return () => {
      clearInterval(interval);
      if (unlisten) unlisten();
      unlistenUnlock.then(f => f());
      unlistenUpdate.then(f => f());
      unlistenGit.then(f => f());
      window.removeEventListener('unlock-achievement', handleUnlockEvent);
      window.removeEventListener('gamification-update', applyTheme);
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
        
        if (newStatuses.nginx.running && newStatuses.php.running && (newStatuses.mariadb.running || newStatuses.mysql.running || newStatuses.postgres.running || newStatuses.mongodb.running)) {
          window.dispatchEvent(new CustomEvent('unlock-achievement', { detail: { id: 'the_architect' } }));
        }
        
        return newStatuses;
      });

      setPortConflicts(prev => {
        if (JSON.stringify(prev) === JSON.stringify(result.conflicts)) {
          return prev;
        }
        return result.conflicts;
      });
    } catch (e) {
      // ignore
    }
  };

  const triggerAchievement = async (id: string) => {
    try {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (!ach) return;

      const res = await invoke<{ success: boolean; message: string; data: any }>('unlock_achievement', {
        id,
        rewardXp: ach.rewardXp,
        rewardCoins: ach.rewardCoins
      });

      if (res.success) {
        toast.success(`Achievement Unlocked: ${ach.title}`, {
          duration: 10000,
          description: ach.description,
          icon: <Trophy className="w-5 h-5 text-amber-500" />,
        });
        window.dispatchEvent(new Event('gamification-update'));
      }
    } catch (e) {
      console.error('Failed to trigger achievement:', e);
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
      
      // Play sound if equipped
      invoke<any>('get_gamification_data').then(data => {
        if (data.active_sound_pack && data.active_sound_pack !== 'none') {
          const pack = SHOP_ITEMS.find(i => i.id === data.active_sound_pack);
          if (pack && pack.audioUrl) {
            new Audio(pack.audioUrl).play().catch(() => {});
          }
        }
      }).catch(() => {});

      // Add XP for starting a service
      await invoke('add_xp', { amount: 10 }).catch(() => {});
      window.dispatchEvent(new Event('gamification-update'));
      
      triggerAchievement('first_blood');
      
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

  const handleSettingsSaved = async (needsRestart: boolean = false) => {
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
    
    if (needsRestart && hasRunning) {
      toast.info('Settings saved. Please restart running services to apply changes.', {
        duration: 5000,
      });
    } else {
      toast.success('Settings saved successfully');
    }
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
      window.dispatchEvent(new CustomEvent('unlock-achievement', { detail: { id: 'database_master' } }));
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
          <img src={loadingAnimation} alt="Loading Animation" />
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
                <header className="mb-2 flex items-center justify-between">
                  <SidebarTrigger className="-ml-2" />
                  <GamificationBadge />
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
                  {activeTab === 'achievements' && <Achievements />}
                  {activeTab === 'shop' && <Shop />}
                  {activeTab === 'profile' && <Profile />}
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
