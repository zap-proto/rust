fn main() {
    ::zapc::CompilerCommand::new()
        .file("wasm-hello-world.zap")
        .run()
        .expect("compiling schema");
}
