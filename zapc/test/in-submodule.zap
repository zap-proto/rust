@0xb9523c11cf10d3bd;

using Rust = import "rust.zap";
using Other = import "in-other-submodule.zap";

$Rust.parentModule("foo::bar");

struct Foo {
   recursive @0 :Foo;
   other @1: Other.Baz;
}


