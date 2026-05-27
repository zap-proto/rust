# zap-rpc/rust

[![crates.io](https://img.shields.io/crates/v/zap-rpc.svg)](https://crates.io/crates/zap-rpc)

[documentation](https://docs.rs/zap-rpc/)

This is a [level one](https://zap.org/rpc.html#protocol-features)
implementation of the ZAP remote procedure call protocol.
It is a fairly direct translation of the original
[C++ implementation](https://github.com/sandstorm-io/zap).

## Defining an interface

First, make sure that the
[`zap` executable](https://zap.org/zap-tool.html)
is installed on your system,
and that you have the [`zapc`](https://crates.io/crates/zapc) crate
in the `build-dependencies` section of your `Cargo.toml`.
Then, in a file named `foo.zap`, define your interface:

```zap
@0xa7ed6c5c8a98ca40;

interface Bar {
    baz @0 (x :Int32) -> (y :Int32);
}

interface Qux {
    quux @0 (bar :Bar) -> (y :Int32);
}
```

Now you can invoke the schema compiler in a
[`build.rs`](http://doc.crates.io/build-script.html) file, like this:

```rust
fn main() {
    ::zapc::CompilerCommand::new().file("foo.zap").run().unwrap();
}
```

Such a command generates a `foo_zap.rs` file in the `OUT_DIR`
directory provided by `cargo`.

To import the generated code, add a line like this at the root of your crate:

```rust
zap::generated_code!(pub mod foo_zap);
```

(If you want to import the code at a non-toplevel module location, then you will
need to use the `$Rust.parentModule` annotation, defined in `rust.zap`.)

## Calling methods on an RPC object

For each defined interface, the generated code includes a `Client` struct
that can be used to call the interface's methods. For example, the following
code calls the `Bar.baz()` method:

```rust
fn call_bar(client: ::foo_zap::bar::Client)
   -> Box<Future<Item=i32, Error=::zap::Error>>
{
    let mut req = client.baz_request();
    req.get().set_x(11);
    Box::new(req.send().promise.and_then(|response| {
         Ok(response.get()?.get_y())
    }))
}
```

A `bar::Client` is a reference to a possibly-remote `Bar` object.
The ZAP RPC runtime tracks the number of such references
that are live at any given time and automatically drops the
object when none are left.

## Implementing an interface

The generated code also includes a `Server` trait for each of your interfaces.
To create an RPC-enabled object, you must implement that trait.

```rust
struct MyBar {}

impl ::foo_zap::bar::Server for MyBar {
     async fn baz(
            self: Rc<Self>,
            params: ::foo_zap::bar::BazParams,
            mut results: ::foo_zap::bar::BazResults)
        -> Result<(), ::zap::Error>
     {
         results.get().set_y(params.get()?.get_x() + 1);
         Ok(())
     }
}
```

Then you can convert your object into a capability client like this:

```rust
let client: foo_zap::bar::Client = zap_rpc::new_client(MyBar {});
```

This new `client` can now be sent across the network.
You can use it as the bootstrap capability when you construct an `RpcSystem`,
and you can pass it in RPC method arguments and results.

## Async methods

The methods of the generated `Server` traits return
a value of type `impl Future<Output = Result<(), ::zap::Error>>`.
As you have seen above,
these can be implented as `async fn` methods returning `Result<(), ::zap::Error>`.

The RPC response will be sent back to the method's caller once two things have happened:

  1. The `Results` struct has been dropped.
  2. The method's returned `Future` has resolved.

Usually (1) happens before (2).

Here's an example of a method implementation that does not return immediately
because it awaits another request:

```rust
struct MyQux {}

impl ::foo_zap::qux::Server for MyQux {
     async fn quux(
             self: Rc<Self>,
             params: ::foo_zap::qux::QuuxParams,
             mut results: ::foo_zap::wux::QuuxResults)
        -> Result<(), ::zap::Error>
     {
         // Call `baz()` on the passed-in client.
         let bar_client = params.get()?.get_bar()?;
         let mut req = bar_client.baz_request();
         req.get().set_x(42);
         let response = req.send().promise.await?; // <-- await
         results.get().set_y(response.get()?.get_y());
         Ok(())
     }
}
```

It's possible for multiple calls of `quux()` to be active at the same time
on the same object, and they do not need to return in the same order
as they were called.

## Further reading

  * The [hello world example](/zap-rpc/examples/hello-world) demonstrates a basic request/reply pattern.
  * The [calculator example](/zap-rpc/examples/calculator)
    demonstrates how to use [promise pipelining](https://zap.org/rpc.html#time-travel-promise-pipelining).
  * The [pubsub example](/zap-rpc/examples/pubsub) shows how even an interface with no methods can be useful.
  * The [Sandstorm raw API example app](https://github.com/dwrensha/sandstorm-rawapi-example-rust)
    shows how Sandstorm lets you write web apps using ZAP instead of HTTP.
