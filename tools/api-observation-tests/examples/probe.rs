use api_observation_tests::api_scanner::{observations::GameAnalysisResult, runtime};
use std::{path::Path, time::Instant};

fn main() {
    let path = std::env::args()
        .nth(1)
        .expect("Usage: probe /absolute/game/directory");
    let root = Path::new(&path)
        .canonicalize()
        .expect("Invalid game directory");
    let start = Instant::now();
    let observation = runtime::observe_game(&root).expect("Could not read /proc");
    eprintln!(
        "Process observation: {:.2} ms; {} matching processes",
        start.elapsed().as_secs_f64() * 1000.0,
        observation.matched_processes
    );
    println!(
        "{}",
        serde_json::to_string_pretty(&GameAnalysisResult::from_observation(observation)).unwrap()
    );
}
