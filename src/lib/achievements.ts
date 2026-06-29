import React from 'react';
import { Zap, Server, CloudLightning, Building, DownloadCloud, Code, Layers, Moon, Clock, Flame, BatteryCharging, Coffee, Ghost, Cpu, Infinity } from 'lucide-react';

export interface AchievementCatalog {
  id: string;
  title: string;
  description: string;
  rewardXp: number;
  rewardCoins: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  progressTarget?: number;
  progressType?: 'minutes';
}

export const ACHIEVEMENTS: AchievementCatalog[] = [
  // Starter Achievements
  { id: 'first_blood', title: 'First Blood', description: 'Start your very first service in Kythia.', rewardXp: 50, rewardCoins: 10, icon: Zap, color: 'text-yellow-500' },
  { id: 'project_creator', title: 'Hello World', description: 'Create your first local project.', rewardXp: 120, rewardCoins: 25, icon: Code, color: 'text-rose-500' },
  { id: 'database_master', title: 'Database Master', description: 'Change your active database engine.', rewardXp: 80, rewardCoins: 10, icon: Server, color: 'text-blue-500' },
  
  // Power User Achievements
  { id: 'the_architect', title: 'The Architect', description: 'Run Nginx, PHP, and a Database simultaneously.', rewardXp: 150, rewardCoins: 30, icon: Building, color: 'text-indigo-500' },
  { id: 'speed_demon', title: 'Speed Demon', description: 'Install a Quick App (e.g., WordPress) in a single click.', rewardXp: 100, rewardCoins: 20, icon: CloudLightning, color: 'text-cyan-500' },
  { id: 'package_hoarder', title: 'Package Hoarder', description: 'Install a global CLI package like Node.js or Composer.', rewardXp: 100, rewardCoins: 15, icon: DownloadCloud, color: 'text-emerald-500' },
  { id: 'multiverse_engine', title: 'Multiverse', description: 'Install multiple versions of PHP at the same time.', rewardXp: 200, rewardCoins: 40, icon: Layers, color: 'text-violet-500' },

  // Time & Commitment (Requires Stats Tracking)
  { id: 'night_owl', title: 'Night Owl', description: 'Code past midnight. The servers never sleep, neither do you.', rewardXp: 250, rewardCoins: 50, icon: Moon, color: 'text-indigo-400' },
  { id: 'early_bird', title: 'Early Bird', description: 'Start a server before 6 AM. The early bird gets the bug.', rewardXp: 250, rewardCoins: 50, icon: Coffee, color: 'text-amber-600' },
  { id: 'marathon_24h', title: 'Iron Coder', description: 'Accumulate 24 hours of total server uptime.', rewardXp: 500, rewardCoins: 100, icon: BatteryCharging, color: 'text-green-500', progressTarget: 1440, progressType: 'minutes' },
  { id: 'marathon_100h', title: 'Centurion', description: 'Reach 100 hours of local development time.', rewardXp: 1000, rewardCoins: 250, icon: Clock, color: 'text-fuchsia-500', progressTarget: 6000, progressType: 'minutes' },
  { id: 'marathon_500h', title: 'No Life', description: 'Spend 500 hours building things locally.', rewardXp: 5000, rewardCoins: 1000, icon: Ghost, color: 'text-zinc-400', progressTarget: 30000, progressType: 'minutes' },
  
  // Hardcore / Chaos
  { id: 'chaos_monkey', title: 'Chaos Monkey', description: 'Restart a service 5 times within 10 minutes.', rewardXp: 300, rewardCoins: 60, icon: Flame, color: 'text-orange-500' },
  { id: 'overloaded', title: 'Max Capacity', description: 'Run all available databases (MariaDB, MySQL, Postgres, Mongo, Redis) at once.', rewardXp: 1000, rewardCoins: 200, icon: Cpu, color: 'text-red-500' },
  { id: 'infinite_loop', title: 'Infinite Loop', description: 'Keep a service running uninterrupted for 7 days straight.', rewardXp: 3000, rewardCoins: 500, icon: Infinity, color: 'text-sky-400' }
];
