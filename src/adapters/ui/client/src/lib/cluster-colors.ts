/**
 * Color utilities for cluster graph connected-component coloring.
 */

/** 10 visually distinct hues for connected component coloring (HSL hue values). */
export const GROUP_HUES = [210, 340, 120, 40, 270, 180, 15, 300, 90, 200];

export interface GroupColor {
  hue: number;
  border: string;
  bgLight: string;
  bgSelected: string;
  haloFill: string;
  haloBorder: string;
  minimap: string;
}

export function getGroupColor(groupIndex: number): GroupColor {
  const hue = GROUP_HUES[groupIndex % GROUP_HUES.length];
  return {
    hue,
    border: `hsl(${hue}, 55%, 50%)`,
    bgLight: `hsl(${hue}, 50%, 96%)`,
    bgSelected: `hsl(${hue}, 55%, 90%)`,
    haloFill: `hsla(${hue}, 50%, 85%, 0.18)`,
    haloBorder: `hsl(${hue}, 40%, 70%)`,
    minimap: `hsl(${hue}, 55%, 55%)`,
  };
}
