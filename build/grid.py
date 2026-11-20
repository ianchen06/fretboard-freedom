# Usage: python3 grid.py <render_dir> <out_dir> [first_slide_number]
# Packs slide renders into 2x2 grids for visual QA.
import sys, glob, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
first = int(sys.argv[3]) if len(sys.argv) > 3 else 1
files = sorted(glob.glob(os.path.join(src, 's-*.jpg')))
os.makedirs(dst, exist_ok=True)
for f in glob.glob(os.path.join(dst, '*.jpg')): os.remove(f)
for i in range(0, len(files), 4):
    ims = [Image.open(x) for x in files[i:i+4]]
    W, H = ims[0].width, ims[0].height
    rows = (len(ims) + 1) // 2
    out = Image.new('RGB', (W*2+8, H*rows+8*(rows-1)), (255, 0, 255))
    for k, im in enumerate(ims):
        out.paste(im, ((k % 2)*(W+8), (k//2)*(H+8)))
    n = first + i
    out.save(os.path.join(dst, f'g{n:02d}-{n+len(ims)-1:02d}.jpg'), quality=85)
print(len(glob.glob(os.path.join(dst, '*.jpg'))))
