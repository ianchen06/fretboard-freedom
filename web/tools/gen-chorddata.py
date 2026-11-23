#!/usr/bin/env python3
"""Builds web/js/chorddata.js: the chords of 700+ Chinese pop songs, bar by bar and section by
section, in 简谱 degrees, for the chord progression generator (js/chordgen.js).

Sources (both MIT licensed; the licenses are repeated in the generated file):
  - POP909 (Wang, Chen, Jiang, Zhang, Xu, Dai, Bin, Xia, ISMIR 2020),
    https://github.com/music-x-lab/POP909-Dataset : index.xlsx gives each song's name and artist.
  - The bar-aligned chords, keys and human structure labels of POP909 from Dai, Zhang & Dannenberg,
    "Automatic Analysis and Influence of Hierarchical Structure on Melody, Rhythm and Harmony in
    Popular Music" (MuMe + CSMC 2020), https://github.com/Dsqvival/hierarchical-structure-analysis :
    finalized_chord.txt (chord, tones, root, length in beats; the authors re-aligned downbeats to bar
    lines), analyzed_key.txt, melody.txt (16th-note grid) and human_label1.txt.

What the labels mean. The labelling code (seg.cpp) and the README say: uppercase letters are melodic
phrases, lettered A, B, C… in order of first appearance; X is a melodic phrase that does not repeat;
lowercase b and x are parts with no melody; i is the intro and o the outro; the number after a letter
is its length in bars. Which letter is the chorus is not stated in the sources we could reach (the
paper's host is not reachable from here), so we infer it per song from the melody: across the corpus
A sits 1.9 semitones below the song's mean pitch and B/C sit 1.2–1.5 above, the usual verse/chorus
register gap. So: A is the verse; the chorus is the repeated letter after A whose melody is highest;
a letter that leads into the chorus most of the time is the pre-chorus; X after the first chorus is the
bridge. Wordless parts (b, x) are left out.

Kept: songs in one key (analyzed_key.txt has one entry) whose chord beats add up to 4 per labelled bar
(within one bar, so 4/4). Minor keys are written from their relative major (so A minor is 6m in C),
the way the app's 简谱 chords are.

Run once (Python 3 with openpyxl):
  git clone --depth 1 https://github.com/music-x-lab/POP909-Dataset
  git clone --depth 1 https://github.com/Dsqvival/hierarchical-structure-analysis
  python3 web/tools/gen-chorddata.py POP909-Dataset hierarchical-structure-analysis > web/js/chorddata.js
"""
import collections
import json
import os
import re
import statistics
import sys

import openpyxl

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def pc_of(name):
    n = NOTE[name[0]]
    for a in name[1:]:
        n += 1 if a == '#' else -1 if a == 'b' else 0
    return n % 12


# Chord qualities in the data → the app's (songtheory.js QUAL). Colors the app has no symbol for
# fall back to the nearest it has: 6 and aug to the triad, 9ths to their 7th or add9, 7sus4 to sus4.
QUAL = {
    'maj': '', 'min': 'm', '7': '7', 'maj7': 'maj7', 'min7': 'm7', 'sus4': 'sus4', 'sus2': 'sus2',
    'dim': 'dim', 'hdim7': 'm7b5', 'dim7': 'dim', 'maj6': '', 'min6': 'm', 'aug': '', 'minmaj7': 'm',
    'maj(9)': 'add9', 'min(9)': 'madd9', 'maj9': 'maj7', 'min9': 'm7', '9': '7', 'maj6(9)': 'add9',
    'sus4(b7)': 'sus4', 'sus4(b7,9)': 'sus4', 'min7(11)': 'm7', '7(b9)': '7', '7(#9)': '7', '13': '7',
    'min11': 'm7', '11': '7', '7(13)': '7',
}
# The bass in a slash chord, as an interval above the chord's root.
BASS = {'2': 2, 'b3': 3, '3': 4, '4': 5, 'b5': 6, '5': 7, '#5': 8, 'b6': 8, '6': 9, 'b7': 10, '7': 11, '9': 2}
# A pitch class above the tonic → a 简谱 degree. ♯4 (not ♭5) and, for diminished chords, ♯1 ♯5:
# they lead up a half step, which is how pop uses them.
DEGREE = {0: '1', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♯4', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7'}
DIM_DEGREE = {1: '♯1', 6: '♯4', 8: '♯5'}


