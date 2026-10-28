import { MATERIALS } from './materials';
import { MATERIAL_LOOKS } from './materialLooks';

describe('material looks', () => {
  it('has a look for every material', () => {
    expect(MATERIALS.filter((m) => !MATERIAL_LOOKS[m.id]).map((m) => m.id)).toEqual([]);
  });
});
