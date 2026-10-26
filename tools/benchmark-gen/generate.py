"""
Spectra Benchmark Generator (Phase 2)
Generates 45 realistic 1280x720 video clips (8 frames @ 4.0 FPS) across 3 environments:
  1. canvas     (S1 — HTML5 Canvas Analytics Chart)
  2. mobile_mp4 (S2 — Mobile Checkout Screen Recording)
  3. dom_catch  (S3 — Web Drawer Transition / "The Catch")

7 Ground-truth occlusion levels: 0.00, 0.05, 0.10, 0.15, 0.25, 0.40, 0.60
Total clips: 3 envs * 7 levels * 2 variants = 42 + 3 clean controls = 45 clips.
Outputs:
  - benchmark/clips/<clip_id>.mp4
  - benchmark/clips/<clip_id>_t0.png
  - benchmark/clips/<clip_id>_tk.png
  - benchmark/manifest.json
"""

import os
import sys
import json
import math
from datetime import datetime, timezone
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cv2

WIDTH = 1280
HEIGHT = 720
FPS = 4.0
TOTAL_FRAMES = 8

def get_font(size: int, bold: bool = False):
    font_names = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in font_names:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

# Preload fonts
FONT_TITLE = get_font(20, bold=True)
FONT_HEADING = get_font(16, bold=True)
FONT_BODY = get_font(14, bold=False)
FONT_BODY_BOLD = get_font(14, bold=True)
FONT_SMALL = get_font(11, bold=False)
FONT_SMALL_BOLD = get_font(11, bold=True)
FONT_MONO = get_font(12, bold=True)