def chord_symbol(name, tonic):
    """'B:maj/3' in a key with tonic pc → '4/6'. None for no chord ('N') or a quality we can't read."""
    if ':' not in name:
        return None
    root, qual = name.split(':', 1)
    qual = re.sub(r'[^\x20-\x7e]', '', qual)
    bass = None
    if '/' in qual:
        qual, b = qual.split('/', 1)
        if b not in BASS:
            return None
        bass = BASS[b]
    if qual not in QUAL:
        qual = re.sub(r'\(.*$', '', qual)
        if qual not in QUAL:
            return None
    q = QUAL[qual]
    r = (pc_of(root) - tonic) % 12
    deg = DIM_DEGREE.get(r, DEGREE[r]) if q in ('dim', 'm7b5') else DEGREE[r]
    sym = deg + q
    if bass is not None:
        sym += '/' + DEGREE[(r + bass) % 12]
    return sym


def bar_tokens(chords, n_bars):
    """Chords (symbol or None, beats) → one token per 4-beat bar: 'a' or 'a,b' (half a bar each).
    Each half takes the chord that covers most of its two beats (ties: the first beat's)."""
    beats = []
    for sym, d in chords:
        beats += [sym] * d
    out = []
    for b in range(n_bars):
        bb = beats[4 * b:4 * b + 4]
        if len(bb) < 4:
            bb += [bb[-1] if bb else None] * (4 - len(bb))
        halves = []
        for h in (bb[0:2], bb[2:4]):
            halves.append(h[0] if h[0] is not None else h[1])
        if halves[0] is None:
            halves[0] = halves[1]
        if halves[1] is None or halves[1] == halves[0]:
            out.append(halves[0] or 'N')
        else:
            out.append(f'{halves[0]},{halves[1]}')
    return out


def roles(labels, melody):
    """Per-section roles from the human labels: I intro, V verse, P pre-chorus, C chorus, B bridge,
    O outro, None for parts we leave out."""
    # Mean melody pitch of each letter.
    pitch = collections.defaultdict(list)
    t = 0
    for L, n in labels:
        seg = [p for p in melody[t * 16:(t + n) * 16] if p > 0]
        if seg:
            pitch[L].append(statistics.mean(seg))
        t += n
    count = collections.Counter(L for L, _ in labels)
    cand = [L for L in count if L.isupper() and L not in ('A', 'X') and count[L] >= 2 and pitch[L]]
    chorus = max(cand, key=lambda L: statistics.mean(pitch[L])) if cand else None
    pre = None
    if chorus:
        before = collections.Counter(labels[k - 1][0] for k in range(1, len(labels)) if labels[k][0] == chorus and labels[k - 1][0] != chorus)
        if before:
            L, c = before.most_common(1)[0]
            # It leads into at least half of the chorus's entries.
            if L.isupper() and L not in ('A', 'X') and c * 2 >= sum(before.values()):
                pre = L
    first_chorus = next((k for k, (L, _) in enumerate(labels) if L == chorus), None)
    out = []
    for k, (L, _) in enumerate(labels):
        if L == 'i':
            out.append('I')
        elif L == 'o':
            out.append('O')
        elif L == 'A':
            out.append('V')
        elif L == chorus:
            out.append('C')
        elif L == pre:
            out.append('P')
        elif L == 'X' and first_chorus is not None and k > first_chorus and k + 1 < len(labels) and labels[k + 1][0] != 'o':
            out.append('B')
        else:
            out.append(None)
    return out


