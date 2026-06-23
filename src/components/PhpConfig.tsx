import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { Save, Loader2, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface PhpConfigProps {
  activePhpVersion: string;
  installedVersions: string[];
  onPhpVersionChange: (version: string) => void;
}

const CORE_SETTINGS = [
  'max_execution_time', 'max_input_time', 'max_input_vars', 'memory_limit', 
  'error_reporting', 'display_errors', 'display_startup_errors', 'log_errors', 
  'error_log', 'date.timezone', 'expose_php', 'short_open_tag'
];

const UPLOAD_SETTINGS = [
  'file_uploads', 'upload_max_filesize', 'max_file_uploads', 'post_max_size'
];

const OPCACHE_SETTINGS = [
  'opcache.enable', 'opcache.enable_cli', 'opcache.memory_consumption', 
  'opcache.interned_strings_buffer', 'opcache.max_accelerated_files', 
  'opcache.revalidate_freq', 'opcache.fast_shutdown', 'opcache.save_comments'
];

interface IniState {
  rawContent: string;
  settings: Record<string, string>;
  extensions: Record<string, boolean>; // key is extension name, value is enabled
  zend_extensions: Record<string, boolean>;
}

function toHumanReadable(str: string): string {
  return str
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function PhpConfig({ activePhpVersion, installedVersions, onPhpVersionChange }: PhpConfigProps) {
  const [iniState, setIniState] = useState<IniState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentVersion = activePhpVersion || (installedVersions.length > 0 ? installedVersions[0] : '');

  useEffect(() => {
    if (currentVersion) {
      loadPhpIni(currentVersion);
    }
  }, [currentVersion]);

  const loadPhpIni = async (version: string) => {
    setIsLoading(true);
    try {
      const content = await invoke<string>('get_php_ini_content', { version });
      parsePhpIni(content);
    } catch (e: any) {
      toast.error(`Failed to load php.ini: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  const parsePhpIni = (content: string) => {
    const lines = content.split('\n');
    const settings: Record<string, string> = {};
    const extensions: Record<string, boolean> = {};
    const zend_extensions: Record<string, boolean> = {};

    // First, set defaults for all known settings so they always appear in the UI
    [...CORE_SETTINGS, ...UPLOAD_SETTINGS, ...OPCACHE_SETTINGS].forEach(key => {
      settings[key] = ''; // Will be populated if found
    });

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Dynamic Extensions parsing
      // Match: extension=curl OR ;extension=curl
      const extMatch = trimmed.match(/^;?\s*extension\s*=\s*(.+)$/i);
      if (extMatch) {
        const cleanExt = extMatch[1].split(';')[0].trim();
        if (cleanExt !== 'modulename' && !cleanExt.includes('/path/to/')) {
          const isEnabled = !trimmed.startsWith(';');
          extensions[cleanExt] = isEnabled;
        }
        continue;
      }

      // Zend Extensions
      const zendExtMatch = trimmed.match(/^;?\s*zend_extension\s*=\s*(.+)$/i);
      if (zendExtMatch) {
        const cleanExt = zendExtMatch[1].split(';')[0].trim();
        if (cleanExt !== 'modulename' && !cleanExt.includes('/path/to/')) {
          const isEnabled = !trimmed.startsWith(';');
          zend_extensions[cleanExt] = isEnabled;
        }
        continue;
      }

      // Settings parsing
      // We look for our known settings keys
      for (const key of Object.keys(settings)) {
        // Need to escape dots in keys like opcache.enable
        const escapedKey = key.replace(/\./g, '\\.');
        const regex = new RegExp(`^;?\\s*${escapedKey}\\s*=\\s*(.*)$`, 'i');
        const match = trimmed.match(regex);
        if (match && !trimmed.startsWith(';')) {
          // If multiple active definitions exist, we take the last one (which PHP does too)
          // But here taking the first uncommented is also fine. Let's just overwrite.
          settings[key] = match[1].trim();
        }
      }
    }

    setIniState({ rawContent: content, settings, extensions, zend_extensions });
  };

  const savePhpIni = async () => {
    if (!iniState || !currentVersion) return;
    setIsSaving(true);
    let newContent = iniState.rawContent;

    // Helper to replace or insert settings
    const applySetting = (key: string, value: string) => {
      if (value === '') return; // Don't save empty fields
      const escapedKey = key.replace(/\./g, '\\.');
      const regex = new RegExp(`^;?\\s*${escapedKey}\\s*=.*$`, 'gm');
      if (newContent.match(regex)) {
        newContent = newContent.replace(regex, `${key} = ${value}`);
      } else {
        newContent += `\n${key} = ${value}\n`;
      }
    };

    // Apply Settings
    for (const [key, val] of Object.entries(iniState.settings)) {
      applySetting(key, val);
    }

    // Apply Extensions
    for (const [ext, enabled] of Object.entries(iniState.extensions)) {
      const regex = new RegExp(`^;?\\s*extension\\s*=\\s*${ext}\\b`, 'gm');
      if (enabled) {
        newContent = newContent.replace(regex, `extension=${ext}`);
      } else {
        newContent = newContent.replace(regex, `;extension=${ext}`);
      }
    }

    // Apply Zend Extensions
    for (const [ext, enabled] of Object.entries(iniState.zend_extensions)) {
      const regex = new RegExp(`^;?\\s*zend_extension\\s*=\\s*${ext}\\b`, 'gm');
      if (enabled) {
        newContent = newContent.replace(regex, `zend_extension=${ext}`);
      } else {
        newContent = newContent.replace(regex, `;zend_extension=${ext}`);
      }
    }

    try {
      await invoke('save_php_ini_content', { version: currentVersion, content: newContent });
      toast.success('php.ini saved successfully! Restart PHP to apply.');
      setIniState({ ...iniState, rawContent: newContent });
    } catch (e: any) {
      toast.error(`Failed to save php.ini: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    if (!iniState) return;
    setIniState({
      ...iniState,
      settings: { ...iniState.settings, [key]: value }
    });
  };

  const handleSwitchChange = (key: string, checked: boolean) => {
    handleSettingChange(key, checked ? 'On' : 'Off');
  };

  const handleExtensionToggle = (ext: string, checked: boolean, isZend: boolean = false) => {
    if (!iniState) return;
    if (isZend) {
      setIniState({
        ...iniState,
        zend_extensions: { ...iniState.zend_extensions, [ext]: checked }
      });
    } else {
      setIniState({
        ...iniState,
        extensions: { ...iniState.extensions, [ext]: checked }
      });
    }
  };

  if (installedVersions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center text-muted-foreground space-y-4">
        <AlertCircle className="w-12 h-12 opacity-50" />
        <div>
          <h3 className="text-lg font-medium text-foreground">No PHP Versions Installed</h3>
          <p>Please install a PHP version from the "PHP Engine" tab first to configure php.ini.</p>
        </div>
      </div>
    );
  }

  // Boolean helper
  const isSettingOn = (key: string) => {
    const val = iniState?.settings[key]?.toLowerCase();
    return val === '1' || val === 'on' || val === 'true';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">PHP Configuration</h2>
          <p className="text-muted-foreground text-sm">Fine-tune your active php.ini seamlessly.</p>
        </div>
        <div className="flex items-center gap-4">
          <Select disabled={isLoading} value={currentVersion} onValueChange={(val) => val && onPhpVersionChange(val)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {installedVersions.map(v => (
                <SelectItem key={v} value={v}>PHP {v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={savePhpIni} disabled={isSaving || !iniState} className="shadow-md">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Alert className="mb-6 bg-sky-500/10 border-sky-500/20 text-sky-500 dark:text-sky-400">
        <Info className="h-4 w-4" color="currentColor" />
        <AlertTitle>Restart Required</AlertTitle>
        <AlertDescription>
          Any changes saved here require the PHP engine to be restarted to take effect. You can restart PHP from the Dashboard or Web Server tab.
        </AlertDescription>
      </Alert>

      {isLoading || !iniState ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="core" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="core">Core</TabsTrigger>
            <TabsTrigger value="uploads">Uploads</TabsTrigger>
            <TabsTrigger value="opcache">Opcache</TabsTrigger>
            <TabsTrigger value="extensions">Extensions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="core">
            <section className="space-y-6 pt-4">
              <div className="mb-6">
                <h3 className="text-xl font-semibold tracking-tight">Core Settings</h3>
                <p className="text-sm text-muted-foreground mt-1">Fundamental PHP runtime limits and error reporting.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CORE_SETTINGS.map(key => {
                  const isBoolean = ['display_errors', 'display_startup_errors', 'log_errors', 'expose_php', 'short_open_tag'].includes(key);
                  return (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key} className="flex items-center justify-between">
                        {toHumanReadable(key)}
                        {isBoolean && (
                          <Switch 
                            id={key}
                            checked={isSettingOn(key)}
                            onCheckedChange={(c) => handleSwitchChange(key, c)}
                          />
                        )}
                      </Label>
                      {!isBoolean && (
                        <Input 
                          id={key}
                          value={iniState.settings[key]}
                          onChange={(e) => handleSettingChange(key, e.target.value)}
                          placeholder="e.g., 256M, E_ALL"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="uploads">
            <section className="space-y-6 pt-4">
              <div className="mb-6">
                <h3 className="text-xl font-semibold tracking-tight">File Uploads</h3>
                <p className="text-sm text-muted-foreground mt-1">Configure file upload constraints.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {UPLOAD_SETTINGS.map(key => {
                  const isBoolean = ['file_uploads'].includes(key);
                  return (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key} className="flex items-center justify-between">
                        {toHumanReadable(key)}
                        {isBoolean && (
                          <Switch 
                            id={key}
                            checked={isSettingOn(key)}
                            onCheckedChange={(c) => handleSwitchChange(key, c)}
                          />
                        )}
                      </Label>
                      {!isBoolean && (
                        <Input 
                          id={key}
                          value={iniState.settings[key]}
                          onChange={(e) => handleSettingChange(key, e.target.value)}
                          placeholder="e.g., 50M"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="opcache">
            <section className="space-y-6 pt-4">
              <div className="mb-6">
                <h3 className="text-xl font-semibold tracking-tight">Zend Opcache</h3>
                <p className="text-sm text-muted-foreground mt-1">Optimize PHP execution by caching precompiled script bytecode.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {OPCACHE_SETTINGS.map(key => {
                  const isBoolean = ['opcache.enable', 'opcache.enable_cli', 'opcache.fast_shutdown', 'opcache.save_comments'].includes(key);
                  return (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key} className="flex items-center justify-between">
                        {toHumanReadable(key)}
                        {isBoolean && (
                          <Switch 
                            id={key}
                            checked={isSettingOn(key)}
                            onCheckedChange={(c) => handleSwitchChange(key, c)}
                          />
                        )}
                      </Label>
                      {!isBoolean && (
                        <Input 
                          id={key}
                          value={iniState.settings[key]}
                          onChange={(e) => handleSettingChange(key, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="extensions">
            <section className="space-y-6 pt-4">
              <div className="mb-6">
                <h3 className="text-xl font-semibold tracking-tight">PHP Extensions</h3>
                <p className="text-sm text-muted-foreground mt-1">Dynamically parsed from your active php.ini. Toggle them on or off instantly.</p>
              </div>
              <div>
                <div className="mb-6">
                  <h3 className="font-semibold mb-4 text-primary">Standard Extensions</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Object.entries(iniState.extensions)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([ext, enabled]) => (
                      <div key={`ext-${ext}`} className="flex items-center space-x-2 border border-border/50 p-2 px-3 rounded-md bg-secondary/20">
                        <Switch 
                          id={`ext-${ext}`} 
                          checked={enabled} 
                          onCheckedChange={(c) => handleExtensionToggle(ext, c, false)}
                        />
                        <Label htmlFor={`ext-${ext}`} className="truncate cursor-pointer" title={ext}>{ext}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {Object.keys(iniState.zend_extensions).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-4 text-primary mt-8 border-t border-border/50 pt-6">Zend Extensions</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {Object.entries(iniState.zend_extensions)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([ext, enabled]) => (
                        <div key={`zext-${ext}`} className="flex items-center space-x-2 border border-border/50 p-2 px-3 rounded-md bg-secondary/20">
                          <Switch 
                            id={`zext-${ext}`} 
                            checked={enabled} 
                            onCheckedChange={(c) => handleExtensionToggle(ext, c, true)}
                          />
                          <Label htmlFor={`zext-${ext}`} className="truncate cursor-pointer" title={ext}>{ext}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </TabsContent>

        </Tabs>
      )}
    </div>
  );
}
