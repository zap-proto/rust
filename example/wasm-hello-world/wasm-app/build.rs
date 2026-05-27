fn main() {
    ::zapc::CompilerCommand::new()
        .file("../wasm-hello-world.zap")
        .src_prefix("../")
        .run()
        .expect("compiling schema");
}
