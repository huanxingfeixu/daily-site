#!/usr/bin/env python3
"""把 AvianVisitors 原始插图处理成站点用图：长边 <=640，128 色量化（保留透明），写入 img/birds/。

用法：
    python3 scripts/process-bird.py /path/to/<拉丁名>.png [/path/to/<拉丁名>-2.png ...]

依赖：Pillow（pip install pillow）。文件名（含 -2 飞行后缀）原样保留。
"""
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "img", "birds")
MAXEDGE = 640
COLORS = 128

def process(src):
    name = os.path.basename(src)
    im = Image.open(src).convert("RGBA")
    im.thumbnail((MAXEDGE, MAXEDGE), Image.LANCZOS)
    q = im.quantize(colors=COLORS, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, name)
    q.save(dst, optimize=True)
    return dst, os.path.getsize(dst)

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(1)
    for src in args:
        dst, sz = process(src)
        print(f"{os.path.basename(dst)}  {sz/1024:.1f}KB  -> {dst}")
