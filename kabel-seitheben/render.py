"""Einarmiges Kabel-Seitheben als animiertes GIF.

Die Figur besteht aus Signed Distance Functions (Kegel, Ellipsoide, Boxen),
die per Raymarching gerendert werden. Kein Bildmaterial, alles aus Code.

    python render.py                 # beide GIFs nach ./
    python render.py --still 0.0,1   # Einzelbilder zum Pruefen
"""

import argparse
import math
import os

import numpy as np
from numba import njit, prange
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))

# Materialien
SKIN, CLOTH, MUSCLE, HAIR, SHOE, METAL, BLACK, LEG, TORSO, EYE = range(10)

# Primitive: 0 = Rundkegel, 1 = Ellipsoid, 2 = abgerundete Box
NF = 25


def _v(x):
    return np.asarray(x, dtype=np.float64)


def _norm(x):
    x = _v(x)
    return x / np.linalg.norm(x)


def _basis(axis, hint=(0.0, 0.0, 1.0)):
    """Zeilen = lokale Achsen, erste Zeile = axis."""
    a = _norm(axis)
    h = _v(hint)
    if abs(np.dot(a, _norm(h))) > 0.95:
        h = _v((1.0, 0.0, 0.0))
    b = _norm(np.cross(a, h))
    c = np.cross(a, b)
    return np.stack([a, b, c])


class Scene:
    def __init__(self):
        self.rows = []

    def _row(self, typ, mat, group, k):
        r = np.zeros(NF)
        r[0], r[1], r[2], r[3] = typ, mat, group, k
        r[12:21] = np.eye(3).ravel()
        return r

    def cone(self, a, b, r1, r2, mat, k=0.0, group=0):
        a, b = _v(a), _v(b)
        r = self._row(0, mat, group, k)
        r[4:7], r[7:10], r[10], r[11] = a, b, r1, r2
        r[21:24] = (a + b) / 2
        r[24] = np.linalg.norm(b - a) / 2 + max(r1, r2)
        self.rows.append(r)

    def ell(self, c, radii, mat, k=0.0, group=0, rot=None):
        c = _v(c)
        r = self._row(1, mat, group, k)
        r[4:7], r[7:10] = c, radii
        if rot is not None:
            r[12:21] = np.asarray(rot).ravel()
        r[21:24] = c
        r[24] = max(radii)
        self.rows.append(r)

    def box(self, c, half, mat, rnd=0.0, group=1, rot=None):
        c = _v(c)
        r = self._row(2, mat, group, 0.0)
        r[4:7], r[7:10], r[11] = c, half, rnd
        if rot is not None:
            r[12:21] = np.asarray(rot).ravel()
        r[21:24] = c
        r[24] = float(np.linalg.norm(half))
        self.rows.append(r)

    def array(self):
        return np.stack(self.rows)


# ---------------------------------------------------------------------------
# SDF-Kern (numba)
# ---------------------------------------------------------------------------


@njit(cache=True, fastmath=True, inline="always")
def _prim(P, i, px, py, pz):
    typ = int(P[i, 0])
    if typ == 0:
        ax, ay, az = P[i, 4], P[i, 5], P[i, 6]
        bax, bay, baz = P[i, 7] - ax, P[i, 8] - ay, P[i, 9] - az
        r1, r2 = P[i, 10], P[i, 11]
        l2 = bax * bax + bay * bay + baz * baz
        rr = r1 - r2
        a2 = l2 - rr * rr
        il2 = 1.0 / l2
        pax, pay, paz = px - ax, py - ay, pz - az
        y = pax * bax + pay * bay + paz * baz
        z = y - l2
        qx, qy, qz = pax * l2 - bax * y, pay * l2 - bay * y, paz * l2 - baz * y
        x2 = qx * qx + qy * qy + qz * qz
        y2 = y * y * l2
        z2 = z * z * l2
        sr = 1.0 if rr > 0 else (-1.0 if rr < 0 else 0.0)
        k = sr * rr * rr * x2
        sz = 1.0 if z > 0 else (-1.0 if z < 0 else 0.0)
        sy = 1.0 if y > 0 else (-1.0 if y < 0 else 0.0)
        if sz * a2 * z2 > k:
            return math.sqrt(x2 + z2) * il2 - r2
        if sy * a2 * y2 < k:
            return math.sqrt(x2 + y2) * il2 - r1
        return (math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
    dx, dy, dz = px - P[i, 4], py - P[i, 5], pz - P[i, 6]
    lx = P[i, 12] * dx + P[i, 13] * dy + P[i, 14] * dz
    ly = P[i, 15] * dx + P[i, 16] * dy + P[i, 17] * dz
    lz = P[i, 18] * dx + P[i, 19] * dy + P[i, 20] * dz
    if typ == 1:
        rx, ry, rz = P[i, 7], P[i, 8], P[i, 9]
        k0 = math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2 + (lz / rz) ** 2)
        k1 = math.sqrt((lx / (rx * rx)) ** 2 + (ly / (ry * ry)) ** 2 + (lz / (rz * rz)) ** 2)
        if k1 < 1e-9:
            return -min(rx, min(ry, rz))
        return k0 * (k0 - 1.0) / k1
    rnd = P[i, 11]
    qx = abs(lx) - P[i, 7] + rnd
    qy = abs(ly) - P[i, 8] + rnd
    qz = abs(lz) - P[i, 9] + rnd
    ox, oy, oz = max(qx, 0.0), max(qy, 0.0), max(qz, 0.0)
    return math.sqrt(ox * ox + oy * oy + oz * oz) + min(max(qx, max(qy, qz)), 0.0) - rnd


