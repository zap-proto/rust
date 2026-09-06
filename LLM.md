# zap (Rust) — ZAP runtime + schema codegen

The Rust ZAP implementation: a Cargo workspace providing the zero-copy runtime,
the `.zap` codegen backend, and a full Level-1 RPC stack. Brand-neutral ZAP —
no `capnp` names. Full docs in README.md.

Crates:
- `zap` — runtime: zero-copy messages + serialization.
- `zapc` — `.zap` codegen, published to npm as `@zap-proto/zapc`.
- `zap-rpc`, `zap-futures` — RPC + async; `async-byte-channel` — transport util.

Build: `cargo build --release`. The library crates (`zap`, `zapc`, `zap-rpc`,
`zap-futures`) build with no external tooling. The example/test/benchmark crates
additionally need the `zap` schema front-end at build time (see below).

## Schema front-end (the `zap` binary)

`zapc::CompilerCommand` does NOT parse `.zap` text. It execs the canonical `zap`
schema front-end (`zap compile -o -`, built from `zap-proto/cpp-core`), which
parses the schema and emits a binary code-generator request on stdout; the
`zapc-rust` backend (`CodeGenerationCommand::run(stdin)`) consumes that request
and emits Rust. So all text-level grammar — including **whitespace-significant
syntax** (offside-rule blocks, optional `@N` with auto-offset) and its
byte-identical brace back-compat — is handled by the front-end's
`compiler/desugar.{h,c++}` and **inherited here transparently**. There is, by
design, no second `.zap` parser in this repo: one way to do everything.

CI provisions the front-end by building `zap_tool` from `zap-proto/cpp-core`
(`.github/actions/install-zap`) — there is no `zap` apt package. The
`@zap-proto/zapc` npm wrapper downloads the prebuilt `zapc` binary for `npx` use
and verifies its published `.sha256` before exec (`npm/install.js`).

## The wire this runtime speaks

Two wire formats ship under the ZAP name, and this runtime implements one of
them. Anything reading or writing frames alongside `zap-proto/go` needs to know
which.

- **This runtime, `zap-proto/cpp-core`, and `spec/schema/zap.zap`'s dialect** —
  a segment table, then 8-byte words addressed by tagged pointers.
- **`zap-proto/go` and `zap-proto/cpp`** — a 16-byte header (magic `ZAP\0`,
  version, flags, root offset, size), then a data segment whose fields sit at
  byte offsets.

They do not interoperate in either direction, and the failure is legible: a Go
frame's leading magic reads here as a segment count of 5259611, because
`0x0050415A` is `ZAP\0` little-endian. `zap/tests/go_frame_conformance.rs` holds
four real frames from the Lux chain differential corpus and keeps that measured.

This is why the three Rust chains in `luxfi/node2` carry their own
`zap.rs` rather than depending on this crate: they exchange frames with Go and
C++ peers, so they need the other format. Which of the two is canonical is an
open question, not something either side should be adapted into.

## Reads are zero-copy

A reader is a lifetime-parameterised view borrowing the buffer, never an owned
struct built by copying fields out. `zap/tests/reads_are_zero_copy.rs` measures
it: zero allocations across 30,000 field reads, and the bytes a field hands back
point inside the original buffer.