def create_canvas_frame(frame_idx: int, occlusion: float, variant: str) -> tuple[Image.Image, dict]:
    """
    S1 — HTML5 Canvas Analytics Chart
    Target: 'Revenue Series Legend' at [x=820, y=240, w=220, h=48]
    """
    target_bbox = {"x": 820, "y": 240, "width": 220, "height": 48}
    center_x = 820 + 220 // 2  # 930
    center_y = 240 + 48 // 2   # 264

    img = Image.new("RGB", (WIDTH, HEIGHT), color=(15, 23, 42))  # #0F172A
    draw = ImageDraw.Draw(img)

    # Top Header
    draw.rectangle([0, 0, WIDTH, 64], fill=(30, 41, 59))  # #1E293B
    draw.line([0, 64, WIDTH, 64], fill=(51, 65, 85), width=1)
    draw.rounded_rectangle([20, 16, 52, 48], radius=6, fill=(59, 130, 246))
    draw.text((28, 20), "SP", fill=(255, 255, 255), font=FONT_HEADING)
    draw.text((66, 22), "Spectra Telemetry Dashboard", fill=(248, 250, 252), font=FONT_HEADING)
    draw.rounded_rectangle([360, 22, 440, 44], radius=11, fill=(16, 185, 129))
    draw.text((375, 26), "LIVE", fill=(255, 255, 255), font=FONT_SMALL_BOLD)
    draw.rounded_rectangle([700, 18, 960, 46], radius=6, fill=(15, 23, 42), outline=(51, 65, 85))
    draw.text((716, 24), "Search metrics, alerts, services...", fill=(100, 116, 139), font=FONT_SMALL)
    draw.ellipse([1216, 16, 1248, 48], fill=(99, 102, 241))
    draw.text((1225, 22), "AI", fill=(255, 255, 255), font=FONT_SMALL_BOLD)

    # Left Sidebar
    draw.rectangle([0, 64, 240, HEIGHT], fill=(30, 41, 59))
    draw.line([240, 64, 240, HEIGHT], fill=(51, 65, 85), width=1)
    nav_items = [
        ("Overview", True),
        ("Timeseries Metrics", False),
        ("Dual Instruments", False),
        ("Noise Calibration", False),
        ("Failure Referee", False),
        ("Settings", False),
    ]
    for idx, (label, active) in enumerate(nav_items):
        y_pos = 90 + idx * 46
        if active:
            draw.rectangle([0, y_pos - 4, 4, y_pos + 30], fill=(59, 130, 246))
            draw.rounded_rectangle([12, y_pos - 2, 228, y_pos + 28], radius=6, fill=(51, 65, 85))
            draw.text((28, y_pos + 4), label, fill=(255, 255, 255), font=FONT_BODY_BOLD)
        else:
            draw.text((28, y_pos + 4), label, fill=(148, 163, 184), font=FONT_BODY)

    # 3 KPI Cards
    kpi_cards = [
        ("Total Invocations", "1,248,930", "+14.2% vs last week", (16, 185, 129)),
        ("P99 Eval Latency", "34.2 ms", "Optimal SLA", (59, 130, 246)),
        ("Noise Floor (sigma)", "0.0443", "Static Calibrated", (168, 85, 247)),
    ]
    card_widths = 310
    for idx, (title, val, badge, badge_col) in enumerate(kpi_cards):
        cx = 264 + idx * (card_widths + 24)
        draw.rounded_rectangle([cx, 84, cx + card_widths, 180], radius=8, fill=(30, 41, 59), outline=(51, 65, 85))
        draw.text((cx + 16, 96), title, fill=(148, 163, 184), font=FONT_SMALL)
        draw.text((cx + 16, 118), val, fill=(248, 250, 252), font=FONT_TITLE)
        draw.text((cx + 16, 152), badge, fill=badge_col, font=FONT_SMALL_BOLD)

    # Central Chart Canvas Container
    draw.rounded_rectangle([264, 200, 1256, 700], radius=10, fill=(11, 17, 32), outline=(51, 65, 85))
    draw.text((288, 218), "Realtime Revenue & Pipeline Velocity (USD)", fill=(248, 250, 252), font=FONT_HEADING)

    # Chart Grid lines
    for i in range(5):
        gy = 280 + i * 80
        draw.line([320, gy, 1220, gy], fill=(30, 41, 59), width=1)
        draw.text((276, gy - 8), f"${(4 - i) * 25}k", fill=(100, 116, 139), font=FONT_SMALL)

    # Multi-line telemetry curves
    pts_revenue = [
        (330, 560), (410, 520), (500, 490), (590, 530),
        (680, 440), (770, 400), (860, 430), (950, 360),
        (1040, 390), (1130, 320), (1210, 310)
    ]
    pts_baseline = [
        (330, 580), (410, 560), (500, 540), (590, 550),
        (680, 500), (770, 480), (860, 490), (950, 450),
        (1040, 460), (1130, 420), (1210, 410)
    ]
    draw.line(pts_baseline, fill=(139, 92, 246), width=2)
    draw.line(pts_revenue, fill=(6, 182, 212), width=3)
    for px, py in pts_revenue:
        draw.ellipse([px - 4, py - 4, px + 4, py + 4], fill=(6, 182, 212), outline=(255, 255, 255))

    # TARGET ELEMENT: "Revenue Series Legend" box [x=820, y=240, w=220, h=48]
    # Background: #334155 (RGB: 51, 65, 85)
    tx, ty, tw, th = target_bbox["x"], target_bbox["y"], target_bbox["width"], target_bbox["height"]
    draw.rectangle([tx, ty, tx + tw - 1, ty + th - 1], fill=(51, 65, 85), outline=(100, 116, 139))
    draw.ellipse([tx + 12, ty + 18, tx + 24, ty + 30], fill=(6, 182, 212))
    draw.ellipse([tx + 30, ty + 18, tx + 42, ty + 30], fill=(139, 92, 246))
    draw.text((tx + 50, ty + 15), "Revenue Series Legend", fill=(248, 250, 252), font=FONT_BODY_BOLD)

    # OCCLUDER: Floating chart tooltip card
    # Color: #0B0F17 (RGB: 11, 15, 23) -> Euclidean distance to target #334155 is ~70 > 5
    center_covered = False
    if occlusion > 0.0:
        current_occlusion = 0.0
        if frame_idx in (0, 1, 2):
            current_occlusion = 0.0
        elif frame_idx == 3:
            current_occlusion = occlusion * 0.40
        elif frame_idx == 4:
            current_occlusion = occlusion * 0.80
        else: # 5, 6, 7
            current_occlusion = occlusion

        if current_occlusion > 0.0:
            cov_w = int(round(tw * current_occlusion))

            # Variant 1: Occluder slides from left to right
            # Variant 2 / Control: Occluder slides from right to left
            if variant == "v1":
                cov_x1 = tx
                cov_x2 = tx + cov_w
                if frame_idx >= 5 and center_x < cov_x2:
                    center_covered = True
                
                # Draw tooltip background extending to the left outside target box
                draw.rectangle([tx - 120, ty - 6, tx - 1, ty + th + 6], fill=(11, 15, 23), outline=(56, 189, 248))
                # Fill exact target region to guarantee uniform color distance > 5
                if cov_w > 0:
                    draw.rectangle([tx, ty, tx + cov_w - 1, ty + th - 1], fill=(11, 15, 23))
                # Text kept strictly outside target box (x < tx)
                draw.text((tx - 110, ty + 14), "Oct 26 Telemetry", fill=(56, 189, 248), font=FONT_SMALL_BOLD)
            else:
                cov_x1 = tx + tw - cov_w
                cov_x2 = tx + tw
                if frame_idx >= 5 and center_x >= cov_x1:
                    center_covered = True
                
                # Draw tooltip background extending to the right outside target box
                draw.rectangle([tx + tw, ty - 6, tx + tw + 120, ty + th + 6], fill=(11, 15, 23), outline=(56, 189, 248))
                if cov_w > 0:
                    draw.rectangle([tx + tw - cov_w, ty, tx + tw - 1, ty + th - 1], fill=(11, 15, 23))
                # Text kept strictly outside target box (x > tx + tw)
                draw.text((tx + tw + 10, ty + 14), "Oct 26 Telemetry", fill=(56, 189, 248), font=FONT_SMALL_BOLD)

    return img, {"centerPixelCovered": center_covered, "targetBBox": target_bbox}


