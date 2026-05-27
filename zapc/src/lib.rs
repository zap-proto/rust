// Copyright (c) 2013-2014 Sandstorm Development Group, Inc. and contributors
// Licensed under the MIT License:
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

//! # ZAP Schema Compiler Plugin Library
//!
//! This library allows you to do
//! [ZAP code generation](https://zap-proto.dev/otherlang.html#how-to-write-compiler-plugins)
//! within a Cargo build. You still need the `zap` binary (implemented in C++).
//! (If you use a package manager, try looking for a package called
//! `zap`.)
//!
//! In your Cargo.toml:
//!
//! ```ignore
//! [dependencies]
//! zap = "0.25" # Note this is a different library than zap*c*
//!
//! [build-dependencies]
//! zapc = "0.25"
//! ```
//!
//! In your build.rs:
//!
//! ```ignore
//! fn main() {
//!     zapc::CompilerCommand::new()
//!         .src_prefix("schema")
//!         .file("schema/foo.zap")
//!         .file("schema/bar.zap")
//!         .run().expect("schema compiler command");
//! }
//! ```
//!
//! In your lib.rs:
//!
//! ```ignore
//! zap::generated_code!(mod foo_zap);
//! zap::generated_code!(mod bar_zap);
//! ```
//!
//! This will be equivalent to executing the shell command
//!
//! ```ignore
//!   zap compile -orust:$OUT_DIR --src-prefix=schema schema/foo.zap schema/bar.zap
//! ```

pub mod codegen;
pub mod codegen_types;
mod pointer_constants;

use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

// Copied from zap/src/lib.rs, where this conversion lives behind the "std" feature flag,
// which we don't want to depend on here.
pub(crate) fn convert_io_err(err: std::io::Error) -> zap::Error {
    use std::io;
    let kind = match err.kind() {
        io::ErrorKind::TimedOut => zap::ErrorKind::Overloaded,
        io::ErrorKind::BrokenPipe
        | io::ErrorKind::ConnectionRefused
        | io::ErrorKind::ConnectionReset
        | io::ErrorKind::ConnectionAborted
        | io::ErrorKind::NotConnected => zap::ErrorKind::Disconnected,
        _ => zap::ErrorKind::Failed,
    };
    zap::Error {
        extra: format!("{err}"),
        kind,
    }
}

fn run_command(
    mut command: ::std::process::Command,
    mut code_generation_command: codegen::CodeGenerationCommand,
) -> ::zap::Result<()> {
    let mut p = command.spawn().map_err(convert_io_err)?;
    code_generation_command.run(p.stdout.take().unwrap())?;
    let exit_status = p.wait().map_err(convert_io_err)?;
    if !exit_status.success() {
        Err(::zap::Error::failed(format!(
            "Non-success exit status: {exit_status}"
        )))
    } else {
        Ok(())
    }
}

/// A builder object for schema compiler commands.
#[derive(Default)]
pub struct CompilerCommand {
    files: Vec<PathBuf>,
    src_prefixes: Vec<PathBuf>,
    import_paths: Vec<PathBuf>,
    no_standard_import: bool,
    executable_path: Option<PathBuf>,
    output_path: Option<PathBuf>,
    default_parent_module: Vec<String>,
    raw_code_generator_request_path: Option<PathBuf>,
    crate_provides_map: HashMap<u64, String>,
}

impl CompilerCommand {
    /// Creates a new, empty command.
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds a file to be compiled.
    pub fn file<P>(&mut self, path: P) -> &mut Self
    where
        P: AsRef<Path>,
    {
        self.files.push(path.as_ref().to_path_buf());
        self
    }

    /// Adds a --src-prefix flag. For all files specified for compilation that start
    /// with `prefix`, removes the prefix when computing output filenames.
    pub fn src_prefix<P>(&mut self, prefix: P) -> &mut Self
    where
        P: AsRef<Path>,
    {
        self.src_prefixes.push(prefix.as_ref().to_path_buf());
        self
    }

