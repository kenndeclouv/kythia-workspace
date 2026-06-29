import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import {
  FolderPlus, ChevronRight, ChevronLeft, CheckCircle2,
  Loader2, Terminal, FolderOpen, AlertCircle, ArrowLeft, Folder
} from 'lucide-react';
import { AppSettings } from '../types';

// ────────────────────────────────────────────────────────────────
// SVG Brand Icons
// ────────────────────────────────────────────────────────────────

function LaravelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#FF2D20">
      <path d="M23.642 5.43a.364.364 0 01.014.1v5.149c0 .135-.073.26-.189.326l-4.323 2.49v4.934a.378.378 0 01-.188.326L9.93 23.949a.316.316 0 01-.066.027c-.008.002-.016.008-.024.01a.348.348 0 01-.192 0c-.011-.002-.02-.008-.03-.012-.02-.008-.042-.014-.062-.025L.533 18.755a.376.376 0 01-.189-.326V2.974c0-.033.005-.066.014-.098.003-.012.01-.02.014-.032a.369.369 0 01.023-.058c.004-.013.015-.022.023-.033l.033-.045c.012-.01.025-.018.037-.027.014-.012.027-.024.041-.034H.53L5.043.05a.375.375 0 01.375 0L9.93 2.647h.002c.015.01.027.021.04.033l.038.027c.013.014.02.03.033.045.008.011.02.021.025.033.01.02.017.038.024.058.003.011.01.021.013.032.01.031.014.064.014.098v9.652l3.76-2.164V5.527c0-.033.004-.066.013-.098.003-.01.01-.02.013-.032a.487.487 0 01.024-.059c.007-.012.018-.02.025-.033.012-.015.021-.03.033-.043.012-.012.025-.02.037-.028.014-.01.026-.023.041-.032h.001l4.513-2.598a.375.375 0 01.375 0l4.513 2.598c.016.01.027.021.042.031.012.01.025.018.036.028.013.014.022.03.034.044.008.012.019.021.024.033.011.02.018.04.024.06.006.01.012.021.015.032zm-.74 5.032V6.179l-1.578.908-2.182 1.256v4.283zm-4.51 7.75v-4.287l-2.147 1.225-6.126 3.498v4.325zM1.093 3.624v14.588l8.273 4.761v-4.325l-4.322-2.445-.002-.003H5.04c-.014-.01-.025-.021-.04-.031-.011-.01-.024-.018-.035-.027l-.001-.002c-.013-.012-.021-.025-.031-.04-.01-.011-.021-.022-.028-.036h-.002c-.008-.014-.013-.031-.02-.047-.006-.016-.014-.027-.018-.043a.49.49 0 01-.008-.057c-.002-.014-.006-.027-.006-.041V5.789l-2.18-1.257zM5.23.81L1.47 2.974l3.76 2.164 3.758-2.164zm1.956 13.505l2.182-1.256V3.624l-1.58.91-2.182 1.255v9.435zm11.581-10.95l-3.76 2.163 3.76 2.163 3.759-2.164zm-.376 4.978L16.21 7.087 14.63 6.18v4.283l2.182 1.256 1.58.908zm-8.65 9.654l5.514-3.148 2.756-1.572-3.757-2.163-4.323 2.489-3.941 2.27z" />
    </svg>
  );
}

function ReactIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-11.5 -10.23174 23 20.46348" xmlns="http://www.w3.org/2000/svg">
      <circle cx="0" cy="0" r="2.05" fill="#61DAFB" />
      <g stroke="#61DAFB" strokeWidth="1" fill="none">
        <ellipse rx="11" ry="4.2" />
        <ellipse rx="11" ry="4.2" transform="rotate(60)" />
        <ellipse rx="11" ry="4.2" transform="rotate(120)" />
      </g>
    </svg>
  );
}

function NextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <mask id="mask0_408_134" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
        <circle cx="90" cy="90" r="90" fill="black" />
      </mask>
      <g mask="url(#mask0_408_134)">
        <circle cx="90" cy="90" r="90" fill="black" />
        <path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#paint0_linear_408_134)" />
        <rect x="115" y="54" width="12" height="72" fill="url(#paint1_linear_408_134)" />
      </g>
      <defs>
        <linearGradient id="paint0_linear_408_134" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="paint1_linear_408_134" x1="121" y1="54" x2="120.799" y2="106.875" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function VueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 261.76 226.69" xmlns="http://www.w3.org/2000/svg">
      <path d="M161.096.001l-30.225 52.351L100.647.001H-.005l130.877 226.688L261.749.001z" fill="#41B883" />
      <path d="M161.096.001l-30.225 52.351L100.647.001H52.346l78.526 136.01L209.398.001z" fill="#34495E" />
    </svg>
  );
}

function NuxtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#00DC82">
      <path d="M13.4642 19.8295h8.9218c.2834 0 .5618-.0723.8072-.2098a1.5899 1.5899 0 0 0 .5908-.5732 1.5293 1.5293 0 0 0 .216-.783 1.529 1.529 0 0 0-.2167-.7828L17.7916 7.4142a1.5904 1.5904 0 0 0-.5907-.573 1.6524 1.6524 0 0 0-.807-.2099c-.2833 0-.5616.0724-.807.2098a1.5904 1.5904 0 0 0-.5907.5731L13.4642 9.99l-2.9954-5.0366a1.5913 1.5913 0 0 0-.591-.573 1.6533 1.6533 0 0 0-.8071-.2098c-.2834 0-.5617.0723-.8072.2097a1.5913 1.5913 0 0 0-.591.573L.2168 17.4808A1.5292 1.5292 0 0 0 0 18.2635c-.0001.2749.0744.545.216.783a1.59 1.59 0 0 0 .5908.5732c.2454.1375.5238.2098.8072.2098h5.6003c2.219 0 3.8554-.9454 4.9813-2.7899l2.7337-4.5922L16.3935 9.99l4.3944 7.382h-5.8586ZM7.123 17.3694l-3.9083-.0009 5.8586-9.8421 2.9232 4.921-1.9572 3.2892c-.7478 1.1967-1.5972 1.6328-2.9163 1.6328z" />
    </svg>
  );
}

function SvelteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 98.1 118" xmlns="http://www.w3.org/2000/svg">
      <path d="M91.8 15.6C80.9-.1 59.2-4.7 43.6 5.2L16.1 22.8C8.6 27.4 3.4 34.9 1.9 43.4c-1.3 7.3-.2 14.8 3.2 21.3-2.4 3.6-4 7.6-4.7 11.8-1.6 8.9.5 18.1 5.7 25.4 11 15.7 32.6 20.3 48.2 10.4l27.5-17.6c7.5-4.6 12.7-12.2 14.2-20.7 1.3-7.3.2-14.8-3.2-21.3 2.4-3.6 4-7.6 4.7-11.8 1.7-8.9-.4-18.1-5.7-25.3z" fill="#FF3E00" />
      <path d="M40.9 103.9c-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.2-.9.4-1.7.6-2.6l.5-1.6 1.4 1c3.3 2.4 6.9 4.2 10.8 5.4l1 .3-.1 1c-.1 1.4.3 2.9 1.1 4.1 1.6 2.3 4.4 3.4 7.1 2.7.6-.2 1.2-.4 1.7-.8L65 72.3c1.4-.9 2.3-2.2 2.6-3.8.3-1.6-.1-3.3-1.1-4.6-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.8l-10.5 6.7c-1.7 1.1-3.6 1.9-5.6 2.4-8.9 2.3-18.2-1.2-23.4-8.7-3.1-4.4-4.4-9.9-3.4-15.3.9-5.2 4.1-9.9 8.6-12.7l27.5-17.5c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.2.9-.4 1.7-.7 2.6l-.5 1.6-1.4-1c-3.3-2.4-6.9-4.2-10.8-5.4l-1-.3.1-1c.1-1.4-.3-2.9-1.1-4.1-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.8L33 45.5c-1.4.9-2.3 2.2-2.6 3.8-.3 1.6.1 3.3 1.1 4.6 1.6 2.3 4.4 3.3 7.1 2.6.6-.2 1.2-.4 1.7-.8l10.5-6.7c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.9 5.2-4.1 9.9-8.6 12.7l-27.5 17.5c-1.7 1.1-3.6 2-5.8 2.6z" fill="#FFF" />
    </svg>
  );
}

function PhpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#777BB4">
      <path d="M7.01 10.207h-.944l-.515 2.648h.838c.556 0 .97-.105 1.242-.314.272-.21.455-.559.55-1.049.092-.47.05-.802-.124-.995-.175-.193-.523-.29-1.047-.29zM12 5.688C5.373 5.688 0 8.514 0 12s5.373 6.313 12 6.313S24 15.486 24 12c0-3.486-5.373-6.312-12-6.312zm-3.26 7.451c-.261.25-.575.438-.917.551-.336.108-.765.164-1.285.164H5.357l-.327 1.681H3.652l1.23-6.326h2.65c.797 0 1.378.209 1.744.628.366.418.476 1.002.33 1.752a2.836 2.836 0 0 1-.305.847c-.143.255-.33.49-.561.703zm4.024.715l.543-2.799c.063-.318.039-.536-.068-.651-.107-.116-.336-.174-.687-.174H11.46l-.704 3.625H9.388l1.23-6.327h1.367l-.327 1.682h1.218c.767 0 1.295.134 1.586.401s.378.7.263 1.299l-.572 2.944h-1.389zm7.597-2.265a2.782 2.782 0 0 1-.305.847c-.143.255-.33.49-.561.703a2.44 2.44 0 0 1-.917.551c-.336.108-.765.164-1.286.164h-1.18l-.327 1.682h-1.378l1.23-6.326h2.649c.797 0 1.378.209 1.744.628.366.417.477 1.001.331 1.751zM17.766 10.207h-.943l-.516 2.648h.838c.557 0 .971-.105 1.242-.314.272-.21.455-.559.551-1.049.092-.47.049-.802-.125-.995s-.524-.29-1.047-.29z" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────

interface Framework {
  id: string;
  name: string;
  description: string;
  IconComponent: React.ComponentType<{ className?: string }>;
  iconBg: string;
  color: string;
  needsNode?: boolean;
  needsComposer?: boolean;
  templates: Template[];
}

interface Template {
  id: string;
  label: string;
  description: string;
  badge?: string;
}

