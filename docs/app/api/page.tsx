import Layout from '@/components/Layout'
import CodeBlock from '@/components/CodeBlock'

export default function ApiReference() {
  return (
    <Layout>
      <h1>API Reference</h1>
      <p>
        Core types and patterns for working with Cap'n Proto messages in Rust.
        For complete API documentation, see <a href="https://docs.rs/capnp">docs.rs/capnp</a>.
      </p>

      <h2>Message Building</h2>
      <p>
        Messages are built using <code>message::Builder</code> and type-specific builders.
      </p>
      <CodeBlock>{`use capnp::message;

// Create a message with default allocator
let mut msg = message::Builder::new_default();

// Or with a specific allocator
let allocator = message::HeapAllocator::new()
    .first_segment_words(1024);
let mut msg = message::Builder::new(allocator);

// Initialize the root struct
let mut root = msg.init_root::<my_struct::Builder>();
root.set_field(value);`}</CodeBlock>

      <h2>Message Reading</h2>
      <p>
        Messages are read using <code>message::Reader</code> and type-specific readers.
      </p>
      <CodeBlock>{`use capnp::message::{Reader, ReaderOptions};
use capnp::serialize;

// Read from bytes
let reader = serialize::read_message(
    &mut data.as_slice(),
    ReaderOptions::new(),
)?;

// Get the root struct
let root = reader.get_root::<my_struct::Reader>()?;
let value = root.get_field();`}</CodeBlock>

      <h2>Reader Options</h2>
      <p>Configure safety limits when reading untrusted data:</p>
      <CodeBlock>{`use capnp::message::ReaderOptions;

let options = ReaderOptions::new()
    .traversal_limit_in_words(Some(8 * 1024 * 1024))  // 64 MB
    .nesting_limit(64);

let reader = serialize::read_message(&mut data, options)?;`}</CodeBlock>

      <h2>Primitive Types</h2>
      <table>
        <thead>
          <tr>
            <th>Cap'n Proto</th>
            <th>Rust</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>Void</code></td><td><code>()</code></td></tr>
          <tr><td><code>Bool</code></td><td><code>bool</code></td></tr>
          <tr><td><code>Int8..Int64</code></td><td><code>i8..i64</code></td></tr>
          <tr><td><code>UInt8..UInt64</code></td><td><code>u8..u64</code></td></tr>
          <tr><td><code>Float32, Float64</code></td><td><code>f32, f64</code></td></tr>
          <tr><td><code>Text</code></td><td><code>text::Reader / text::Builder</code></td></tr>
          <tr><td><code>Data</code></td><td><code>data::Reader / data::Builder</code></td></tr>
        </tbody>
      </table>

      <h2>Text and Data</h2>
      <CodeBlock>{`// Reading text
let name: &str = person.get_name()?.to_str()?;

// Setting text
person.set_name("Alice");

// Reading data (binary)
let bytes: &[u8] = msg.get_payload()?;

// Setting data
msg.set_payload(&[0x01, 0x02, 0x03]);`}</CodeBlock>

      <h2>Lists</h2>
      <CodeBlock>{`// Initialize a list with known size
let mut phones = person.init_phones(2);
phones.reborrow().get(0).set_number("555-1234");
phones.reborrow().get(1).set_number("555-5678");

// Read a list
for phone in person.get_phones()? {
    println!("{}", phone.get_number()?.to_str()?);
}`}</CodeBlock>

      <h2>Structs and Reborrowing</h2>
      <p>
        Builders require <code>reborrow()</code> to take multiple mutable references:
      </p>
      <CodeBlock>{`let mut person = msg.init_root::<person::Builder>();

// reborrow() lets you keep using person after init_phones
let mut phones = person.reborrow().init_phones(1);
phones.reborrow().get(0).set_number("555-1234");

// person is still usable
person.set_name("Alice");`}</CodeBlock>

      <h2>Unions</h2>
      <p>Tagged unions use <code>which()</code> for reading and setters for writing:</p>
      <CodeBlock>{`// Schema:
// employment :union {
//   unemployed @0 :Void;
//   employer @1 :Text;
//   school @2 :Text;
// }

// Writing
person.get_employment().set_employer("Acme Inc");

// Reading
match person.get_employment().which() {
    Ok(employment::Unemployed(())) => println!("unemployed"),
    Ok(employment::Employer(e)) => println!("works at {}", e?.to_str()?),
    Ok(employment::School(s)) => println!("studies at {}", s?.to_str()?),
    Err(capnp::NotInSchema(_)) => println!("unknown"),
}`}</CodeBlock>

      <h2>Enums</h2>
      <CodeBlock>{`// Schema:
// enum Type { mobile @0; home @1; work @2; }

// Writing
phone.set_type(phone_number::Type::Mobile);

// Reading
match phone.get_type() {
    Ok(phone_number::Type::Mobile) => "mobile",
    Ok(phone_number::Type::Home) => "home",
    Ok(phone_number::Type::Work) => "work",
    Err(capnp::NotInSchema(_)) => "unknown",
}`}</CodeBlock>

      <h2>Serialization</h2>
      <CodeBlock>{`use capnp::serialize;
use capnp::serialize_packed;

// Standard format
let mut output = Vec::new();
serialize::write_message(&mut output, &message)?;
let reader = serialize::read_message(&mut input, options)?;

// Packed format (smaller, slower)
serialize_packed::write_message(&mut output, &message)?;
let reader = serialize_packed::read_message(&mut input, options)?;`}</CodeBlock>

      <h2>Error Handling</h2>
      <p>
        All fallible operations return <code>capnp::Result&lt;T&gt;</code>:
      </p>
      <CodeBlock>{`use capnp::{Error, ErrorKind};

fn process_message(data: &[u8]) -> capnp::Result<String> {
    let reader = serialize::read_message(
        &mut data,
        ReaderOptions::new(),
    )?;

    let person = reader.get_root::<person::Reader>()?;
    let name = person.get_name()?.to_str()?;

    Ok(name.to_string())
}

// Handle errors
match process_message(&data) {
    Ok(name) => println!("Name: {}", name),
    Err(e) => eprintln!("Error: {}", e),
}`}</CodeBlock>
    </Layout>
  )
}
