// Structured benchmark runner — emits one JSON object per run, suitable
// for aggregation across hardware classes.
//
// USAGE:
//   cargo build -p benchmark --release
//   ./target/release/run_json ./target/release/benchmark \
//       [carsales_iters] [catrank_iters] [eval_iters] > result.json
//
// Output schema:
//   {
//     "schema_version": 1,
//     "host": { "hostname": "...", "os": "...", "arch": "..." },
//     "toolchain": { "rustc": "1.81.0" },
//     "iters": { "carsales": 10000, "catrank": 1000, "eval": 200000 },
//     "runs": [
//       { "case": "carsales", "mode": "object", "compression": "none",
//         "scratch": "reuse", "iters": 10000, "elapsed_secs": 0.42,
//         "throughput_ops_per_sec": 23809.5 },
//       ...
//     ]
//   }

use std::{env, process, time};

fn run_one(
    executable: &str,
    case: &str,
    mode: &str,
    scratch: &str,
    compression: &str,
    iteration_count: u64,
) -> f64 {
    let mut command = process::Command::new(executable);
    command
        .arg(case)
        .arg(mode)
        .arg(scratch)
        .arg(compression)
        .arg(format!("{iteration_count}"));

    // The pipe-mode benchmark child prints "exit status: 0" to stdout
    // after each spawn — silence it so our JSON is clean.
    command.stdout(process::Stdio::null());
    command.stderr(process::Stdio::null());

    let start = time::Instant::now();
    let status = command.spawn().unwrap().wait().unwrap();
    let elapsed = start.elapsed();

    if !status.success() {
        panic!("failed: case={case} mode={mode} compression={compression} scratch={scratch}");
    }

    elapsed.as_secs_f64()
}

fn emit_run(case: &str, mode: &str, scratch: &str, compression: &str, iters: u64, secs: f64) {
    let ops_per_sec = if secs > 0.0 { iters as f64 / secs } else { 0.0 };
    print!(
        "    {{\"case\":\"{case}\",\"mode\":\"{mode}\",\"compression\":\"{compression}\",\"scratch\":\"{scratch}\",\"iters\":{iters},\"elapsed_secs\":{secs:.6},\"throughput_ops_per_sec\":{ops_per_sec:.1}}}"
    );
}

fn run_case(
    executable: &str,
    case: &str,
    scratch_options: &[&str],
    iters: u64,
    first_in_runs: &mut bool,
) {
    // object mode only varies by scratch (no bytes/pipe x compression cross)
    for scratch in scratch_options {
        let secs = run_one(executable, case, "object", scratch, "none", iters);
        if !*first_in_runs {
            println!(",");
        } else {
            *first_in_runs = false;
        }
        emit_run(case, "object", scratch, "none", iters, secs);
    }

    for mode in &["bytes", "pipe"] {
        for compression in &["none", "packed"] {
            for scratch in scratch_options {
                let secs = run_one(executable, case, mode, scratch, compression, iters);
                if !*first_in_runs {
                    println!(",");
                } else {
                    *first_in_runs = false;
                }
                emit_run(case, mode, scratch, compression, iters, secs);
            }
        }
    }
}

fn hostname() -> String {
    process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn rustc_version() -> String {
    process::Command::new("rustc")
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn try_main() -> ::zap::Result<()> {
    let args: Vec<String> = env::args().collect();
    assert!(
        args.len() == 2 || args.len() == 5,
        "USAGE: {} BENCHMARK_EXECUTABLE [CARSALES_ITERS CATRANK_ITERS EVAL_ITERS]",
        args[0]
    );

    let (carsales_iters, catrank_iters, eval_iters) = if args.len() > 2 {
        (
            args[2].parse::<u64>().unwrap(),
            args[3].parse::<u64>().unwrap(),
            args[4].parse::<u64>().unwrap(),
        )
    } else {
        (10000, 1000, 200000)
    };

    let executable = &*args[1];

    println!("{{");
    println!("  \"schema_version\": 1,");
    println!(
        "  \"host\": {{\"hostname\":\"{}\",\"os\":\"{}\",\"arch\":\"{}\"}},",
        hostname().replace('"', "\\\""),
        env::consts::OS,
        env::consts::ARCH
    );
    println!(
        "  \"toolchain\": {{\"rustc\":\"{}\"}},",
        rustc_version().replace('"', "\\\"")
    );
    println!(
        "  \"iters\": {{\"carsales\":{},\"catrank\":{},\"eval\":{}}},",
        carsales_iters, catrank_iters, eval_iters
    );
    println!("  \"runs\": [");

    let mut first = true;
    run_case(
        executable,
        "carsales",
        &["reuse", "no-reuse"],
        carsales_iters,
        &mut first,
    );
    run_case(
        executable,
        "catrank",
        &["no-reuse"],
        catrank_iters,
        &mut first,
    );
    run_case(executable, "eval", &["no-reuse"], eval_iters, &mut first);

    println!();
    println!("  ]");
    println!("}}");

    Ok(())
}

pub fn main() {
    if let Err(e) = try_main() {
        eprintln!("error: {e:?}");
        std::process::exit(1);
    }
}
