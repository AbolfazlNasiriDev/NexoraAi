import {
  Archive,
  BookOpen,
  Code2,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Presentation,
  Settings,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export type NavId =
  | "chat"
  | "archived"
  | "library"
  | "workspaces"
  | "new-project"
  | "image-generator"
  | "presentation"
  | "settings";

export interface NavItem {
  id: NavId;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    label: "Menu",
    items: [
      { id: "chat", label: "Chat", icon: MessageSquare },
      { id: "archived", label: "Archived", icon: Archive },
      { id: "library", label: "Library", icon: BookOpen },
      { id: "workspaces", label: "Workspaces", icon: Layers },
    ],
  },
  {
    label: "Create",
    items: [
      { id: "new-project", label: "New Project", icon: FolderPlus },
      {
        id: "image-generator",
        label: "Image Generator",
        icon: ImageIcon,
        badge: "Phase 2",
      },
      {
        id: "presentation",
        label: "Presentation",
        icon: Presentation,
        badge: "Phase 2",
      },
    ],
  },
  {
    label: "General",
    items: [{ id: "settings", label: "Settings", icon: Settings }],
  },
];

/* ------------------------------------------------------------------ */
/* Models (local UI state only — no backend in Phase 1)                */
/* ------------------------------------------------------------------ */

export interface ModelOption {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
}

export const modelOptions: ModelOption[] = [
  {
    id: "nexora-pro",
    name: "Nexora 1.0 Pro",
    tagline: "Most capable — reasoning, code & long context",
    badge: "Recommended",
  },
  {
    id: "nexora-1",
    name: "Nexora 1.0",
    tagline: "Balanced speed and quality for everyday work",
  },
  {
    id: "nexora-lite",
    name: "Nexora Lite",
    tagline: "Fast and light for quick questions",
  },
];

/* ------------------------------------------------------------------ */
/* Feature cards                                                       */
/* ------------------------------------------------------------------ */

export type FeatureMode = "chat" | "image" | "presentation" | "dev";

export interface FeatureCardData {
  id: FeatureMode;
  title: string;
  description: string;
  buttonLabel: string;
  icon: LucideIcon;
  placeholder: string;
  gradient: string;
  iconBg: string;
}

export const featureCards: FeatureCardData[] = [
  {
    id: "image",
    title: "Image Generator",
    description:
      "Turn a sentence into polished visuals, illustrations and product shots.",
    buttonLabel: "Generate an image",
    icon: ImageIcon,
    placeholder: "Describe the image you want — style, subject, mood…",
    gradient: "from-[#8054D9] to-[#B69AEF]",
    iconBg: "bg-[#EDE5FC] text-[#8054D9]",
  },
  {
    id: "presentation",
    title: "AI Presentation",
    description:
      "Draft a structured, beautifully designed deck from a single outline.",
    buttonLabel: "Create a deck",
    icon: Presentation,
    placeholder: "Outline your presentation — topic, audience, slides…",
    gradient: "from-[#6A3FC4] to-[#B69AEF]",
    iconBg: "bg-[#EDE5FC] text-[#6A3FC4]",
  },
  {
    id: "dev",
    title: "Dev Assistant",
    description:
      "Explain code, debug errors and scaffold components with Nexora.",
    buttonLabel: "Ask about code",
    icon: Code2,
    placeholder: "Paste code or describe what you want to build…",
    gradient: "from-[#8054D9] to-[#9D7BE8]",
    iconBg: "bg-[#EDE5FC] text-[#8054D9]",
  },
];

export const defaultPlaceholder =
  "Ask Nexora anything — write, plan, code, or create…";

export function placeholderFor(mode: FeatureMode): string {
  if (mode === "chat") return defaultPlaceholder;
  return featureCards.find((c) => c.id === mode)?.placeholder ?? defaultPlaceholder;
}

/* ------------------------------------------------------------------ */
/* Chat (local only)                                                   */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  text: string;
  fileName?: string;
  fileSize?: number;
  model: string;
  createdAt: Date;
}
