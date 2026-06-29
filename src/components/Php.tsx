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
import { PhpRelease } from '../types';

interface PhpProps {
  activePhpVersion: string;
  onPhpVersionChange: (version: string) => void;
}

export function Php({ activePhpVersion, onPhpVersionChange }: PhpProps) {
  const [releases, setReleases] = useState<PhpRelease[]>([]);
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  
  const [isPathEnabled, setIsPathEnabled] = useState(false);

  const { progress, clearProgress } = useDownloadProgress('php');

  useEffect(() => {
    fetchData();
  }, []);

  const currentActiveVersion = activePhpVersion || (installedVersions.length > 0 ? installedVersions[0] : '');

  useEffect(() => {
    if (currentActiveVersion) {
      checkPathStatus(currentActiveVersion);
    }
  }, [currentActiveVersion]);

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const [installed, available] = await Promise.all([
        invoke<string[]>('get_installed_php').catch(() => []),
        fetchWithCache('cache_php_versions', () => invoke<PhpRelease[]>('fetch_php_versions').catch(() => [])),
      ]);
      setInstalledVersions(installed);
      const filtered = filterHighestPatches(available, installed);
      setReleases(filtered);
    } catch (e) {
      toast.error('Failed to load PHP versions');
    } finally {
      setIsFetching(false);
    }
  };

  const checkPathStatus = async (version: string) => {
    try {
      const path = `C:\\kythia\\bin\\php\\${version}`;
      const status = await invoke<boolean>('get_path_status', { exactPath: path });
      setIsPathEnabled(status);
    } catch (e) {
      // ignore
    }
  };

  const togglePath = async (checked: boolean) => {
    if (!currentActiveVersion) return;
    const version = currentActiveVersion;
    const path = `C:\\kythia\\bin\\php\\${version}`;
    try {
      if (checked) {
        await invoke('add_to_path', { service: 'php', exactPath: path });
        toast.success(`Added PHP ${version} to System PATH. You may need to restart your terminal.`);
      } else {
        await invoke('remove_from_path', { service: 'php' });
        toast.success(`Removed PHP from System PATH.`);
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
      const msg = await invoke<string>('install_php', { 
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
          <h2 className="text-2xl font-semibold tracking-tight">Install PHP</h2>
          <p className="text-sm text-muted-foreground mt-1">Select an NTS x64 build from windows.php.net.</p>
        </div>
        <div className="space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Available Versions
              </label>
              <Select 
                disabled={isFetching || isInstalling} 
                value={selectedVersion} 
                onValueChange={(v) => v && setSelectedVersion(v)}
                items={releases.map(r => ({ value: r.version, label: `PHP ${r.version}` }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isFetching ? "Fetching versions..." : "Select version"} />
                </SelectTrigger>
                <SelectContent>
                  {releases.map(r => (
                    <SelectItem key={r.version} value={r.version} label={`PHP ${r.version}`}>PHP {r.version}</SelectItem>
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

      {installedVersions.length > 0 && (
        <section className="border-t border-border/50 pt-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4 mb-1">
                <h2 className="text-2xl font-semibold tracking-tight">Global Environment</h2>
                <Select 
                  value={currentActiveVersion} 
                  onValueChange={(val) => val && onPhpVersionChange(val)}
                  items={installedVersions.map(v => ({ value: v, label: `PHP ${v}` }))}
                >
                  <SelectTrigger className="w-[140px] h-8 text-sm">
                    <SelectValue placeholder="Version" />
                  </SelectTrigger>
                  <SelectContent>
                    {installedVersions.map(v => (
                      <SelectItem key={v} value={v} label={`PHP ${v}`}>PHP {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Select the default PHP version and add it to System PATH</p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="path-toggle" checked={isPathEnabled} onCheckedChange={togglePath} />
              <Label htmlFor="path-toggle">Global CLI Access (PATH)</Label>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
