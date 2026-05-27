# addressbook example

A Rust port of [this C++ sample code](https://github.com/sandstorm-io/zap/blob/v0.5.3/c%2B%2B/samples/addressbook.c%2B%2B).

Make sure to have the C++ `zap` binary and header files installed.
(For example, on Ubuntu you would install `zap` and `libzap-dev`
in your package manager.)

Try it like this:

```
$ cargo run write | cargo run read
```
