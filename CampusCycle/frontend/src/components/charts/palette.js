/**
 * Chart colour tokens.
 *
 * These palettes were checked with the data-visualisation validator for
 * lightness band, chroma floor, colour-vision-deficiency separation,
 * normal-vision separation and contrast against a light surface, and all
 * pass. Do not substitute hues casually — re-validate first.
 *
 * Colour follows the entity (a status, a severity), never its rank, so
 * filtering a chart never repaints the remaining marks.
 */

/** Single hue for "how much" charts with one series. */
export const PRIMARY = '#059669';

/** Two-series time comparison. The second series is also dashed, so the
 *  pair never relies on colour alone (its tritan separation is in the floor
 *  band and therefore needs a secondary encoding). */
export const SERIES = ['#059669', '#2563eb'];

/** Fleet status — reserved colours, never reused as "series 4". */
export const BICYCLE_STATUS_COLORS = {
  AVAILABLE: '#059669',
  IN_USE: '#2563eb',
  RESERVED: '#db2777',
  MAINTENANCE: '#d97706',
};

/** Maintenance severity, low to critical. */
export const SEVERITY_COLORS = {
  LOW: '#0891b2',
  MEDIUM: '#2563eb',
  HIGH: '#d97706',
  CRITICAL: '#e11d48',
};

/** Recessive chart furniture. */
export const GRID = '#e2e8f0';
export const AXIS_TEXT = '#64748b';
export const SURFACE = '#ffffff';

/** Shared tooltip styling so every chart's hover layer matches. */
export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
    fontSize: 12,
    padding: '8px 10px',
  },
  labelStyle: { color: '#0f172a', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: '#475569' },
};