def main(pop909, hier):
    wb = openpyxl.load_workbook(os.path.join(pop909, 'POP909', 'index.xlsx'), read_only=True)
    index = {str(r[0]).zfill(3): (str(r[1]), str(r[2])) for r in list(wb.active.iter_rows(values_only=True))[1:] if r[0]}
    base = os.path.join(hier, 'POP909')
    songs, skipped = [], collections.Counter()
    for sid in sorted(os.listdir(base)):
        d = os.path.join(base, sid)
        try:
            keys = open(os.path.join(d, 'analyzed_key.txt')).read().split()
            raw = [l.split() for l in open(os.path.join(d, 'finalized_chord.txt')) if l.strip()]
            labels = [(L, int(n)) for L, n in re.findall(r'([A-Za-z])(\d+)', open(os.path.join(d, 'human_label1.txt')).read())]
            mel = [tuple(map(int, l.split())) for l in open(os.path.join(d, 'melody.txt')) if l.strip()]
        except (OSError, ValueError):
            skipped['missing files'] += 1
            continue
        if len(keys) != 1:
            skipped['key change'] += 1
            continue
        tonic_name, mode = keys[0].split(':')
        tonic = pc_of(tonic_name) if mode == 'maj' else (pc_of(tonic_name) + 3) % 12
        n_bars = sum(n for _, n in labels)
        beats = sum(int(c[-1]) for c in raw)
        if abs(beats - 4 * n_bars) > 4:
            skipped['not 4/4'] += 1
            continue
        chords = [(chord_symbol(c[0], tonic), int(c[-1])) for c in raw]
        melody = []
        for p, dur in mel:
            melody += [p] * dur
        toks = bar_tokens(chords, n_bars)
        rl = roles(labels, melody)
        secs, t = [], 0
        for (L, n), r in zip(labels, rl):
            bars = toks[t:t + n]
            t += n
            if r and bars and 'N' not in bars:
                secs.append([r, bars])
        if not any(r == 'C' for r, _ in secs):
            skipped['no chorus found'] += 1
            continue
        name, artist = index.get(sid, ('?', '?'))
        songs.append({'id': sid, 'name': name, 'artist': artist, 'minor': mode == 'min', 'sections': secs})

    # Compact: a table of bar tokens, songs as [name, artist index, minor, sections as 'R i.j.k'].
    tok_count = collections.Counter(b for s in songs for _, bars in s['sections'] for b in bars)
    tokens = [t for t, _ in tok_count.most_common()]
    ti = {t: i for i, t in enumerate(tokens)}
    artists = [a for a, _ in collections.Counter(s['artist'] for s in songs).most_common()]
    ai = {a: i for i, a in enumerate(artists)}
    b36 = lambda n: (b36(n // 36) if n >= 36 else '') + '0123456789abcdefghijklmnopqrstuvwxyz'[n % 36]
    rows = [[s['name'], ai[s['artist']], 1 if s['minor'] else 0,
             ' '.join(r + '.'.join(b36(ti[b]) for b in bars) for r, bars in s['sections'])] for s in songs]

    print('// Generated by web/tools/gen-chorddata.py: do not edit by hand.')
    print(f'// The chords of {len(songs)} Chinese pop songs, bar by bar, per section, in 简谱 degrees (minor keys from')
    print('// their relative major). Kept: one key, 4/4. Skipped: ' + ', '.join(f'{v} {k}' for k, v in skipped.items()) + '.')
    print('// tokens: one bar each ("4" or "3m,6m", half a bar each). songs: [name, artist index, minor key,')
    print('// sections "R" + base-36 token indices joined by "."], R = I intro, V verse, P pre-chorus, C chorus,')
    print('// B bridge, O outro.')
    print('//')
    print('// Data: POP909, Copyright (c) 2020 Music X Lab, MIT License; chords, keys and structure labels re-aligned')
    print('// to bar lines: hierarchical-structure-analysis, Copyright (c) 2020 Shuqi Dai, MIT License.')
    print('// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and')
    print('// associated documentation files (the "Software"), to deal in the Software without restriction, including')
    print('// without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell')
    print('// copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the')
    print('// following conditions: The above copyright notice and this permission notice shall be included in all')
    print('// copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF')
    print('// ANY KIND, EXPRESS OR IMPLIED.')
    print('(function (root) {')
    print('  const ChordData = ' + json.dumps({'tokens': tokens, 'artists': artists, 'songs': rows}, ensure_ascii=False, separators=(',', ':')) + ';')
    print("  if (typeof module !== 'undefined' && module.exports) module.exports = ChordData;")
    print('  else root.ChordData = ChordData;')
    print("})(typeof self !== 'undefined' ? self : this);")
    print(f'kept {len(songs)} songs, {len(tokens)} bar tokens; skipped {dict(skipped)}', file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
