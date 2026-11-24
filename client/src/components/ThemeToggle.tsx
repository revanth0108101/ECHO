import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type Props = { compact?: boolean };

export default function ThemeToggle({ compact = false }: Props) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={`theme-toggle${compact ? " compact" : ""}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      aria-pressed={theme === "light"}
      title={`Switch to ${next} theme`}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {!compact && <span>{theme === "dark" ? "Light appearance" : "Dark appearance"}</span>}
    </button>
  );
}
