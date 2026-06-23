import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { useDownloadProgress, formatBytes } from '../hooks/useDownloadProgress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface RedisRelease {
  version: string;
  url: string;
}
interface RedisProps {
  activeVersion?: string | null;
  onVersionChange?: (version: string) => void;
}

export function Redis({ activeVersion, onVersionChange }: RedisProps = {}) {
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [availableVersions, setAvailableVersions] = useState<RedisRelease[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  
  const [isInstalling, setIsInstalling] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  
  const { progress, clearProgress } = useDownloadProgress('redis');

  const currentActiveVersion = activeVersion || (installedVersions.length > 0 ? installedVersions[0] : '');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const [installed, available] = await Promise.all([
        invoke<string[]>('get_installed_redis').catch(() => [] as string[]),
        invoke<RedisRelease[]>('fetch_versions').catch(() => [] as RedisRelease[])
      ]);
      
      setInstalledVersions(installed);
      
      const uninstalled = available.filter(v => !installed.includes(v.version));
      setAvailableVersions(uninstalled);
      if (uninstalled.length > 0) {
        setSelectedVersion(uninstalled[0].version);
      }
    } catch (e) {
      toast.error('Failed to load Redis versions');
    } finally {
      setIsFetching(false);
    }
  };

  const handleInstall = async () => {
    if (!selectedVersion) return;
    
    const release = availableVersions.find(v => v.version === selectedVersion);
    if (!release) return;

    setIsInstalling(true);
    clearProgress();
    try {
      const msg = await invoke<string>('install_redis', { 
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

  return (
    <div className="space-y-12 max-w-2xl pb-10">
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Install Redis</h2>
          <p className="text-sm text-muted-foreground mt-1">Install a native, portable Windows Redis</p>
        </div>
        <div className="space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
               <p className="text-sm font-medium">Select Native Windows Release</p>
               <Select 
                 value={selectedVersion} 
                 onValueChange={(v) => v && setSelectedVersion(v)}
                 disabled={isInstalling || isFetching || availableVersions.length === 0}
               >
                 <SelectTrigger className="bg-secondary/30">
                   <SelectValue placeholder={isFetching ? "Fetching latest releases..." : (availableVersions.length === 0 ? "No new versions available" : "Select a version")} />
                 </SelectTrigger>
                 <SelectContent>
                   {availableVersions.map((release) => (
                     <SelectItem key={release.version} value={release.version}>
                       Redis v{release.version}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            </div>
            <Button 
              disabled={isInstalling || isFetching || !selectedVersion || availableVersions.length === 0} 
              onClick={handleInstall}
            >
              {isInstalling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {availableVersions.length === 0 && !isFetching ? "Up to date" : "Install"}
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
                    <Select value={currentActiveVersion} onValueChange={(val) => val && onVersionChange?.(val)}>
                      <SelectTrigger className="w-[140px] h-8 text-sm">
                        <SelectValue placeholder="Version" />
                      </SelectTrigger>
                      <SelectContent>
                        {installedVersions.map(v => (
                          <SelectItem key={v} value={v}>Redis v{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Select the default version to run</p>
                </div>
              </div>

              <ul className="space-y-2">
                {installedVersions.map(v => (
                  <li key={v} className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border/50">
                    <span className="font-medium">Redis v{v}</span>
                    <span className="text-xs text-muted-foreground">Ready</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
