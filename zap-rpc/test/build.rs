fn main() {
    ::zapc::CompilerCommand::new()
        .file("test.zap")
        .run()
        .unwrap();
}
