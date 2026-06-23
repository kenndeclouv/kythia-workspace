import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

export interface DownloadProgressPayload {
  service: string;
  downloaded: number;
  total: number;
  percent: number;
  status: string;
}

export function useDownloadProgress(serviceName: string) {
  const [progress, setProgress] = useState<DownloadProgressPayload | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen<DownloadProgressPayload>('download-progress', (event) => {
        if (event.payload.service === serviceName) {
          setProgress(event.payload);
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [serviceName]);

  const clearProgress = () => setProgress(null);

  return { progress, clearProgress };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