@njit(cache=True, fastmath=True)
def _map(P, idx, n, px, py, pz):
    dbody = 1e9
    dhard = 1e9
    best = 1e9
    bi = -1
    for j in range(n):
        i = idx[j]
        d = _prim(P, i, px, py, pz)
        if d < best:
            best = d
            bi = i
        if P[i, 2] == 0.0:
            k = P[i, 3]
            if k > 0.0:
                h = max(k - abs(dbody - d), 0.0) / k
                dbody = min(dbody, d) - h * h * k * 0.25
            else:
                dbody = min(dbody, d)
        else:
            dhard = min(dhard, d)
    return min(dbody, dhard), bi


@njit(cache=True, fastmath=True)
def _smooth(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3.0 - 2.0 * t)


@njit(cache=True, fastmath=True)
def _material(m, px, py, pz):
    if m == LEG:
        return CLOTH if py > 0.765 - 0.02 * _smooth(0.02, 0.11, abs(px)) else SKIN
    if m == TORSO:
        if py < 0.985:
            return CLOTH
        if 1.1 < py < 1.47 and abs(px) < 0.16:
            top = 1.3
            if pz > 0.0:
                top -= 0.05 * math.exp(-(px / 0.065) ** 2)
            if 1.135 < py < top:
                return CLOTH
            # Traeger: von der Oberkante ueber die Schulter nach hinten
            ax = abs(px)
            if py >= top - 0.01:
                t = (py - 1.29) / (1.43 - 1.29)
                cx = 0.078 + 0.03 * min(max(t, 0.0), 1.0)
                if abs(ax - cx) < 0.0125:
                    return CLOTH
        return SKIN
    return m


