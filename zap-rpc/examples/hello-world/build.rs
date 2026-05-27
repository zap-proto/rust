fn main() -> Result<(), Box<dyn std::error::Error>> {
    zapc::CompilerCommand::new()
        .file("hello_world.zap")
        .run()?;
    Ok(())
}
