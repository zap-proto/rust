#!/usr/bin/env bash
# saturate.sh — run N parallel encoder-heavy benchmark instances.
#
#   bash ./benchmark/saturate.sh                  # N = ncpu, encoder-only
#   bash ./benchmark/saturate.sh 16               # explicit N
#   PRESET=full bash ./benchmark/saturate.sh      # quick | default | full
#   MODES=all bash ./benchmark/saturate.sh        # include pipe mode (slow, fork-heavy)
#
# Default is `encoder-only`: drops pipe-mode runs (which fork-and-exec
# a child per RPC and bottleneck on the OS scheduler rather than the
# encoder). The encoder-only workload is what actually saturates cores.
#
# Writes one JSON per worker, then aggregates and reports per-CPU
# busy-loop saturation.

set -euo pipefail

cd "$(dirname "$0")/.."

N="${1:-$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)}"
PRESET="${PRESET:-quick}"
MODES="${MODES:-encoder-only}"

echo "▸ building release binaries..." >&2
cargo build -p benchmark --release --bin benchmark --bin run_json 2>&1 | tail -2 >&2

mkdir -p bench-results
HOST=$(hostname | tr '/ ' '__')
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
WORKER_DIR="bench-results/saturate-${HOST}-${STAMP}"
mkdir -p "$WORKER_DIR"

case "$PRESET" in
  quick)   ITERS=(500 50 10000) ;;
  default) ITERS=(10000 1000 200000) ;;
  full)    ITERS=(100000 10000 2000000) ;;
  *)       echo "unknown PRESET: $PRESET" >&2 ; exit 1 ;;
esac

# `bash ./benchmark/saturate.sh baseline` records a single-worker time
# the aggregator can use to compute real parallel speedup.
if [ "$N" = "baseline" ]; then
  echo "▸ recording single-worker baseline for eval bytes none, ${ITERS[2]} iters" >&2
  mkdir -p bench-results
  cargo build -p benchmark --release --bin benchmark 2>&1 | tail -1 >&2
  START=$(python3 -c "import time;print(time.time())")
  ./target/release/benchmark eval bytes no-reuse none "${ITERS[2]}" >/dev/null 2>&1
  END=$(python3 -c "import time;print(time.time())")
  ELAPSED=$(python3 -c "print(f'{$END - $START:.6f}')")
  OUT="bench-results/single-baseline-${ITERS[2]}.json"
  python3 -c "
import json
d = {'iters': ${ITERS[2]}, 'elapsed_secs': float('$ELAPSED'),
     'throughput_ops_per_sec': ${ITERS[2]} / float('$ELAPSED')}
json.dump(d, open('$OUT','w'), indent=2)
print(f'single-baseline: {d[\"elapsed_secs\"]:.3f}s for {d[\"iters\"]:,} iters'
      f' = {d[\"throughput_ops_per_sec\"]:,.0f} ops/s')
"
  echo "✓ wrote ${OUT}" >&2
  exit 0
fi

# Build the command per worker. For encoder-only, run a focused
# benchmark child that exercises bytes mode only (in-memory marshal +
# unmarshal, no fork, no pipe).
WORKER_CMD=()
if [ "$MODES" = "encoder-only" ]; then
  WORKER_CMD=(./target/release/benchmark eval bytes no-reuse none "${ITERS[2]}")
  WORKLOAD_NAME="eval bytes none ${ITERS[2]} iters"
else
  WORKER_CMD=(./target/release/run_json ./target/release/benchmark "${ITERS[0]}" "${ITERS[1]}" "${ITERS[2]}")
  WORKLOAD_NAME="full matrix (carsales+catrank+eval × object/bytes/pipe × none/packed)"
fi

echo "▸ workers   : ${N}" >&2
echo "▸ preset    : ${PRESET} → iters=${ITERS[*]}" >&2
echo "▸ workload  : ${WORKLOAD_NAME}" >&2
echo "▸ output    : ${WORKER_DIR}/worker-*.json + cpu.log" >&2

# CPU sampler — top samples every 2 sec, captures aggregate %CPU of
# our benchmark children. Lightweight, no fancy parsing.
CPU_LOG="${WORKER_DIR}/cpu.log"
(
  echo "# elapsed  total_bench_cpu%  one_active_bench_pid_cpu%  top_proc_list"
  ITER=0
  while true; do
    ITER=$((ITER+1))
    # Sum CPU% across all benchmark children
    TOTAL=$(ps -A -o %cpu,command 2>/dev/null | awk '/[b]enchmark|[r]un_json/ {s+=$1} END {printf "%.1f", s}')
    # One representative worker CPU% (highest)
    ONE=$(ps -A -o %cpu,command 2>/dev/null | awk '/[b]enchmark|[r]un_json/ {print $1}' | sort -nr | head -1)
    # Count of benchmark processes alive
    COUNT=$(pgrep -f "[b]enchmark|[r]un_json" 2>/dev/null | wc -l | tr -d ' ')
    printf "t+%02ds  total=%6.1f%%  procs=%2s  hottest=%5s%%\n" $((ITER*2)) "$TOTAL" "$COUNT" "$ONE"
    sleep 2
  done
) > "$CPU_LOG" 2>&1 &
SAMPLER_PID=$!

