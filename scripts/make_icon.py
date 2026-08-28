"""生成 CSweeper 应用图标（纯标准库，无 PIL 依赖）。

输出：src-tauri/icons/icon.png (256x256) 与 icon.ico（内嵌 PNG 的单尺寸 ICO）。
"""
import math
import os
import struct
import zlib

S = 256
SS = 4
N = S * SS

RING_R = 0.26
RING_HALF_T = 0.044
GAP_THETA = -math.pi / 7.0
GAP_HALF = 0.58
DOT_R = 0.062


def lerp(a, b, t):
    return a + (b - a) * max(0.0, min(1.0, t))


def sample(u, v):
    rad = 0.22
    qx = abs(u - 0.5) - (0.5 - rad)
    qy = abs(v - 0.5) - (0.5 - rad)
    d = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - rad
    if d > 0:
        return None

    dx, dy = u - 0.5, v - 0.5
    dist = math.hypot(dx, dy)
    ang = math.atan2(dy, dx)
    dang = math.atan2(math.sin(ang - GAP_THETA), math.cos(ang - GAP_THETA))

    is_ring = abs(dist - RING_R) < RING_HALF_T and abs(dang) > GAP_HALF
    dot_x = 0.5 + RING_R * math.cos(GAP_THETA)
    dot_y = 0.5 + RING_R * math.sin(GAP_THETA)
    is_dot = math.hypot(u - dot_x, v - dot_y) < DOT_R

    if is_ring or is_dot:
        t = (v - 0.2) / 0.6
        return (
            int(lerp(0x3f, 0x86, t)),
            int(lerp(0xb9, 0xe9, t)),
            int(lerp(0x50, 0x8b, t)),
            255,
        )
    t = v
    return (
        int(lerp(0x1d, 0x11, t)),
        int(lerp(0x26, 0x17, t)),
        int(lerp(0x33, 0x1e, t)),
        255,
    )


def render():
    rows = []
    for y in range(S):
        row = bytearray()
        for x in range(S):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    u = (x * SS + sx + 0.5) / N
                    v = (y * SS + sy + 0.5) / N
                    c = sample(u, v)
                    if c is not None:
                        r += c[0]
                        g += c[1]
                        b += c[2]
                        a += c[3]
            cnt = SS * SS
            alpha = a / cnt
            if alpha > 0:
                k = cnt / a if a else 0
                row += bytes(
                    (
                        min(255, round(r * k)),
                        min(255, round(g * k)),
                        min(255, round(b * k)),
                        round(alpha),
                    )
                )
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    return rows


def png_chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path, rows):
    raw = b"".join(b"\x00" + r for r in rows)
    ihdr = struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(png_chunk(b"IHDR", ihdr))
        f.write(png_chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(png_chunk(b"IEND", b""))


def write_ico(path, png_bytes):
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png_bytes), 22)
    with open(path, "wb") as f:
        f.write(header + entry + png_bytes)


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons")
    os.makedirs(out_dir, exist_ok=True)
    rows = render()
    png_path = os.path.join(out_dir, "icon.png")
    ico_path = os.path.join(out_dir, "icon.ico")
    write_png(png_path, rows)
    with open(png_path, "rb") as f:
        write_ico(ico_path, f.read())
    print("icons written:", os.path.abspath(out_dir))
