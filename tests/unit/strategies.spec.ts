import { describe, expect, it } from 'vitest';
import { matchesStrategy, normalizeStrategy } from '@/utils/strategies';

describe('normalizeStrategy', () => {
  it('gives every spelling of a strategy the same key', () => {
    expect(normalizeStrategy('BBRevertLS-008')).toBe('bbrevertls');
    expect(normalizeStrategy('BBRevertLS')).toBe('bbrevertls');
    expect(normalizeStrategy('bb_revert_ls')).toBe('bbrevertls');
    expect(normalizeStrategy('IchiV4Short-011')).toBe(normalizeStrategy('ichiv4_short'));
  });

  it('maps a renamed strategy to its report name', () => {
    expect(normalizeStrategy('SigComboExp47')).toBe(normalizeStrategy('sig_combo_dvol'));
  });

  it('tolerates a missing name', () => {
    expect(normalizeStrategy(undefined)).toBe('');
    expect(normalizeStrategy(null)).toBe('');
  });
});

describe('matchesStrategy', () => {
  it('matches a trade to the selected strategy and everything when none is selected', () => {
    expect(matchesStrategy('DonchianLong-003', 'donchianlong')).toBe(true);
    expect(matchesStrategy('DonchianMeanRev', 'donchianlong')).toBe(false);
    expect(matchesStrategy('DonchianMeanRev', '')).toBe(true);
    expect(matchesStrategy(undefined, 'donchianlong')).toBe(false);
  });
});
