# ZAP for Rust

> **Docs:** [ZAP Rust SDK](https://zap-proto.dev/docs/sdks/rust) · part of the [ZAP Protocol](https://zap-proto.io); also: [Native ZAP RPC](https://zap-proto.dev/docs/protocols/native)


[![Build Status](https://github.com/zap/zap-rust/workflows/CI/badge.svg?branch=master&event=push)](https://github.com/zap/zap-rust/actions?query=workflow%3ACI)

[documentation](https://docs.rs/zap/)

For the latest news,
see the [zap-rust blog](https://dwrensha.github.io/zap-rust).

## Introduction

[ZAP](https://zap.org) is a type system for distributed systems.

With ZAP, you describe your data and interfaces
in a [schema file](https://zap.org/language.html), like this:

```zap
@0x986b3393db1396c9;

struct Point {
    x @0 :Float32;
    y @1 :Float32;
}

interface PointTracker {
    addPoint @0 (p :Point) -> (totalPoints :UInt64);
}
```

You can then use the [zap tool](https://zap.org/zap-tool.html#compiling-schemas)
to generate code in a [variety of programming languages](https://zap.org/otherlang.html).
The generated code lets you produce and consume values of the
types you've defined in your schema.

Values are encoded in [a format](https://zap.org/encoding.html) that
is suitable not only for transmission over a network and persistence to disk,
but also for zero-copy in-memory traversal.
That is, you can completely skip serialization and deserialization!
It's in this sense that ZAP is
["infinity times faster"](https://zap.org/news/2013-04-01-announcing-capn-proto.html)
than alternatives like Protocol Buffers.

In Rust, the generated code for the example above includes
a `point::Reader<'a>` struct with `get_x()` and `get_y()` methods,
and a `point::Builder<'a>` struct with `set_x()` and `set_y()` methods.
The lifetime parameter `'a` is a formal reminder
that `point::Reader<'a>` and `point::Builder<'a>`
contain borrowed references to the raw buffers that contain the encoded messages.
Those underlying buffers are never actually copied into separate data structures.

The generated code for the example above also includes
a `point_tracker::Server` trait with an `add_point()` method,
and a `point_tracker::Client` struct with an `add_point_request()` method.
The former can be implemented to create a network-accessible object,
and the latter can be used to invoke a possibly-remote instance of a `PointTracker`.

## Features

- [tagged unions](https://zap.org/language.html#unions)
- [generics](https://zap.org/language.html#generic-types)
- [protocol evolvability](https://zap.org/language.html#evolving-your-protocol)
- [canonicalization](https://zap.org/encoding.html#canonicalization)
- [`Result`-based error handling](https://dwrensha.github.io/zap-rust/2015/03/21/error-handling-revisited.html)
- [`no_std` support](https://dwrensha.github.io/zap-rust/2020/06/06/no-std-support.html)
- [no-alloc support](https://dwrensha.github.io/zap-rust/2023/09/04/0.18-release.html)
- [reflection](https://dwrensha.github.io/zap-rust/2023/05/08/run-time-reflection.html)

## Crates

|  |  |  |
| ----- | ---- | ---- |
| [zap](/zap) | Runtime library for dealing with ZAP messages. | [![crates.io](https://img.shields.io/crates/v/zap.svg)](https://crates.io/crates/zap) |
| [zapc](/zapc) | Rust code generator [plugin](https://zap.org/otherlang.html#how-to-write-compiler-plugins), including support for hooking into a `build.rs` file in a `cargo` build. | [![crates.io](https://img.shields.io/crates/v/zapc.svg)](https://crates.io/crates/zapc) |
| [zap-futures](/zap-futures) | Support for asynchronous reading and writing of ZAP messages. | [![crates.io](https://img.shields.io/crates/v/zap-futures.svg)](https://crates.io/crates/zap-futures) |
| [zap-rpc](/zap-rpc) | Object-capability remote procedure call system with ["level 1"](https://zap.org/rpc.html#protocol-features) features. | [![crates.io](https://img.shields.io/crates/v/zap-rpc.svg)](https://crates.io/crates/zap-rpc) |

## Examples

[addressbook serialization](/example/addressbook),
[RPC](/zap-rpc/examples)

## Who is using zap-rust?

- Sandstorm's [raw API example app](https://github.com/dwrensha/sandstorm-rawapi-example-rust) and
  [collections app](https://github.com/sandstorm-io/collections-app)
- [juice](https://github.com/spearow/juice)
- [combustion-engine](https://github.com/combustion-engine/combustion/tree/master/combustion_protocols)

## Unimplemented / Future Work

- [orphans](https://zap.org/cxx.html#orphans)