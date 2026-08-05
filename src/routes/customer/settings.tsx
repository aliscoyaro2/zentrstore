import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bell,
  BellOff,
  Globe,
  Moon,
  Sun,
  User,
  Trash2,
  Shield,
  ChevronRight,
  Check,
} from "lucide-react";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";

export const Route = createFileRoute("/customer/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Zentra" },
      {
        name: "description",
        content: "Manage your app preferences and settings.",
      },
    ],
  }),
  component: SettingsPage,
});

// ── Types ──
type SettingsType = {
  notifications: boolean;
  darkMode: boolean;
  language: "en" | "ha" | "kn";
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ha", label: "Hausa" },
  { code: "kn", label: "Kanuri" },
];

function SettingsPage() {
  // ── Load settings from localStorage ──
  const loadSettings = (): SettingsType => {
    if (typeof window === "undefined") {
      return { notifications: true, darkMode: false, language: "en" };
    }
    const stored = localStorage.getItem("zentra-settings");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { notifications: true, darkMode: false, language: "en" };
      }
    }
    return { notifications: true, darkMode: false, language: "en" };
  };

  const [settings, setSettings] = useState<SettingsType>(loadSettings);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // ── Save settings to localStorage ──
  const saveSettings = (newSettings: SettingsType) => {
    setSettings(newSettings);
    localStorage.setItem("zentra-settings", JSON.stringify(newSettings));
  };

  // ── Toggle handlers ──
  const toggleNotifications = () => {
    saveSettings({ ...settings, notifications: !settings.notifications });
  };

  const toggleDarkMode = () => {
    saveSettings({ ...settings, darkMode: !settings.darkMode });
  };

  const changeLanguage = (code: "en" | "ha" | "kn") => {
    saveSettings({ ...settings, language: code });
    setShowLanguageModal(false);
  };

  const clearLocalData = () => {
    if (window.confirm("Clear all local app data? This will reset your preferences.")) {
      localStorage.removeItem("zentra-settings");
      setSettings({ notifications: true, darkMode: false, language: "en" });
    }
  };

  // ── Apply dark mode class to document ──
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.darkMode]);

  const currentLanguage = LANGUAGES.find((l) => l.code === settings.language);

  return (
    <Screen>
      <PageHeader title="Settings" subtitle="Customize your app experience" />

      <div className="space-y-4 px-4 py-6 pb-24">
        {/* ── Profile Quick Link ── */}
        <Link
          to="/account/edit"
          className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-4 hover:bg-muted/50 transition"
        >
          <span className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 p-2 text-primary">
              <User className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">Edit Profile</span>
              <span className="block text-xs text-muted-foreground">
                Name, phone, and photo
              </span>
            </span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>

        {/* ── Notifications Toggle ── */}
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.notifications ? (
                <Bell className="size-5 text-primary" />
              ) : (
                <BellOff className="size-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {settings.notifications
                    ? "Order updates and promotions"
                    : "All notifications off"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleNotifications}
              className={`relative h-7 w-12 rounded-full transition ${
                settings.notifications ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${
                  settings.notifications ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>
        </Panel>

        {/* ── Dark Mode Toggle ── */}
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.darkMode ? (
                <Moon className="size-5 text-primary" />
              ) : (
                <Sun className="size-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-muted-foreground">
                  {settings.darkMode ? "On" : "Off"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative h-7 w-12 rounded-full transition ${
                settings.darkMode ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${
                  settings.darkMode ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>
        </Panel>

        {/* ── Language Selector ── */}
        <Panel className="p-4">
          <button
            onClick={() => setShowLanguageModal(true)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Globe className="size-5 text-muted-foreground" />
              <div className="text-left">
                <p className="text-sm font-medium">Language</p>
                <p className="text-xs text-muted-foreground">
                  {currentLanguage?.label || "English"}
                </p>
              </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>
        </Panel>

        {/* ── Privacy & Data ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
            Privacy & Data
          </p>
          <div className="space-y-2">
            <button
              onClick={clearLocalData}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition"
            >
              <span className="flex items-center gap-3">
                <Trash2 className="size-5" />
                Clear Local Data
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
            <Link
              to="/privacy"
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
            >
              <span className="flex items-center gap-3">
                <Shield className="size-5 text-muted-foreground" />
                Privacy Policy
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* ── Language Selection Modal ── */}
        {showLanguageModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
            <div className="w-full max-w-md rounded-t-2xl bg-background p-4 animate-in slide-in-from-bottom">
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />
              <h3 className="text-lg font-bold mb-4">Select Language</h3>
              <div className="space-y-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code as "en" | "ha" | "kn")}
                    className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-muted/50 transition"
                  >
                    <span className="text-sm font-medium">{lang.label}</span>
                    {settings.language === lang.code && (
                      <Check className="size-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowLanguageModal(false)}
                className="mt-4 w-full rounded-xl border border-border py-3 text-sm font-medium hover:bg-muted/50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Navigation ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card py-2 px-4 flex justify-around max-w-md mx-auto">
        <Link
          to="/"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Explore
        </Link>
        <Link
          to="/customer/orders"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Orders
        </Link>
        <Link
          to="/customer/cart"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Cart
        </Link>
        <Link
          to="/customer/account"
          className="text-center text-sm text-primary font-medium"
        >
          Profile
        </Link>
      </div>
    </Screen>
  );
}
