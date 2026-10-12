import { AVAILABILITY_STYLE } from '../../utils/domain';

const ITEMS = [
  { level: 'GOOD', label: 'Good availability' },
  { level: 'LOW', label: 'Low availability' },
  { level: 'NONE', label: 'No cycles available' },
  { level: 'INACTIVE', label: 'Inactive station' },
];

/**
 * Legend for the campus map. `showBicycles` adds the simulated-location dot,
 * which only appears on the admin map.
 */
export default function MapLegend({ showBoundary = true, showBicycles = false }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
      {ITEMS.map((item) => (
        <li key={item.level} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-full ring-2 ring-white"
            style={{ background: AVAILABILITY_STYLE[item.level].dot }}
          />
          {item.label}
        </li>
      ))}
      {showBoundary && (
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0 w-5 border-t-2 border-dashed"
            style={{ borderColor: '#059669' }}
          />
          Campus boundary
        </li>
      )}
      {showBicycles && (
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: '#2563eb' }}
          />
          Simulated cycle position
        </li>
      )}
    </ul>
  );
}