@njit(parallel=True, cache=True, fastmath=True)
def render(P, W, H, cam, light, fib, out):
    tx, ty, tz = cam[0], cam[1], cam[2]
    rx, ry, rz = cam[3], cam[4], cam[5]
    ux, uy, uz = cam[6], cam[7], cam[8]
    fx, fy, fz = cam[9], cam[10], cam[11]
    half = cam[12]
    npr = P.shape[0]
    margin = 0.16
    cu = np.empty(npr)
    cv = np.empty(npr)
    cw = np.empty(npr)
    cr = np.empty(npr)
    for i in range(npr):
        dx, dy, dz = P[i, 21] - tx, P[i, 22] - ty, P[i, 23] - tz
        cu[i] = dx * rx + dy * ry + dz * rz
        cv[i] = dx * ux + dy * uy + dz * uz
        cw[i] = dx * fx + dy * fy + dz * fz
        cr[i] = P[i, 24] + margin
    # Fuer den Bodenschatten reichen Teile nahe am Boden
    nfl = 0
    flidx = np.empty(npr, np.int64)
    for i in range(npr):
        if P[i, 22] - P[i, 24] < 0.3:
            flidx[nfl] = i
            nfl += 1

    # Licht
    l1x, l1y, l1z = light[0], light[1], light[2]
    l2x, l2y, l2z = light[3], light[4], light[5]

    # Muskelfasern (Deltamuskel): Achse Ursprung -> Ansatz
    fox, foy, foz = fib[0], fib[1], fib[2]
    fax, fay, faz = fib[3] - fox, fib[4] - foy, fib[5] - foz
    fl = math.sqrt(fax * fax + fay * fay + faz * faz)
    fax, fay, faz = fax / fl, fay / fl, faz / fl
    # Referenzvektor senkrecht zur Achse
    e1x, e1y, e1z = fay, -fax, 0.0
    el = math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z)
    e1x, e1y, e1z = e1x / el, e1y / el, e1z / el
    e2x = fay * e1z - faz * e1y
    e2y = faz * e1x - fax * e1z
    e2z = fax * e1y - fay * e1x

    for yy in prange(H):
        idx = np.empty(npr, np.int64)
        for xx in range(W):
            u = ((xx + 0.5) / W * 2.0 - 1.0) * half
            v = (1.0 - (yy + 0.5) / H * 2.0) * half
            ox = tx + rx * u + ux * v - fx * 4.0
            oy = ty + ry * u + uy * v - fy * 4.0
            oz = tz + rz * u + uz * v - fz * 4.0
            n = 0
            t0 = 1e9
            t1 = -1e9
            for i in range(npr):
                du = u - cu[i]
                dv = v - cv[i]
                d2 = du * du + dv * dv
                if d2 < cr[i] * cr[i]:
                    idx[n] = i
                    n += 1
                    s = math.sqrt(cr[i] * cr[i] - d2)
                    t0 = min(t0, cw[i] + 4.0 - s)
                    t1 = max(t1, cw[i] + 4.0 + s)
            r, g, b = 1.0, 1.0, 1.0
            hit = False
            px, py, pz = 0.0, 0.0, 0.0
            bi = -1
            if n > 0:
                t = max(t0, 0.0)
                for _ in range(220):
                    px, py, pz = ox + fx * t, oy + fy * t, oz + fz * t
                    d, bi = _map(P, idx, n, px, py, pz)
                    if d < 0.00025:
                        hit = True
                        break
                    t += d * 0.85
                    if t > t1:
                        break
            if hit:
                # Normale (Tetraeder-Methode)
                e = 0.0006
                d1, _i = _map(P, idx, n, px + e, py - e, pz - e)
                d2_, _i = _map(P, idx, n, px - e, py - e, pz + e)
                d3, _i = _map(P, idx, n, px - e, py + e, pz - e)
                d4, _i = _map(P, idx, n, px + e, py + e, pz + e)
                nx = d1 - d2_ - d3 + d4
                ny = -d1 - d2_ + d3 + d4
                nz = -d1 + d2_ - d3 + d4
                nl = math.sqrt(nx * nx + ny * ny + nz * nz) + 1e-12
                nx, ny, nz = nx / nl, ny / nl, nz / nl

                # Ambient Occlusion
                occ = 0.0
                sca = 1.0
                for k in range(5):
                    hh = 0.012 + 0.03 * k
                    dd, _i = _map(P, idx, n, px + nx * hh, py + ny * hh, pz + nz * hh)
                    occ += (hh - dd) * sca
                    sca *= 0.75
                ao = min(max(1.0 - 2.2 * occ, 0.0), 1.0)

                m = _material(int(P[bi, 1]), px, py, pz)
                if m == SKIN:
                    br, bg, bb, spec, shin = 0.80, 0.80, 0.82, 0.16, 24.0
                elif m == CLOTH:
                    br, bg, bb, spec, shin = 0.25, 0.25, 0.28, 0.06, 12.0
                elif m == MUSCLE:
                    br, bg, bb, spec, shin = 0.86, 0.13, 0.12, 0.28, 30.0
                elif m == HAIR:
                    br, bg, bb, spec, shin = 0.20, 0.18, 0.18, 0.18, 20.0
                elif m == SHOE:
                    br, bg, bb, spec, shin = 0.93, 0.93, 0.94, 0.10, 16.0
                elif m == METAL:
                    br, bg, bb, spec, shin = 0.55, 0.57, 0.6, 0.4, 40.0
                elif m == EYE:
                    br, bg, bb, spec, shin = 0.12, 0.11, 0.11, 0.3, 40.0
                else:
                    br, bg, bb, spec, shin = 0.10, 0.10, 0.11, 0.35, 40.0

                if m == MUSCLE:
                    # Faserstruktur entlang der Achse Ursprung -> Ansatz
                    qx, qy, qz = px - fox, py - foy, pz - foz
                    ta = qx * fax + qy * fay + qz * faz
                    qx, qy, qz = qx - fax * ta, qy - fay * ta, qz - faz * ta
                    ang = math.atan2(qx * e2x + qy * e2y + qz * e2z, qx * e1x + qy * e1y + qz * e1z)
                    st = 0.5 + 0.5 * math.sin(ang * 34.0 + 3.0 * ta)
                    st = st * st
                    f = 0.80 + 0.20 * (1.0 - st)
                    br, bg, bb = br * f, bg * f, bb * f

                # Beleuchtung (Blick zur Kamera = -f)
                vx, vy, vz = -fx, -fy, -fz
                ndl1 = nx * l1x + ny * l1y + nz * l1z
                ndl2 = nx * l2x + ny * l2y + nz * l2z
                dif1 = max((ndl1 + 0.35) / 1.35, 0.0)
                dif2 = max((ndl2 + 0.2) / 1.2, 0.0)
                hx, hy, hz = l1x + vx, l1y + vy, l1z + vz
                hl = math.sqrt(hx * hx + hy * hy + hz * hz)
                ndh = max((nx * hx + ny * hy + nz * hz) / hl, 0.0)
                sp = spec * ndh ** shin
                ndv = max(nx * vx + ny * vy + nz * vz, 0.0)
                edge = 0.72 + 0.28 * _smooth(0.0, 0.55, ndv)
                sky = 0.5 + 0.5 * ny
                lum = (0.30 + 0.08 * sky) * ao + 0.62 * dif1 * (0.55 + 0.45 * ao) + 0.16 * dif2 * ao
                lum *= edge
                r = br * lum + sp * ao
                g = bg * lum + sp * ao
                b = bb * lum + sp * ao
            else:
                # Boden y = 0: nur weicher Kontaktschatten
                if fy < -1e-6:
                    tf = -oy / fy
                    gx, gz = ox + fx * tf, oz + fz * tf
                    occ = 0.0
                    for k in range(4):
                        hh = 0.02 + 0.06 * k
                        dd, _i = _map(P, flidx, nfl, gx, hh, gz)
                        occ += max(hh - dd, 0.0) / hh * (0.5 ** k)
                    sh = min(occ * 0.22, 0.35)
                    r = 1.0 - sh
                    g = 1.0 - sh
                    b = 1.0 - sh * 0.9
            out[yy, xx, 0] = min(max(r, 0.0), 1.0)
            out[yy, xx, 1] = min(max(g, 0.0), 1.0)
            out[yy, xx, 2] = min(max(b, 0.0), 1.0)


