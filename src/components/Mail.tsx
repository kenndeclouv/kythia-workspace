import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { useDownloadProgress, formatBytes } from '../hooks/useDownloadProgress';
import { toast } from 'sonner';
import { Loader2, Play, Square, Mail as MailIcon, Trash2, RefreshCw, Inbox, FileText } from 'lucide-react';
import { ServiceStatus } from '../types';

interface MailProps {
  status: ServiceStatus;
  installedVersions: string[];
  onStart: () => void;
  onStop: () => void;
  uiPort: number;
}

export function Mail({ status, installedVersions, onStart, onStop, uiPort }: MailProps) {
  const [releases, setReleases] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [isFetchingVersions, setIsFetchingVersions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  
  const { progress, clearProgress } = useDownloadProgress('mailpit');

  // Custom UI State
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageDetails, setMessageDetails] = useState<any>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (installedVersions.length === 0) {
      fetchVersions();
    }
  }, [installedVersions]);

  const fetchVersions = async () => {
    setIsFetchingVersions(true);
    try {
      const available = await invoke<string[]>('fetch_mailpit_versions');
      setReleases(available);
      if (available.length > 0) {
        setSelectedVersion(available[0]);
      }
    } catch (e) {
      toast.error('Failed to load Mailpit versions');
    } finally {
      setIsFetchingVersions(false);
    }
  };

  const handleInstall = async () => {
    if (!selectedVersion) return;

    setIsInstalling(true);
    clearProgress();
    try {
      const msg = await invoke<string>('install_mailpit', { 
        version: selectedVersion
      });
      toast.success(msg);
    } catch (e: any) {
      toast.error(`Install failed: ${e}`);
    } finally {
      setIsInstalling(false);
    }
  };

  // API Calls to local Mailpit
  const fetchMessages = async () => {
    if (!status.running) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`http://127.0.0.1:${uiPort}/api/v1/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error("Failed to fetch messages", e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const fetchMessageDetails = async (id: string) => {
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`http://127.0.0.1:${uiPort}/api/v1/message/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessageDetails(data);
      }
    } catch (e) {
      console.error("Failed to fetch message details", e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const deleteAllMessages = async () => {
    if (!status.running) return;
    try {
      const res = await fetch(`http://127.0.0.1:${uiPort}/api/v1/messages`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMessages([]);
        setSelectedMessageId(null);
        setMessageDetails(null);
        toast.success('All messages cleared');
      }
    } catch (e) {
      toast.error('Failed to clear messages');
    }
  };

  useEffect(() => {
    if (status.running) {
      fetchMessages();
      // Poll every 5 seconds
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [status.running, uiPort]);

  useEffect(() => {
    if (selectedMessageId) {
      fetchMessageDetails(selectedMessageId);
    } else {
      setMessageDetails(null);
    }
  }, [selectedMessageId, uiPort]);

  if (installedVersions.length === 0) {
    return (
      <div className="space-y-12 max-w-2xl pb-10">
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">Install Local Mail Catcher</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Catch outbound emails from your local apps without sending them to the real internet.
            </p>
          </div>
          <div className="space-y-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium leading-none">
                  Available Versions
                </label>
                <Select disabled={isFetchingVersions || isInstalling} value={selectedVersion} onValueChange={(v) => v && setSelectedVersion(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={isFetchingVersions ? "Fetching versions..." : "Select version"} />
                  </SelectTrigger>
                  <SelectContent>
                    {releases.map(v => (
                      <SelectItem key={v} value={v}>Mailpit {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                disabled={!selectedVersion || isInstalling || isFetchingVersions} 
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
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold">Local Inbox</h2>
          <p className="text-sm text-muted-foreground">
            SMTP Port: <code>{status.port || 1025}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status.running && (
            <>
              <Button variant="outline" size="sm" onClick={fetchMessages} disabled={isLoadingMessages}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingMessages ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={deleteAllMessages} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" /> Clear All
              </Button>
            </>
          )}
          {status.running ? (
            <Button variant="destructive" onClick={onStop} size="sm">
              <Square className="w-4 h-4 mr-2" /> Stop Server
            </Button>
          ) : (
            <Button variant="default" onClick={onStart} size="sm">
              <Play className="w-4 h-4 mr-2" /> Start Server
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-card/30 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-sm flex relative">
        {!status.running ? (
          <div className="absolute inset-0 flex items-center justify-center flex-col text-muted-foreground z-10 bg-background/80 backdrop-blur-md">
            <MailIcon className="w-16 h-16 mb-4 opacity-20" />
            <p>Mail Server is offline.</p>
            <p className="text-sm mt-1">Start the service to catch and view emails.</p>
          </div>
        ) : null}

        {/* Mail List Sidebar */}
        <div className="w-1/3 border-r border-border/50 flex flex-col bg-background/50">
          <div className="p-3 border-b border-border/50 bg-secondary/20 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Inbox className="w-4 h-4" /> Inbox ({messages.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                <Inbox className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">No messages yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {messages.map((msg) => (
                  <button
                    key={msg.ID}
                    onClick={() => setSelectedMessageId(msg.ID)}
                    className={`w-full text-left p-4 hover:bg-accent/10 transition-colors flex flex-col gap-1 ${
                      selectedMessageId === msg.ID ? 'bg-primary/5 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate flex-1">
                        {msg.From?.Address || 'Unknown Sender'}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(msg.Created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground truncate">
                      {msg.Subject || 'No Subject'}
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {msg.Snippet || 'No content preview.'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mail Viewer */}
        <div className="flex-1 flex flex-col bg-background/30">
          {!selectedMessageId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col">
              <FileText className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a message to read</p>
            </div>
          ) : isLoadingDetails || !messageDetails ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground opacity-50" />
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Email Headers */}
              <div className="p-6 border-b border-border/50 bg-background/50 flex flex-col gap-4 shrink-0">
                <h2 className="text-2xl font-bold text-foreground">
                  {messageDetails.Subject || 'No Subject'}
                </h2>
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground text-right">From:</span>
                  <span className="font-medium text-foreground">
                    {messageDetails.From?.Name ? `${messageDetails.From.Name} <${messageDetails.From.Address}>` : messageDetails.From?.Address}
                  </span>
                  
                  <span className="text-muted-foreground text-right">To:</span>
                  <span className="text-foreground">
                    {messageDetails.To?.map((t: any) => t.Address).join(', ')}
                  </span>

                  <span className="text-muted-foreground text-right">Date:</span>
                  <span className="text-foreground">
                    {new Date(messageDetails.Date).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Email Body */}
              <div className="flex-1 overflow-auto p-0 bg-white dark:bg-neutral-950 relative">
                {messageDetails.HTML ? (
                  <iframe 
                    srcDoc={messageDetails.HTML} 
                    className="w-full h-full border-0 bg-white"
                    sandbox="allow-same-origin"
                    title="Email Content"
                  />
                ) : (
                  <div className="p-6 whitespace-pre-wrap font-mono text-sm text-foreground">
                    {messageDetails.Text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
