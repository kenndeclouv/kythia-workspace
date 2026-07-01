import { Server, Terminal, Database, Play, PackagePlus, LayoutDashboard, PackageSearch, Settings, Mail, Settings2, Globe, Info, FolderPlus, Trophy, Store } from 'lucide-react';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";

import { useGamification } from '../hooks/useGamification';
import { SHOP_ITEMS } from '../lib/shop';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { data } = useGamification();

  const activeBadge = SHOP_ITEMS.find(item => item.type === 'badge' && item.id === data?.active_badge);
  const BadgeIcon = activeBadge?.icon;
  const activeTitle = activeBadge ? activeBadge.name : (data?.active_title || "Newbie");

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sites', label: 'Sites', icon: Globe },
    { id: 'projects', label: 'New Project', icon: FolderPlus },
    { id: 'nginx', label: 'Web Server', icon: Server },
    { id: 'php', label: 'PHP Engine', icon: Terminal },
    { id: 'php-config', label: 'PHP Config', icon: Settings2 },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'packages', label: 'Packages', icon: PackageSearch },
    { id: 'quick-apps', label: 'Quick Apps', icon: PackagePlus },
    { id: 'mail', label: 'Mail', icon: Mail },
    { id: 'logs', label: 'Live Logs', icon: Play },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <ShadcnSidebar>
      <SidebarHeader className="p-4 border-b border-border/50">
        <div className="flex items-center">
          <img src="/logo.webp" alt="Kythia Logo" className="w-8 h-8 rounded-md mr-3 shadow-lg shrink-0" />
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold tracking-wide text-foreground">KYTHIA</h2>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">Workspace</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className='gap-1'>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={activeTab === item.id}
                  onClick={() => onTabChange(item.id)}
                  tooltip={item.label}
                  className="py-5"
                >
                  <item.icon className="!size-5" />
                  <span className="text-[14px] font-medium">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeTab === 'settings'}
                onClick={() => onTabChange('settings')}
                tooltip="Settings"
                className="py-5"
              >
                <Settings className="!size-5" />
                <span className="text-[14px] font-medium">Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>


        </SidebarGroup>
        <SidebarGroup className='gap-1'>
          <div className="my-2 border-t border-border/50" />

          <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Game
          </div>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeTab === 'achievements'}
              onClick={() => onTabChange('achievements')}
              tooltip="Achievements"
              className="py-5"
            >
              <Trophy className="!size-5" />
              <span className="text-[14px] font-medium">Achievements</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeTab === 'shop'}
              onClick={() => onTabChange('shop')}
              tooltip="Coin Store"
              className="py-5"
            >
              <Store className="!size-5 text-amber-500" />
              <span className="text-[14px] font-medium text-amber-500">Coin Store</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-border/50 flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeTab === 'profile'}
              onClick={() => onTabChange('profile')}
              className="py-2 h-auto flex items-center gap-3 bg-secondary/30 border border-border/50 hover:border-primary/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-primary/20 bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                {data?.avatar_data ? (
                  <img src={data.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  data?.nickname?.substring(0, 2).toUpperCase() || 'KY'
                )}
              </div>
              <div className="flex flex-col text-left flex-1 min-w-0">
                <span className="text-[14px] font-bold truncate text-foreground flex items-center gap-1.5">
                  {data?.nickname || "Loading..."}
                  {BadgeIcon && activeBadge && <BadgeIcon className={`w-3 h-3 ${activeBadge.color}`} />}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">Lv. {data?.level || 1} • {activeTitle}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* <SidebarMenuItem>
            <SidebarMenuButton 
              isActive={activeTab === 'about'}
              onClick={() => onTabChange('about')}
              tooltip="About"
              className="py-5"
            >
              <Info className="!size-5" />
              <span className="text-[14px] font-medium">About</span>
            </SidebarMenuButton>
          </SidebarMenuItem> */}
        </SidebarMenu>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