const FRAMEWORKS: Framework[] = [
  {
    id: 'laravel',
    name: 'Laravel',
    description: 'The PHP framework for web artisans',
    IconComponent: LaravelIcon,
    iconBg: 'bg-red-950/60',
    color: 'from-red-500/10 to-orange-500/10 border-red-500/30',
    needsComposer: true,
    templates: [
      { id: 'none', label: 'Default (No Starter Kit)', description: 'Fresh Laravel install without any auth scaffold' },
      { id: 'breeze-blade', label: 'Breeze + Blade', description: 'Minimal auth with Blade templates', badge: 'Recommended' },
      { id: 'breeze-react', label: 'Breeze + React', description: 'Inertia.js with React & TypeScript' },
      { id: 'breeze-vue', label: 'Breeze + Vue', description: 'Inertia.js with Vue & TypeScript' },
      { id: 'breeze-livewire', label: 'Breeze + Livewire', description: 'Livewire + Volt functional API' },
      { id: 'breeze-api', label: 'Breeze + API', description: 'API-only auth scaffolding (no frontend)' },
      { id: 'jetstream-livewire', label: 'Jetstream + Livewire', description: 'Full-featured auth with teams support' },
      { id: 'jetstream-inertia', label: 'Jetstream + Inertia', description: 'Full-featured auth with Inertia.js' },
    ],
  },
  {
    id: 'react-vite',
    name: 'React + Vite',
    description: 'Blazing fast React with TypeScript & Vite',
    IconComponent: ReactIcon,
    iconBg: 'bg-cyan-950/60',
    color: 'from-cyan-500/10 to-blue-500/10 border-cyan-500/30',
    needsNode: true,
    templates: [
      { id: 'ts', label: 'React + TypeScript', description: 'React with TypeScript support', badge: 'Recommended' },
      { id: 'js', label: 'React + JavaScript', description: 'React with plain JavaScript' },
    ],
  },
  {
    id: 'next',
    name: 'Next.js',
    description: 'React framework with SSR & App Router',
    IconComponent: NextIcon,
    iconBg: 'bg-secondary',
    color: 'from-border/10 to-border/30 border-border/50',
    needsNode: true,
    templates: [
      { id: 'ts', label: 'Next.js + TypeScript', description: 'App Router, Tailwind, ESLint', badge: 'Recommended' },
      { id: 'js', label: 'Next.js + JavaScript', description: 'App Router, Tailwind, ESLint (no TS)' },
    ],
  },
  {
    id: 'vue-vite',
    name: 'Vue + Vite',
    description: 'Progressive framework with Composition API',
    IconComponent: VueIcon,
    iconBg: 'bg-green-950/60',
    color: 'from-green-500/10 to-emerald-500/10 border-green-500/30',
    needsNode: true,
    templates: [
      { id: 'ts', label: 'Vue + TypeScript', description: 'Vue 3 with TypeScript support', badge: 'Recommended' },
      { id: 'js', label: 'Vue + JavaScript', description: 'Vue 3 with plain JavaScript' },
    ],
  },
  {
    id: 'nuxt',
    name: 'Nuxt.js',
    description: 'The intuitive Vue framework with SSR',
    IconComponent: NuxtIcon,
    iconBg: 'bg-teal-950/60',
    color: 'from-teal-500/10 to-green-500/10 border-teal-500/30',
    needsNode: true,
    templates: [
      { id: 'default', label: 'Nuxt 3', description: 'Default Nuxt 3 setup with TypeScript', badge: 'Recommended' },
    ],
  },
  {
    id: 'svelte-vite',
    name: 'Svelte + Vite',
    description: 'Lightweight, reactive web framework',
    IconComponent: SvelteIcon,
    iconBg: 'bg-orange-950/60',
    color: 'from-orange-500/10 to-red-500/10 border-orange-500/30',
    needsNode: true,
    templates: [
      { id: 'ts', label: 'Svelte + TypeScript', description: 'Svelte 5 with TypeScript', badge: 'Recommended' },
      { id: 'js', label: 'Svelte + JavaScript', description: 'Svelte 5 with plain JavaScript' },
    ],
  },
  {
    id: 'blank-php',
    name: 'Blank PHP',
    description: 'Simple folder with an index.php starter',
    IconComponent: PhpIcon,
    iconBg: 'bg-indigo-950/60',
    color: 'from-indigo-500/10 to-purple-500/10 border-indigo-500/30',
    templates: [
      { id: 'default', label: 'Blank PHP', description: 'Creates a folder with a minimal index.php' },
    ],
  },
  {
    id: 'blank',
    name: 'Empty Folder',
    description: 'Just an empty project directory',
    IconComponent: ({ className }: { className?: string }) => <Folder className={className} />,
    iconBg: 'bg-secondary',
    color: 'from-border/10 to-border/30 border-border/50',
    templates: [
      { id: 'default', label: 'Empty Folder', description: 'Creates an empty directory in your document root' },
    ],
  },
];

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

type Step = 'pick-framework' | 'configure' | 'creating' | 'done';

