#!/usr/bin/env python3
"""Converts Simplified Chinese to Traditional (Taiwan standard) in text files, in place, the way
OpenCC's s2tw configuration does (https://github.com/BYVoid/OpenCC, Apache-2.0; its data/config/s2tw.json):
longest phrase match in STPhrases, else the first reading in STCharacters, then Taiwan's character
forms from TWVariantsPhrases and TWVariants. The dictionaries are OpenCC's own text files; nothing is
installed. (s2tw also merges phrases generated from the regional lists at build time; those aren't in
the repository, so this leaves them out.)

A character with more than one Traditional form (发 → 發 or 髮, 后 → 後 or 后) is converted by phrase
when a phrase covers it, else to its first form. --report lists those uncovered ones, with context, so
they can be checked by hand; --fix 'simplified=traditional' (repeatable) sets them, longest first.

  curl -O https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/{STPhrases,STCharacters,TWVariants,TWVariantsPhrases}.txt
  python3 web/tools/s2t.py --dict DIR [--report] [--fix 发如雪=髮如雪 …] FILE…
"""
import argparse
import sys


def load(path):
    d = {}
    for line in open(path, encoding='utf-8'):
        if line.startswith('#') or '\t' not in line:
            continue
        k, v = line.rstrip('\n').split('\t', 1)
        d[k] = v.split(' ')
    return d


def convert(text, dicts, maxlen, ambiguous=None):
    """Forward maximum matching through each dictionary group in turn."""
    for group, n in zip(dicts, maxlen):
        out, i = [], 0
        while i < len(text):
            for L in range(min(n, len(text) - i), 0, -1):
                seg = text[i:i + L]
                hit = next((g[seg] for g in group if seg in g), None)
                if hit:
                    if L == 1 and len(hit) > 1 and ambiguous is not None and group is dicts[0]:
                        ambiguous.append((i, seg, hit))
                    out.append(hit[0])
                    i += L
                    break
            else:
                out.append(text[i])
                i += 1
        text = ''.join(out)
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dict', required=True)
    ap.add_argument('--report', action='store_true')
    ap.add_argument('--fix', action='append', default=[])
    ap.add_argument('files', nargs='+')
    a = ap.parse_args()
    D = lambda n: load(f'{a.dict}/{n}.txt')
    fixes = dict(f.split('=', 1) for f in a.fix)
    stage1 = [{k: [v] for k, v in fixes.items()}, D('STPhrases'), D('STCharacters')]
    stage2 = [D('TWVariantsPhrases'), D('TWVariants')]
    dicts = [stage1, stage2]
    maxlen = [max(len(k) for g in stage1 for k in g), max(len(k) for g in stage2 for k in g)]
    for f in a.files:
        text = open(f, encoding='utf-8').read()
        amb = []
        new = convert(text, dicts, maxlen, amb)
        if a.report:
            for i, seg, hit in amb:
                print(f'{f}: {seg}→{"/".join(hit)}  …{text[max(0, i - 8):i + 9].replace(chr(10), " ")}…')
        elif new != text:
            open(f, 'w', encoding='utf-8').write(new)
            print(f'converted {f}', file=sys.stderr)


if __name__ == '__main__':
    main()