    /// Adds an --import_path flag. Adds `dir` to the list of directories searched
    /// for absolute imports.
    pub fn import_path<P>(&mut self, dir: P) -> &mut Self
    where
        P: AsRef<Path>,
    {
        self.import_paths.push(dir.as_ref().to_path_buf());
        self
    }

    /// Specify that `crate_name` provides generated code for `files`.
    ///
    /// This means that when your schema refers to types defined in `files` we
    /// will generate Rust code that uses identifiers in `crate_name`.
    ///
    /// # Arguments
    ///
    /// - `crate_name`: The Rust identifier of the crate
    /// - `files`: the Zap file ids the crate provides generated code for
    ///
    /// # When to use
    ///
    /// You only need this when your generated code needs to refer to types in
    /// the external crate. If you just want to use an annotation and the
    /// argument to that annotation is a builtin type (e.g. `$Json.name`) this
    /// isn't necessary.
    ///
    /// # Example
    ///
    /// If you write a schema like so
    ///
    /// ```zap
    /// // my_schema.zap
    ///
    /// using Json = import "/zap/compat/json.zap";
    ///
    /// struct Foo {
    ///     value @0 :Json.Value;
    /// }
    /// ```
    ///
    /// you'd look at [json.zap][json.zap] to see its zap id.
    ///
    /// ```zap
    /// // json.zap
    ///
    /// # Copyright (c) 2015 Sandstorm Development Group, Inc. and contributors ...
    /// @0x8ef99297a43a5e34;
    /// ```
    ///
    /// If you want the `foo::Builder::get_value` method generated for your
    /// schema to return a `zap_json::json_zap::value::Reader` you'd add a
    /// dependency on `zap_json` to your `Cargo.toml` and specify it provides
    /// `json.zap` in your `build.rs`.
    ///
    /// ```rust,no_run
    /// // build.rs
    ///
    /// zapc::CompilerCommand::new()
    ///     .crate_provides("json_zap", [0x8ef99297a43a5e34])
    ///     .file("my_schema.zap")
    ///     .run()
    ///     .unwrap();
    /// ```
    ///
    /// [json.zap]:
    ///     https://github.com/zap/zap/blob/master/c%2B%2B/src/zap/compat/json.zap
    pub fn crate_provides(
        &mut self,
        crate_name: impl Into<String>,
        files: impl IntoIterator<Item = u64>,
    ) -> &mut Self {
        let crate_name = crate_name.into();
        for file in files.into_iter() {
            self.crate_provides_map.insert(file, crate_name.clone());
        }
        self
    }

    /// Adds the --no-standard-import flag, indicating that the default import paths of
    /// /usr/include and /usr/local/include should not be included.
    pub fn no_standard_import(&mut self) -> &mut Self {
        self.no_standard_import = true;
        self
    }

    /// Sets the output directory of generated code. Default is OUT_DIR
    pub fn output_path<P>(&mut self, path: P) -> &mut Self
    where
        P: AsRef<Path>,
    {
        self.output_path = Some(path.as_ref().to_path_buf());
        self
    }

    /// Specify the executable which is used for the 'zap' tool. When this method is not called, the command looks for a name 'zap'
    /// on the system (e.g. in working directory or in PATH environment variable).
    pub fn zap_executable<P>(&mut self, path: P) -> &mut Self
    where
        P: AsRef<Path>,
    {
        self.executable_path = Some(path.as_ref().to_path_buf());
        self
    }

    /// Internal function for starting to build a zap command.
    fn new_command(&self) -> ::std::process::Command {
        if let Some(executable) = &self.executable_path {
            ::std::process::Command::new(executable)
        } else {
            ::std::process::Command::new("zap")
        }
    }

    /// Sets the default parent module. This indicates the scope in your crate where you will
    /// add a module containing the generated code. For example, if you set this option to
    /// `vec!["foo".into(), "bar".into()]`, and you are generating code for `baz.zap`, then your crate
    /// should have this structure:
    ///
    /// ```ignore
    /// pub mod foo {
    ///    pub mod bar {
    ///        pub mod baz_zap {
    ///            include!(concat!(env!("OUT_DIR"), "/baz_zap.rs"));
    ///        }
    ///    }
    /// }
    /// ```
    ///
    /// This option can be overridden by the `parentModule` annotation defined in `rust.zap`.
    ///
    /// If this option is unset, the default is the crate root.
    pub fn default_parent_module(&mut self, default_parent_module: Vec<String>) -> &mut Self {
        self.default_parent_module = default_parent_module;
        self
    }

