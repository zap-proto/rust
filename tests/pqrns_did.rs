//! PQ-RNS DID KAT — verifies our compute_did matches the canonical
//! fixture published at zap-proto/rns/testdata/pqrns_kat.json.

use base32::{encode as b32_encode, Alphabet};
use serde::Deserialize;
use sha3::{Digest, Sha3_256};

#[derive(Deserialize)]
struct Kat {
    did_canonical: Canonical,
}

#[derive(Deserialize)]
struct Canonical {
    inputs: Inputs,
    outputs: Outputs,
}

#[derive(Deserialize)]
struct Inputs {
    kem_pubkey_hex: String,
    sig_pubkey_hex: String,
}

#[derive(Deserialize)]
struct Outputs {
    did: String,
}

fn compute_did(kem_pubkey: &[u8], sig_pubkey: &[u8]) -> String {
    let mut h = Sha3_256::new();
    h.update(kem_pubkey);
    h.update(sig_pubkey);
    let digest = h.finalize();
    let enc = b32_encode(Alphabet::Rfc4648 { padding: false }, &digest);
    format!("did:zap:{}", enc.to_lowercase())
}

#[test]
fn pqrns_did_kat() {
    let kat_raw = include_str!("pqrns_kat.json");
    let kat: Kat = serde_json::from_str(kat_raw).expect("parse KAT");

    let kem_pk = hex::decode(&kat.did_canonical.inputs.kem_pubkey_hex).expect("kem hex");
    let sig_pk = hex::decode(&kat.did_canonical.inputs.sig_pubkey_hex).expect("sig hex");

    assert_eq!(kem_pk.len(), 1216, "kem pk size");
    assert_eq!(sig_pk.len(), 1984, "sig pk size");

    let got = compute_did(&kem_pk, &sig_pk);
    assert_eq!(got, kat.did_canonical.outputs.did, "DID diverged");
}
