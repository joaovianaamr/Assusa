#!/usr/bin/env python3
"""boundary_lint.py — Enforce Clean/Hexagonal layer boundaries in a backend tree.

Stdlib-only. Classifies each source file into a layer by path, parses its imports,
and flags any import that violates the dependency rule (arrows point inward) or that
pulls a framework into the domain layer. Exits non-zero on any violation so it can
gate a pre-commit hook or CI job.

Dependency rule (clean):
    domain          -> imports nothing from other layers, no framework
    application     -> may import domain
    infrastructure  -> may import domain, application
    interface       -> may import domain, application     (nobody may import interface)

Config: an .arch.json (see assets/sample.arch.json) maps layers to path markers and
declares the allowed imports + forbidden domain framework patterns. Defaults are
built in, so --config is optional.

Usage:
    python boundary_lint.py --root ./build
    python boundary_lint.py --root ./build --config assets/sample.arch.json
    python boundary_lint.py --root ./build --output json
"""

import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

SOURCE_EXTS = {".ts", ".tsx", ".js", ".py", ".java", ".go"}

DEFAULT_CONFIG: Dict[str, Any] = {
    "style": "clean",
    # canonical layer -> path segments that mean "this file is in that layer".
    # `interface` and `presentation` both map to the interface layer (keyword-safe alias).
    "layers": {
        "domain": {"markers": ["domain"], "may_import": []},
        "application": {"markers": ["application"], "may_import": ["domain"]},
        "infrastructure": {"markers": ["infrastructure"], "may_import": ["domain", "application"]},
        "interface": {"markers": ["interface", "presentation"], "may_import": ["domain", "application"]},
    },
    # if a domain file imports something matching one of these, it is a violation.
    "domain_forbidden_import_patterns": [
        "nestjs", "@nestjs", "express", "fastify", "typeorm", "prisma", "sequelize",
        "springframework", "jakarta.", "javax.", "hibernate",
        "fastapi", "django", "flask", "sqlalchemy", "pydantic",
        "gorm", "gin-gonic", "net/http", "database/sql",
    ],
}

# Import extractors per file extension -> list of raw import target strings.
_TS_IMPORT = re.compile(r"""(?:import\s[^'"]*from\s*|import\s*|require\s*\(\s*|export\s[^'"]*from\s*)['"]([^'"]+)['"]""")
_PY_FROM = re.compile(r"^\s*from\s+([\w.]+)\s+import\b", re.MULTILINE)
_PY_IMPORT = re.compile(r"^\s*import\s+([\w.]+)", re.MULTILINE)
_JAVA_IMPORT = re.compile(r"^\s*import\s+(?:static\s+)?([\w.]+)\s*;", re.MULTILINE)
_GO_SINGLE = re.compile(r'^\s*import\s+"([^"]+)"', re.MULTILINE)
_GO_BLOCK = re.compile(r"import\s*\((.*?)\)", re.DOTALL)
_GO_BLOCK_ITEM = re.compile(r'"([^"]+)"')


def extract_imports(path: str, text: str) -> List[str]:
    ext = os.path.splitext(path)[1]
    if ext in (".ts", ".tsx", ".js"):
        return _TS_IMPORT.findall(text)
    if ext == ".py":
        return _PY_FROM.findall(text) + _PY_IMPORT.findall(text)
    if ext == ".java":
        return _JAVA_IMPORT.findall(text)
    if ext == ".go":
        found: List[str] = list(_GO_SINGLE.findall(text))
        for block in _GO_BLOCK.findall(text):
            found.extend(_GO_BLOCK_ITEM.findall(block))
        return found
    return []


def _segment_regex(token: str) -> re.Pattern:
    # match token as a delimited segment inside an import path/package string.
    return re.compile(r"(^|[./\\_-])" + re.escape(token) + r"([./\\_'\"-]|$)")


def classify_layer(path: str, layers: Dict[str, Any]) -> Optional[str]:
    posix = path.replace("\\", "/")
    segments = posix.split("/")
    # walk from the layer markers; a file is in a layer if a path segment matches a marker.
    for layer, spec in layers.items():
        for marker in spec["markers"]:
            if marker in segments:
                return layer
    return None


def imported_layers(import_target: str, layers: Dict[str, Any]) -> List[str]:
    hits: List[str] = []
    for layer, spec in layers.items():
        for marker in spec["markers"]:
            if _segment_regex(marker).search(import_target):
                hits.append(layer)
                break
    return hits


def lint(root: str, config: Dict[str, Any]) -> Dict[str, Any]:
    layers = config["layers"]
    forbidden = config.get("domain_forbidden_import_patterns", [])
    violations: List[Dict[str, str]] = []
    files_scanned = 0

    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if os.path.splitext(fn)[1] not in SOURCE_EXTS:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root)
            layer = classify_layer(rel, layers)
            if layer is None:
                continue
            files_scanned += 1
            try:
                with open(full, "r", encoding="utf-8") as fh:
                    text = fh.read()
            except (IOError, OSError):
                continue
            may_import = set(layers[layer]["may_import"])
            for target in extract_imports(full, text):
                # 1) framework leaking into the domain
                if layer == "domain":
                    low = target.lower()
                    for pat in forbidden:
                        if pat.lower() in low:
                            violations.append({
                                "file": rel, "layer": layer, "import": target,
                                "rule": "domain_must_be_framework_free",
                                "detail": f"domain imports framework '{pat}'",
                            })
                            break
                # 2) dependency-direction rule between layers
                for other in imported_layers(target, layers):
                    if other == layer:
                        continue
                    if other not in may_import:
                        violations.append({
                            "file": rel, "layer": layer, "import": target,
                            "rule": "dependency_direction",
                            "detail": f"{layer} must not import {other} (arrows point inward)",
                        })
    return {
        "root": root,
        "files_scanned": files_scanned,
        "violations": violations,
        "passed": len(violations) == 0,
    }


def render_text(r: Dict[str, Any]) -> str:
    lines = []
    lines.append("=" * 72)
    lines.append("BOUNDARY LINT (Clean/Hexagonal)")
    lines.append(f"Root: {r['root']}   files scanned: {r['files_scanned']}")
    lines.append("=" * 72)
    if r["passed"]:
        lines.append("")
        lines.append("PASS — no layer-boundary violations.")
        return "\n".join(lines)
    lines.append("")
    lines.append(f"FAIL — {len(r['violations'])} violation(s):")
    lines.append("")
    for v in r["violations"]:
        lines.append(f"  [{v['rule']}] {v['file']}")
        lines.append(f"      layer={v['layer']}  import={v['import']}")
        lines.append(f"      {v['detail']}")
    return "\n".join(lines)


def load_config(path: Optional[str]) -> Dict[str, Any]:
    if not path:
        return DEFAULT_CONFIG
    with open(path, "r", encoding="utf-8") as f:
        user = json.load(f)
    # shallow merge onto defaults so a partial config still works.
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    cfg.update(user)
    return cfg


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Enforce Clean/Hexagonal layer boundaries; exit non-zero on violation.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--root", required=True, help="root directory of the backend source to audit")
    parser.add_argument("--config", help="path to .arch.json (optional; sensible defaults built in)")
    parser.add_argument("--style", default="clean", choices=["clean"], help="architecture contract")
    parser.add_argument("--output", choices=("text", "json"), default="text")
    args = parser.parse_args()

    if not os.path.isdir(args.root):
        print(f"error: not a directory: {args.root}", file=sys.stderr)
        return 2

    config = load_config(args.config)
    result = lint(args.root, config)
    if args.output == "json":
        print(json.dumps(result, indent=2))
    else:
        print(render_text(result))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
