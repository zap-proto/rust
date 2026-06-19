#! /bin/sh

set -e
set -x

cargo build -p zapc
zap compile -otarget/debug/zapc-rust-bootstrap:zap/src zap/schema.zap --src-prefix zap/ -I. --no-standard-import
rustfmt zap/src/schema_zap.rs
