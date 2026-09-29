import type { ArtAtlas } from './atlas';
import { registerCharacterArt } from './characters';
import { registerEnemyArt } from './enemies';
import { registerEnvironmentArt } from './environment';
import { registerFxArt } from './fx';
import { registerPedalArt } from './pedals';

/** Queue every procedurally painted sprite. Call ART.build() afterwards. */
export function registerAllArt(atlas: ArtAtlas): void {
  registerCharacterArt(atlas);
  registerEnemyArt(atlas);
  registerFxArt(atlas);
  registerEnvironmentArt(atlas);
  registerPedalArt(atlas);
}
