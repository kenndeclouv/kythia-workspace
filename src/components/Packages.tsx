import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Download, Package2 } from 'lucide-react';
import { filterHighestPatches } from '../lib/utils';

interface NodeRelease {
  version: string;
  lts: boolean;
  url: string;
}

interface BunRelease {
  version: string;
  url: string;
}

interface MeiliRelease {
  version: string;
  url: string;
}

interface DenoRelease {
  version: string;
  url: string;
}

export function Packages() {
  // Available
  const [nodeReleases, setNodeReleases] = useState<NodeRelease[]>([]);
  const [bunReleases, setBunReleases] = useState<BunRelease[]>([]);
  const [meiliReleases, setMeiliReleases] = useState<MeiliRelease[]>([]);
  const [denoReleases, setDenoReleases] = useState<DenoRelease[]>([]);
  
  // Installed
  const [installedNode, setInstalledNode] = useState<string[]>([]);
  const [installedBun, setInstalledBun] = useState<string[]>([]);
  const [installedComposer, setInstalledComposer] = useState<string | null>(null);
  const [installedWpCli, setInstalledWpCli] = useState<string | null>(null);
  const [installedPnpm, setInstalledPnpm] = useState<string | null>(null);
  const [installedYarn, setInstalledYarn] = useState<string | null>(null);
  const [installedMeili, setInstalledMeili] = useState<string[]>([]);
  const [installedDeno, setInstalledDeno] = useState<string[]>([]);

  // Selected for installation
  const [selectedNodeVersion, setSelectedNodeVersion] = useState<string>('');
  const [selectedBunVersion, setSelectedBunVersion] = useState<string>('');
  const [selectedMeiliVersion, setSelectedMeiliVersion] = useState<string>('');
  const [selectedDenoVersion, setSelectedDenoVersion] = useState<string>('');

  // Global Paths
  const [globalNode, setGlobalNode] = useState<string | null>(null);
  const [globalBun, setGlobalBun] = useState<string | null>(null);
  const [globalComposer, setGlobalComposer] = useState<boolean>(false);
  const [globalWpCli, setGlobalWpCli] = useState<boolean>(false);
  const [globalPnpm, setGlobalPnpm] = useState<boolean>(false);
  const [globalYarn, setGlobalYarn] = useState<boolean>(false);
  const [globalMeili, setGlobalMeili] = useState<string | null>(null);
  const [globalDeno, setGlobalDeno] = useState<string | null>(null);

  // Status
  const [isInstalling, setIsInstalling] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailable();
    fetchInstalled();
  }, []);

  const fetchAvailable = async () => {
    try {
      const node = await invoke<NodeRelease[]>('fetch_node_versions');
      const filteredNode = filterHighestPatches(node, installedNode);
      setNodeReleases(filteredNode);
      if (filteredNode.length > 0) setSelectedNodeVersion(filteredNode[0].version);

      const bun = await invoke<BunRelease[]>('fetch_bun_versions');
      const filteredBun = filterHighestPatches(bun, installedBun);
      setBunReleases(filteredBun);
      if (filteredBun.length > 0) setSelectedBunVersion(filteredBun[0].version);

      const meili = await invoke<MeiliRelease[]>('fetch_meilisearch_versions');
      const filteredMeili = filterHighestPatches(meili, installedMeili);
      setMeiliReleases(filteredMeili);
      if (filteredMeili.length > 0) setSelectedMeiliVersion(filteredMeili[0].version);

      const deno = await invoke<DenoRelease[]>('fetch_deno_versions');
      const filteredDeno = filterHighestPatches(deno, installedDeno);
      setDenoReleases(filteredDeno);
      if (filteredDeno.length > 0) setSelectedDenoVersion(filteredDeno[0].version);
    } catch (e) {
      console.error('Failed to fetch package versions:', e);
    }
  };

  const fetchInstalled = async () => {
    try {
      // Fetch all installed lists in parallel
      const [node, bun, meili, deno, composer, wpcli, pnpm, yarn] = await Promise.all([
        invoke<string[]>('get_installed_node').catch(() => [] as string[]),
        invoke<string[]>('get_installed_bun').catch(() => [] as string[]),
        invoke<string[]>('get_installed_meilisearch').catch(() => [] as string[]),
        invoke<string[]>('get_installed_deno').catch(() => [] as string[]),
        invoke<string | null>('get_installed_composer').catch(() => null),
        invoke<string | null>('get_installed_wp_cli').catch(() => null),
        invoke<string | null>('get_installed_pnpm').catch(() => null),
        invoke<string | null>('get_installed_yarn').catch(() => null),
      ]);

      setInstalledNode(node);
      setInstalledBun(bun);
      setInstalledMeili(meili);
      setInstalledDeno(deno);
      setInstalledComposer(composer);
      setInstalledWpCli(wpcli);
      setInstalledPnpm(pnpm);
      setInstalledYarn(yarn);

      // Check global PATH status for all versions in parallel
      const [nodeStatuses, bunStatuses, meiliStatuses, denoStatuses, composerStatus, wpcliStatus, pnpmStatus, yarnStatus] = await Promise.all([
        Promise.all(node.map(v => invoke<boolean>('get_path_status', { exactPath: `C:\\kythia\\bin\\node\\${v}` }).catch(() => false))),
        Promise.all(bun.map(v => invoke<boolean>('get_path_status', { exactPath: `C:\\kythia\\bin\\bun\\${v}` }).catch(() => false))),
        Promise.all(meili.map(v => invoke<boolean>('get_path_status', { exactPath: `C:\\kythia\\bin\\meilisearch\\${v}` }).catch(() => false))),
        Promise.all(deno.map(v => invoke<boolean>('get_path_status', { exactPath: `C:\\kythia\\bin\\deno\\${v}` }).catch(() => false))),
        composer ? invoke<boolean>('get_path_status', { exactPath: `C:\\kythia\\bin\\composer` }).catch(() => false) : Promise.resolve(false),
        wpcli ? invoke<boolean>('get_path_status', { exactPath: `C:\\kythia\\bin\\wp-cli` }).catch(() => false) : Promise.resolve(false),
        pnpm ? invoke<boolean>('get_path_status', { exactPath: `C:\\kythia\\bin\\pnpm` }).catch(() => false) : Promise.resolve(false),
        yarn ? invoke<boolean>('get_path_status', { exactPath: `C:\\kythia\\bin\\yarn` }).catch(() => false) : Promise.resolve(false),
      ]);

      setGlobalNode(node.find((_, i) => nodeStatuses[i]) ?? null);
      setGlobalBun(bun.find((_, i) => bunStatuses[i]) ?? null);
      setGlobalMeili(meili.find((_, i) => meiliStatuses[i]) ?? null);
      setGlobalDeno(deno.find((_, i) => denoStatuses[i]) ?? null);
      setGlobalComposer(composerStatus as boolean);
      setGlobalWpCli(wpcliStatus as boolean);
      setGlobalPnpm(pnpmStatus as boolean);
      setGlobalYarn(yarnStatus as boolean);

    } catch (e) {
      console.error('Failed to fetch installed packages:', e);
    }
  };

  const handleInstall = async (pkg: string, version?: string, url?: string) => {
    setIsInstalling(pkg);
    toast.info(`Installing ${pkg}...`);
    try {
      if (version && url) {
        await invoke(`install_${pkg}`, { version, url });
        toast.success(`${pkg} v${version} installed!`);
      } else {
        await invoke(`install_${pkg}`);
        toast.success(`${pkg} installed!`);
      }
      fetchInstalled();
    } catch (e: any) {
      toast.error(`${pkg} installation failed: ${e}`);
    } finally {
      setIsInstalling(null);
    }
  };

  const handleGlobal = async (service: string, exactPath: string, checked: boolean, setter: (val: any) => void, val: any) => {
    try {
      if (checked) {
        await invoke('add_to_path', { service, exactPath });
        setter(val);
        toast.success(`Added ${service} to global PATH`);
      } else {
        await invoke('remove_from_path', { service });
        setter(service === 'composer' || service === 'wp-cli' || service === 'pnpm' || service === 'yarn' ? false : null);
        toast.success(`Removed ${service} from global PATH`);
      }
    } catch (e) {
      toast.error(`Failed to update PATH: ${e}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl pb-10">
      
      {/* Node.js */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="text-green-500" /> Node.js
          </CardTitle>
          <CardDescription>JavaScript runtime (includes npm)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Install New Version</h4>
            <div className="flex gap-2">
              <Select value={selectedNodeVersion} onValueChange={(v) => v && setSelectedNodeVersion(v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select version" /></SelectTrigger>
                <SelectContent>
                  {nodeReleases.map((r) => (
                    <SelectItem key={r.version} value={r.version}>
                      v{r.version} {r.lts && '(LTS)'} {installedNode.includes(r.version) && ' (Installed)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => handleInstall('node', selectedNodeVersion, nodeReleases.find(r => r.version === selectedNodeVersion)?.url)} disabled={isInstalling === 'node' || !selectedNodeVersion} variant="default">
                {isInstalling === 'node' ? '...' : <Download size={16} />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Installed Versions</h4>
            {installedNode.length === 0 ? <div className="text-sm text-muted-foreground italic">No versions installed</div> : (
              <ul className="space-y-1">
                {installedNode.map(v => (
                  <li key={v} className="text-sm flex items-center justify-between p-2 bg-secondary/30 rounded-md">
                    <span>v{v}</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`node-global-${v}`} className="text-xs text-muted-foreground">Global</Label>
                      <Switch id={`node-global-${v}`} checked={globalNode === v} onCheckedChange={(checked) => handleGlobal('node', `C:\\kythia\\bin\\node\\${v}`, checked, setGlobalNode, v)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bun */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="text-pink-500" /> Bun
          </CardTitle>
          <CardDescription>Fast all-in-one toolkit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Install New Version</h4>
            <div className="flex gap-2">
              <Select value={selectedBunVersion} onValueChange={(v) => v && setSelectedBunVersion(v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select version" /></SelectTrigger>
                <SelectContent>
                  {bunReleases.map((r) => (
                    <SelectItem key={r.version} value={r.version}>
                      v{r.version} {installedBun.includes(r.version) && ' (Installed)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => handleInstall('bun', selectedBunVersion, bunReleases.find(r => r.version === selectedBunVersion)?.url)} disabled={isInstalling === 'bun' || !selectedBunVersion} variant="default">
                {isInstalling === 'bun' ? '...' : <Download size={16} />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Installed Versions</h4>
            {installedBun.length === 0 ? <div className="text-sm text-muted-foreground italic">No versions installed</div> : (
              <ul className="space-y-1">
                {installedBun.map(v => (
                  <li key={v} className="text-sm flex items-center justify-between p-2 bg-secondary/30 rounded-md">
                    <span>v{v}</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`bun-global-${v}`} className="text-xs text-muted-foreground">Global</Label>
                      <Switch id={`bun-global-${v}`} checked={globalBun === v} onCheckedChange={(checked) => handleGlobal('bun', `C:\\kythia\\bin\\bun\\${v}`, checked, setGlobalBun, v)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deno */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="text-slate-500" /> Deno
          </CardTitle>
          <CardDescription>Secure JS/TS runtime</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Install New Version</h4>
            <div className="flex gap-2">
              <Select value={selectedDenoVersion} onValueChange={(v) => v && setSelectedDenoVersion(v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select version" /></SelectTrigger>
                <SelectContent>
                  {denoReleases.map((r) => (
                    <SelectItem key={r.version} value={r.version}>
                      v{r.version} {installedDeno.includes(r.version) && ' (Installed)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => handleInstall('deno', selectedDenoVersion, denoReleases.find(r => r.version === selectedDenoVersion)?.url)} disabled={isInstalling === 'deno' || !selectedDenoVersion} variant="default">
                {isInstalling === 'deno' ? '...' : <Download size={16} />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Installed Versions</h4>
            {installedDeno.length === 0 ? <div className="text-sm text-muted-foreground italic">No versions installed</div> : (
              <ul className="space-y-1">
                {installedDeno.map(v => (
                  <li key={v} className="text-sm flex items-center justify-between p-2 bg-secondary/30 rounded-md">
                    <span>v{v}</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`deno-global-${v}`} className="text-xs text-muted-foreground">Global</Label>
                      <Switch id={`deno-global-${v}`} checked={globalDeno === v} onCheckedChange={(checked) => handleGlobal('deno', `C:\\kythia\\bin\\deno\\${v}`, checked, setGlobalDeno, v)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Meilisearch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="text-orange-500" /> Meilisearch
          </CardTitle>
          <CardDescription>Lightning-fast search engine</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Install New Version</h4>
            <div className="flex gap-2">
              <Select value={selectedMeiliVersion} onValueChange={(v) => v && setSelectedMeiliVersion(v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select version" /></SelectTrigger>
                <SelectContent>
                  {meiliReleases.map((r) => (
                    <SelectItem key={r.version} value={r.version}>
                      v{r.version} {installedMeili.includes(r.version) && ' (Installed)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => handleInstall('meilisearch', selectedMeiliVersion, meiliReleases.find(r => r.version === selectedMeiliVersion)?.url)} disabled={isInstalling === 'meilisearch' || !selectedMeiliVersion} variant="default">
                {isInstalling === 'meilisearch' ? '...' : <Download size={16} />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Installed Versions</h4>
            {installedMeili.length === 0 ? <div className="text-sm text-muted-foreground italic">No versions installed</div> : (
              <ul className="space-y-1">
                {installedMeili.map(v => (
                  <li key={v} className="text-sm flex items-center justify-between p-2 bg-secondary/30 rounded-md">
                    <span>v{v}</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`meili-global-${v}`} className="text-xs text-muted-foreground">Global</Label>
                      <Switch id={`meili-global-${v}`} checked={globalMeili === v} onCheckedChange={(checked) => handleGlobal('meilisearch', `C:\\kythia\\bin\\meilisearch\\${v}`, checked, setGlobalMeili, v)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="text-blue-500" /> Composer
          </CardTitle>
          <CardDescription>PHP dependency manager</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Installation</h4>
            <Button onClick={() => handleInstall('composer')} disabled={isInstalling === 'composer'} variant={installedComposer ? "outline" : "default"} className="w-full">
              {isInstalling === 'composer' ? 'Installing...' : installedComposer ? 'Re-install Latest' : 'Install Latest Composer'}
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Status</h4>
            {installedComposer ? (
               <div className="text-sm flex items-center justify-between p-2 bg-secondary/30 rounded-md border border-green-500/20">
                  <span className="text-green-600 dark:text-green-400">Installed</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="composer-global" className="text-xs text-muted-foreground">Global</Label>
                    <Switch id="composer-global" checked={globalComposer} onCheckedChange={(checked) => handleGlobal('composer', `C:\\kythia\\bin\\composer`, checked, setGlobalComposer, true)} />
                  </div>
               </div>
            ) : <div className="text-sm text-muted-foreground italic">Not installed</div>}
          </div>
        </CardContent>
      </Card>

      {/* WP-CLI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="text-teal-500" /> WP-CLI
          </CardTitle>
          <CardDescription>WordPress command-line tool</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Installation</h4>
            <Button onClick={() => handleInstall('wp_cli')} disabled={isInstalling === 'wp_cli'} variant={installedWpCli ? "outline" : "default"} className="w-full">
              {isInstalling === 'wp_cli' ? 'Installing...' : installedWpCli ? 'Re-install Latest' : 'Install Latest WP-CLI'}
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Status</h4>
            {installedWpCli ? (
               <div className="text-sm flex items-center justify-between p-2 bg-secondary/30 rounded-md border border-green-500/20">
                  <span className="text-green-600 dark:text-green-400">Installed</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="wpcli-global" className="text-xs text-muted-foreground">Global</Label>
                    <Switch id="wpcli-global" checked={globalWpCli} onCheckedChange={(checked) => handleGlobal('wp-cli', `C:\\kythia\\bin\\wp-cli`, checked, setGlobalWpCli, true)} />
                  </div>
               </div>
            ) : <div className="text-sm text-muted-foreground italic">Not installed</div>}
          </div>
        </CardContent>
      </Card>

      {/* PNPM */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="text-yellow-500" /> PNPM
          </CardTitle>
          <CardDescription>Fast, disk space efficient package manager</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Installation</h4>
            <Button onClick={() => handleInstall('pnpm')} disabled={isInstalling === 'pnpm'} variant={installedPnpm ? "outline" : "default"} className="w-full">
              {isInstalling === 'pnpm' ? 'Installing...' : installedPnpm ? 'Re-install Latest' : 'Install Standalone PNPM'}
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Status</h4>
            {installedPnpm ? (
               <div className="text-sm flex items-center justify-between p-2 bg-secondary/30 rounded-md border border-green-500/20">
                  <span className="text-green-600 dark:text-green-400">Installed</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pnpm-global" className="text-xs text-muted-foreground">Global</Label>
                    <Switch id="pnpm-global" checked={globalPnpm} onCheckedChange={(checked) => handleGlobal('pnpm', `C:\\kythia\\bin\\pnpm`, checked, setGlobalPnpm, true)} />
                  </div>
               </div>
            ) : <div className="text-sm text-muted-foreground italic">Not installed</div>}
          </div>
        </CardContent>
      </Card>

      {/* Yarn */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="text-cyan-500" /> Yarn
          </CardTitle>
          <CardDescription>Safe, stable, reproducible projects</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Installation</h4>
            <Button onClick={() => handleInstall('yarn')} disabled={isInstalling === 'yarn'} variant={installedYarn ? "outline" : "default"} className="w-full">
              {isInstalling === 'yarn' ? 'Installing...' : installedYarn ? 'Re-install Latest' : 'Install Standalone Yarn'}
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Status</h4>
            {installedYarn ? (
               <div className="text-sm flex items-center justify-between p-2 bg-secondary/30 rounded-md border border-green-500/20">
                  <span className="text-green-600 dark:text-green-400">Installed</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="yarn-global" className="text-xs text-muted-foreground">Global</Label>
                    <Switch id="yarn-global" checked={globalYarn} onCheckedChange={(checked) => handleGlobal('yarn', `C:\\kythia\\bin\\yarn`, checked, setGlobalYarn, true)} />
                  </div>
               </div>
            ) : <div className="text-sm text-muted-foreground italic">Not installed</div>}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
