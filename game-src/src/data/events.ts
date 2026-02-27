export interface RunEventModifier {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  spawnIntervalScale: number;
  enemySpeedScale: number;
  playerMoveSpeedScale: number;
  enemyHealthScale: number;
  enemyXpScale: number;
  projectileDamageScale: number;
  description: string;
}

export const RUN_EVENT_MODIFIERS: RunEventModifier[] = [
  {
    id: 'blood_monsoon',
    label: 'Blood Monsoon',
    startTime: 55,
    endTime: 90,
    spawnIntervalScale: 0.72,
    enemySpeedScale: 1.1,
    playerMoveSpeedScale: 1.06,
    enemyHealthScale: 0.94,
    enemyXpScale: 1.18,
    projectileDamageScale: 1,
    description: 'The sky tears open. More enemies surge, but they are easier to shred.'
  },
  {
    id: 'iron_canopy',
    label: 'Iron Canopy',
    startTime: 105,
    endTime: 150,
    spawnIntervalScale: 0.9,
    enemySpeedScale: 0.92,
    playerMoveSpeedScale: 0.98,
    enemyHealthScale: 1.34,
    enemyXpScale: 1.22,
    projectileDamageScale: 1.08,
    description: 'Ancient bark hardens the horde into walking fortresses.'
  },
  {
    id: 'void_howl',
    label: 'Void Howl',
    startTime: 170,
    endTime: 220,
    spawnIntervalScale: 0.7,
    enemySpeedScale: 1.2,
    playerMoveSpeedScale: 1.12,
    enemyHealthScale: 1,
    enemyXpScale: 1.3,
    projectileDamageScale: 1.14,
    description: 'The run enters peak chaos as the forest goes feral.'
  }
];

const RUN_EVENT_LABELS: Record<string, string> = RUN_EVENT_MODIFIERS.reduce((labels, event) => {
  labels[event.id] = event.label;
  return labels;
}, {} as Record<string, string>);

const RUN_EVENT_DESCRIPTIONS: Record<string, string> = RUN_EVENT_MODIFIERS.reduce((descriptions, event) => {
  descriptions[event.id] = event.description;
  return descriptions;
}, {} as Record<string, string>);

export function getActiveRunEvent(timeSeconds: number): RunEventModifier | null {
  const t = Math.max(0, timeSeconds);
  for (const event of RUN_EVENT_MODIFIERS) {
    if (t >= event.startTime && t < event.endTime) {
      return event;
    }
  }

  return null;
}

export function getRunEventLabel(eventId: string | null): string {
  if (!eventId) return 'None';
  return RUN_EVENT_LABELS[eventId] || 'Unknown';
}

export function getRunEventDescription(eventId: string | null): string {
  if (!eventId) return '';
  return RUN_EVENT_DESCRIPTIONS[eventId] || '';
}
