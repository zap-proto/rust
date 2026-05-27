fn main() -> Result<(), Box<dyn std::error::Error>> {
    Ok(zapc::CompilerCommand::new().file("foo.zap").run()?)
}
