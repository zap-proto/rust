# ZAP for Rust

> **Docs:** [Rust SDK](https://zap-proto.dev/docs/sdks/rust) · [Schema language](https://zap-proto.dev/docs/schema) · [Code generation](https://zap-proto.dev/docs/codegen) — part of the [ZAP Protocol](https://github.com/zap-proto)

The Rust implementation of **ZAP** (Zero-copy Application Protocol): a Cargo
workspace providing the zero-copy message runtime, the Rust code-generation
backend, and a Level-1 capability RPC stack.

## Introduction

ZAP describes data and service interfaces in a whitespace-significant schema
file. There are no braces and no required byte-offsets — blocks are delimited by
indentation (the offside rule), and field ordinals are assigned automatically in
declaration order. A `point.zap` schema:

```zap
struct Point
  x Float32
  y Float32

interface PointTracker
  addPoint (p Point) -> (totalPoints UInt64)
```

The canonical `zap` schema compiler parses this and drives a language backend to
generate code. The legacy brace form (`x @0 :Float32;`) still parses for
backward compatibility, but the indentation form above is the surface ZAP
teaches.

In Rust, the generated code for the example above includes a `point::Reader<'a>`
with `get_x()` / `get_y()` and a `point::Builder<'a>` with `set_x()` / `set_y()`.
The lifetime `'a` records that a reader/builder borrows the raw buffer holding
the encoded message — that buffer is never copied into a separate structure. The
encoding doubles as the in-memory representation, so traversal is zero-copy: you
read a field straight out of the bytes.

The generated code also includes a `point_tracker::Server` trait with an
`add_point()` method and a `point_tracker::Client` with `add_point_request()` —
implement the former to expose a network object, use the latter to call a
possibly-remote `PointTracker`.

## Install

The schema compiler and the Rust runtime are obtained separately.

**Schema compiler** — the one-shot CLI that turns a `.zap` file into Rust:

```sh
cargo install zap-schema     # provides the `zap-schema` binary
```

The `zap-schema` crate bundles the canonical schema front-end (the same parser
used by every other language plugin, built from
[`zap-proto/cpp-core`](https://github.com/zap-proto/cpp-core)) together with the
Rust backend, so no external C++ toolchain is required at build time.

The npm wrapper [`@zap-proto/zapc`](https://www.npmjs.com/package/@zap-proto/zapc)
exposes the same Rust backend as a code-generation plugin for projects already
on a Node toolchain; it downloads a prebuilt, checksum-verified binary on
install.

**Runtime** — add the workspace crates you need to `Cargo.toml`:

```toml
[dependencies]
zap = { git = "https://github.com/zap-proto/rust" }       # zero-copy messages
zapc = { git = "https://github.com/zap-proto/rust" }       # build.rs codegen hook
zap-rpc = { git = "https://github.com/zap-proto/rust" }    # capability RPC
zap-futures = { git = "https://github.com/zap-proto/rust" } # async read/write
```

To generate code as part of a `cargo` build, call `zapc` from `build.rs`:

```rust
fn main() {
    zapc::CompilerCommand::new()
        .file("schema/point.zap")
        .run()
        .expect("zap schema compile");
}
```

`zapc::CompilerCommand` execs the canonical `zap` schema front-end and feeds its
code-generator request to the Rust backend — the whitespace grammar (and its
brace back-compat) is handled entirely by that front-end, so there is exactly
one schema parser across the whole stack.

## Crates

| Crate | Role |
| --- | --- |
| [`zap`](/zap) | Runtime library for building and reading ZAP messages. |
| [`zapc`](/zapc) | Rust code-generation backend; `build.rs` integration. Published to npm as `@zap-proto/zapc`. |
| [`zap-futures`](/zap-futures) | Asynchronous reading and writing of ZAP messages. |
| [`zap-rpc`](/zap-rpc) | Object-capability RPC system with Level-1 features (promise pipelining). |

## Features

- Tagged unions, generics, and forward-compatible protocol evolution
- Canonicalization for deterministic, signable encodings
- `Result`-based error handling — invalid pointers surface as errors, never UB
- `no_std` and no-alloc support
- Run-time reflection

## Examples

- [addressbook serialization](/example/addressbook)
- [RPC examples](/zap-rpc/examples) — hello-world, calculator, pubsub, streaming, reconnect

## Building

```sh
cargo build --release
```

The library crates (`zap`, `zapc`, `zap-rpc`, `zap-futures`) build with no
external tooling. The example, test, and benchmark crates additionally need the
`zap` schema front-end on `PATH` at build time; CI provisions it by building
`zap_tool` from [`zap-proto/cpp-core`](https://github.com/zap-proto/cpp-core)
(see `.github/actions/install-zap`).

## License

MIT
