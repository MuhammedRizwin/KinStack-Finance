"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return <button type="button" className="theme-switch"
    aria-label="Switch light and dark mode" title="Switch light and dark mode"
    onClick={() => setTheme(current => current === "dark" ? "light" : "dark")}>
    <Moon size={18} className="theme-to-dark" aria-hidden="true" />
    <Sun size={18} className="theme-to-light" aria-hidden="true" />
    <span className="theme-to-dark theme-label">Dark mode</span>
    <span className="theme-to-light theme-label">Light mode</span>
  </button>;
}
