import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// PRAHARI's semantic type scale (app/globals.css). tailwind-merge assumes an
// unknown `text-*` class is a text colour, so without this it treats
// `text-metric` and `text-warning` as conflicting and silently drops the type
// style. Registering the scale as font sizes keeps both, while two real sizes
// (e.g. `text-caption` + `text-sm`) still resolve to the last one.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['hero', 'display', 'title', 'subtitle', 'eyebrow', 'metric', 'metric-lg', 'body', 'caption', 'readout'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
