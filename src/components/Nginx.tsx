import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { useDownloadProgress, formatBytes } from '../hooks/useDownloadProgress';
import { filterHighestPatches, fetchWithCache } from '../lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function Nginx() {
  const [releases, setReleases] = useState<{ version: string }[]>([]);
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const { progress, clearProgress } = useDownloadProgress('nginx');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const [installed, available] = await Promise.all([
        invoke<string[]>('get_installed_nginx').catch(() => []),
        fetchWithCache('cache_nginx_versions', () => invoke<string[]>('fetch_nginx_versions').catch(() => [])),
      ]);
      setInstalledVersions(installed);
      const availableObjs = available.map((v: string) => ({ version: v }));
      const filtered = filterHighestPatches(availableObjs, installed);
      setReleases(filtered);
    } catch (e) {
      toast.error('Failed to load Nginx versions');
    } finally {
      setIsFetching(false);
    }
  };

  const handleInstall = async () => {
    if (!selectedVersion) return;
    setIsInstalling(true);
    clearProgress();
    try {
      const msg = await invoke<string>('install_nginx', {
        version: selectedVersion
      });
      toast.success(msg);
      fetchData(); // Refresh installed list
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
          <h2 className="text-2xl font-semibold tracking-tight">Install NGINX</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a stable or mainline version to install.</p>
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
                    <SelectItem key={r.version} value={r.version}>Nginx {r.version}</SelectItem>
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
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Installed Versions</h2>
        </div>

        <div>
          {installedVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions installed yet.</p>
          ) : (
            <ul className="space-y-2">
              {installedVersions.map(v => (
                <li key={v} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50 transition-colors hover:bg-secondary/50">
                  <span className="font-medium">Nginx v{v}</span>
                  <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">Ready</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
