fn main() -> Result<(), Box<dyn std::error::Error>> {
    zapc::CompilerCommand::new().file("streaming.zap").run()?;
    Ok(())
}
