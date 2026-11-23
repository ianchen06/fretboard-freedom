# Real guitar recordings for the tuner tests

Six single notes, recorded from real guitars, used by `test/realguitar.test.js` so the tuner is
tested on real strings and not only on synthetic ones (real strings have stiff, slightly stretched
harmonics that each wander by a few cents, a low E whose fundamental is 20–30 dB under its 2nd
harmonic, sympathetic strings, body resonances).

| File | Guitar | Note |
|---|---|---|
| `guitar-acoustic-E2.s16` | steel-string acoustic | E2 (low E) |
| `guitar-electric-E2.s16` | electric | E2 (low E) |
| `guitar-nylon-E2.s16` | nylon-string classical | E2 (low E) |
| `guitar-acoustic-A2.s16` | steel-string acoustic | A2 |
| `guitar-acoustic-G3.s16` | steel-string acoustic | G3 |
| `guitar-acoustic-E4.s16` | steel-string acoustic | E4 (high e) |

Format: raw 16-bit signed little-endian PCM, mono, 12 kHz, the first 2.4 s of each note (the
tuner analyses the band up to 4.5 kHz, so 12 kHz keeps all of it; the test resamples to 48 kHz).

Source: the guitar samples of [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)
by Nicholaus Brosowsky (packaged on npm as `tonejs-instrument-guitar-acoustic-mp3`,
`tonejs-instrument-guitar-electric-mp3` and `tonejs-instrument-guitar-nylon-mp3`), gathered from
public-domain sources and edited there (trimmed, faded in and out, level-matched). Licensed under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Changes here: cut to 2.4 s, mixed to
mono, resampled to 12 kHz, lowered by 1 dB, converted to 16-bit PCM.
