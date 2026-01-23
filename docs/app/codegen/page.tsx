import Layout from '@/components/Layout'
import CodeBlock from '@/components/CodeBlock'

export default function CodeGeneration() {
  return (
    <Layout>
      <h1>Code Generation</h1>
      <p>
        The <code>capnpc</code> crate generates Rust code from Cap'n Proto schema files.
        This page covers schema syntax, the code generator, and build integration.
      </p>

      <h2>Schema Basics</h2>
      <p>Every schema file starts with a unique 64-bit ID:</p>
      <CodeBlock language="capnp" filename="schema.capnp">{`@0x9eb32e19f86ee174;

struct Person {
  id @0 :UInt32;
  name @1 :Text;
  email @2 :Text;
}`}</CodeBlock>

      <p>Generate a unique ID with:</p>
      <CodeBlock language="bash">{`capnp id`}</CodeBlock>

      <h2>Build Integration</h2>
      <p>
        The standard approach uses <code>build.rs</code> to compile schemas during cargo build:
      </p>
      <CodeBlock language="rust" filename="build.rs">{`fn main() {
    capnpc::CompilerCommand::new()
        .file("schema/person.capnp")
        .file("schema/address.capnp")
        .run()
        .expect("schema compilation failed");
}`}</CodeBlock>

      <p>Include the generated code in your crate:</p>
      <CodeBlock filename="src/lib.rs">{`// Include generated modules
capnp::generated_code!(pub mod person_capnp);
capnp::generated_code!(pub mod address_capnp);

use person_capnp::person;`}</CodeBlock>

      <h2>CompilerCommand Options</h2>
      <CodeBlock>{`capnpc::CompilerCommand::new()
    // Schema files to compile
    .file("schema/api.capnp")

    // Add import paths for schema dependencies
    .import_path("schema/")
    .import_path("/usr/include/capnp/")

    // Specify capnp binary location
    .capnp_executable("/usr/local/bin/capnp")

    // Output directory (default: OUT_DIR)
    .output_path("src/generated/")

    // Additional raw arguments to capnp
    .raw_code_generator_request_path("request.bin")

    .run()
    .expect("compilation failed");`}</CodeBlock>

      <h2>Schema Types</h2>

      <h3>Structs</h3>
      <CodeBlock language="capnp">{`struct Point {
  x @0 :Float32;
  y @1 :Float32;
}

struct Rectangle {
  topLeft @0 :Point;
  bottomRight @1 :Point;
}`}</CodeBlock>

      <h3>Lists</h3>
      <CodeBlock language="capnp">{`struct Document {
  pages @0 :List(Page);
  tags @1 :List(Text);
  scores @2 :List(Float64);
}`}</CodeBlock>

      <h3>Enums</h3>
      <CodeBlock language="capnp">{`enum Status {
  pending @0;
  active @1;
  completed @2;
  failed @3;
}`}</CodeBlock>

      <h3>Unions</h3>
      <CodeBlock language="capnp">{`struct Shape {
  union {
    circle @0 :Circle;
    rectangle @1 :Rectangle;
    triangle @2 :Triangle;
  }
}

# Named union
struct Result {
  outcome :union {
    success @0 :Data;
    error @1 :Text;
  }
}`}</CodeBlock>

      <h3>Groups</h3>
      <CodeBlock language="capnp">{`struct Person {
  name @0 :Text;

  address :group {
    street @1 :Text;
    city @2 :Text;
    country @3 :Text;
  }
}`}</CodeBlock>

      <h3>Generics</h3>
      <CodeBlock language="capnp">{`struct Map(Key, Value) {
  entries @0 :List(Entry);

  struct Entry {
    key @0 :Key;
    value @1 :Value;
  }
}

struct Config {
  settings @0 :Map(Text, Text);
}`}</CodeBlock>

      <h2>Interfaces (RPC)</h2>
      <CodeBlock language="capnp">{`interface Calculator {
  add @0 (a :Float64, b :Float64) -> (result :Float64);
  subtract @1 (a :Float64, b :Float64) -> (result :Float64);

  # Returns a capability
  getHistory @2 () -> (history :History);
}

interface History {
  getEntries @0 () -> (entries :List(Text));
}`}</CodeBlock>

      <h2>Constants</h2>
      <CodeBlock language="capnp">{`const maxSize :UInt32 = 1024;
const defaultName :Text = "unnamed";
const defaultConfig :Config = (
  timeout = 30,
  retries = 3
);`}</CodeBlock>

      <h2>Annotations</h2>
      <CodeBlock language="capnp">{`annotation deprecated(field, struct, enum) :Void;

struct OldApi {
  legacyField @0 :Text $deprecated;
}`}</CodeBlock>

      <h2>Schema Evolution</h2>
      <p>Cap'n Proto supports adding new fields without breaking compatibility:</p>
      <CodeBlock language="capnp">{`# Original schema
struct Person {
  name @0 :Text;
  email @1 :Text;
}

# Evolved schema - new fields have higher ordinals
struct Person {
  name @0 :Text;
  email @1 :Text;
  phone @2 :Text;        # New field
  age @3 :UInt8 = 0;     # New field with default
}`}</CodeBlock>

      <h2>Generated Code Structure</h2>
      <p>For a struct <code>Person</code>, the generator creates:</p>
      <ul>
        <li><code>person::Reader&lt;'a&gt;</code> - Immutable view into message data</li>
        <li><code>person::Builder&lt;'a&gt;</code> - Mutable builder for creating messages</li>
        <li><code>person::Owned</code> - Type marker for generic contexts</li>
        <li>Getter methods: <code>get_field()</code></li>
        <li>Setter methods: <code>set_field(value)</code></li>
        <li>Initializer methods: <code>init_field()</code> for nested structs/lists</li>
      </ul>

      <h2>Import Paths</h2>
      <CodeBlock language="capnp" filename="api.capnp">{`@0xabc123;

using Types = import "types.capnp";

struct Request {
  user @0 :Types.User;
  action @1 :Types.Action;
}`}</CodeBlock>

      <p>Configure import paths in build.rs:</p>
      <CodeBlock filename="build.rs">{`capnpc::CompilerCommand::new()
    .file("schema/api.capnp")
    .import_path("schema/")
    .run()
    .unwrap();`}</CodeBlock>
    </Layout>
  )
}
