import { describe, expect, it } from 'vitest';
import { FULL_CROP } from './defaults';
import { cropDimensions } from './geometry';

describe('crop geometry', () => {
  it('preserves the full source dimensions below the limit', () => {
    expect(cropDimensions(FULL_CROP, 1000, 1500, 2000)).toEqual({ width: 1000, height: 1500 });
  });

  it('scales both dimensions to the requested limit', () => {
    expect(cropDimensions(FULL_CROP, 2000, 4000, 1000)).toEqual({ width: 500, height: 1000 });
  });
});
