fn main() {
    ::zapc::CompilerCommand::new()
        .file("addressbook.zap")
        .run()
        .expect("compiling schema");
}
