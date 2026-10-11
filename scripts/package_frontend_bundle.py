#!/usr/bin/env python3
"""
AWS Amplify Frontend Packaging & Verification Script.

Creates a zip archive from the contents of 'street-map 5/dist' such that index.html
resides directly at the root of the ZIP archive for AWS Amplify manual deployment.
"""

import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT / "street-map 5" / "dist"
DEPLOY_DIR = ROOT / "deploy"
OUTPUT_ZIP = DEPLOY_DIR / "amplify-frontend-deployment.zip"

FORBIDDEN_FILES = {".DS_Store", "Thumbs.db"}


def package_frontend():
    print(f"Packaging frontend from: {DIST_DIR}")
    print(f"Output archive:           {OUTPUT_ZIP}")

    if not (DIST_DIR / "index.html").is_file():
        print("ERROR: street-map 5/dist/index.html not found. Run 'npm run build' first.", file=sys.stderr)
        sys.exit(1)

    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)

    file_count = 0
    total_uncompressed = 0
    total_compressed = 0

    with zipfile.ZipFile(OUTPUT_ZIP, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for file_path in sorted(DIST_DIR.rglob("*")):
            if file_path.is_dir():
                continue
            if file_path.name in FORBIDDEN_FILES:
                continue

            rel_path = file_path.relative_to(DIST_DIR).as_posix()
            zinfo = zipfile.ZipInfo.from_file(file_path, arcname=rel_path)
            zinfo.compress_type = zipfile.ZIP_DEFLATED
            zinfo.external_attr = 0o644 << 16

            with open(file_path, "rb") as f:
                content = f.read()
                zf.writestr(zinfo, content)

            file_count += 1
            total_uncompressed += file_path.stat().st_size
            total_compressed += zinfo.compress_size

    zip_size_bytes = OUTPUT_ZIP.stat().st_size
    print(f"Created archive successfully:")
    print(f"  Files: {file_count}")
    print(f"  Total uncompressed size: {total_uncompressed / 1024:.2f} KB ({total_uncompressed / (1024*1024):.2f} MB)")
    print(f"  Total ZIP size:          {zip_size_bytes / 1024:.2f} KB ({zip_size_bytes / (1024*1024):.2f} MB)")


def verify_frontend_zip():
    print("\n--- Verifying Frontend ZIP Archive ---")
    with zipfile.ZipFile(OUTPUT_ZIP, "r") as zf:
        names = zf.namelist()
        print(f"Total entries in ZIP: {len(names)}")

        # 1. Check index.html is at root
        assert "index.html" in names, "ERROR: index.html is not at root of ZIP!"
        assert not any(n.startswith("dist/") for n in names), "ERROR: ZIP contains nested dist/ folder!"
        print(" [PASS] index.html confirmed at ZIP root (no nested dist/ directory).")

        # 2. Check assets folder
        js_assets = [n for n in names if n.startswith("assets/") and n.endswith(".js")]
        css_assets = [n for n in names if n.startswith("assets/") and n.endswith(".css")]
        assert len(js_assets) >= 1, "ERROR: No JS assets found!"
        assert len(css_assets) >= 1, "ERROR: No CSS assets found!"
        print(f" [PASS] Assets confirmed: JS={js_assets}, CSS={css_assets}")

        # 3. Check data assets
        presets = [n for n in names if n == "data/scada_presets.json"]
        assert len(presets) == 1, "ERROR: data/scada_presets.json missing from ZIP!"
        print(" [PASS] data/scada_presets.json confirmed present.")

        # 4. Check for forbidden files
        for n in names:
            assert ".DS_Store" not in n, f"Forbidden file found: {n}"
        print(" [PASS] Zero forbidden files or caches.")

        # Print full manifest
        print("\nZIP Manifest:")
        print(f"{'Filename':<45} {'Size (bytes)':<15}")
        print("-" * 60)
        for info in zf.infolist():
            print(f"{info.filename:<45} {info.file_size:<15}")


if __name__ == "__main__":
    package_frontend()
    verify_frontend_zip()
