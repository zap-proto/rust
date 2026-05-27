# ZAP benchmark suite

Canonical end-to-end performance harness for the ZAP Rust SDK. Runs the
three classic Cap'n-Proto-derived test cases — **carsales** (random
struct trees with sums), **catrank** (search-result re-ranking), **eval**
(arithmetic expression evaluator) — across:

- modes: `object` (in-memory), `bytes` (sliced buffer), `pipe` (stdin/stdout child)
- compression: `none`, `packed`
- scratch: `reuse` (carsales only), `no-reuse`

## Quick run (≈10 seconds on M-class hardware)

```bash
./benchmark/bench.sh quick
```

Builds release binaries, runs all 20 (case × mode × compression × scratch)
combinations with reduced iteration counts, writes a single JSON file
named `bench-results/$(hostname)-$(timestamp).json`, and prints a summary
table.

## Full run (≈minutes)

```bash
./benchmark/bench.sh default   # original Cap'n Proto iteration counts
./benchmark/bench.sh full      # 10× iterations — ~10 min on a laptop
```

Override individual iteration counts:

```bash
CARSALES_ITERS=50000 CATRANK_ITERS=5000 EVAL_ITERS=1000000 \
  ./benchmark/bench.sh default
```

## Output format

Each run produces one JSON file (`bench-results/${hostname}-${stamp}.json`):

```json
{
  "schema_version": 1,
  "host": {"hostname":"...","os":"...","arch":"..."},
  "toolchain": {"rustc":"..."},
  "iters": {"carsales":10000,"catrank":1000,"eval":200000},
  "runs": [
    {"case":"carsales","mode":"object","compression":"none",
     "scratch":"reuse","iters":10000,"elapsed_secs":0.42,
     "throughput_ops_per_sec":23809.5},
    ...
  ]
}
```

Twenty runs per file (5 carsales × 2 scratch + 5 catrank + 5 eval).

## Contributing results across hardware

The intent of `bench.sh` is to make multi-machine comparisons easy:

1. Pull this repo on each machine
2. `./benchmark/bench.sh default`
3. Open a PR adding the resulting `bench-results/*.json` to this directory

The schema is stable; downstream tools (and the documentation site at
[zap-proto.dev/docs/benchmarks](https://zap-proto.dev/docs/benchmarks))
can aggregate any future submission by reading the `runs` array.

## What each case stresses

**carsales** — large, deeply-nested message tree. Tests encoding bandwidth
and allocation cost. Stress allocators.

**catrank** — moderate-size strings + ranking arithmetic on read. Tests
zero-copy access vs. copy-decode.

**eval** — small, recursive structure. Tests per-message overhead and
dispatch.

The three together give a fair picture of where the encoder spends its
budget on your hardware.

## Background

The carsales / catrank / eval workload set is the de-facto benchmark
shape across Cap'n Proto, Protobuf, and FlatBuffers ports — what's run
here in the Rust SDK is the same shape, ported to ZAP's encoder.
Numbers should be comparable across language ports of the same suite
(see [zap-proto/cpp-core/c++/src/benchmark](https://github.com/zap-proto/cpp-core),
[zap-proto/java/benchmark](https://github.com/zap-proto/java),
[zap-proto/py/benchmark](https://github.com/zap-proto/py)).
