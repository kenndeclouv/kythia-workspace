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
import { Loader2 } from 'lucide-react';
import { MongodbRelease } from '../types';

interface MongodbProps {
  activeVersion?: string | null;
  onVersionChange?: (version: string) => void;
}

export function Mongodb({ activeVersion, onVersionChange }: MongodbProps = {}) {
  const [releases, setReleases] = useState<MongodbRelease[]>([]);
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isPathEnabled, setIsPathEnabled] = useState(false);
  
  const { progress, clearProgress } = useDownloadProgress('mongodb');

  const currentActiveVersion = activeVersion || (installedVersions.length > 0 ? installedVersions[0] : '');

  useEffect(() => {
    fetchData();
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
        invoke<string[]>('get_installed_mongodb').catch(() => []),
        fetchWithCache('cache_mongodb_versions_v1', () => invoke<MongodbRelease[]>('fetch_mongodb_versions').catch(() => [])),
      ]);
      setInstalledVersions(installed);
      const filtered = filterHighestPatches(available, installed);
      setReleases(filtered);
    } catch (e) {
      toast.error('Failed to load MongoDB versions');
    } finally {
      setIsFetching(false);
    }
  };



  const checkPathStatus = async (version: string) => {
    try {
      const path = `C:\\kythia\\bin\\mongodb\\${version}\\bin`;
      const status = await invoke<boolean>('get_path_status', { exactPath: path });
      setIsPathEnabled(status);
    } catch (e) {
      // ignore
    }
  };

  const togglePath = async (checked: boolean) => {
    if (!currentActiveVersion) return;
    const version = currentActiveVersion;
    const path = `C:\\kythia\\bin\\mongodb\\${version}\\bin`;
    try {
      if (checked) {
        await invoke('add_to_path', { service: 'mongodb', exactPath: path });
        toast.success(`Added MongoDB ${version} to System PATH. You may need to restart your terminal.`);
      } else {
        await invoke('remove_from_path', { service: 'mongodb' });
        toast.success(`Removed MongoDB from System PATH.`);
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
      const msg = await invoke<string>('install_mongodb', { 
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
          <h2 className="text-2xl font-semibold tracking-tight">Install MongoDB</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a version of MongoDB Community Server to install.</p>
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
                    <SelectItem key={r.version} value={r.version}>MongoDB {r.version}</SelectItem>
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
                    <Select value={currentActiveVersion} onValueChange={(val) => val && onVersionChange?.(val)}>
                      <SelectTrigger className="w-[140px] h-8 text-sm">
                        <SelectValue placeholder="Version" />
                      </SelectTrigger>
                      <SelectContent>
                        {installedVersions.map(v => (
                          <SelectItem key={v} value={v}>MongoDB v{v}</SelectItem>
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
                    <span className="font-medium">MongoDB v{v}</span>
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
