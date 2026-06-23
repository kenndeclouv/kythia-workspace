import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Terminal, Trash2, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

type LogLevel = 'all' | 'error' | 'warn' | 'info';

const serviceNames: Record<string, string> = {
  nginx: "Nginx",
  php: "PHP",
  mariadb: "MariaDB",
  mysql: "MySQL",
  postgres: "Postgres",
  mongodb: "MongoDB",
  redis: "Redis"
};

// Command names for each service
const logCommands: Record<string, string> = {
  nginx: 'get_nginx_logs',
  php: 'get_php_logs',
  mariadb: 'get_mariadb_logs',
  mysql: 'get_mysql_logs',
  postgres: 'get_postgres_logs',
  mongodb: 'get_mongodb_logs',
  redis: 'get_redis_logs',
};

export function Logs() {
  const [activeTab, setActiveTab] = useState('nginx');
  const [logLevel, setLogLevel] = useState<LogLevel>('all');
  const [logs, setLogs] = useState<Record<string, string[]>>({
    nginx: [], php: [], mariadb: [], mysql: [], postgres: [], mongodb: [], redis: [],
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScroll = useRef(true);

  // Only fetch logs for the currently active service — not all 7 at once
  const fetchActiveLogs = useCallback(async () => {
    if (document.hidden) return; // pause when app window is not visible
    try {
      const lines = await invoke<string[]>(logCommands[activeTab], { lines: 100 });
      setLogs(prev => ({ ...prev, [activeTab]: lines }));
    } catch {
      // ignore
    }
  }, [activeTab]);

  // Fetch immediately on tab switch, then poll every 5s
  useEffect(() => {
    fetchActiveLogs();
    const interval = setInterval(fetchActiveLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveLogs]);

  useEffect(() => {
    if (scrollRef.current && isAutoScroll.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, activeTab]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 20;
    isAutoScroll.current = isAtBottom;
  };

  const handleClearLogs = async () => {
    try {
      await invoke(`clear_${activeTab}_logs`);
      toast.success(`${serviceNames[activeTab]} logs cleared`);
      setLogs(prev => ({ ...prev, [activeTab]: [] }));
    } catch (e: any) {
      toast.error(`Failed to clear logs: ${e}`);
    }
  };

  const parseLogLine = (line: string) => {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('[error]') || lowerLine.includes('error:') || lowerLine.includes('fatal') || lowerLine.includes('exception')) {
      return { text: line, level: 'error', color: 'text-red-400' };
    } else if (lowerLine.includes('[warn]') || lowerLine.includes('warning:') || lowerLine.includes('notice:')) {
      return { text: line, level: 'warn', color: 'text-yellow-400' };
    } else {
      return { text: line, level: 'info', color: 'text-zinc-300' };
    }
  };

  const currentLogs = logs[activeTab] || [];

  // Memoize expensive log parsing + filtering so it doesn't rerun on every unrelated render
  const filteredLogs = useMemo(() => {
    const parsed = currentLogs.map(parseLogLine);
    if (logLevel === 'all') return parsed;
    return parsed.filter(log => log.level === logLevel);
  }, [currentLogs, logLevel]);

  return (
    <div className="space-y-6 max-w-5xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center space-x-2 text-foreground">
          <Terminal size={24} />
          <h2 className="text-2xl font-bold">System Logs</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={logLevel} onValueChange={(val) => val && setLogLevel(val as LogLevel)}>
            <SelectTrigger className="w-32 h-9 border-border/50">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="warn">Warnings</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activeTab} onValueChange={(val) => val && setActiveTab(val)}>
            <SelectTrigger className="w-40 h-9 border-border/50">
              <SelectValue placeholder="Select Service" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(serviceNames).map(([key, name]) => (
                <SelectItem key={key} value={key}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="h-9 border-border/50" onClick={handleClearLogs}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      <Card className="flex-1 border-white/5 bg-background/40 backdrop-blur-xl flex flex-col overflow-hidden">
        <CardContent className="p-6 flex-1 flex flex-col h-full overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 bg-black/80 rounded-md p-4 font-mono text-xs overflow-y-auto break-all border border-border/50"
          >
            {filteredLogs.length === 0 ? (
              <span className="text-muted-foreground italic">
                {currentLogs.length === 0 ? "No logs available." : "No logs match the current filter."}
              </span>
            ) : (
              filteredLogs.map((log, i) => (
                <div key={i} className={`whitespace-pre-wrap mb-1 ${log.color}`}>{log.text}</div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
