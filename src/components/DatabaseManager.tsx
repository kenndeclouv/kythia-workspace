import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { MariaDb } from "./MariaDb";
import { Mysql } from "./Mysql";
import { Postgres } from "./Postgres";
import { Mongodb } from "./Mongodb";
import { Redis } from "./Redis";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "./ui/select";
import { Database, Server, Leaf, HardDrive } from "lucide-react";

interface DatabaseManagerProps {
  activeEngine: string;
  onEngineChange: (engine: string) => void;
  activeMariaDbVersion?: string | null;
  activeMysqlVersion?: string | null;
  activePostgresVersion?: string | null;
  activeMongodbVersion?: string | null;
  activeRedisVersion?: string | null;
  onActiveVersionChange?: (service: string, version: string | null) => void;
}

export function DatabaseManager({ 
  activeEngine, 
  onEngineChange,
  activeMariaDbVersion,
  activeMysqlVersion,
  activePostgresVersion,
  activeMongodbVersion,
  activeRedisVersion,
  onActiveVersionChange
}: DatabaseManagerProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Database className="text-green-500" size={24} />
          <h2 className="text-xl font-semibold tracking-tight">Database Management</h2>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground hidden sm:inline-block">Active Engine:</span>
          <Select value={activeEngine} onValueChange={(val) => val && onEngineChange(val)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Engine" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Database Engines</SelectLabel>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mariadb">MariaDB</SelectItem>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
                <SelectItem value="mongodb">MongoDB</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Tabs defaultValue="mysql" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="mysql">
            <Database className="mr-2 h-4 w-4" />
            MySQL
          </TabsTrigger>
          <TabsTrigger value="mariadb">
            <Server className="mr-2 h-4 w-4" />
            MariaDB
          </TabsTrigger>
          <TabsTrigger value="postgres">
            <HardDrive className="mr-2 h-4 w-4" />
            PostgreSQL
          </TabsTrigger>
          <TabsTrigger value="mongodb">
            <Leaf className="mr-2 h-4 w-4" />
            MongoDB
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mysql">
          <Mysql 
            activeVersion={activeMysqlVersion}
            onVersionChange={(v) => onActiveVersionChange?.('mysql', v)}
          />
        </TabsContent>
        <TabsContent value="mariadb">
          <MariaDb 
            activeVersion={activeMariaDbVersion}
            onVersionChange={(v) => onActiveVersionChange?.('mariadb', v)}
          />
        </TabsContent>
        <TabsContent value="postgres">
          <Postgres 
            activeVersion={activePostgresVersion}
            onVersionChange={(v) => onActiveVersionChange?.('postgres', v)}
          />
        </TabsContent>
        <TabsContent value="mongodb">
          <Mongodb 
            activeVersion={activeMongodbVersion}
            onVersionChange={(v) => onActiveVersionChange?.('mongodb', v)}
          />
        </TabsContent>
      </Tabs>

      <div className="pt-8 mt-8 border-t">
        <div className="flex items-center space-x-2 mb-6">
          <Database className="text-red-500" size={24} />
          <h2 className="text-xl font-semibold tracking-tight">In-Memory Data Store</h2>
        </div>
        <Redis 
          activeVersion={activeRedisVersion}
          onVersionChange={(v) => onActiveVersionChange?.('redis', v)}
        />
      </div>
    </div>
  );
}
