/** Team 5089 Robo-Nerds mark. */

export function TeamLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
<h1>Logo</h1>
  );
}

export function TeamWordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`font-semibold tracking-tight ${dark ? "text-white" : "text-brand-600"}`}>
      <span className={dark ? "text-gold-400" : "text-brand-600"}>Robo-Nerds</span> Robotics
      <span className={`ml-2 hidden text-xs font-normal sm:inline ${dark ? "text-slate-300" : "text-brand-700"}`}>
        FRC Team 5089
      </span>
    </span>
  );
}
