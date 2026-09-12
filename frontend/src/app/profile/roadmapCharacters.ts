export type RoadmapCharacter =
  | 'milo-standing'
  | 'milo-wave'
  | 'milo-guide'
  | 'milo-celebrate'
  | 'an-welcome';

export const CHARACTER_OPTIONS: { key: RoadmapCharacter; label: string; src: string }[] = [
  { key: 'milo-standing', label: 'Milo (Cáo đứng)', src: '/characters/milo-standing.png' },
  { key: 'milo-wave', label: 'Milo vẫy tay', src: '/characters/milo-wave.png' },
  { key: 'milo-guide', label: 'Milo hướng dẫn', src: '/characters/milo-guide.png' },
  { key: 'milo-celebrate', label: 'Milo ăn mừng', src: '/characters/milo-celebrate.png' },
  { key: 'an-welcome', label: 'An (Người)', src: '/characters/an-welcome.png' },
];

export function findCharacter(key: RoadmapCharacter | string | undefined) {
  return CHARACTER_OPTIONS.find((c) => c.key === key) ?? CHARACTER_OPTIONS[0];
}
