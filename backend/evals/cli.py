"""CLI for AI Tutor eval pipeline (ArkSim-style simulate-evaluate)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from evals.config import EvalPipelineConfig
from evals.pipeline import run_simulate_evaluate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="AI Tutor eval pipeline (simulate → evaluate → report)")
    sub = parser.add_subparsers(dest="command")

    run_p = sub.add_parser("simulate-evaluate", help="Run full simulate → evaluate → report pipeline")
    run_p.add_argument("--config", type=str, default=None, help="Path to eval_config.yaml")
    run_p.add_argument("--output-dir", type=str, default=None, help="Output directory for artifacts")
    run_p.add_argument("--smoke", action="store_true", help="Smoke mode: 2 scenarios, 4 turns max")
    run_p.add_argument("--scenario", action="append", dest="scenarios", help="Limit to scenario_id (repeatable)")

    args = parser.parse_args(argv)
    if args.command != "simulate-evaluate":
        parser.print_help()
        return 2

    config = EvalPipelineConfig.from_yaml(args.config) if args.config else EvalPipelineConfig.from_yaml()
    result = run_simulate_evaluate(
        config,
        output_dir=args.output_dir,
        scenario_ids=args.scenarios,
        smoke=args.smoke,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\nReport: {result['artifacts'].get('report', 'n/a')}", file=sys.stderr)
    return 0 if result["thresholds"]["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
