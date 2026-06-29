import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { AppSettings } from '../types';
import { useTheme } from './theme-provider';

interface SettingsProps {
  onSettingsSaved?: () => void;
}

export function Settings({ onSettingsSaved }: SettingsProps) {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');

  const isFirstLoad = useRef(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (isFirstLoad.current) {
      if (settings !== null) {
        isFirstLoad.current = false;
      }
      return;
    }

    const autoSave = async () => {
      if (!settings) return;
      try {
        await invoke('save_settings', { settings });
        if (onSettingsSaved) onSettingsSaved();
      } catch (e: any) {
        toast.error(`Failed to auto-save settings: ${e}`);
      }
    };

    const timeout = setTimeout(autoSave, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const loadSettings = async () => {
    try {
      const s = await invoke<AppSettings>('get_settings');
      setSettings(s);
    } catch (e) {
      toast.error('Failed to load settings');
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await invoke('clear_all_cache');
      localStorage.clear();
      toast.success('All cache cleared successfully! You may need to restart the app or reload the page to fetch fresh data.');
    } catch (e: any) {
      toast.error(`Failed to clear cache: ${e}`);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (licenseKey === 'KYTH-COIN-2705-GIFT') {
      try {
        await invoke('add_coins', { amount: 100 });
        toast.success("Cheat Code Activated! +100 Coins", {
          duration: 3000,
          position: 'bottom-right',
          icon: '✨'
        });
        window.dispatchEvent(new Event('gamification-update'));
        setLicenseKey('');
        return; // Don't close the modal so they can repeat it easily!
      } catch (err) {
        toast.error("Cheat failed.");
      }
    }

    if (licenseKey.trim().length > 0) {
      toast.success("Just kidding! Kythia is and always will be 100% free! 🎉", {
        duration: 5000,
        position: 'bottom-right',
        style: { fontSize: '1.1rem', padding: '16px' }
      });
      setLicenseKey('');
      setTimeout(() => setShowLicense(false), 3000);
    }
  };

  if (!settings) return null;

  if (showLicense) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-500 max-w-lg mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight">Upgrade to Kythia Pro</h2>
          <p className="text-muted-foreground">Unlock the ultimate developer experience. Enter your license key below to activate all premium features.</p>
        </div>

        <form onSubmit={handleActivateLicense} className="w-full space-y-4">
          <Input
            value={licenseKey}
            onChange={(e) => {
              let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              if (val.length > 16) val = val.substring(0, 16);
              const parts = [];
              for (let i = 0; i < val.length; i += 4) {
                parts.push(val.substring(i, i + 4));
              }
              setLicenseKey(parts.join('-'));
            }}
            maxLength={19}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="text-center text-2xl tracking-widest uppercase h-14 font-mono"
            autoFocus
          />
          <div className="flex gap-4 w-full">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowLicense(false)}>Cancel</Button>
            <Button type="submit" className="flex-1">Activate Now</Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground text-sm">Manage your workspace configuration and preferences.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleClearCache} disabled={isClearingCache} variant="outline" className="w-full sm:w-auto shadow-sm">
            {isClearingCache ? 'Clearing...' : 'Clear Cache'}
          </Button>
        </div>
      </div>

      <section>
        <div className="mb-6">
          <h3 className="text-2xl font-semibold tracking-tight">Appearance</h3>
          <p className="text-sm text-muted-foreground mt-1">Customize how Kythia Workspace looks.</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="theme" className="flex-1">Theme</Label>
            <div>
              <Select
                value={theme}
                onValueChange={(v) => setTheme(v as any)}
                items={{ dark: 'Dark', light: 'Light', system: 'System' }}
              >
                <SelectTrigger id="theme">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark" label="Dark">Dark</SelectItem>
                  <SelectItem value="light" label="Light">Light</SelectItem>
                  <SelectItem value="system" label="System">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/70 pt-8">
        <div className="mb-6">
          <h3 className="text-2xl font-semibold tracking-tight">Web & Database Services</h3>
          <p className="text-sm text-muted-foreground mt-1">Configure service ports and paths. Restart services to apply changes.</p>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document_root">Document Root</Label>
              <Input
                id="document_root"
                value={settings.document_root || ''}
                onChange={(e) => setSettings({ ...settings, document_root: e.target.value })}
                placeholder="C:\kythia\www"
              />
              <div className="text-xs text-muted-foreground">
                The directory where your web files (like index.php) are served from.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="local_domain">Local Domain Suffix</Label>
              <Input
                id="local_domain"
                value={settings.local_domain || 'test'}
                onChange={(e) => {
                  // strip leading dot if user types it
                  const val = e.target.value.replace(/^\./, '');
                  setSettings({ ...settings, local_domain: val })
                }}
                placeholder="test"
              />
              <div className="text-xs text-muted-foreground">
                E.g. "test" maps your folders to .test domains automatically.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nginx_port">Nginx Port</Label>
              <Input
                id="nginx_port"
                type="number"
                value={settings.nginx?.port || 80}
                onChange={(e) => setSettings({
                  ...settings,
                  nginx: { ...settings.nginx, port: parseInt(e.target.value) || 80 }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="php_port">PHP Port</Label>
              <Input
                id="php_port"
                type="number"
                value={settings.php?.port || 8080}
                onChange={(e) => setSettings({
                  ...settings,
                  php: { ...settings.php, port: parseInt(e.target.value) || 8080 }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mariadb_port">MariaDB / MySQL Port</Label>
              <Input
                id="mariadb_port"
                type="number"
                value={settings.mariadb?.port || 3306}
                onChange={(e) => {
                  const port = parseInt(e.target.value) || 3306;
                  setSettings({
                    ...settings,
                    mariadb: { ...settings.mariadb, port },
                    mysql: { ...settings.mysql, port } // keep in sync or handle separately
                  })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postgres_port">PostgreSQL Port</Label>
              <Input
                id="postgres_port"
                type="number"
                value={settings.postgres?.port || 5432}
                onChange={(e) => setSettings({
                  ...settings,
                  postgres: { ...settings.postgres, port: parseInt(e.target.value) || 5432 }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mongodb_port">MongoDB Port</Label>
              <Input
                id="mongodb_port"
                type="number"
                value={settings.mongodb?.port || 27017}
                onChange={(e) => setSettings({
                  ...settings,
                  mongodb: { ...settings.mongodb, port: parseInt(e.target.value) || 27017 }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redis_port">Redis Port</Label>
              <Input
                id="redis_port"
                type="number"
                value={settings.redis?.port || 6379}
                onChange={(e) => setSettings({
                  ...settings,
                  redis: { ...settings.redis, port: parseInt(e.target.value) || 6379 }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redis_user">Redis Username</Label>
              <Input
                id="redis_user"
                type="text"
                placeholder="default"
                value={settings.redis?.user || ''}
                onChange={(e) => setSettings({
                  ...settings,
                  redis: { ...settings.redis, user: e.target.value }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redis_password">Redis Password</Label>
              <Input
                id="redis_password"
                type="password"
                placeholder="Leave blank for no password"
                value={settings.redis?.password || ''}
                onChange={(e) => setSettings({
                  ...settings,
                  redis: { ...settings.redis, password: e.target.value }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mailpit_smtp_port">Mailpit SMTP Port</Label>
              <Input
                id="mailpit_smtp_port"
                type="number"
                value={settings.mailpit?.smtp_port || 1025}
                onChange={(e) => setSettings({
                  ...settings,
                  mailpit: { ...settings.mailpit, smtp_port: parseInt(e.target.value) || 1025 }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mailpit_ui_port">Mailpit UI Port</Label>
              <Input
                id="mailpit_ui_port"
                type="number"
                value={settings.mailpit?.ui_port || 8025}
                onChange={(e) => setSettings({
                  ...settings,
                  mailpit: { ...settings.mailpit, ui_port: parseInt(e.target.value) || 8025 }
                })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Ngrok Auth Token (Required)  <a href="https://dashboard.ngrok.com/get-started/setup/windows" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Get Auth Token</a></Label>
            <Input
              type="password"
              value={settings.ngrok_auth_token || ''}
              onChange={(e) => setSettings({ ...settings, ngrok_auth_token: e.target.value })}
              placeholder="Authtoken from dashboard.ngrok.com"
            />
            <p className="text-xs text-muted-foreground mt-1">Required to share local sites to the internet via Ngrok.</p>
          </div>

        </div>
      </section>

      <section className="border-t border-border/70 pt-8">
        <div className="mb-6">
          <h3 className="text-2xl font-semibold tracking-tight">System Tray & Startup</h3>
          <p className="text-sm text-muted-foreground mt-1">Configure how Kythia behaves in Windows.</p>
        </div>
        <div className="space-y-6">
            <div className="flex items-center justify-between p-3 border border-border/50 bg-card/30 rounded-xl">
              <div>
                <Label htmlFor="native_notifications">OS Native Notifications</Label>
                <div className="text-xs text-muted-foreground mt-1">Receive alerts directly in Windows/Mac notification center</div>
              </div>
              <Switch 
                id="native_notifications" 
                checked={settings.native_notifications} 
                onCheckedChange={(c) => setSettings({...settings, native_notifications: c})}
              />
            </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autostart">Launch on Startup</Label>
              <div className="text-sm text-muted-foreground">
                Automatically start Kythia Workspace when you log in.
              </div>
            </div>
            <Switch
              id="autostart"
              checked={settings.autostart}
              onCheckedChange={(c) => setSettings({ ...settings, autostart: c })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="close_to_tray">Close to Tray</Label>
              <div className="text-sm text-muted-foreground">
                Clicking the 'X' button will minimize Kythia to the system tray instead of quitting.
              </div>
            </div>
            <Switch
              id="close_to_tray"
              checked={settings.close_to_tray}
              onCheckedChange={(c) => setSettings({ ...settings, close_to_tray: c })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="minimize_to_tray">Minimize to Tray</Label>
              <div className="text-sm text-muted-foreground">
                Minimizing the window will hide it to the system tray.
              </div>
            </div>
            <Switch
              id="minimize_to_tray"
              checked={settings.minimize_to_tray}
              onCheckedChange={(c) => setSettings({ ...settings, minimize_to_tray: c })}
            />
          </div>
        </div>
      </section>

      <div className="mt-12 border-t border-border/70 pt-8 text-center text-xs text-muted-foreground pb-8">
        <button onClick={() => setShowLicense(true)} className="text-primary hover:text-primary/80 transition-color duration-200">
          Activate Kythia Pro
        </button>
      </div>
    </div>
  );
}
