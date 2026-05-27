fn main() {
    ::zapc::CompilerCommand::new()
        .file("addressbook.zap")
        .run()
        .unwrap();
}