# ---------------------------------------------------------------------------
# Figur und Kabelzug
# ---------------------------------------------------------------------------

SH_R = _v((-0.172, 1.365, -0.012))  # rechte Schulter (arbeitet), Bildseite links
SH_L = _v((0.172, 1.365, -0.012))
UPPER = 0.285
FORE = 0.245
PULLEY = _v((0.585, 0.155, 0.075))


def _slerp(a, b, s):
    a, b = _norm(a), _norm(b)
    om = math.acos(float(np.clip(np.dot(a, b), -1.0, 1.0)))
    if om < 1e-6:
        return a
    return (math.sin((1 - s) * om) * a + math.sin(s * om) * b) / math.sin(om)


def arm_pose(s):
    """s = 0 unten, s = 1 oben (Oberarm etwa waagerecht)."""
    u0 = _norm((0.035, -1.0, 0.24))  # unten: Hand vor dem Oberschenkel
    u1 = _norm((-0.94, -0.035, 0.34))  # oben: Schulterhoehe, leicht vor der Frontalebene
    u = _slerp(u0, u1, s)
    elbow = SH_R + UPPER * u
    fwd = _v((0.12, 0.0, 1.0))
    ant = _norm(fwd - np.dot(fwd, u) * u)
    bend = math.radians(24 - 8 * s)  # Ellenbogen leicht gebeugt, bleibt fast konstant
    f = math.cos(bend) * u + math.sin(bend) * ant
    f = _norm(f + _v((0, -0.07 * s, 0)))  # oben: Hand minimal unter dem Ellenbogen
    wrist = elbow + FORE * f
    return u, elbow, f, wrist


