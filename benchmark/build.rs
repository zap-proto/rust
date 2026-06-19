// build.rs — copy pre-generated schema-bound Rust into OUT_DIR.
//
// No schema compiler invoked at build time. The schemas were compiled
// once during development and the generated *_zap.rs files are checked
// into the source tree alongside the schemas. This means: zero build-
// time dependency on any external compiler, instant builds, fully
// reproducible.
//
// To regenerate from .zap schemas (developer task):
//   1. install the zapc binary: `cargo install --path ../zapc`
//   2. compile via: `zap compile -orust *.zap`
//      (the zapc binary is the codegen plugin invoked by the zap CLI's
//       schema parser frontend; neither is linked at build time)

use std::{env, fs, path::Path};

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    for name in ["carsales_zap", "catrank_zap", "eval_zap"] {
        let src = format!("{}.rs", name);
        let dst = Path::new(&out_dir).join(&src);
        fs::copy(&src, &dst).expect(&format!("copy {}", src));
        println!("cargo:rerun-if-changed={}", src);
    }
}
