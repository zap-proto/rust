# addressbook_send example

A quick example that demonstrates how to send (parsed) ZAP messages
across thread boundaries. Because the standard `Builder` and `Reader`
interfaces require lifetimes (meaning that they're not `'static`) they can't
be sent across thread boundaries.

Make sure to have the C++ `zap` binary and header files installed.
(For example, on Ubuntu you would install `zap` and `libzap-dev`
in your package manager.)

Try it like this:

```
$ cargo run
```
