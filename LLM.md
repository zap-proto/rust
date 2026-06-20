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
