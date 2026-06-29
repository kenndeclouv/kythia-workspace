# Usage Guide & User Manual

Welcome to Kythia Workspace! This manual is designed to get you from absolute zero to managing complex, multi-service local development environments in minutes.

---

## 1. First Launch & Setup

When you open Kythia Workspace for the first time, your dashboard will be mostly empty. Unlike legacy environments that pre-bundle bloated software, Kythia lets you download exactly what you need.

### 1.1 Downloading Services
1. Navigate to the **Packages** (or Services) tab.
2. You will see sections for Web Servers (Nginx), PHP, Databases (MariaDB, PostgreSQL, MongoDB, Redis), and Utilities (Mailpit).
3. Kythia fetches the latest available versions directly from their official sources.
4. Click **Install** on the versions you need. Kythia will download and securely extract them into its isolated directory, keeping your Windows Registry clean.

### 1.2 Managing Ports & Settings
Before starting services, you may want to ensure the default ports don't conflict with existing applications.
- Click the **Settings** gear icon.
- Here you can customize:
  - **Document Root**: By default `C:\kythia\www`. This is where you should place your web projects.
  - **Local Domain Suffix**: Default is `.test`. You can change this to anything (e.g., `.localhost` or `.app`).
  - **Service Ports**: Change default ports (e.g., move Nginx from `80` to `8080`, or MySQL from `3306` to `3307`).
  - **Autostart**: Toggle whether Kythia should start automatically when Windows boots.

---

## 2. Operating Services

### 2.1 Starting and Stopping
- From the main dashboard, you can start individual services using the Play/Stop buttons next to them.
- **Start All**: A convenient button to boot up your "Active" stack (e.g., Nginx, PHP, and your chosen Database) simultaneously.

### 2.2 Handling Port Conflicts
If you attempt to start a service and the port is already in use, Kythia will trigger its smart **Port Conflict Detection**.
- A notification will appear identifying the exact application holding the port hostage (e.g., `Port 3306 is in use by PID 1420 (mysqld.exe)`).
- You must terminate the conflicting process via Windows Task Manager (or by stopping the conflicting service) before Kythia can bind to the port.

---

## 3. Projects & Pretty URLs

Kythia handles complex Nginx virtual hosting and DNS spoofing for you automatically.

### 3.1 Adding a Project
1. Move your web project folder into your Document Root (e.g., `C:\kythia\www\my-laravel-app`).
2. Navigate to the **Projects** tab in Kythia.
3. Click **Add Project** and select your folder.
4. Kythia will automatically:
   - Generate an Nginx `server` block specific to your application (routing PHP traffic correctly if needed).
   - Require Administrator Privileges to securely modify `C:\Windows\System32\drivers\etc\hosts`.
   - Route `http://my-laravel-app.test` to `127.0.0.1`.

### 3.2 Accessing Your Site
Make sure Nginx (and PHP, if applicable) are running, then simply open your browser and navigate to your custom domain!

---

## 4. The System Tray Agent

Kythia is designed to live in the background without disturbing your workflow.

- **Closing the App**: By default, clicking the "X" on the main window does not kill your services. It minimizes Kythia to the System Tray.
- **Left-Click Tray Icon**: Opens a lightning-fast "Mini Dashboard" where you can quickly toggle services without loading the full UI.
- **Right-Click Tray Icon**: Provides a context menu with options to **Start All**, **Stop All**, or **Quit** (which will safely terminate all running processes and exit the application).

---

## 5. Debugging & Logs

When things go wrong (e.g., a database connection fails, or Nginx throws a 502 Bad Gateway), logs are your best friend.

- Navigate to the **Logs** tab.
- Select the service you wish to inspect.
- The logs are streamed directly from the service outputs into the UI. You can click **Clear Logs** to wipe the slate clean before reproducing an error.

---

## 6. Sharing with the World (Ngrok)

Need to show your local project to a client, or test a webhook from Stripe/GitHub? Kythia has native Ngrok integration.

1. Create a free account at [ngrok.com](https://ngrok.com) and get your Authtoken.
2. Enter your Authtoken in Kythia's **Settings**.
3. Go to the **Projects** tab, click on your project, and select **Share via Ngrok**.
4. Kythia will generate a secure, public HTTPS URL that tunnels directly to your local `.test` domain!

---

## 7. Developer Gamification

Kythia Workspace turns mundane local development into a rewarding experience!

- **Earning XP & Coins**: Every time you start a service, maintain long uptimes, or unlock secret achievements, you earn XP (to level up) and Kythia Coins.
- **The Coin Store**: Spend your hard-earned Coins on cosmetics to personalize your workspace. You can purchase gorgeous UI Themes, Sound Packs (which play epic sound effects when services boot up), and Title Badges.
- **Achievements**: Unlock special milestones like *Night Owl* (coding between midnight and 4 AM) or *The Architect* (running Nginx, PHP, and a Database simultaneously).
- **Profile Management**: Track your leveling progress, equip or unequip your purchased items, and manage your developer avatar in the Profile tab.
