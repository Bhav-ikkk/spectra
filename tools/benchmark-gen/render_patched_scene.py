#!/usr/bin/env python3
"""
Spectra Patched Scene Renderer
Renders dynamic post-patch frames for Scenario S1, S2, and S3.
Can be used via CLI or imported programmatically.
"""

import os
import sys
import argparse
from PIL import Image, ImageDraw

WIDTH = 1280
HEIGHT = 720

SCENARIO_CONFIGS = {
    "s1": {
        "target_bbox": {"x": 820, "y": 240, "width": 220, "height": 48},
        "occluder_color": (11, 15, 23),
        "outline_color": (56, 189, 248),
    },
    "s2": {
        "target_bbox": {"x": 475, "y": 610, "width": 330, "height": 52},
        "occluder_color": (9, 9, 11),
        "handle_color": (113, 113, 122),
        "dev_x": 445,
        "dev_y": 20,
        "dev_w": 390,
        "dev_h": 680,
    },
    "s3": {
        "target_bbox": {"x": 910, "y": 600, "width": 340, "height": 50},
        "occluder_color": (15, 23, 42),
    },
}


def render_patched_scene(
    scenario: str,
    baseline_path: str,
    overlap_ratio: float,
    output_path: str,
    patch: str = "",
) -> str:
    """
    Renders the post-patch frame based on remaining overlap ratio.
    If overlap_ratio == 0, occluder is drawn outside target bounding box (100% visible).
    If overlap_ratio > 0, occluder is drawn overlapping exact fraction of target bounding box.
    """
    scenario_key = scenario.lower().strip()
    if scenario_key not in SCENARIO_CONFIGS:
        raise ValueError(f"Unknown scenario: {scenario}. Expected s1, s2, or s3.")

    if not os.path.exists(baseline_path):
        raise FileNotFoundError(f"Baseline frame not found: {baseline_path}")

    img = Image.open(baseline_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    cfg = SCENARIO_CONFIGS[scenario_key]
    tx = cfg["target_bbox"]["x"]
    ty = cfg["target_bbox"]["y"]
    tw = cfg["target_bbox"]["width"]
    th = cfg["target_bbox"]["height"]

    r = max(0.0, min(1.0, float(overlap_ratio)))

    if scenario_key == "s1":
        # S1: Canvas chart tooltip
        occ_color = cfg["occluder_color"]
        outline_col = cfg["outline_color"]

        if r <= 0.0:
            # Clean patch (e.g. tooltipX = 660) -> shifted left of target [820..1040]
            draw.rectangle([660, 230, 800, 290], fill=occ_color, outline=outline_col)
        else:
            # Overlapping tooltip (from left edge tx)
            cov_w = int(round(tw * r))
            # Tooltip card body outside target
            draw.rectangle([tx - 120, ty - 6, tx - 1, ty + th + 6], fill=occ_color, outline=outline_col)
            # Overlap inside target
            if cov_w > 0:
                draw.rectangle([tx, ty, tx + cov_w - 1, ty + th - 1], fill=occ_color)

    elif scenario_key == "s2":
        # S2: Mobile bottom sheet
        occ_color = cfg["occluder_color"]
        dev_x = cfg["dev_x"]
        dev_y = cfg["dev_y"]
        dev_w = cfg["dev_w"]
        dev_h = cfg["dev_h"]

        if r <= 0.0:
            # Clean patch (e.g. snapPoint = 50%) -> sheet stays strictly below button (y >= 662)
            draw.rectangle([dev_x + 8, ty + th + 3, dev_x + dev_w - 8, dev_y + dev_h - 8], fill=occ_color)
            # Drawer handle
            draw.rounded_rectangle(
                [dev_x + dev_w // 2 - 25, ty + th + 8, dev_x + dev_w // 2 + 25, ty + th + 12],
                radius=2,
                fill=cfg["handle_color"],
            )
        else:
            total_target_px = tw * th
            desired_cov_px = int(round(total_target_px * r))
            full_rows = desired_cov_px // tw
            extra_px = desired_cov_px % tw

            # Sheet below button
            draw.rectangle([dev_x + 8, ty + th, dev_x + dev_w - 8, dev_y + dev_h - 8], fill=occ_color)
            # Exact button overlap from bottom edge
            if full_rows > 0:
                draw.rectangle([tx, ty + th - full_rows, tx + tw - 1, ty + th - 1], fill=occ_color)
            if extra_px > 0:
                draw.rectangle([tx, ty + th - full_rows - 1, tx + extra_px - 1, ty + th - full_rows - 1], fill=occ_color)

    elif scenario_key == "s3":
        # S3: Sticky cart drawer footer
        occ_color = cfg["occluder_color"]

        if r <= 0.0:
            # Clean patch (e.g. height: 110px; margin-top: 0px) -> footer below y=650
            draw.rectangle([880, ty + th, WIDTH, HEIGHT], fill=occ_color)
        else:
            total_target_px = tw * th
            desired_cov_px = int(round(total_target_px * r))
            full_rows = desired_cov_px // tw
            extra_px = desired_cov_px % tw

            # Footer below target
            draw.rectangle([880, ty + th, WIDTH, HEIGHT], fill=occ_color)
            # Exact button overlap from bottom edge
            if full_rows > 0:
                draw.rectangle([tx, ty + th - full_rows, tx + tw - 1, ty + th - 1], fill=occ_color)
            if extra_px > 0:
                draw.rectangle([tx, ty + th - full_rows - 1, tx + extra_px - 1, ty + th - full_rows - 1], fill=occ_color)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    img.save(output_path, "PNG")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Render patched scene frame for Spectra closed-loop verification")
    parser.add_argument("--scenario", required=True, choices=["s1", "s2", "s3"], help="Scenario ID (s1, s2, s3)")
    parser.add_argument("--baseline", required=True, help="Path to baseline t0 frame PNG")
    parser.add_argument("--overlap-ratio", type=float, default=0.0, help="Remaining overlap ratio (0.0 to 1.0)")
    parser.add_argument("--patch", default="", help="Optional patch text or description")
    parser.add_argument("--output", required=True, help="Output PNG path")

    args = parser.parse_args()
    out = render_patched_scene(
        scenario=args.scenario,
        baseline_path=args.baseline,
        overlap_ratio=args.overlap_ratio,
        output_path=args.output,
        patch=args.patch,
    )
    print(f"Patched scene rendered to {out}")


if __name__ == "__main__":
    main()
