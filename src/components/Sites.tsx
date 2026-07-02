import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { Globe, Lock, Unlock, Link as LinkIcon, ExternalLink, Loader2, RefreshCw, TriangleAlert, Info } from 'lucide-react';
import { AppSettings, ServiceStatus } from '../types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface Site {
  name: string;
  path: string;
  domain: string;
  secured: boolean;
}

export function Sites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [sharedSites, setSharedSites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [securingDomain, setSecuringDomain] = useState<string | null>(null);
  const [sharingDomain, setSharingDomain] = useState<string | null>(null);
  const [hasNgrokToken, setHasNgrokToken] = useState(true);
  const [isServerRunning, setIsServerRunning] = useState(true);

  const fetchSites = async () => {
    setIsLoading(true);
    try {
      const settings = await invoke<AppSettings>('get_settings');
      setHasNgrokToken(!!settings.ngrok_auth_token && settings.ngrok_auth_token.trim() !== '');

      const nginxStatus = await invoke<ServiceStatus>('get_nginx_status');
      const phpStatus = await invoke<ServiceStatus>('get_php_status');
      setIsServerRunning(nginxStatus.running && phpStatus.running);

      const result = await invoke<Site[]>('list_sites');
      setSites(result);
      const shared = await invoke<string[]>('get_shared_sites');
      setSharedSites(shared);
    } catch (e: any) {
      toast.error(`Failed to load sites: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleSecureToggle = async (site: Site, checked: boolean) => {
    setSecuringDomain(site.domain);
    try {
      if (checked) {
        toast.info(`Securing ${site.domain} (may prompt for admin)...`);
        const msg = await invoke<string>('secure_site', { domain: site.domain, projectPath: site.path });
        toast.success(msg);
      } else {
        const msg = await invoke<string>('unsecure_site', { domain: site.domain });
        toast.success(msg);
      }
      fetchSites();
    } catch (e: any) {
      toast.error(`Error: ${e}`);
    } finally {
      setSecuringDomain(null);
    }
  };

  const handleShare = async (domain: string) => {
    if (sharedSites.includes(domain)) {
      setSharingDomain(domain);
      try {
        await invoke('stop_share', { domain });
        toast.success(`Stopped sharing ${domain}`);
        fetchSites();
      } catch (e: any) {
        toast.error(`Failed to stop sharing: ${e}`);
      } finally {
        setSharingDomain(null);
      }
    } else {
      setSharingDomain(domain);
      try {
        toast.info(`Starting Ngrok tunnel for ${domain}...`);
        const publicUrl = await invoke<string>('share_site', { domain });
        toast.success(`Shared! Public URL: ${publicUrl}`);
        // Copy to clipboard
        navigator.clipboard.writeText(publicUrl);
        toast.info('Public URL copied to clipboard!');
        fetchSites();
      } catch (e: any) {
        toast.error(`Sharing failed: ${e}`);
      } finally {
        setSharingDomain(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Site Manager</h2>
          <p className="text-muted-foreground text-sm">Automatically discovered from your document root.</p>
        </div>
        <Button variant="outline" onClick={fetchSites} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {!hasNgrokToken && (
        <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20 text-destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Ngrok Auth Token Required</AlertTitle>
          <AlertDescription>
            You must configure your Ngrok Auth Token in the Settings tab before you can share local sites.
          </AlertDescription>
        </Alert>
      )}

      {!isServerRunning && (
        <Alert className="mb-6 bg-sky-500/10 border-sky-500/20 text-sky-500 dark:text-sky-400">
          <Info className="h-4 w-4" color="currentColor" />
          <AlertTitle>Servers Offline</AlertTitle>
          <AlertDescription>
            Your Nginx or PHP engine is currently stopped. Make sure to start them first so your sites can be accessed!
          </AlertDescription>
        </Alert>
      )}

      <section className="border-t border-border/50 pt-8 mt-8">
        <div className="mb-6">
          <h3 className="text-xl font-semibold tracking-tight">Local Projects</h3>
          <p className="text-sm text-muted-foreground mt-1">Manage SSL certificates and local sharing via Ngrok.</p>
        </div>
        <div className="flex-1 overflow-y-auto pb-10 custom-scrollbar">
          <div className="bg-card dark:bg-[#141414] text-card-foreground rounded-2xl border border-border/50 dark:border-zinc-800/60 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/50 dark:border-zinc-800/60 bg-secondary/30 dark:bg-white/[0.02] font-semibold text-sm text-muted-foreground">
              <div className="col-span-4">Project</div>
              <div className="col-span-4">URL</div>
              <div className="col-span-2 text-center">SSL</div>
              <div className="col-span-2 text-right">Share</div>
            </div>
            
            {isLoading && sites.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mb-4 opacity-50" />
                <p className="text-lg font-medium text-foreground">Loading projects...</p>
              </div>
            ) : sites.length === 0 && !isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Globe className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-lg font-medium text-foreground">No projects found</p>
                <p className="text-sm mt-1 max-w-md">
                  No projects found in your document root.
                </p>
              </div>
            ) : sites.length > 0 ? sites.map((site) => {
              const protocol = site.secured ? 'https' : 'http';
              const fullUrl = `${protocol}://${site.domain}`;
              const isSecuring = securingDomain === site.domain;
              const isSharing = sharingDomain === site.domain;
              const isShared = sharedSites.includes(site.domain);

              return (
                <div key={site.domain} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/10 dark:border-zinc-800/40 hover:bg-accent/50 dark:hover:bg-[#1a1a1a] transition-colors items-center text-sm group">
                  <div className="col-span-4 font-medium flex flex-col">
                    <span>{site.name}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={site.path}>
                      {site.path}
                    </span>
                  </div>
                  <div className="col-span-4">
                    <a 
                      href={fullUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center text-primary hover:underline"
                    >
                      {site.secured ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1 text-muted-foreground" />}
                      {site.domain}
                      <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                    </a>
                  </div>
                  <div className="col-span-2 flex items-center justify-center space-x-2">
                    <Switch 
                      checked={site.secured}
                      disabled={isSecuring}
                      onCheckedChange={(c) => handleSecureToggle(site, c)}
                    />
                    {isSecuring && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    {hasNgrokToken ? (
                      <Button 
                        variant={isShared ? "destructive" : "secondary"} 
                        size="sm" 
                        disabled={isSharing}
                        onClick={() => handleShare(site.domain)}
                        className="w-full max-w-[120px]"
                      >
                        {isSharing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isShared ? (
                          "Stop"
                        ) : (
                          <>
                            <LinkIcon className="w-4 h-4 mr-1" /> Share
                          </>
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic flex items-center">Requires Token</span>
                    )}
                  </div>
                </div>
              );
            }) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