def build(s):
    sc = Scene()
    # Rumpf (weich verschmolzen)
    sc.ell((0, 0.915, -0.005), (0.15, 0.11, 0.105), CLOTH, 0.0)
    sc.ell((0.068, 0.875, -0.052), (0.082, 0.1, 0.075), CLOTH, 0.04)
    sc.ell((-0.068, 0.875, -0.052), (0.082, 0.1, 0.075), CLOTH, 0.04)
    sc.ell((0, 1.06, -0.002), (0.118, 0.11, 0.084), TORSO, 0.07)
    sc.ell((0, 1.215, -0.008), (0.14, 0.14, 0.098), TORSO, 0.07)
    sc.cone((-0.14, 1.33, -0.018), (0.14, 1.33, -0.018), 0.062, 0.062, TORSO, 0.06)
    for sx in (-1, 1):
        sc.ell((sx * 0.058, 1.215, 0.066), (0.062, 0.056, 0.048), TORSO, 0.035)
        # Trapez, flach und entspannt (Schultern bleiben unten)
        sc.cone((0, 1.45, -0.03), (sx * 0.15, 1.375, -0.022), 0.033, 0.036, TORSO, 0.05)
    sc.cone((0, 1.39, -0.015), (0, 1.5, -0.004), 0.044, 0.041, SKIN, 0.03)
    # Kopf
    sc.ell((0, 1.578, 0.008), (0.074, 0.098, 0.088), SKIN, 0.03)
    sc.ell((0, 1.528, 0.026), (0.058, 0.05, 0.064), SKIN, 0.04)
    sc.ell((0, 1.572, 0.09), (0.0095, 0.016, 0.013), SKIN, 0.012)
    sc.ell((0, 1.598, -0.016), (0.079, 0.088, 0.09), HAIR, 0.012)
    sc.ell((0, 1.675, -0.06), (0.04, 0.036, 0.04), HAIR, 0.02)
    for sx in (-1, 1):
        sc.ell((sx * 0.029, 1.59, 0.083), (0.0105, 0.005, 0.006), EYE, 0.0)
        sc.cone((sx * 0.015, 1.611, 0.087), (sx * 0.044, 1.612, 0.077), 0.0028, 0.0024, HAIR, 0.0)

    # Beine
    for sx in (-1, 1):
        hip = _v((sx * 0.085, 0.87, -0.005))
        knee = _v((sx * 0.1, 0.475, 0.012))
        ank = _v((sx * 0.108, 0.085, -0.012))
        sc.cone(hip, knee, 0.078, 0.05, LEG, 0.05)
        sc.ell(hip * 0.45 + knee * 0.55 + _v((sx * 0.006, 0, 0.012)), (0.068, 0.17, 0.07), LEG, 0.04)
        sc.cone(knee, ank, 0.048, 0.03, SKIN, 0.03)
        sc.ell(knee * 0.62 + ank * 0.38 + _v((sx * 0.004, 0, -0.03)), (0.048, 0.11, 0.045), SKIN, 0.035)
        # Schuh
        rot = _basis(_v((sx * 0.14, 0, 1.0)), (0, 1, 0))
        sc.ell(_v((sx * 0.115, 0.05, 0.045)), (0.12, 0.047, 0.05), SHOE, 0.02, rot=rot)
        sc.ell(_v((sx * 0.115, 0.018, 0.045)), (0.124, 0.05, 0.018), BLACK, 0.0, group=1, rot=rot)

    # Linker Arm: Hand in der Huefte
    elL = _v((0.315, 1.125, -0.07))
    wrL = _v((0.165, 0.985, 0.0))
    sc.ell(SH_L, (0.05, 0.05, 0.05), SKIN, 0.02)
    sc.cone(SH_L + _v((0.012, 0.03, 0)), SH_L + 0.16 * _norm(elL - SH_L), 0.047, 0.022, SKIN, 0.04)
    sc.cone(SH_L, elL, 0.042, 0.033, SKIN, 0.012)
    sc.cone(elL, wrL, 0.034, 0.022, SKIN, 0.012)
    hdL = _norm(wrL - elL + _v((0, -0.05, 0.02)))
    sc.ell(wrL + 0.04 * hdL, (0.05, 0.03, 0.02), SKIN, 0.012, rot=_basis(hdL, (1, 0, 0.3)))

    # Rechter Arm: arbeitet
    u, elbow, f, wrist = arm_pose(s)
    sc.ell(SH_R, (0.05, 0.05, 0.05), SKIN, 0.02)
    sc.cone(SH_R, elbow, 0.042, 0.033, SKIN, 0.012)
    sc.cone(elbow, wrist, 0.035, 0.022, SKIN, 0.012)
    sc.ell(elbow + 0.07 * f + _v((0, 0.0, 0.0)), (0.075, 0.037, 0.034), SKIN, 0.02, rot=_basis(f))
    hand = wrist + 0.045 * f
    sc.ell(hand, (0.05, 0.034, 0.03), SKIN, 0.012, rot=_basis(f, (0, 0, 1)))

    # Deltamuskel: Ursprung fix am Schulterdach, Ansatz wandert mit dem Oberarm.
    # Volumen bleibt ungefaehr erhalten, er wird also dicker, wenn er sich verkuerzt.
    origin = SH_R + _v((-0.012, 0.03, 0.0))
    insert = SH_R + 0.16 * u
    L = np.linalg.norm(insert - origin)
    thick = (0.19 / L) ** 0.35
    sc.cone(origin, insert, 0.047 * thick, 0.022 * thick, MUSCLE, 0.04)

    # Griff (D-Griff) und Seil
    cable = _norm(PULLEY - hand)
    grip = _norm(np.cross(f, cable))
    if grip[2] < 0:
        grip = -grip
    g0, g1 = hand - 0.058 * grip, hand + 0.058 * grip
    apex = hand + 0.075 * cable
    sc.cone(g0, g1, 0.012, 0.012, BLACK, group=1)
    sc.cone(g0, apex, 0.005, 0.005, METAL, group=1)
    sc.cone(g1, apex, 0.005, 0.005, METAL, group=1)
    sc.cone(apex, PULLEY, 0.0038, 0.0038, BLACK, group=1)

    # Kabelturm
    col = _v((0.675, 1.2, -0.02))
    sc.box(col, (0.065, 1.2, 0.06), METAL, 0.012)
    sc.box((0.675, 0.012, 0.0), (0.2, 0.012, 0.26), METAL, 0.006)
    sc.box((0.625, 0.16, 0.035), (0.03, 0.07, 0.045), BLACK, 0.01)
    rotp = _basis((0.0, 0.0, 1.0), (0, 1, 0))
    sc.ell(PULLEY + _v((0.0, 0.0, -0.005)), (0.012, 0.045, 0.045), METAL, group=1, rot=rotp)
    for yy in (0.5, 0.9, 1.3, 1.7):
        sc.box((0.61, yy, -0.02), (0.006, 0.012, 0.04), BLACK, 0.004)

    fib = np.concatenate([origin, insert])
    return sc.array(), fib


