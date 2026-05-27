# ZAP benchmark suite

Canonical end-to-end performance harness for the ZAP Rust SDK. Runs the
three classic Cap'n-Proto-derived test cases — **carsales** (random
struct trees with sums), **catrank** (search-result re-ranking), **eval**
(arithmetic expression evaluator) — across:

- modes: `object` (in-memory), `bytes` (sliced buffer), `pipe` (stdin/stdout child)
- compression: `none`, `packed`
- scratch: `reuse` (carsales only), `no-reuse`

## Quick start

```bash
git clone https://github.com/zap-proto/rust
cd rust
bash ./benchmark/bench.sh quick      # ~10 sec sanity
bash ./benchmark/bench.sh default    # ~15 sec — original ZAP iters
bash ./benchmark/bench.sh full       # ~3 min  — 10× iters
```

Each run writes one JSON file `bench-results/$(hostname)-$(timestamp).json`
plus prints a summary table. Schema documented below.

## Parallel saturation

`saturate.sh` runs N worker copies of the encoder workload in parallel
and reports REAL parallel efficiency by comparing against a recorded
single-worker baseline.

```bash
# step 1 — record single-worker baseline
PRESET=full bash ./benchmark/saturate.sh baseline
#   single-baseline: 6.003s for 2,000,000 iters = 333,183 ops/s

# step 2 — saturate with N=ncpu workers (default), compute real speedup
PRESET=full bash ./benchmark/saturate.sh
#   per-worker p50    : 10.991s (181,963 ops/s under contention)
#   aggregate ops/s   : 1,745,201
#   baseline (single) : 6.003s (333,183 ops/s/core)
#   REAL speedup      : 5.24× (= single × N / wall)
#   effective cores   : 5.24 of 10
#   parallel efficiency: 52%

# step 3 — see CPU was actually busy
tail bench-results/saturate-ra-*/cpu.log
#   t+04s  total= 406.5%  procs=23  hottest= 43.8%
#   t+06s  total= 473.4%  procs=23  hottest= 51.1%
#   t+08s  total= 556.8%  procs=23  hottest= 69.2%
#   t+10s  total= 529.1%  procs=23  hottest= 53.4%
```

What to look for:

- **Real speedup < N**: normal. On M-class Macs you'll see 4-6× speedup
  on 10 cores due to macOS QoS scheduling (subprocesses get throttled
  to efficiency cores) and system allocator contention.
- **CPU sampler total ≈ 100 × speedup**: the math should match. If `ps`
  says 500% and speedup is 5×, that's coherent.

Skip `pipe` mode for saturation: pipe mode forks a child per RPC, so
under N workers you spawn N × iters_count children, and the bottleneck
is the OS fork rate, not the encoder. The encoder workload is
`eval bytes none` — pure marshal + unmarshal, no process boundaries.

## Output schema

```json
{
  "schema_version": 1,
  "host": {"hostname":"...","os":"linux","arch":"x86_64"},
  "toolchain": {"rustc":"rustc 1.95.0 ..."},
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

The intent is multi-machine comparison:

1. Pull this repo on each machine
2. `bash ./benchmark/bench.sh default`
3. Open a PR adding the resulting `bench-results/*.json` to this
   directory

The schema is stable; downstream tools (and [zap-proto.dev/docs/benchmarks](https://zap-proto.dev/docs/benchmarks))
aggregate any future submission by reading the `runs` array.

## What each case stresses

**carsales** — large, deeply-nested message tree. Tests encoding
bandwidth and allocation cost. Stress allocators.

**catrank** — moderate-size strings + ranking arithmetic on read.
Tests zero-copy access vs. copy-decode.

**eval** — small, recursive structure. Tests per-message overhead and
dispatch.

The three together give a fair picture of where the encoder spends its
budget on your hardware.

## Background

The carsales / catrank / eval workload set is the de-facto benchmark
shape across ZAP, Protobuf, and FlatBuffers ports — what's run
here in the Rust SDK is the same shape, ported to ZAP's encoder.
Numbers should be comparable across language ports of the same suite
(see [zap-proto/cpp-core/c++/src/benchmark](https://github.com/zap-proto/cpp-core),
[zap-proto/java/benchmark](https://github.com/zap-proto/java),
[zap-proto/py/benchmark](https://github.com/zap-proto/py)).
