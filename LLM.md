# zap (Rust) — canonical ZAP implementation

The reference ZAP impl in Rust (Cap'n-Proto lineage, fully rebranded — no `capnp`
names). Cargo workspace; full docs in README.md.

Crates:
- `zap` — runtime: zero-copy messages + serialization.
- `zapc` — the `.zap` schema compiler (codegen; published to npm as `@zap-proto/zapc`).
- `zap-rpc`, `zap-futures` — RPC + async; `async-byte-channel` — transport util.

Build: `cargo build --release`. The `@zap-proto/zapc` npm wrapper downloads the
prebuilt compiler binary for `npx` use.