# ---------------------------------------------------------------------------
# Kamera, Bildaufbau, Zeitablauf
# ---------------------------------------------------------------------------


def camera(yaw_deg=12.0, pitch_deg=9.0, target=(0.0, 0.9, 0.0), half=0.95):
    yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
    back = _v((math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)))
    fwd = -back
    right = _norm(np.cross(fwd, (0, 1, 0)))
    up = np.cross(right, fwd)
    return np.concatenate([_v(target), right, up, fwd, [half]])


def lights():
    l1 = _norm((0.35, 0.75, 0.75))
    l2 = _norm((-0.8, 0.1, 0.35))
    return np.concatenate([l1, l2])


def frame(s, size, ss=2, cam=None):
    P, fib = build(s)
    cam = camera() if cam is None else cam
    W = size * ss
    out = np.zeros((W, W, 3))
    render(P, W, W, cam, lights(), fib, out)
    img = out.reshape(size, ss, size, ss, 3).mean(axis=(1, 3))
    img = np.power(img, 1 / 1.05)
    return Image.fromarray((img * 255 + 0.5).clip(0, 255).astype(np.uint8))


def ease(x):
    return 0.5 - 0.5 * math.cos(math.pi * x)


def timeline(fps=25, up=1.0, top=0.35, down=2.0, bottom=0.55):
    """Liste aus (s, Dauer in ms, Phase)."""
    ms = int(round(1000 / fps))
    seq = [(0.0, int(bottom * 1000), "start")]
    nu = int(round(up * fps))
    for i in range(1, nu):
        seq.append((ease(i / nu), ms, "up"))
    seq.append((1.0, int(top * 1000), "top"))
    nd = int(round(down * fps))
    for i in range(1, nd):
        seq.append((1.0 - ease(i / nd), ms, "down"))
    return seq


FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

