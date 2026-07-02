import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Play, Square, Activity, Server, Terminal, Database, HardDrive, Settings, Mail, Rocket } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ServiceStatus, SystemStats } from '../types';

interface DashboardProps {
  statuses: {
    nginx: ServiceStatus;
    php: ServiceStatus;
    mariadb: ServiceStatus;
    mysql: ServiceStatus;
    postgres: ServiceStatus;
    mongodb: ServiceStatus;
    redis: ServiceStatus;
    mailpit: ServiceStatus;
  };
  activeDatabaseEngine: string;
  activeVersions: {
    nginx: string;
    php: string;
    database: string;
    redis: string;
    mailpit: string;
  };
  onStart: (service: 'nginx' | 'php' | 'mariadb' | 'mysql' | 'postgres' | 'mongodb' | 'redis' | 'mailpit') => void;
  onStop: (service: 'nginx' | 'php' | 'mariadb' | 'mysql' | 'postgres' | 'mongodb' | 'redis' | 'mailpit') => void;
  onConfigure: (tab: string) => void;
  onStartAll: () => void;
  onStopAll: () => void;
  onEngineChange: (engine: string) => void;
}

function ServiceRow({
  name,
  engine,
  status,
  stats,
  icon: Icon,
  onStart,
  onStop,
  onConfigure
}: {
  name: string,
  engine: string,
  status: ServiceStatus,
  stats?: { memory: number; cpu: number },
  icon: any,
  onStart: () => void,
  onStop: () => void,
  onConfigure?: () => void
}) {
  return (
    <div className="flex items-center justify-between p-4 sm:px-6 hover:bg-accent/5 transition-colors group border-b border-border/50 last:border-0">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center border border-border/50 shrink-0">
          <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-foreground truncate">{name}</span>
          <span className="text-xs text-muted-foreground truncate">{engine}</span>
        </div>
      </div>

      <div className="flex items-center gap-6 sm:gap-8 shrink-0">
        <div className="hidden sm:flex items-center w-24">
          <div className={`w-2 h-2 rounded-full mr-2 ${status.running ? 'bg-green-500' : 'bg-neutral-500/50'}`} />
          <span className={`text-sm ${status.running ? 'text-foreground' : 'text-muted-foreground'}`}>
            {status.running ? 'Running' : 'Stopped'}
          </span>
        </div>

        <div className="hidden md:flex flex-col items-end w-20 text-[10px] font-mono text-muted-foreground justify-center">
          {status.running && stats ? (
            <>
              <span className="text-primary">{stats.cpu.toFixed(1)}% CPU</span>
              <span className="text-blue-400">{(stats.memory / 1024 / 1024).toFixed(0)} MB</span>
            </>
          ) : (
            <span className="opacity-0">-</span>
          )}
        </div>

        <div className="hidden sm:flex items-center w-16 justify-end">
          <span className="font-mono text-xs text-muted-foreground bg-secondary/30 px-2 py-1 rounded border border-border/50">
            {status.running ? status.port : '---'}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {onConfigure && (
            <Button variant="default" size="icon" className="h-8 w-8 shrink-0" onClick={onConfigure}>
              <Settings className="w-4 h-4" />
            </Button>
          )}
          <div className="w-[88px] shrink-0">
            {status.running ? (
              <Button variant="outline" size="sm" className="h-8 w-full border-red-500/20 hover:bg-red-500/10 hover:text-red-500 text-muted-foreground" onClick={onStop}>
                <Square className="w-3.5 h-3.5 mr-2" /> Stop
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8 w-full border-green-500/20 hover:bg-green-500/10 hover:text-green-500 text-muted-foreground" onClick={onStart}>
                <Play className="w-3.5 h-3.5 mr-2" /> Start
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ statuses, activeDatabaseEngine, activeVersions, onStart, onStop, onStartAll, onStopAll, onConfigure }: DashboardProps) {
  const activeDbStatus = statuses[activeDatabaseEngine as 'mariadb' | 'mysql' | 'postgres' | 'mongodb'] || { running: false };

  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/kenndeclouv/kythia-workspace/releases/latest');
        if (!res.ok) return;
        const data = await res.json();
        const latestTag = data.tag_name;
        const currentVersion = await invoke<string>('get_app_version');

        let normalizedLatest = latestTag.startsWith('v') ? latestTag.slice(1) : latestTag;
        if (normalizedLatest !== currentVersion && normalizedLatest > currentVersion) {
          setUpdateAvailable(data.html_url);
        }
      } catch (e) { console.error(e); }
    };
    checkUpdate();

    const pollStats = async () => {
      try {
        const stats = await invoke<SystemStats>('get_system_stats');
        setSysStats(stats);
      } catch (e) { console.error(e); }
    };
    pollStats();
    const interval = setInterval(pollStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const runningServices = [
    statuses.nginx.running,
    statuses.php.running,
    activeDbStatus.running,
    statuses.redis.running,
    statuses.mailpit.running,
  ];
  const activeCount = runningServices.filter(Boolean).length;
  const totalCount = 5;

  return (
    <div className="space-y-6 max-w-6xl w-full mx-auto">
      {updateAvailable && (
        <Alert className="bg-indigo-500/10 border-indigo-500/50 text-indigo-400">
          <Rocket className="w-5 h-5 mr-2" />
          <AlertTitle className="font-bold">Update Available!</AlertTitle>
          <AlertDescription>
            A new version of Kythia Workspace is available.
            <span onClick={() => openUrl(updateAvailable)} className="underline ml-1 font-bold hover:text-indigo-300 transition-colors cursor-pointer">Download it here</span>.
          </AlertDescription>
        </Alert>
      )}

      {/* Sleek Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border/50">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">System Status</h2>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2 ml-11">
            <span className="relative flex h-2 w-2">
              {activeCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${activeCount > 0 ? 'bg-green-500' : 'bg-neutral-500'}`}></span>
            </span>
            {activeCount} of {totalCount} core services running
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-9 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/30 transition-colors"
            onClick={onStartAll}
            disabled={activeCount === totalCount}
          >
            <Play className="w-4 h-4 mr-2" /> Start All
          </Button>
          <Button
            variant="outline"
            className="h-9 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors"
            onClick={onStopAll}
            disabled={activeCount === 0}
          >
            <Square className="w-4 h-4 mr-2" /> Stop All
          </Button>
        </div>
      </div>

      {sysStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card/30 border border-border/50 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground font-semibold">CPU Usage</span>
                <span className="text-foreground font-bold">{sysStats.cpu_usage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.min(sysStats.cpu_usage, 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-card/30 border border-border/50 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <HardDrive className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground font-semibold">RAM Usage</span>
                <span className="text-foreground font-bold">
                  {(sysStats.used_memory / 1024 / 1024 / 1024).toFixed(1)} GB / {(sysStats.total_memory / 1024 / 1024 / 1024).toFixed(1)} GB
                </span>
              </div>
              <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(sysStats.used_memory / sysStats.total_memory) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services List */}
      <div className="bg-card/30 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-col">
          <ServiceRow
            name="NGINX"
            engine={activeVersions.nginx}
            status={statuses.nginx}
            stats={sysStats?.services_usage['nginx']}
            icon={Server}
            onStart={() => onStart('nginx')}
            onStop={() => onStop('nginx')}
            onConfigure={() => onConfigure('nginx')}
          />
          <ServiceRow
            name="PHP"
            engine={activeVersions.php}
            status={statuses.php}
            stats={sysStats?.services_usage['php']}
            icon={Terminal}
            onStart={() => onStart('php')}
            onStop={() => onStop('php')}
            onConfigure={() => onConfigure('php')}
          />
          <ServiceRow
            name={activeDatabaseEngine.charAt(0).toUpperCase() + activeDatabaseEngine.slice(1)}
            engine={activeVersions.database}
            status={activeDbStatus}
            stats={sysStats?.services_usage[activeDatabaseEngine]}
            icon={Database}
            onStart={() => onStart(activeDatabaseEngine as any)}
            onStop={() => onStop(activeDatabaseEngine as any)}
            onConfigure={() => onConfigure('database')}
          />
          <ServiceRow
            name="Redis"
            engine={activeVersions.redis}
            status={statuses.redis}
            stats={sysStats?.services_usage['redis']}
            icon={HardDrive}
            onStart={() => onStart('redis')}
            onStop={() => onStop('redis')}
            onConfigure={() => onConfigure('database')}
          />
          <ServiceRow
            name="Mailpit"
            engine={activeVersions.mailpit}
            status={statuses.mailpit}
            stats={sysStats?.services_usage['mailpit']}
            icon={Mail}
            onStart={() => onStart('mailpit')}
            onStop={() => onStop('mailpit')}
            onConfigure={() => onConfigure('mail')}
          />
        </div>
      </div>
    </div>
  );
}
