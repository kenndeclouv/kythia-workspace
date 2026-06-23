import { Server, Terminal, Database, Play, PackagePlus, LayoutDashboard, PackageSearch, Settings, Mail, Settings2, Globe, Info, FolderPlus } from 'lucide-react';
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

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
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
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50 flex flex-col gap-2">
        <SidebarMenu>
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