export function Projects() {
  const [step, setStep] = useState<Step>('pick-framework');
  const [selectedFramework, setSelectedFramework] = useState<Framework | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectName, setProjectName] = useState('');
  const [nameError, setNameError] = useState('');
  const [documentRoot, setDocumentRoot] = useState('C:\\kythia\\www');
  const [outputLines, setOutputLines] = useState<{ text: string; isError: boolean }[]>([]);
  const [doneSuccess, setDoneSuccess] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const [donePath, setDonePath] = useState('');
  const terminalRef = useRef<HTMLDivElement>(null);

  // Load document root from settings
  useEffect(() => {
    invoke<AppSettings>('get_settings').then(s => {
      setDocumentRoot(s.document_root);
    }).catch(() => { });
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [outputLines]);

  const slugify = (val: string) =>
    val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

  const handleNameChange = (val: string) => {
    const slug = slugify(val);
    setProjectName(slug);
    if (!slug) {
      setNameError('Project name is required.');
    } else if (slug.length < 2) {
      setNameError('Must be at least 2 characters.');
    } else {
      setNameError('');
    }
  };

  const handleFrameworkSelect = (fw: Framework) => {
    setSelectedFramework(fw);
    // Auto-select first template
    setSelectedTemplate(fw.templates[0]);
    setStep('configure');
  };

  const handleBack = () => {
    if (step === 'configure') {
      setStep('pick-framework');
      setSelectedFramework(null);
      setSelectedTemplate(null);
      setProjectName('');
      setNameError('');
    }
  };

  const handleCreate = useCallback(async () => {
    if (!selectedFramework || !selectedTemplate || !projectName || nameError) return;

    setOutputLines([]);
    setStep('creating');

    // Map framework+template to actual backend id
    let frameworkId = selectedFramework.id;
    if (selectedFramework.id === 'react-vite' && selectedTemplate.id === 'ts') frameworkId = 'react-vite';
    if (selectedFramework.id === 'react-vite' && selectedTemplate.id === 'js') frameworkId = 'react-vite-js';
    if (selectedFramework.id === 'vue-vite' && selectedTemplate.id === 'ts') frameworkId = 'vue-vite';
    if (selectedFramework.id === 'vue-vite' && selectedTemplate.id === 'js') frameworkId = 'vue-vite-js';

    // Subscribe to streaming output
    const unlistenOutput = await listen<{ line: string; is_error: boolean }>('project_output', (e) => {
      setOutputLines(prev => [...prev, { text: e.payload.line, isError: e.payload.is_error }]);
    });

    const unlistenDone = await listen<{ success: boolean; message: string; path: string }>('project_done', async (e) => {
      setDoneSuccess(e.payload.success);
      setDoneMessage(e.payload.message);
      setDonePath(e.payload.path);
      setStep('done');
      if (e.payload.success) {
        toast.success(e.payload.message);
        await invoke('add_coins', { amount: 10 }).catch(() => {});
        window.dispatchEvent(new CustomEvent('unlock-achievement', { detail: { id: 'project_creator' } }));
        window.dispatchEvent(new Event('gamification-update'));
      } else {
        toast.error(e.payload.message);
      }
    });

    try {
      await invoke('create_project', {
        options: {
          framework: frameworkId,
          template: selectedTemplate.id,
          name: projectName,
          document_root: documentRoot,
        },
      });
    } catch (e: any) {
      toast.error(`Failed to create project: ${e}`);
      setDoneSuccess(false);
      setDoneMessage(String(e));
      setStep('done');
    } finally {
      unlistenOutput();
      unlistenDone();
    }
  }, [selectedFramework, selectedTemplate, projectName, nameError, documentRoot]);

  const handleReset = () => {
    setStep('pick-framework');
    setSelectedFramework(null);
    setSelectedTemplate(null);
    setProjectName('');
    setNameError('');
    setOutputLines([]);
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="max-w-5xl w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-border/50">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
          <FolderPlus className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Project</h2>
          <p className="text-sm text-muted-foreground">Scaffold a new project directly into your workspace</p>
        </div>
      </div>

      {/* Step: Pick Framework */}
      {step === 'pick-framework' && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">Choose a framework or template to get started</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FRAMEWORKS.map(fw => (
              <button
                key={fw.id}
                onClick={() => handleFrameworkSelect(fw)}
                className={`group relative text-left rounded-xl border bg-gradient-to-br p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 active:scale-[0.99] ${fw.color}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${fw.iconBg}`}>
                  <fw.IconComponent className="w-6 h-6" />
                </div>
                <div className="font-semibold text-foreground mb-1">{fw.name}</div>
                <div className="text-xs text-muted-foreground leading-snug">{fw.description}</div>
                {(fw.needsNode || fw.needsComposer) && (
                  <div className="mt-3 flex gap-1 flex-wrap">
                    {fw.needsComposer && (
                      <span className="text-[10px] font-medium bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Needs Composer</span>
                    )}
                    {fw.needsNode && (
                      <span className="text-[10px] font-medium bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Needs Node</span>
                    )}
                  </div>
                )}
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Configure */}
      {step === 'configure' && selectedFramework && (
        <div className="space-y-8">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Back to frameworks
          </button>

          {/* Framework badge */}
          <div className={`inline-flex items-center gap-3 px-4 py-3 rounded-xl border bg-gradient-to-br ${selectedFramework.color}`}>
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${selectedFramework.iconBg}`}>
              <selectedFramework.IconComponent className="w-4 h-4" />
            </div>
            <span className="font-semibold">{selectedFramework.name}</span>
          </div>

          {/* Template picker */}
          {selectedFramework.templates.length > 1 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Starter Template</label>
              <div className="space-y-2">
                {selectedFramework.templates.map(tmpl => (
                  <label
                    key={tmpl.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${selectedTemplate?.id === tmpl.id
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/50 bg-secondary/10 hover:bg-secondary/20'
                      }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={tmpl.id}
                      checked={selectedTemplate?.id === tmpl.id}
                      onChange={() => setSelectedTemplate(tmpl)}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{tmpl.label}</span>
                        {tmpl.badge && (
                          <span className="text-[10px] font-semibold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            {tmpl.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{tmpl.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Project name */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Project Name</label>
            <Input
              placeholder="my-awesome-project"
              value={projectName}
              onChange={e => handleNameChange(e.target.value)}
              className={`font-mono ${nameError ? 'border-red-500/50 focus-visible:ring-red-500/30' : ''}`}
              autoFocus
            />
            {nameError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {nameError}
              </p>
            )}
            {projectName && !nameError && (
              <p className="text-xs text-muted-foreground font-mono">
                📁 {documentRoot}\{projectName}
              </p>
            )}
          </div>

          {/* Warning if tools not available */}
          {selectedFramework.needsComposer && (
            <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Composer must be installed. Install it from the <strong>Packages</strong> tab if you haven't already.</span>
            </div>
          )}
          {selectedFramework.needsNode && (
            <div className="flex items-start gap-2 text-xs text-green-400/80 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Node.js must be installed. Install it from the <strong>Packages</strong> tab if you haven't already.</span>
            </div>
          )}

          <Button
            onClick={handleCreate}
            disabled={!projectName || !!nameError || !selectedTemplate}
            className="w-full h-11 font-semibold"
            size="lg"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        </div>
      )}

      {/* Step: Creating */}
      {(step === 'creating' || step === 'done') && (
        <div className="space-y-4">
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                {step === 'creating' ? `Creating ${projectName}...` : projectName}
              </span>
              {step === 'creating' && (
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              )}
              {step === 'done' && doneSuccess && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              )}
              {step === 'done' && !doneSuccess && (
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
          </div>

          {/* Terminal output */}
          <div
            ref={terminalRef}
            className="bg-black/80 rounded-xl border border-border/50 p-4 font-mono text-xs h-80 overflow-y-auto space-y-0.5"
          >
            {outputLines.length === 0 && step === 'creating' && (
              <span className="text-muted-foreground/50 animate-pulse">Initializing...</span>
            )}
            {outputLines.map((line, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap leading-relaxed ${line.isError ? 'text-red-500' : 'text-foreground'}`}
              >
                {line.text}
              </div>
            ))}
            {step === 'creating' && outputLines.length > 0 && (
              <div className="text-primary/60 animate-pulse">▌</div>
            )}
          </div>

          {/* Done state */}
          {step === 'done' && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${doneSuccess
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
              {doneSuccess
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              }
              <div>
                <div className="font-medium text-sm">{doneSuccess ? 'Project created!' : 'Something went wrong'}</div>
                <div className="text-xs opacity-80 mt-0.5">{doneMessage}</div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {step === 'done' && (
            <div className="flex gap-3 flex-wrap">
              {doneSuccess && (
                <Button
                  variant="default"
                  onClick={() => openUrl(`file:///${donePath.replace(/\\/g, '/')}`)}
                  className="flex-1"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Open Folder
                </Button>
              )}
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Create Another
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
