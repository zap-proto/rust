import Layout from '@/components/Layout'
import CodeBlock from '@/components/CodeBlock'

export default function Home() {
  return (
    <Layout>
      <h1>Cap'n Proto for Rust</h1>
      <p>
        A Rust implementation of <a href="https://capnproto.org">Cap'n Proto</a>,
        a high-performance serialization and RPC protocol. Zero-copy message traversal,
        schema-defined types, and object-capability RPC.
      </p>

      <h2>Features</h2>
      <ul>
        <li><strong>Zero-copy deserialization</strong> - Access data directly from wire format</li>
        <li><strong>Schema evolution</strong> - Add fields without breaking compatibility</li>
        <li><strong>Object-capability RPC</strong> - Secure, promise-pipelined remote calls</li>
        <li><strong>no_std support</strong> - Use in embedded and WASM environments</li>
        <li><strong>Async/await</strong> - Native Rust async for I/O and RPC</li>
      </ul>

      <h2>Quick Start</h2>
      <p>Add the dependencies to your <code>Cargo.toml</code>:</p>
      <CodeBlock language="toml" filename="Cargo.toml">{`[dependencies]
capnp = "0.25"

[build-dependencies]
capnpc = "0.25"`}</CodeBlock>

      <p>Define a schema:</p>
      <CodeBlock language="capnp" filename="schema.capnp">{`@0x9eb32e19f86ee174;

struct Person {
  id @0 :UInt32;
  name @1 :Text;
  email @2 :Text;
}`}</CodeBlock>

      <p>Generate Rust code in <code>build.rs</code>:</p>
      <CodeBlock language="rust" filename="build.rs">{`fn main() {
    capnpc::CompilerCommand::new()
        .file("schema.capnp")
        .run()
        .expect("schema compilation");
}`}</CodeBlock>

      <p>Use the generated types:</p>
      <CodeBlock>{`capnp::generated_code!(pub mod schema_capnp);

use schema_capnp::person;

fn main() -> capnp::Result<()> {
    // Build a message
    let mut message = capnp::message::Builder::new_default();
    let mut person = message.init_root::<person::Builder>();
    person.set_id(42);
    person.set_name("Alice");
    person.set_email("alice@example.com");

    // Serialize
    let mut output = Vec::new();
    capnp::serialize::write_message(&mut output, &message)?;

    // Deserialize
    let reader = capnp::serialize::read_message(
        &mut output.as_slice(),
        capnp::message::ReaderOptions::new(),
    )?;
    let person = reader.get_root::<person::Reader>()?;
    println!("{}: {}", person.get_name()?.to_str()?, person.get_email()?.to_str()?);

    Ok(())
}`}</CodeBlock>

      <h2>Crates</h2>
      <table>
        <thead>
          <tr>
            <th>Crate</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>capnp</code></td>
            <td>Core runtime library for message building and reading</td>
          </tr>
          <tr>
            <td><code>capnpc</code></td>
            <td>Code generator plugin and build.rs integration</td>
          </tr>
          <tr>
            <td><code>capnp-futures</code></td>
            <td>Async message serialization with futures</td>
          </tr>
          <tr>
            <td><code>capnp-rpc</code></td>
            <td>Object-capability RPC implementation</td>
          </tr>
        </tbody>
      </table>

      <h2>Requirements</h2>
      <ul>
        <li>Rust 1.81.0 or later</li>
        <li><code>capnp</code> CLI tool for schema compilation</li>
      </ul>
    </Layout>
  )
}
