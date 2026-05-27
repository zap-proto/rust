#!/usr/bin/env bash
# bench.sh — turn-key ZAP benchmark runner.
#
# Builds the benchmark binary in release mode, runs the canonical
# carsales / catrank / eval workloads, and emits a single JSON file
# named after the host + timestamp for collection across hardware
# classes.
#
# USAGE:
#   ./benchmark/bench.sh                  # default iters
#   ./benchmark/bench.sh quick            # 1/20th iters — sanity check
#   ./benchmark/bench.sh full             # 10× iters — long run
#   CARSALES_ITERS=20000 ./benchmark/bench.sh   # override individually

set -euo pipefail

cd "$(dirname "$0")/.."

PRESET="${1:-default}"

case "$PRESET" in
  quick)
    : "${CARSALES_ITERS:=500}"
    : "${CATRANK_ITERS:=50}"
    : "${EVAL_ITERS:=10000}"
    ;;
  default)
    : "${CARSALES_ITERS:=10000}"
    : "${CATRANK_ITERS:=1000}"
    : "${EVAL_ITERS:=200000}"
    ;;
  full)
    : "${CARSALES_ITERS:=100000}"
    : "${CATRANK_ITERS:=10000}"
    : "${EVAL_ITERS:=2000000}"
    ;;
  *)
    echo "unknown preset: $PRESET (quick | default | full)" >&2
    exit 1
    ;;
esac

echo "▸ building release binaries..." >&2
cargo build -p benchmark --release --bin benchmark --bin run_json 2>&1 | tail -5 >&2

mkdir -p bench-results
HOST=$(hostname | tr '/ ' '__')
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="bench-results/${HOST}-${STAMP}.json"

echo "▸ running: carsales=${CARSALES_ITERS} catrank=${CATRANK_ITERS} eval=${EVAL_ITERS}" >&2
echo "▸ output:  ${OUT}" >&2

./target/release/run_json ./target/release/benchmark \
  "$CARSALES_ITERS" "$CATRANK_ITERS" "$EVAL_ITERS" > "$OUT"

echo >&2
echo "✓ wrote ${OUT} ($(wc -c < "$OUT" | tr -d ' ') bytes)" >&2

# Tiny summary table
python3 - <<PY
import json
d = json.load(open("$OUT"))
print()
print("=" * 80)
print(f"HOST    {d['host']['hostname']:<20} {d['host']['os']}/{d['host']['arch']}")
print(f"TOOL    {d['toolchain']['rustc']}")
print("=" * 80)
print(f"{'case':<10} {'mode':<8} {'scratch':<9} {'comp':<8} {'iters':>8} {'sec':>10} {'ops/s':>12}")
print("-" * 80)
for r in d['runs']:
    print(f"{r['case']:<10} {r['mode']:<8} {r['scratch']:<9} {r['compression']:<8} "
          f"{r['iters']:>8} {r['elapsed_secs']:>10.3f} {r['throughput_ops_per_sec']:>12,.0f}")
print("=" * 80)
PY
