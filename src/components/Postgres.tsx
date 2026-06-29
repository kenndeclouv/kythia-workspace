import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useDownloadProgress, formatBytes } from '../hooks/useDownloadProgress';
import { filterHighestPatches, fetchWithCache } from '../lib/utils';
import { toast } from 'sonner';
import { Loader2, Database } from 'lucide-react';
import { PostgresRelease } from '../types';

interface PostgresProps {
  activeVersion?: string | null;
  onVersionChange?: (version: string) => void;
}

export function Postgres({ activeVersion, onVersionChange }: PostgresProps = {}) {
  const [releases, setReleases] = useState<PostgresRelease[]>([]);
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPathEnabled, setIsPathEnabled] = useState(false);
  
  const { progress, clearProgress } = useDownloadProgress('postgres');

  const currentActiveVersion = activeVersion || (installedVersions.length > 0 ? installedVersions[0] : '');

  useEffect(() => {
    fetchData();
    checkInitialized();
  }, []);

  useEffect(() => {
    if (currentActiveVersion) {
      checkPathStatus(currentActiveVersion);
    }
  }, [currentActiveVersion]);

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const [installed, available] = await Promise.all([
        invoke<string[]>('get_installed_postgres').catch(() => []),
        fetchWithCache('cache_postgres_versions_v1', () => invoke<PostgresRelease[]>('fetch_postgres_versions').catch(() => [])),
      ]);
      setInstalledVersions(installed);
      const filtered = filterHighestPatches(available, installed);
      setReleases(filtered);
    } catch (e) {
      toast.error('Failed to load PostgreSQL versions');
    } finally {
      setIsFetching(false);
    }
  };

  const checkInitialized = async () => {
    try {
      const initialized = await invoke<boolean>('is_postgres_initialized');
      setIsInitialized(initialized);
    } catch (e) {
      // ignore
    }
  };

  const checkPathStatus = async (version: string) => {
    try {
      const path = `C:\\kythia\\bin\\postgres\\${version}\\bin`;
      const status = await invoke<boolean>('get_path_status', { exactPath: path });
      setIsPathEnabled(status);
    } catch (e) {
      // ignore
    }
  };

  const togglePath = async (checked: boolean) => {
    if (!currentActiveVersion) return;
    const version = currentActiveVersion;
    const path = `C:\\kythia\\bin\\postgres\\${version}\\bin`;
    try {
      if (checked) {
        await invoke('add_to_path', { service: 'postgres', exactPath: path });
        toast.success(`Added PostgreSQL ${version} to System PATH. You may need to restart your terminal.`);
      } else {
        await invoke('remove_from_path', { service: 'postgres' });
        toast.success(`Removed PostgreSQL from System PATH.`);
      }
      setIsPathEnabled(checked);
    } catch (e: any) {
      toast.error(`Failed to modify PATH: ${e}`);
    }
  };

  const handleInstall = async () => {
    if (!selectedVersion) return;
    const release = releases.find(r => r.version === selectedVersion);
    if (!release) return;

    setIsInstalling(true);
    clearProgress();
    try {
      const msg = await invoke<string>('install_postgres', { 
        version: release.version,
        url: release.url
      });
      toast.success(msg);
      fetchData();
    } catch (e: any) {
      toast.error(`Install failed: ${e}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleInitialize = async () => {
    if (installedVersions.length === 0) return;
    setIsInitializing(true);
    try {
      const msg = await invoke<string>('init_postgres', { version: installedVersions[0] });
      toast.success(msg);
      checkInitialized();
    } catch (e: any) {
      toast.error(`Initialization failed: ${e}`);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="space-y-12 max-w-2xl pb-10">
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Install PostgreSQL</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a version of PostgreSQL to install.</p>
        </div>
        <div className="space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Available Versions
              </label>
              <Select disabled={isFetching || isInstalling} value={selectedVersion} onValueChange={(v) => v && setSelectedVersion(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={isFetching ? "Fetching versions..." : "Select version"} />
                </SelectTrigger>
                <SelectContent>
                  {releases.map(r => (
                    <SelectItem key={r.version} value={r.version} label={`PostgreSQL ${r.version}`}>PostgreSQL {r.version}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              disabled={!selectedVersion || isInstalling || isFetching} 
              onClick={handleInstall}
            >
              {isInstalling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Install
            </Button>
          </div>

          {progress && (
            <div className="space-y-2 bg-secondary/30 p-4 rounded-lg border border-border/50">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{progress.status === 'extracting' ? 'Extracting...' : `Downloading — ${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`}</span>
                <span>{Math.round(progress.percent)}%</span>
              </div>
              <Progress value={progress.percent} />
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border/50 pt-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Installed Versions & Setup</h2>
        </div>
        <div>
          {installedVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions installed yet.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-secondary/20 p-4 rounded-lg border border-border/50">
                <div>
                  <div className="flex items-center space-x-4 mb-1">
                    <h3 className="font-semibold">Global Environment</h3>
                    <Select 
                      value={currentActiveVersion} 
                      onValueChange={(val) => val && onVersionChange?.(val)}
                      items={installedVersions.map(v => ({ value: v, label: `PostgreSQL v${v}` }))}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-sm">
                        <SelectValue placeholder="Version" />
                      </SelectTrigger>
                      <SelectContent>
                        {installedVersions.map(v => (
                          <SelectItem key={v} value={v} label={`PostgreSQL v${v}`}>PostgreSQL v{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Select the default version and add it to System PATH</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="path-toggle" checked={isPathEnabled} onCheckedChange={togglePath} />
                  <Label htmlFor="path-toggle">Global CLI Access</Label>
                </div>
              </div>

              <ul className="space-y-2">
                {installedVersions.map(v => (
                  <li key={v} className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border/50">
                    <span className="font-medium">PostgreSQL v{v}</span>
                    <span className="text-xs text-muted-foreground">Ready</span>
                  </li>
                ))}
              </ul>
              
              {!isInitialized && (
                <div className="p-4 mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <h4 className="font-semibold text-yellow-500 flex items-center mb-2">
                    <Database size={16} className="mr-2" /> Action Required
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    The database data directory needs to be initialized before you can start the server for the first time.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto"
                    onClick={handleInitialize}
                    disabled={isInitializing}
                  >
                    {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Initialize Database
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