    /// If set, the generator will also write a file containing the raw code generator request to the
    /// specified path.
    pub fn raw_code_generator_request_path<P>(&mut self, path: P) -> &mut Self
    where
        P: AsRef<Path>,
    {
        self.raw_code_generator_request_path = Some(path.as_ref().to_path_buf());
        self
    }

    /// Runs the command.
    /// Returns an error if `OUT_DIR` or a custom output directory was not set, or if `zap compile` fails.
    pub fn run(&mut self) -> ::zap::Result<()> {
        match self.new_command().arg("--version").output() {
            Err(error) => {
                return Err(::zap::Error::failed(format!(
                    "Failed to execute `zap --version`: {error}. \
                     Please verify that version 0.5.2 or higher of the zap executable \
                     is installed on your system. See https://zap-proto.dev/install.html"
                )))
            }
            Ok(output) => {
                if !output.status.success() {
                    return Err(::zap::Error::failed(format!(
                        "`zap --version` returned an error: {:?}. \
                         Please verify that version 0.5.2 or higher of the zap executable \
                         is installed on your system. See https://zap-proto.dev/install.html",
                        output.status
                    )));
                }
                // TODO Parse the version string?
            }
        }

        let mut command = self.new_command();

        // We remove PWD from the env to avoid the following warning.
        // kj/filesystem-disk-unix.c++:1690:
        //    warning: PWD environment variable doesn't match current directory
        command.env_remove("PWD");

        command.arg("compile").arg("-o").arg("-");

        if self.no_standard_import {
            command.arg("--no-standard-import");
        }

        for import_path in &self.import_paths {
            command.arg(format!("--import-path={}", import_path.display()));
        }

        for src_prefix in &self.src_prefixes {
            command.arg(format!("--src-prefix={}", src_prefix.display()));
        }

        for file in &self.files {
            std::fs::metadata(file).map_err(|error| {
                let current_dir = match std::env::current_dir() {
                    Ok(current_dir) => format!("`{}`", current_dir.display()),
                    Err(..) => "<unknown working directory>".to_string(),
                };

                ::zap::Error::failed(format!(
                    "Unable to stat zap input file `{}` in working directory {}: {}.  \
                     Please check that the file exists and is accessible for read.",
                    file.display(),
                    current_dir,
                    error
                ))
            })?;

            command.arg(file);
        }

        let output_path = if let Some(output_path) = &self.output_path {
            output_path.clone()
        } else {
            // Try `OUT_DIR` by default
            PathBuf::from(::std::env::var("OUT_DIR").map_err(|error| {
                ::zap::Error::failed(format!(
                    "Could not access `OUT_DIR` environment variable: {error}. \
                     You might need to set it up or instead create your own output \
                     structure using `CompilerCommand::output_path`"
                ))
            })?)
        };

        command.stdout(::std::process::Stdio::piped());
        command.stderr(::std::process::Stdio::inherit());

        let mut code_generation_command = crate::codegen::CodeGenerationCommand::new();
        code_generation_command
            .output_directory(output_path)
            .default_parent_module(self.default_parent_module.clone())
            .crates_provide_map(self.crate_provides_map.clone());
        if let Some(raw_code_generator_request_path) = &self.raw_code_generator_request_path {
            code_generation_command
                .raw_code_generator_request_path(raw_code_generator_request_path.clone());
        }

        run_command(command, code_generation_command).map_err(|error| {
            ::zap::Error::failed(format!(
                "Error while trying to execute `zap compile`: {error}."
            ))
        })
    }
}

#[test]
#[cfg_attr(miri, ignore)]
fn compiler_command_new_no_out_dir() {
    std::env::remove_var("OUT_DIR");
    let error = CompilerCommand::new().run().unwrap_err().extra;
    assert!(error.starts_with("Could not access `OUT_DIR` environment variable"));
}
