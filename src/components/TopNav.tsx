import { ScreenId, TelemetrySeverity } from '../types/telemetry';

interface TopNavProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  overallSeverity: TelemetrySeverity;
  onTriggerContingency: () => void;
}

const NAV_ITEMS: { id: ScreenId; label: string }[] = [
  { id: 'flight-deck', label: 'Flight Deck' },
  { id: 'orbital-matrix', label: 'Orbital Matrix' },
  { id: 'contingency', label: 'Contingency' },
  { id: 'archive', label: 'OSDR Archive' },
];

export function TopNav({
  activeScreen,
  onSelectScreen,
  overallSeverity,
  onTriggerContingency,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#00F0FF]/20 bg-[#030712]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:gap-8 lg:px-8">
        {/* Zone 1: Single-line Brand Title */}
        <button
          type="button"
          onClick={() => onSelectScreen('flight-deck')}
          className="font-display text-base sm:text-lg font-bold tracking-[0.06em] text-[#F8FAFC] uppercase whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF]"
        >
          AETHER FLIGHT DECK
        </button>

        {/* Zone 2: 4 Clean Single-Line Navigation Links */}
        <nav
          aria-label="Primary telemetry views"
          className="hidden md:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectScreen(item.id)}
                className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00F0FF] ${
                  isActive
                    ? 'text-[#00F0FF]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute inset-x-0 -bottom-[13px] h-[2px] bg-[#00F0FF]"
                    style={{ boxShadow: '0 0 8px rgba(0, 240, 255, 0.7)' }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onTriggerContingency}
            className={`min-h-[40px] rounded px-4 py-2 font-mono text-xs font-bold tracking-wider uppercase whitespace-nowrap shrink-0 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF] ${
              overallSeverity === 'critical'
                ? 'bg-[#FF2A55] text-[#F8FAFC] hover:bg-[#ff4268]'
                : 'bg-[#00F0FF] text-[#030712] hover:bg-[#7df4ff]'
            }`}
          >
            {overallSeverity === 'critical' ? 'View Active Alert' : 'Run Contingency'}
          </button>
        </div>
      </div>

      {/* Mobile Bottom-Safe Compact Navigation Strip */}
      <nav
        aria-label="Mobile telemetry views"
        className="flex md:hidden items-center justify-between gap-1 border-t border-[#00F0FF]/15 px-3 py-1.5 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectScreen(item.id)}
              className={`min-h-[36px] rounded px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/50'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
