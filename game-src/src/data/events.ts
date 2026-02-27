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
    id: 'verdant_fog',
    label: 'Verdant Fog',
    startTime: 240,
    endTime: 300,
    spawnIntervalScale: 0.84,
    enemySpeedScale: 0.9,
    playerMoveSpeedScale: 1.04,
    enemyHealthScale: 1,
    enemyXpScale: 1,
    projectileDamageScale: 1,
    description: 'Dense mist swells the horde but blunts their pace.'
  },
  {
    id: 'moonlit_rush',
    label: 'Moonlit Rush',
    startTime: 405,
    endTime: 470,
    spawnIntervalScale: 0.78,
    enemySpeedScale: 1.17,
    playerMoveSpeedScale: 1.08,
    enemyHealthScale: 0.96,
    enemyXpScale: 1.12,
    projectileDamageScale: 1,
    description: 'Predators frenzy under moonlight. You must kite harder.'
  },
  {
    id: 'ancient_bloom',
    label: 'Ancient Bloom',
    startTime: 590,
    endTime: 680,
    spawnIntervalScale: 1.06,
    enemySpeedScale: 0.94,
    playerMoveSpeedScale: 0.96,
    enemyHealthScale: 1.38,
    enemyXpScale: 1.34,
    projectileDamageScale: 1.08,
    description: 'Ancient roots fortify enemies, but each kill is richer.'
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
