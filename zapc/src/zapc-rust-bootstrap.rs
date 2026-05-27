//! Schema compiler plugin specialized for the sole purpose of bootstrapping schema.zap.
//! Because the generated code lives in the zap crate, we need to make sure that
//! it uses `crate::` rather than `::zap::` to refer to things in that crate.

pub fn main() {
    ::zapc::codegen::CodeGenerationCommand::new()
        .output_directory(::std::path::Path::new("."))
        .zap_root("crate")
        .run(::std::io::stdin())
        .expect("failed to generate code");
}