def create_mobile_frame(frame_idx: int, occlusion: float, variant: str) -> tuple[Image.Image, dict]:
    """
    S2 — Mobile Checkout Screen Recording
    Target: 'Pay $149.00' button at [x=475, y=610, w=330, h=52]
    """
    target_bbox = {"x": 475, "y": 610, "width": 330, "height": 52}
    center_x = 475 + 330 // 2  # 640
    center_y = 610 + 52 // 2   # 636

    img = Image.new("RGB", (WIDTH, HEIGHT), color=(9, 13, 22))  # Studio backdrop
    draw = ImageDraw.Draw(img)

    # Ambient Studio Lighting / Backdrop elements
    draw.rectangle([0, 0, 445, HEIGHT], fill=(12, 18, 30))
    draw.rectangle([835, 0, WIDTH, HEIGHT], fill=(12, 18, 30))
    draw.text((80, 120), "Spectra Mobile Device Lab", fill=(71, 85, 105), font=FONT_TITLE)
    draw.text((80, 160), "Environment: iOS 18.1 Safari Viewport", fill=(100, 116, 139), font=FONT_BODY)
    draw.text((80, 190), "Resolution: 390 x 680 (Centered)", fill=(100, 116, 139), font=FONT_BODY)
    draw.text((80, 220), "Target: Primary Blue CTA", fill=(100, 116, 139), font=FONT_BODY)

    # Mobile Device Bezel [x=445, y=20, w=390, h=680]
    dev_x, dev_y, dev_w, dev_h = 445, 20, 390, 680
    draw.rounded_rectangle([dev_x, dev_y, dev_x + dev_w, dev_y + dev_h], radius=24, fill=(24, 24, 27), outline=(63, 63, 70), width=3)
    draw.rectangle([dev_x + 8, dev_y + 8, dev_x + dev_w - 8, dev_y + dev_h - 8], fill=(15, 23, 42))

    # Mobile Status Bar (y=28..56)
    draw.text((dev_x + 28, dev_y + 14), "9:41", fill=(255, 255, 255), font=FONT_SMALL_BOLD)
    draw.ellipse([dev_x + dev_w // 2 - 24, dev_y + 12, dev_x + dev_w // 2 + 24, dev_y + 24], fill=(0, 0, 0)) # Dynamic island
    draw.rectangle([dev_x + dev_w - 50, dev_y + 16, dev_x + dev_w - 28, dev_y + 26], outline=(255, 255, 255))
    draw.rectangle([dev_x + dev_w - 48, dev_y + 18, dev_x + dev_w - 34, dev_y + 24], fill=(16, 185, 129))

    # Mobile Navigation Bar (y=56..96)
    draw.text((dev_x + 24, dev_y + 48), "< Back", fill=(59, 130, 246), font=FONT_BODY)
    draw.text((dev_x + 150, dev_y + 48), "Checkout", fill=(248, 250, 252), font=FONT_HEADING)

    # Product Card
    draw.rounded_rectangle([dev_x + 20, dev_y + 90, dev_x + dev_w - 20, dev_y + 250], radius=10, fill=(30, 41, 59), outline=(51, 65, 85))
    draw.rounded_rectangle([dev_x + 36, dev_y + 106, dev_x + 96, dev_y + 166], radius=8, fill=(124, 58, 237))
    draw.text((dev_x + 50, dev_y + 124), "PRO", fill=(255, 255, 255), font=FONT_HEADING)
    draw.text((dev_x + 112, dev_y + 110), "Spectra Developer Pro", fill=(248, 250, 252), font=FONT_BODY_BOLD)
    draw.text((dev_x + 112, dev_y + 132), "1-Year Full License", fill=(148, 163, 184), font=FONT_SMALL)
    draw.text((dev_x + 112, dev_y + 152), "$149.00 / yr", fill=(56, 189, 248), font=FONT_BODY_BOLD)

    # Order Details Card
    draw.rounded_rectangle([dev_x + 20, dev_y + 266, dev_x + dev_w - 20, dev_y + 440], radius=10, fill=(30, 41, 59), outline=(51, 65, 85))
    draw.text((dev_x + 36, dev_y + 282), "Summary", fill=(248, 250, 252), font=FONT_BODY_BOLD)
    draw.text((dev_x + 36, dev_y + 312), "Subtotal", fill=(148, 163, 184), font=FONT_SMALL)
    draw.text((dev_x + dev_w - 100, dev_y + 312), "$149.00", fill=(248, 250, 252), font=FONT_SMALL)
    draw.text((dev_x + 36, dev_y + 340), "Taxes & Regulatory", fill=(148, 163, 184), font=FONT_SMALL)
    draw.text((dev_x + dev_w - 70, dev_y + 340), "$0.00", fill=(248, 250, 252), font=FONT_SMALL)
    draw.line([dev_x + 36, dev_y + 372, dev_x + dev_w - 36, dev_y + 372], fill=(51, 65, 85))
    draw.text((dev_x + 36, dev_y + 390), "Total Due", fill=(248, 250, 252), font=FONT_BODY_BOLD)
    draw.text((dev_x + dev_w - 110, dev_y + 390), "$149.00", fill=(16, 185, 129), font=FONT_BODY_BOLD)

    # Security badge
    draw.text((dev_x + 60, dev_y + 460), "🔒 256-Bit Encrypted Secure Checkout", fill=(100, 116, 139), font=FONT_SMALL)

    # TARGET ELEMENT: "Pay $149.00" CTA button [x=475, y=610, w=330, h=52]
    # Primary Blue: #2563EB (RGB: 37, 99, 235)
    tx, ty, tw, th = target_bbox["x"], target_bbox["y"], target_bbox["width"], target_bbox["height"]
    draw.rectangle([tx, ty, tx + tw - 1, ty + th - 1], fill=(37, 99, 235), outline=(96, 165, 250))
    draw.text((tx + 110, ty + 16), "Pay $149.00", fill=(255, 255, 255), font=FONT_BODY_BOLD)

    # OCCLUDER: Mobile promo bottom-sheet drawer (#09090B)
    center_covered = False
    if occlusion > 0.0:
        current_occlusion = 0.0
        if frame_idx in (0, 1, 2):
            current_occlusion = 0.0
        elif frame_idx == 3:
            current_occlusion = occlusion * 0.40
        elif frame_idx == 4:
            current_occlusion = occlusion * 0.80
        else:
            current_occlusion = occlusion

        if current_occlusion > 0.0:
            total_target_px = tw * th
            desired_cov_px = int(round(total_target_px * current_occlusion))

            full_rows = desired_cov_px // tw
            extra_px = desired_cov_px % tw
            
            # Variant 1: Bottom-sheet slides up from bottom
            # Variant 2: Top promo banner slides down
            if variant == "v1":
                cov_y_top = ty + th - full_rows

                # Check center pixel (x=640, y=636)
                if frame_idx >= 5:
                    if center_y >= cov_y_top:
                        center_covered = True
                    elif extra_px > 0 and center_y == (cov_y_top - 1) and center_x < (tx + extra_px):
                        center_covered = True

                # Draw bottom sheet outside device area below button
                draw.rectangle([dev_x + 8, ty + th, dev_x + dev_w - 8, dev_y + dev_h - 8], fill=(9, 9, 11))
                # Draw exact button overlap
                if full_rows > 0:
                    draw.rectangle([tx, ty + th - full_rows, tx + tw - 1, ty + th - 1], fill=(9, 9, 11))
                if extra_px > 0:
                    draw.rectangle([tx, ty + th - full_rows - 1, tx + extra_px - 1, ty + th - full_rows - 1], fill=(9, 9, 11))

                # Drawer details placed strictly below target box (y > ty + th)
                draw.rounded_rectangle([dev_x + dev_w // 2 - 25, ty + th + 6, dev_x + dev_w // 2 + 25, ty + th + 10], radius=2, fill=(113, 113, 122))
                draw.text((dev_x + 24, ty + th + 16), "Promo: 20% Applied to Order", fill=(244, 244, 245), font=FONT_SMALL)
            else:
                cov_y_bottom = ty + full_rows

                if frame_idx >= 5:
                    if center_y < cov_y_bottom:
                        center_covered = True
                    elif extra_px > 0 and center_y == cov_y_bottom and center_x < (tx + extra_px):
                        center_covered = True

                # Outside banner well above button
                draw.rectangle([dev_x + 8, ty - 40, dev_x + dev_w - 8, ty - 1], fill=(9, 9, 11))
                if full_rows > 0:
                    draw.rectangle([tx, ty, tx + tw - 1, ty + full_rows - 1], fill=(9, 9, 11))
                if extra_px > 0:
                    draw.rectangle([tx, ty + full_rows, tx + extra_px - 1, ty + full_rows], fill=(9, 9, 11))
                draw.text((dev_x + 24, ty - 34), "VIP Voucher Active", fill=(56, 189, 248), font=FONT_SMALL)

    return img, {"centerPixelCovered": center_covered, "targetBBox": target_bbox}


def create_dom_catch_frame(frame_idx: int, occlusion: float, variant: str) -> tuple[Image.Image, dict]:
    """
    S3 — Web Drawer Transition / "The Catch"
    Target: 'Complete Checkout' button at [x=910, y=600, w=340, h=50]
    Center pixel: (1080, 625).
    At 0.05, 0.10, and 0.15, bottom edge overlap leaves center uncovered!
    """
    target_bbox = {"x": 910, "y": 600, "width": 340, "height": 50}
    center_x = 910 + 340 // 2  # 1080
    center_y = 600 + 50 // 2   # 625

    img = Image.new("RGB", (WIDTH, HEIGHT), color=(15, 23, 42))  # #0F172A
    draw = ImageDraw.Draw(img)

    # Left Side: E-Commerce Store Catalog (x=0..880)
    draw.rectangle([0, 0, 880, 64], fill=(30, 41, 59))
    draw.line([0, 64, 880, 64], fill=(51, 65, 85))
    draw.text((24, 20), "SPECTRA STORE", fill=(248, 250, 252), font=FONT_TITLE)
    draw.text((220, 24), "Hardware & Developer Tooling", fill=(148, 163, 184), font=FONT_BODY)

    # 4 Product Cards Grid (2x2)
    products = [
        ("Precision Telemetry Hub", "$499.00", "In Stock — Next Day"),
        ("Optical Calibration Target", "$129.00", "Certified NIST Traced"),
        ("Edge Neural Accelerator", "$899.00", "Meta SAM 3.1 Ready"),
        ("Zero-Jitter FPGA Capture", "$349.00", "Hardware Synchronized"),
    ]
    for idx, (pname, price, stock) in enumerate(products):
        row = idx // 2
        col = idx % 2
        px = 30 + col * 420
        py = 88 + row * 290
        draw.rounded_rectangle([px, py, px + 390, py + 260], radius=8, fill=(30, 41, 59), outline=(51, 65, 85))
        draw.rounded_rectangle([px + 16, py + 16, px + 374, py + 160], radius=6, fill=(15, 23, 42))
        draw.text((px + 110, py + 80), "Product Visual", fill=(100, 116, 139), font=FONT_HEADING)
        draw.text((px + 16, py + 176), pname, fill=(248, 250, 252), font=FONT_BODY_BOLD)
        draw.text((px + 16, py + 200), stock, fill=(16, 185, 129), font=FONT_SMALL)
        draw.text((px + 16, py + 224), price, fill=(56, 189, 248), font=FONT_BODY_BOLD)
        draw.rounded_rectangle([px + 270, py + 218, px + 374, py + 248], radius=6, fill=(59, 130, 246))
        draw.text((px + 290, py + 226), "Add Cart", fill=(255, 255, 255), font=FONT_SMALL_BOLD)

    # Right Side: Open Slide-Out Cart Drawer (x=880..1280)
    draw.rectangle([880, 0, WIDTH, HEIGHT], fill=(17, 24, 39))  # #111827
    draw.line([880, 0, 880, HEIGHT], fill=(55, 65, 81), width=2)
    # Drawer Header
    draw.text((910, 22), "Your Cart (2 items)", fill=(248, 250, 252), font=FONT_HEADING)
    draw.text((1230, 20), "✕", fill=(156, 163, 175), font=FONT_HEADING)
    draw.line([880, 64, WIDTH, 64], fill=(55, 65, 81))

    # Line Item 1
    draw.rounded_rectangle([910, 84, 1250, 164], radius=8, fill=(31, 41, 55), outline=(55, 65, 81))
    draw.text((926, 98), "Precision Telemetry Hub", fill=(248, 250, 252), font=FONT_BODY_BOLD)
    draw.text((926, 122), "Qty: 1 • Expedited Air", fill=(156, 163, 175), font=FONT_SMALL)
    draw.text((1170, 122), "$499.00", fill=(56, 189, 248), font=FONT_BODY_BOLD)

    # Line Item 2
    draw.rounded_rectangle([910, 180, 1250, 260], radius=8, fill=(31, 41, 55), outline=(55, 65, 81))
    draw.text((926, 194), "Optical Calibration Target", fill=(248, 250, 252), font=FONT_BODY_BOLD)
    draw.text((926, 218), "Qty: 1 • Standard Pack", fill=(156, 163, 175), font=FONT_SMALL)
    draw.text((1170, 218), "$129.00", fill=(56, 189, 248), font=FONT_BODY_BOLD)

    # Subtotal and discounts
    draw.line([910, 510, 1250, 510], fill=(55, 65, 81))
    draw.text((910, 524), "Subtotal", fill=(156, 163, 175), font=FONT_BODY)
    draw.text((1180, 524), "$628.00", fill=(248, 250, 252), font=FONT_BODY)
    draw.text((910, 554), "Estimated Shipping", fill=(156, 163, 175), font=FONT_BODY)
    draw.text((1205, 554), "FREE", fill=(16, 185, 129), font=FONT_BODY_BOLD)

    # TARGET ELEMENT: "Complete Checkout" button [x=910, y=600, w=340, h=50]
    # Emerald green: #10B981 (RGB: 16, 185, 129)
    tx, ty, tw, th = target_bbox["x"], target_bbox["y"], target_bbox["width"], target_bbox["height"]
    draw.rectangle([tx, ty, tx + tw - 1, ty + th - 1], fill=(16, 185, 129), outline=(52, 211, 153))
    draw.text((tx + 90, ty + 15), "Complete Checkout", fill=(255, 255, 255), font=FONT_BODY_BOLD)

    # OCCLUDER: Sticky drawer footer bar (#0F172A)
    # Overlaps bottom edge of Complete Checkout button
    center_covered = False
    if occlusion > 0.0:
        current_occlusion = 0.0
        if frame_idx in (0, 1, 2):
            current_occlusion = 0.0
        elif frame_idx == 3:
            current_occlusion = occlusion * 0.40
        elif frame_idx == 4:
            current_occlusion = occlusion * 0.80
        else:
            current_occlusion = occlusion

        if current_occlusion > 0.0:
            total_target_px = tw * th
            desired_cov_px = int(round(total_target_px * current_occlusion))

            full_rows = desired_cov_px // tw
            extra_px = desired_cov_px % tw
            cov_y_top = ty + th - full_rows

            # Center pixel is (1080, 625)
            if frame_idx >= 5:
                if center_y >= cov_y_top:
                    center_covered = True
                elif extra_px > 0 and center_y == (cov_y_top - 1) and center_x < (tx + extra_px):
                    center_covered = True

            # Fill footer extending down to bottom of viewport (y=720) strictly below target box
            draw.rectangle([880, ty + th, WIDTH, HEIGHT], fill=(15, 23, 42))
            if full_rows > 0:
                draw.rectangle([tx, ty + th - full_rows, tx + tw - 1, ty + th - 1], fill=(15, 23, 42))
            if extra_px > 0:
                draw.rectangle([tx, ty + th - full_rows - 1, tx + extra_px - 1, ty + th - full_rows - 1], fill=(15, 23, 42))

            # Footer badges strictly below target box (y > ty + th)
            draw.line([880, ty + th + 2, WIDTH, ty + th + 2], fill=(55, 65, 81))
            draw.text((910, ty + th + 14), "🔒 256-Bit SSL Secured • Free Express Returns", fill=(156, 163, 175), font=FONT_SMALL)

    return img, {"centerPixelCovered": center_covered, "targetBBox": target_bbox}


def generate_benchmark():
    print("=== Generating Spectra Benchmark Clips (45 Clips, 8 Frames @ 4 FPS) ===")

    clips_dir = os.path.abspath("benchmark/clips")
    os.makedirs(clips_dir, exist_ok=True)
    manifest_path = os.path.abspath("benchmark/manifest.json")

    environments = [
        ("canvas", "canvas_analytics", create_canvas_frame, "Revenue Series Legend"),
        ("mobile_mp4", "mobile_checkout", create_mobile_frame, "Pay $149.00"),
        ("dom_catch", "dom_drawer_catch", create_dom_catch_frame, "Complete Checkout"),
    ]

    occlusion_levels = [0.00, 0.05, 0.10, 0.15, 0.25, 0.40, 0.60]

    manifest_entries = []

    for env_name, scenario_name, frame_gen_fn, target_label in environments:
        # 1. Standard 7 levels * 2 variants = 14 clips
        for occ in occlusion_levels:
            for var in ("v1", "v2"):
                level_str = f"{int(round(occ * 100)):03d}"
                clip_id = f"{env_name}_{level_str}_{var}"

                # Determine category variant
                if occ == 0.0:
                    cat_variant = "clean"
                elif occ <= 0.15:
                    cat_variant = "edge-case"
                else:
                    cat_variant = "adversarial"

                video_filename = f"{clip_id}.mp4"
                video_rel_path = f"benchmark/clips/{video_filename}"
                video_abs_path = os.path.join(clips_dir, video_filename)

                t0_rel_path = f"benchmark/clips/{clip_id}_t0.png"
                t0_abs_path = os.path.join(clips_dir, f"{clip_id}_t0.png")

                tk_rel_path = f"benchmark/clips/{clip_id}_tk.png"
                tk_abs_path = os.path.join(clips_dir, f"{clip_id}_tk.png")

                # Generate 8 frames
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                writer = cv2.VideoWriter(video_abs_path, fourcc, FPS, (WIDTH, HEIGHT))

                center_covered_final = False
                target_bbox = None

                for frame_i in range(TOTAL_FRAMES):
                    pil_img, meta = frame_gen_fn(frame_i, occ, var)
                    if frame_i == 0:
                        pil_img.save(t0_abs_path)
                        target_bbox = meta["targetBBox"]
                    if frame_i == TOTAL_FRAMES - 1:
                        pil_img.save(tk_abs_path)
                        center_covered_final = meta["centerPixelCovered"]

                    # Convert PIL RGB to OpenCV BGR
                    cv_frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                    writer.write(cv_frame)

                writer.release()

                entry = {
                    "clipId": clip_id,
                    "environment": env_name,
                    "scenario": scenario_name,
                    "variant": cat_variant,
                    "groundTruthOcclusion": occ,
                    "targetLabel": target_label,
                    "targetBBox": target_bbox,
                    "t0FramePath": t0_rel_path,
                    "tkFramePath": tk_rel_path,
                    "videoPath": video_rel_path,
                    "centerPixelCovered": center_covered_final,
                    "expectedVerdicts": {
                        "samDecode": "pass" if occ <= 0.10 else "fail",
                        "noiseFloor": "pass",
                    },
                    "sourceParams": {
                        "fps": FPS,
                        "frameCount": TOTAL_FRAMES,
                        "width": WIDTH,
                        "height": HEIGHT,
                        "variantType": var,
                    },
                }
                manifest_entries.append(entry)

        # 2. Extra 0.00 clean control clip = 1 per env -> 15 per env total
        ctrl_clip_id = f"{env_name}_clean_ctrl"
        ctrl_video_filename = f"{ctrl_clip_id}.mp4"
        ctrl_video_rel = f"benchmark/clips/{ctrl_video_filename}"
        ctrl_video_abs = os.path.join(clips_dir, ctrl_video_filename)
        ctrl_t0_rel = f"benchmark/clips/{ctrl_clip_id}_t0.png"
        ctrl_t0_abs = os.path.join(clips_dir, f"{ctrl_clip_id}_t0.png")
        ctrl_tk_rel = f"benchmark/clips/{ctrl_clip_id}_tk.png"
        ctrl_tk_abs = os.path.join(clips_dir, f"{ctrl_clip_id}_tk.png")

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(ctrl_video_abs, fourcc, FPS, (WIDTH, HEIGHT))
        target_bbox = None
        for frame_i in range(TOTAL_FRAMES):
            pil_img, meta = frame_gen_fn(frame_i, 0.0, "ctrl")
            if frame_i == 0:
                pil_img.save(ctrl_t0_abs)
                target_bbox = meta["targetBBox"]
            if frame_i == TOTAL_FRAMES - 1:
                pil_img.save(ctrl_tk_abs)
            cv_frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
            writer.write(cv_frame)
        writer.release()

        manifest_entries.append({
            "clipId": ctrl_clip_id,
            "environment": env_name,
            "scenario": scenario_name,
            "variant": "clean",
            "groundTruthOcclusion": 0.00,
            "targetLabel": target_label,
            "targetBBox": target_bbox,
            "t0FramePath": ctrl_t0_rel,
            "tkFramePath": ctrl_tk_rel,
            "videoPath": ctrl_video_rel,
            "centerPixelCovered": False,
            "expectedVerdicts": {
                "samDecode": "pass",
                "noiseFloor": "pass",
            },
            "sourceParams": {
                "fps": FPS,
                "frameCount": TOTAL_FRAMES,
                "width": WIDTH,
                "height": HEIGHT,
                "variantType": "control",
            },
        })

    manifest_data = {
        "version": "1.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "clips": manifest_entries,
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

    print(f"Generated {len(manifest_entries)} clips in {clips_dir}")
    print(f"Manifest written to {manifest_path}")


if __name__ == "__main__":
    generate_benchmark()
