/**
 * FALSE PROPHET — the five band members.
 *
 * Stage names, lines and colors are all editable here. Member ids are the
 * musical ROLE (which is also the stem id) so renaming a character never
 * touches game logic.
 */
import type { StemId } from '../config/audioConfig';

export type MemberId = StemId;

export interface BandMemberDef {
  id: MemberId;
  /** Stage name. */
  name: string;
  /** Instrument / role label. */
  role: string;
  /** Short role word used in splashes ("BASS FOUND"). */
  roleShort: string;
  color: number;
  colorCss: string;
  /** Darker companion color for outlines/shadows. */
  deep: number;
  tagline: string;
  /** One-sentence combat identity (character select). */
  identity: string;
  soloName: string;
  soloDesc: string;
  passiveName: string;
  passiveDesc: string;
  /** Name of the temporary instrument pickup. */
  spareGear: string;
  /** Line spoken when rescued. */
  rescueLine: string;
  /** Line used when this member starts the run. */
  wakeLine: string;
  /** One quip on first sight of maracas etc. (used sparingly). */
  quip: string;
}

export const BAND: Record<MemberId, BandMemberDef> = {
  lead: {
    id: 'lead',
    name: 'VEX',
    role: 'LEAD GUITAR',
    roleShort: 'LEAD',
    color: 0xb455ff,
    colorCss: '#b455ff',
    deep: 0x3b1466,
    tagline: 'FAST. PRECISE. RELENTLESS.',
    identity: 'Riff bolts arc ahead of you and chain through whatever is standing there.',
    soloName: 'SHREDSTORM',
    soloDesc: 'Plant and shred: a sweeping solo beam and a storm of spectral notes.',
    passiveName: 'MOMENTUM',
    passiveDesc: 'Keep moving to build up to +30% damage.',
    spareGear: 'SPARE STRINGS',
    rescueLine: 'Took you long enough. Where is my pick?',
    wakeLine: '...that’s new.',
    quip: 'Of course it’s maracas.',
  },
  rhythm: {
    id: 'rhythm',
    name: 'ASH',
    role: 'RHYTHM GUITAR',
    roleShort: 'RHYTHM',
    color: 0xff6a1f,
    colorCss: '#ff6a1f',
    deep: 0x5a1a06,
    tagline: 'HEAVY. STEADY. IMMOVABLE.',
    identity: 'Palm-muted chord blasts hit a wide cone and hurl the crowd back.',
    soloName: 'WALL OF SOUND',
    soloDesc: 'An armored sonic barrier explodes outward and holds the line.',
    passiveName: 'PALM MUTE',
    passiveDesc: 'Brief damage resistance after landing a heavy hit.',
    spareGear: 'FRESH PICKS',
    rescueLine: 'Stay behind me. I’ve got the low end of the wall.',
    wakeLine: '...that’s new.',
    quip: 'Of course it’s maracas.',
  },
  bass: {
    id: 'bass',
    name: 'GRAVE',
    role: 'BASS',
    roleShort: 'BASS',
    color: 0x9dff2e,
    colorCss: '#9dff2e',
    deep: 0x21420a,
    tagline: 'LOW. SLOW. INESCAPABLE.',
    identity: 'Sub-bass pulses drag enemies together and crush them in place.',
    soloName: 'DROP ZONE',
    soloDesc: 'A gravity well swallows the pack, then the bass drops.',
    passiveName: 'LOW END',
    passiveDesc: 'Enemies near Grave are slowed by the sub field.',
    spareGear: 'HEAVY GAUGE STRINGS',
    rescueLine: 'They were trying to TUNE me.',
    wakeLine: '...that’s new.',
    quip: 'Of course it’s maracas.',
  },
  drums: {
    id: 'drums',
    name: 'RIOT',
    role: 'DRUMS',
    roleShort: 'DRUMS',
    color: 0x2fe6ff,
    colorCss: '#2fe6ff',
    deep: 0x0a3f4a,
    tagline: 'LOUD. TIGHT. ACCELERATING.',
    identity: 'Kick and snare shockwaves land on the beat; cymbals ricochet between targets.',
    soloName: 'DOUBLE KICK',
    soloDesc: 'One bar of sixteenth-note blast beats detonating all around you.',
    passiveName: 'BLAST BEAT',
    passiveDesc: 'Quick consecutive kills speed up the tempo and damage.',
    spareGear: 'SPARE STICKS',
    rescueLine: 'Count me in! One, two — whatever, just GO!',
    wakeLine: '...that’s new.',
    quip: 'Of course it’s maracas.',
  },
  vocals: {
    id: 'vocals',
    name: 'NYX',
    role: 'VOCALS',
    roleShort: 'VOCALS',
    color: 0xff5ccf,
    colorCss: '#ff5ccf',
    deep: 0x4d0d3c,
    tagline: 'PIERCING. HAUNTING. MERCILESS.',
    identity: 'Spectral scream arcs tear through whole lines of enemies at once.',
    soloName: 'DEATH GROWL',
    soloDesc: 'A colossal vocal blast that interrupts and marks survivors for the band.',
    passiveName: 'SHATTER',
    passiveDesc: 'Wounded elites are staggered by vocal hits.',
    spareGear: 'MIC CABLE',
    rescueLine: 'Their choir is off-key. Let’s fix that.',
    wakeLine: '...that’s new.',
    quip: 'Of course it’s maracas.',
  },
};

export const MEMBER_ORDER: MemberId[] = ['lead', 'rhythm', 'bass', 'drums', 'vocals'];

export const BAND_NAME = 'FALSE PROPHET';
