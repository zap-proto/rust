// Cross-runtime frame conformance against zap-proto/go.
//
// The four frames below are real vectors from the Lux chain differential corpus
// (node2/conformance/corpus/vectors.tsv), one per chain. Every one of them was
// written by the Go ZAP runtime and is read back by it; they are the frames the
// two C++ chains and the three Rust chains in that repo exchange today.
//
// This runtime reads none of them, and nothing it writes is readable there. The
// reason is structural rather than a bug in either side: the two runtimes carry
// different wire formats under the same name.
//
//   zap-proto/go, zap-proto/cpp   16-byte header — magic "ZAP\0", version, flags,
//                                 root offset, size — then a data segment whose
//                                 fields sit at byte offsets.
//   this runtime                  a segment table, then 8-byte words addressed by
//                                 tagged pointers.
//
// A Go frame's first four bytes are the magic; this runtime reads that word as a
// segment count, which is why every failure below reports 5259611 segments:
// 0x0050415A is "ZAP\0" little-endian, plus one.
//
// These tests record that measurement so it stays measured. They deliberately do
// not translate between the two formats — which format is canonical is not a
// question a test can answer.

fn frame(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("corpus frame is hex"))
        .collect()
}

/// Corpus frames: (vector id, chain, wire bytes as hex).
const CORPUS: &[(&str, &str, &str)] = &[
    ("P_REWARD_VALIDATOR", "P", "5a415000020000001000000031000000022a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a"),
    ("X_BLOCK_EMPTY", "X", "5a4150000200000010000000700000000a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0100000000000000e803000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    ("Q_GENESIS", "Q", "5a4150000200000010000000780000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e010000000000000000000000000000000000000000000000"),
    ("Z_BLOCK_GENESIS_WITH_PARENT", "Z", "5a4150000200000010000000600000009c227870184f9269e1c720c2df8256dea664debf56f8eec76acab03c4bea755d0000000000000000e8030000000000000000000000000000000000000000000000000000000000000000000000000000"),
];

/// The magic the Go runtime writes at byte 0, and the segment count this runtime
/// reads those same four bytes as.
const GO_MAGIC: &[u8; 4] = b"ZAP\0";
const MAGIC_AS_SEGMENT_COUNT: u32 = u32::from_le_bytes(*GO_MAGIC) + 1;

#[test]
fn every_corpus_frame_carries_the_go_header() {
    for (id, _chain, hex) in CORPUS {
        let bytes = frame(hex);
        assert_eq!(
            &bytes[..4],
            GO_MAGIC,
            "{id} does not start with the ZAP magic"
        );
        // Bytes 8..12 are the root offset, which is the header size for every frame.
        let root = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
        assert_eq!(root, 16, "{id} root offset is not the 16-byte header");
        // Bytes 12..16 are the declared total size, which the buffer must match.
        let size = u32::from_le_bytes(bytes[12..16].try_into().unwrap()) as usize;
        assert_eq!(
            size,
            bytes.len(),
            "{id} declared size does not match its length"
        );
    }
}

#[test]
fn this_runtime_reads_no_go_frame() {
    // 8-byte alignment is a precondition of the segment-table read, so give every
    // frame an aligned buffer: the failure below is about the format, not the address.
    for (id, chain, hex) in CORPUS {
        let bytes = frame(hex);
        let mut aligned: Vec<u64> = vec![0; bytes.len() / 8 + 2];
        let buf = unsafe {
            core::slice::from_raw_parts_mut(aligned.as_mut_ptr() as *mut u8, aligned.len() * 8)
        };
        buf[..bytes.len()].copy_from_slice(&bytes);

        let mut slice: &[u8] = &buf[..bytes.len()];
        let err = zap::serialize::read_message_from_flat_slice(
            &mut slice,
            zap::message::ReaderOptions::new(),
        )
        .err()
        .unwrap_or_else(|| panic!("{chain} {id}: this runtime read a Go frame — the wire formats have converged, so update this test"));

        // The count it reports is the Go magic, which is the whole story.
        assert!(
            err.to_string().contains(&MAGIC_AS_SEGMENT_COUNT.to_string()),
            "{chain} {id}: expected the magic ({MAGIC_AS_SEGMENT_COUNT}) read as a segment count, got: {err}"
        );
    }
}

#[test]
fn what_this_runtime_writes_carries_no_go_header() {
    // The other direction, stated structurally: the Go reader checks bytes 0..4 for
    // the magic and rejects anything else, and this is what it would find.
    let mut msg = zap::message::Builder::new_default();
    msg.set_root("hello").unwrap();
    let mut out = Vec::new();
    zap::serialize::write_message(&mut out, &msg).unwrap();

    assert_ne!(
        &out[..4],
        GO_MAGIC,
        "this runtime now writes the Go magic — update this test"
    );
    // What it writes at byte 0 is the segment table: (count - 1), then each size in words.
    let segments = u32::from_le_bytes(out[..4].try_into().unwrap()) + 1;
    assert_eq!(segments, 1, "a default single-segment message");
    let words = u32::from_le_bytes(out[4..8].try_into().unwrap()) as usize;
    assert_eq!(
        out.len(),
        8 + words * 8,
        "table plus its segment, in whole words"
    );
}
