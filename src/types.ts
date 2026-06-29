export interface ServiceStatus {
  running: boolean;
  pid?: number;
  port?: number;
}

export interface AppSettings {
  document_root: string;
  nginx: {
    port: number;
  };
  php: {
    port: number;
  };
  mariadb: {
    port: number;
  };
  mysql: {
    port: number;
  };
  postgres: {
    port: number;
  };
  mongodb: {
    port: number;
  };
  mailpit: {
    smtp_port: number;
    ui_port: number;
  };
  redis: {
    port: number;
    user?: string;
    password?: string;
  };
  appearance: string;
  autostart: boolean;
  close_to_tray: boolean;
  minimize_to_tray: boolean;
  native_notifications: boolean;
  active_database_engine: string;
  active_php_version: string | null;
  active_mariadb_version: string | null;
  active_mysql_version: string | null;
  active_postgres_version: string | null;
  active_mongodb_version: string | null;
  active_redis_version: string | null;
  local_domain: string;
  ngrok_auth_token: string | null;
}

export interface PhpRelease {
  version: string;
  url: string;
}

export interface MariaDbRelease {
  version: string;
  url: string;
}

export interface MysqlRelease {
  version: string;
  url: string;
}

export interface PostgresRelease {
  version: string;
  url: string;
}

export interface MongodbRelease {
  version: string;
  url: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
  price: number;
}

export interface GamificationData {
  current_xp: number;
  level: number;
  coins: number;
  unlocked_achievements: string[];
  purchased_items: string[];
  active_theme: string;
  active_sound_pack: string;
  active_badge: string;
  active_title: string;
  username: string;
  nickname: string;
  avatar_data: string | null;
  total_uptime_minutes: number;
}

export interface SystemStats {
  total_memory: number;
  used_memory: number;
  cpu_usage: number;
  services_usage: Record<string, { memory: number; cpu: number }>;
}