LABELS = {
    "start": ("Start", "Schulter tief, Bauch fest, Arm leicht gebeugt"),
    "up": ("Hoch: ca. 1 Sek.", "Arm seitlich wegführen, Ellenbogen führt"),
    "top": ("Oben: Schulterhöhe", "kurz halten, nicht höher"),
    "down": ("Runter: ca. 2 Sek.", "langsam und kontrolliert"),
}
RED = (200, 35, 32)


def label(img, phase, t0, t1, total):
    """Bild mit Hinweisstreifen darunter; Balken zeigt die Zeit im Zyklus."""
    W, H = img.size
    band = int(W * 0.19)
    out = Image.new("RGB", (W, H + band), "white")
    out.paste(img, (0, 0))
    d = ImageDraw.Draw(out)
    fb = ImageFont.truetype(FONT_B, int(W * 0.046))
    fr = ImageFont.truetype(FONT_R, int(W * 0.034))
    head, sub = LABELS[phase]
    x = int(W * 0.045)
    d.line((x, H, W - x, H), fill=(228, 228, 230), width=1)
    d.text((x, H + int(band * 0.12)), head, font=fb, fill=RED)
    d.text((x, H + int(band * 0.45)), sub, font=fr, fill=(70, 70, 76))
    y = H + int(band * 0.84)
    d.rounded_rectangle((x, y, W - x, y + 5), radius=2, fill=(230, 230, 232))
    fill = x + (W - 2 * x) * min(t1 / total, 1.0)
    if fill > x + 5:
        d.rounded_rectangle((x, y, int(fill), y + 5), radius=2, fill=RED)
    return out


def to_gif(frames, durations, path):
    # Gemeinsame Palette fuer alle Bilder, damit nichts flimmert
    sample = [frames[i] for i in np.linspace(0, len(frames) - 1, 8).astype(int)]
    strip = Image.new("RGB", (sample[0].width * len(sample), sample[0].height))
    for i, im in enumerate(sample):
        strip.paste(im, (i * im.width, 0))
    q = strip.quantize(colors=254, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[: 254 * 3], dtype=np.float32).reshape(-1, 3)
    pal = np.vstack([pal, [[255, 255, 255]]])  # reines Weiss fuer den Hintergrund
    flat = pal.astype(np.uint8).ravel().tolist()

    out = []
    for im in frames:
        a = np.asarray(im, dtype=np.uint8)
        key = (a[..., 0].astype(np.int32) << 16) | (a[..., 1].astype(np.int32) << 8) | a[..., 2]
        uniq, inv = np.unique(key.ravel(), return_inverse=True)
        cols = np.stack([(uniq >> 16) & 255, (uniq >> 8) & 255, uniq & 255], axis=1).astype(np.float32)
        best = np.empty(len(uniq), dtype=np.uint8)
        for s in range(0, len(uniq), 4096):
            d = ((cols[s:s + 4096, None, :] - pal[None, :, :]) ** 2).sum(-1)
            best[s:s + 4096] = d.argmin(1)
        p = Image.fromarray(best[inv].reshape(a.shape[:2]), "P")
        p.putpalette(flat)
        out.append(p)
    out[0].save(path, save_all=True, append_images=out[1:], duration=durations, loop=0,
                optimize=True, disposal=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=480)
    ap.add_argument("--ss", type=int, default=2)
    ap.add_argument("--still", type=str, default=None)
    ap.add_argument("--out", type=str, default=HERE)
    a = ap.parse_args()

    if a.still:
        for s in [float(x) for x in a.still.split(",")]:
            frame(s, a.size, a.ss).save(os.path.join(a.out, f"still_{s:.2f}.png"))
        return

    seq = timeline()
    cache = {}
    frames, durs, phases = [], [], []
    for n, (s, ms, ph) in enumerate(seq):
        key = round(s, 5)
        if key not in cache:
            cache[key] = frame(s, a.size, a.ss)
        frames.append(cache[key])
        durs.append(ms)
        phases.append(ph)
        print(f"\r{n + 1}/{len(seq)}", end="", flush=True)
    print()
    to_gif(frames, durs, os.path.join(a.out, "kabel-seitheben.gif"))
    total = sum(durs)
    ends = np.cumsum(durs)
    lab = [label(im, ph, e - ms, e, total) for im, ph, e, ms in zip(frames, phases, ends, durs)]
    to_gif(lab, durs, os.path.join(a.out, "kabel-seitheben-mit-hinweisen.gif"))


if __name__ == "__main__":
    main()
