#! /bin/sh

set -e
set -x

cargo build -p zapc
zap compile -otarget/debug/zapc-rust:zap-rpc/src zap-rpc/schema/rpc.zap zap-rpc/schema/rpc-twoparty.zap --src-prefix zap-rpc/schema/ -I. --no-standard-import
rustfmt zap-rpc/src/rpc_zap.rs zap-rpc/src/rpc_twoparty_zap.rs
