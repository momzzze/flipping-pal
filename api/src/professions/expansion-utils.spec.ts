import { pickTargetSkillTier } from './expansion-utils';

describe('pickTargetSkillTier', () => {
  const tiers = [
    { id: 10, name: 'Classic Alchemy' },
    { id: 20, name: 'Midnight Alchemy' },
  ];

  it('selects only a tier matching the configured target', () => {
    expect(pickTargetSkillTier(tiers, 'Classic')).toEqual(tiers[0]);
    expect(pickTargetSkillTier(tiers, 'midnight')).toEqual(tiers[1]);
  });

  it('does not substitute the newest tier when the target is unavailable', () => {
    expect(pickTargetSkillTier(tiers, 'Classic Forever')).toBeUndefined();
  });
});