WALL_START=$(python3 -c "import time;print(time.time())")

PIDS=()
for i in $(seq 1 "$N"); do
  (
    if [ "$MODES" = "encoder-only" ]; then
      # In encoder-only we just want wall time per worker
      START=$(python3 -c "import time;print(time.time())")
      "${WORKER_CMD[@]}" >/dev/null 2>&1
      END=$(python3 -c "import time;print(time.time())")
      ELAPSED=$(python3 -c "print(f'{$END - $START:.6f}')")
      echo "{\"worker\":$i,\"workload\":\"eval bytes none\",\"iters\":${ITERS[2]},\"elapsed_secs\":$ELAPSED,\"throughput_ops_per_sec\":$(python3 -c "print(f'{${ITERS[2]} / float($ELAPSED):.1f}')") }" > "${WORKER_DIR}/worker-${i}.json"
    else
      "${WORKER_CMD[@]}" > "${WORKER_DIR}/worker-${i}.json" 2>/dev/null
    fi
  ) &
  PIDS+=($!)
done

FAIL=0
for pid in "${PIDS[@]}"; do
  if ! wait "$pid"; then FAIL=$((FAIL+1)); fi
done

WALL_END=$(python3 -c "import time;print(time.time())")
WALL=$(python3 -c "print(f'{$WALL_END - $WALL_START:.2f}')")

kill $SAMPLER_PID 2>/dev/null || true
wait $SAMPLER_PID 2>/dev/null || true

echo >&2
echo "▸ wall: ${WALL}s with ${N} workers, ${FAIL} failed" >&2

# Aggregate
python3 - "$WORKER_DIR" "$N" "$WALL" "$MODES" "${ITERS[@]}" <<'PY'
import glob, json, sys, statistics

worker_dir, n_workers, wall, modes, *iters = sys.argv[1:]
n_workers, wall = int(n_workers), float(wall)
iters = list(map(int, iters))

workers = sorted(glob.glob(f"{worker_dir}/worker-*.json"))
docs = []
for w in workers:
    try:
        docs.append(json.load(open(w)))
    except Exception as e:
        print(f"  ✘ {w}: {e}")
        continue

if not docs:
    sys.exit("no workers completed")

if modes == "encoder-only":
    elapsed = [d["elapsed_secs"] for d in docs]
    tput_par = [d["throughput_ops_per_sec"] for d in docs]
    iters_pw = iters[2]
    total_ops = iters_pw * len(docs)
    total_ops_per_sec = total_ops / wall

    # REAL parallel efficiency needs single-worker baseline.
    import pathlib
    bl_path = pathlib.Path(worker_dir).parent / f"single-baseline-{iters_pw}.json"
    single_baseline = None
    if bl_path.exists():
        try:
            single_baseline = json.load(open(bl_path))
        except Exception:
            single_baseline = None

    print()
    print(f"workload          : eval bytes none, {iters_pw:,} iters/worker")
    print(f"workers           : {n_workers}")
    print(f"wall time         : {wall:.2f}s")
    print(f"per-worker p50    : {statistics.median(elapsed):.3f}s ({statistics.median(tput_par):,.0f} ops/s under contention)")
    print(f"per-worker p05    : {min(elapsed):.3f}s")
    print(f"per-worker p95    : {max(elapsed):.3f}s")
    print(f"total work        : {total_ops:,} encoder ops")
    print(f"aggregate ops/s   : {total_ops_per_sec:,.0f}")

    if single_baseline:
        single_secs = single_baseline["elapsed_secs"]
        speedup = (single_secs * n_workers) / wall
        eff = speedup / n_workers
        print()
        print(f"baseline (single) : {single_secs:.3f}s  →  {iters_pw/single_secs:,.0f} ops/s/core")
        print(f"REAL speedup      : {speedup:.2f}× (= single × N / wall)")
        print(f"effective cores   : {speedup:.2f} of {n_workers}")
        print(f"parallel efficiency: {eff*100:.0f}%")
    else:
        print()
        print(f"(no single-baseline-{iters_pw}.json — re-run with 'baseline' preset")
        print(f" or symlink an existing baseline file to get a real speedup number)")
else:
    groups = {}
    for d in docs:
        for r in d["runs"]:
            key = (r["case"], r["mode"], r["scratch"], r["compression"])
            groups.setdefault(key, []).append(r)
    print()
    print(f"{'case':<10} {'mode':<8} {'scratch':<9} {'comp':<8} {'p50 s':>8} {'p95 s':>8} {'agg ops/s':>14}")
    print("-" * 72)
    for key in sorted(groups, key=lambda k:(k[0], {"object":0,"bytes":1,"pipe":2}.get(k[1],9), k[3], k[2])):
        runs = groups[key]
        case, mode, scratch, comp = key
        elapsed = [r["elapsed_secs"] for r in runs]
        tput = sum(r["throughput_ops_per_sec"] for r in runs)
        print(f"{case:<10} {mode:<8} {scratch:<9} {comp:<8} "
              f"{statistics.median(elapsed):>8.3f} {max(elapsed):>8.3f} {int(tput):>14,}")
PY

echo "" >&2
echo "✓ aggregate written; CPU samples in ${CPU_LOG}" >&2
echo "✓ tail -n 5 ${CPU_LOG} for a quick CPU peek" >&2
