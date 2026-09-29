import Phaser from 'phaser';
import { App } from '../../app';
import { ART } from '../art/atlas';
import { registerAllArt } from '../art/registerAll';
import { paintGrainTile } from '../art/environment';
import { makeCanvas } from '../art/paint';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    void this.boot();
  }

  private async boot(): Promise<void> {
    const fonts = Promise.all([
      document.fonts.load('40px "Metal Mania"'),
      document.fonts.load('40px "Permanent Marker"'),
      document.fonts.load('600 20px Oswald'),
      document.fonts.load('700 20px Oswald'),
    ]).catch(() => undefined);
    await Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]);

    if (!ART.built) {
      registerAllArt(ART);
      ART.build();
    }
    ART.register(this.textures);
    if (!this.textures.exists('grain')) this.textures.addCanvas('grain', paintGrainTile(256));
    this.buildDamageFont();

    const splash = document.getElementById('boot-splash');
    splash?.classList.add('gone');
    setTimeout(() => splash?.remove(), 600);
    this.scene.start('backdrop');
    App.ui.showTitle();
  }

  /** Retro bitmap font for damage numbers (cheap to update every hit). */
  private buildDamageFont(): void {
    const chars = '0123456789!+-x';
    const cw = 26;
    const ch = 34;
    const c = makeCanvas(cw * chars.length, ch);
    const ctx = c.getContext('2d')!;
    ctx.font = '700 28px Oswald, "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < chars.length; i++) {
      const x = i * cw + cw / 2;
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#07060a';
      ctx.strokeText(chars[i], x, ch / 2 + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(chars[i], x, ch / 2 + 1);
    }
    if (this.textures.exists('dmgfont')) this.textures.remove('dmgfont');
    this.textures.addCanvas('dmgfont', c);
    const data = Phaser.GameObjects.RetroFont.Parse(this, {
      image: 'dmgfont',
      width: cw,
      height: ch,
      chars,
      charsPerRow: chars.length,
      'spacing.x': 0,
      'spacing.y': 0,
      'offset.x': 0,
      'offset.y': 0,
      lineSpacing: 0,
    } as unknown as Phaser.Types.GameObjects.BitmapText.RetroFontConfig);
    this.cache.bitmapFont.add('dmg', data);
  }
}
