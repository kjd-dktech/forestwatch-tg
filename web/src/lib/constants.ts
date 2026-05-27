export const LAND_COVER_CLASSES = [
  { id: 0, label: 'Forêt', hex: '#22c55e', rgb: [34, 197, 94] },
  { id: 1, label: 'Savanes/Buissons', hex: '#eab308', rgb: [234, 179, 8] },
  { id: 2, label: 'Cultures', hex: '#f97316', rgb: [249, 115, 22] },
  { id: 3, label: 'Urbain', hex: '#ef4444', rgb: [239, 68, 68] },
  { id: 4, label: 'Sols nus', hex: '#8b5cf6', rgb: [139, 92, 246] }, // Mauve/Brownish
  { id: 5, label: 'Eau', hex: '#3b82f6', rgb: [59, 130, 246] }
];

export const getLabelColorHex = (label: string): string => {
  const found = LAND_COVER_CLASSES.find(c => label.toLowerCase().includes(c.label.toLowerCase()) || label === String(c.id));
  return found ? found.hex : '#9ca3af';
};

export const getLabelColorRgb = (label: string): [number, number, number, number] => {
  const found = LAND_COVER_CLASSES.find(c => label.toLowerCase().includes(c.label.toLowerCase()) || label === String(c.id));
  return found ? [...found.rgb, 200] as [number, number, number, number] : [156, 163, 175, 200];
};
