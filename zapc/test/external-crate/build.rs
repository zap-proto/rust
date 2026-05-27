fn main() {
    zapc::CompilerCommand::new()
        .file("external.zap")
        .run()
        .expect("compiling schema");
}
