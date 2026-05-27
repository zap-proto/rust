fn main() {
    ::zapc::CompilerCommand::new()
        .file("fuzzers/test.zap")
        .src_prefix("fuzzers")
        .run()
        .expect("compiling schema");
}
