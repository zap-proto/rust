fn main() {
    ::zapc::CompilerCommand::new()
        .file("fill.zap")
        .file("corpora.zap")
        .file("addressbook.zap")
        .file("shapes.zap")
        .run()
        .expect("compiling schema");
}
