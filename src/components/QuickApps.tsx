import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

import { Button } from './ui/button';
import { toast } from 'sonner';
import { Database, Download, ExternalLink, Globe, Info, Folder, ShoppingCart, Code, LineChart, MessageSquare, Book, Gauge } from 'lucide-react';
import { useDownloadProgress } from '../hooks/useDownloadProgress';
import { Progress } from './ui/progress';
import { ServiceStatus } from '../types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function QuickApps() {
  const [status, setStatus] = useState<Record<string, boolean>>({
    phpmyadmin: false,
    adminer: false,
    wordpress: false,
    phpinfo: false,
    tinyfilemanager: false,
    drupal: false,
    joomla: false,
    prestashop: false,
    codeigniter: false,
    opencart: false,
    matomo: false,
    phpbb: false,
    mediawiki: false,
    opcachegui: false,
  });
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [isServerRunning, setIsServerRunning] = useState(true);

  const pmaProgress = useDownloadProgress('phpmyadmin');
  const adminerProgress = useDownloadProgress('adminer');
  const wpProgress = useDownloadProgress('wordpress');
  const tfmProgress = useDownloadProgress('tinyfilemanager');
  const drupalProgress = useDownloadProgress('drupal');
  const joomlaProgress = useDownloadProgress('joomla');
  const psProgress = useDownloadProgress('prestashop');
  const ciProgress = useDownloadProgress('codeigniter');
  const ocProgress = useDownloadProgress('opencart');
  const matomoProgress = useDownloadProgress('matomo');
  const phpbbProgress = useDownloadProgress('phpbb');
  const mediawikiProgress = useDownloadProgress('mediawiki');
  const opcacheguiProgress = useDownloadProgress('opcachegui');

  useEffect(() => {
    checkStatus('phpmyadmin');
    checkStatus('adminer');
    checkStatus('wordpress');
    checkStatus('phpinfo');
    checkStatus('tinyfilemanager');
    checkStatus('drupal');
    checkStatus('joomla');
    checkStatus('prestashop');
    checkStatus('codeigniter');
    checkStatus('opencart');
    checkStatus('matomo');
    checkStatus('phpbb');
    checkStatus('mediawiki');
    checkStatus('opcachegui');
    checkServers();
  }, []);

  const checkServers = async () => {
    try {
      const nginx = await invoke<ServiceStatus>('get_nginx_status');
      const php = await invoke<ServiceStatus>('get_php_status');
      setIsServerRunning(nginx.running && php.running);
    } catch (e) {
      console.error(e);
    }
  };

  const checkStatus = async (app: string) => {
    try {
      const isInstalled = await invoke<boolean>(`check_${app}`);
      setStatus(prev => ({ ...prev, [app]: isInstalled }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleInstall = async (app: string, title: string) => {
    setInstalling(prev => ({ ...prev, [app]: true }));
    toast.info(`Installing ${title}...`);
    try {
      await invoke(`install_${app}`);
      toast.success(`${title} installed successfully!`);
      await invoke('add_xp', { amount: 30 }).catch(() => {});
      window.dispatchEvent(new CustomEvent('unlock-achievement', { detail: { id: 'speed_demon' } }));
      window.dispatchEvent(new Event('gamification-update'));
      checkStatus(app);
    } catch (e: any) {
      toast.error(`Installation failed: ${e}`);
    } finally {
      setInstalling(prev => ({ ...prev, [app]: false }));
    }
  };

  const handleOpen = async (path: string) => {
    await openUrl(`http://localhost/${path}`);
  };

  const apps = [
    {
      id: 'phpmyadmin',
      title: 'phpMyAdmin',
      version: '5.2.3',
      description: 'Web interface for MySQL and MariaDB',
      icon: <Database className="text-orange-500" />,
      path: 'phpmyadmin/',
      progress: pmaProgress.progress,
      colorClass: 'bg-orange-600 hover:bg-orange-700'
    },
    {
      id: 'adminer',
      title: 'Adminer',
      version: '4.8.4',
      description: 'Lightweight database management in a single PHP file',
      icon: <Database className="text-blue-500" />,
      path: 'adminer/',
      progress: adminerProgress.progress,
      colorClass: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      id: 'wordpress',
      title: 'WordPress',
      version: 'Latest',
      description: 'Popular CMS and blogging platform',
      icon: <Globe className="text-sky-500" />,
      path: 'wordpress/',
      progress: wpProgress.progress,
      colorClass: 'bg-sky-600 hover:bg-sky-700'
    },
    {
      id: 'drupal',
      title: 'Drupal',
      version: 'Latest',
      description: 'Powerful open-source CMS for ambitious digital experiences',
      icon: <Globe className="text-indigo-500" />,
      path: 'drupal/',
      progress: drupalProgress.progress,
      colorClass: 'bg-indigo-600 hover:bg-indigo-700'
    },
    {
      id: 'tinyfilemanager',
      title: 'Tiny File Manager',
      version: '2.5.4',
      description: 'Web based file manager. Default login: admin / admin@123',
      icon: <Folder className="text-yellow-500" />,
      path: 'filemanager/',
      progress: tfmProgress.progress,
      colorClass: 'bg-yellow-600 hover:bg-yellow-700'
    },
    {
      id: 'joomla',
      title: 'Joomla!',
      version: '5.0.3',
      description: 'Award-winning content management system (CMS)',
      icon: <Globe className="text-red-500" />,
      path: 'joomla/',
      progress: joomlaProgress.progress,
      colorClass: 'bg-red-600 hover:bg-red-700'
    },
    {
      id: 'prestashop',
      title: 'PrestaShop',
      version: '8.1.4',
      description: 'Fully scalable open source e-commerce solution',
      icon: <ShoppingCart className="text-pink-500" />,
      path: 'prestashop/',
      progress: psProgress.progress,
      colorClass: 'bg-pink-600 hover:bg-pink-700'
    },
    {
      id: 'opencart',
      title: 'OpenCart',
      version: '4.0.2.3',
      description: 'Free open source e-commerce platform',
      icon: <ShoppingCart className="text-teal-500" />,
      path: 'opencart/',
      progress: ocProgress.progress,
      colorClass: 'bg-teal-600 hover:bg-teal-700'
    },
    {
      id: 'matomo',
      title: 'Matomo',
      version: 'Latest',
      description: 'Google Analytics alternative that protects your data and your customers\' privacy',
      icon: <LineChart className="text-blue-600" />,
      path: 'matomo/',
      progress: matomoProgress.progress,
      colorClass: 'bg-blue-700 hover:bg-blue-800'
    },
    {
      id: 'phpbb',
      title: 'phpBB',
      version: '3.3.11',
      description: 'Free and open source forum software',
      icon: <MessageSquare className="text-cyan-500" />,
      path: 'phpbb/',
      progress: phpbbProgress.progress,
      colorClass: 'bg-cyan-600 hover:bg-cyan-700'
    },
    {
      id: 'mediawiki',
      title: 'MediaWiki',
      version: '1.41.0',
      description: 'The free and open-source wiki software that powers Wikipedia',
      icon: <Book className="text-muted-foreground" />,
      path: 'mediawiki/',
      progress: mediawikiProgress.progress,
      colorClass: 'bg-secondary hover:bg-secondary/80 text-foreground'
    },
    {
      id: 'codeigniter',
      title: 'CodeIgniter 4',
      version: '4.4.6',
      description: 'Powerful PHP framework with a very small footprint',
      icon: <Code className="text-emerald-500" />,
      path: 'codeigniter/public/',
      progress: ciProgress.progress,
      colorClass: 'bg-emerald-600 hover:bg-emerald-700'
    },
    {
      id: 'phpinfo',
      title: 'PHP Info',
      version: 'Latest',
      description: 'Outputs information about PHP\'s configuration',
      icon: <Info className="text-purple-500" />,
      path: 'info.php',
      progress: null,
      colorClass: 'bg-purple-600 hover:bg-purple-700'
    },
    {
      id: 'opcachegui',
      title: 'Opcache GUI',
      version: 'Latest',
      description: 'A clean, responsive GUI for Zend OPcache information',
      icon: <Gauge className="text-rose-500" />,
      path: 'opcache.php',
      progress: opcacheguiProgress.progress,
      colorClass: 'bg-rose-600 hover:bg-rose-700'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Quick Apps</h2>
        <p className="text-muted-foreground text-sm">One-click install popular PHP scripts and tools directly to your local workspace.</p>
      </div>

      {!isServerRunning && (
        <Alert className="mb-6 bg-sky-500/10 border-sky-500/20 text-sky-500 dark:text-sky-400">
          <Info className="h-4 w-4" color="currentColor" />
          <AlertTitle>Servers Offline</AlertTitle>
          <AlertDescription>
            Your Nginx or PHP engine is currently stopped. Make sure to start them in the Dashboard or Web Server tab to open these apps!
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {apps.map(app => (
          <div key={app.id} className="bg-card dark:bg-[#141414] hover:bg-accent/50 dark:hover:bg-[#1a1a1a] text-card-foreground p-5 rounded-2xl border border-border/50 dark:border-zinc-800/60 hover:border-border dark:hover:border-zinc-700 shadow-sm relative group overflow-hidden transition-all duration-200 flex flex-col h-full">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-secondary/50 dark:bg-zinc-800/50 flex items-center justify-center shadow-sm border border-border/50 dark:border-zinc-700/50 shrink-0 group-hover:scale-105 transition-transform">
                {app.icon}
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground dark:text-white group-hover:text-primary transition-colors">{app.title}</h3>
                <p className="text-sm text-muted-foreground dark:text-zinc-500 line-clamp-2" title={app.description}>{app.description}</p>
              </div>
            </div>
            
            <div className="space-y-4 flex-1">
              {app.progress && app.progress.status !== 'done' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{app.progress.status}...</span>
                    <span>{Math.round(app.progress.percent)}%</span>
                  </div>
                  <Progress value={app.progress.percent} className="h-2" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-border/50 dark:border-zinc-800/50">
              {!status[app.id] ? (
                <Button
                  onClick={() => handleInstall(app.id, app.title)}
                  disabled={installing[app.id]}
                  className="w-full bg-primary/90 hover:bg-primary text-white border-0 shadow-lg shadow-primary/20"
                >
                  {installing[app.id] ? 'Installing...' : (
                    <>
                      <Download size={16} className="mr-2" />
                      Install {app.version}
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => handleOpen(app.path)}
                    className={`w-full text-white border-0 shadow-lg opacity-90 hover:opacity-100 transition-opacity ${app.colorClass}`}
                  >
                    <ExternalLink size={16} className="mr-2" />
                    Open {app.title}
                  </Button>
                  <Button
                    onClick={() => handleInstall(app.id, app.title)}
                    disabled={installing[app.id]}
                    variant="outline"
                    className="w-full bg-secondary/30 hover:bg-secondary/60 border-border/50"
                  >
                    {installing[app.id] ? 'Reinstalling...' : `Re-install ${app.version}`}
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
