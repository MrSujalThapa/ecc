import type { AppMode } from "@/lib/types";

type ModeSwitcherProps = {
  mode: AppMode | "all";
  onModeChange: (mode: AppMode | "all") => void;
};

const modes: Array<{ value: AppMode | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "normal", label: "Normal" },
  { value: "disaster", label: "Disaster" },
  { value: "world_cup", label: "World Cup" },
];

export function ModeSwitcher({ mode, onModeChange }: ModeSwitcherProps) {
  return (
    <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
      {modes.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onModeChange(item.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            mode === item.value
              ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20"
              : "text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
