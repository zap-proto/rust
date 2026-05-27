fn main() -> Result<(), Box<dyn std::error::Error>> {
    zapc::CompilerCommand::new().file("pubsub.zap").run()?;
    Ok(())
}
