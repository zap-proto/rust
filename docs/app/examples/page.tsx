import Layout from '@/components/Layout'
import CodeBlock from '@/components/CodeBlock'

export default function Examples() {
  return (
    <Layout>
      <h1>Examples</h1>
      <p>
        Complete working examples demonstrating common Cap'n Proto patterns in Rust.
      </p>

      <h2>Address Book</h2>
      <p>
        A complete example of serialization with nested structs, lists, enums, and unions.
      </p>

      <h3>Schema</h3>
      <CodeBlock language="capnp" filename="addressbook.capnp">{`@0x9eb32e19f86ee174;

struct Person {
  id @0 :UInt32;
  name @1 :Text;
  email @2 :Text;
  phones @3 :List(PhoneNumber);

  struct PhoneNumber {
    number @0 :Text;
    type @1 :Type;

    enum Type {
      mobile @0;
      home @1;
      work @2;
    }
  }

  employment :union {
    unemployed @4 :Void;
    employer @5 :Text;
    school @6 :Text;
    selfEmployed @7 :Void;
  }
}

struct AddressBook {
  people @0 :List(Person);
}`}</CodeBlock>

      <h3>Build Script</h3>
      <CodeBlock filename="build.rs">{`fn main() {
    capnpc::CompilerCommand::new()
        .file("addressbook.capnp")
        .run()
        .expect("schema compilation");
}`}</CodeBlock>

      <h3>Writing Messages</h3>
      <CodeBlock filename="src/main.rs">{`capnp::generated_code!(pub mod addressbook_capnp);

use addressbook_capnp::{address_book, person};
use capnp::serialize_packed;

fn write_address_book() -> capnp::Result<()> {
    let mut message = capnp::message::Builder::new_default();
    let address_book = message.init_root::<address_book::Builder>();
    let mut people = address_book.init_people(2);

    // First person
    {
        let mut alice = people.reborrow().get(0);
        alice.set_id(123);
        alice.set_name("Alice");
        alice.set_email("alice@example.com");

        let mut phones = alice.reborrow().init_phones(1);
        phones.reborrow().get(0).set_number("555-1212");
        phones.reborrow().get(0).set_type(person::phone_number::Type::Mobile);

        alice.get_employment().set_school("MIT");
    }

    // Second person
    {
        let mut bob = people.get(1);
        bob.set_id(456);
        bob.set_name("Bob");
        bob.set_email("bob@example.com");

        let mut phones = bob.reborrow().init_phones(2);
        phones.reborrow().get(0).set_number("555-4567");
        phones.reborrow().get(0).set_type(person::phone_number::Type::Home);
        phones.reborrow().get(1).set_number("555-7654");
        phones.reborrow().get(1).set_type(person::phone_number::Type::Work);

        bob.get_employment().set_unemployed(());
    }

    serialize_packed::write_message(&mut std::io::stdout(), &message)
}`}</CodeBlock>

      <h3>Reading Messages</h3>
      <CodeBlock>{`fn read_address_book() -> capnp::Result<()> {
    let stdin = std::io::stdin();
    let message = serialize_packed::read_message(
        &mut stdin.lock(),
        capnp::message::ReaderOptions::new(),
    )?;

    let address_book = message.get_root::<address_book::Reader>()?;

    for person in address_book.get_people()? {
        println!(
            "{}: {}",
            person.get_name()?.to_str()?,
            person.get_email()?.to_str()?
        );

        for phone in person.get_phones()? {
            let type_name = match phone.get_type() {
                Ok(person::phone_number::Type::Mobile) => "mobile",
                Ok(person::phone_number::Type::Home) => "home",
                Ok(person::phone_number::Type::Work) => "work",
                Err(capnp::NotInSchema(_)) => "unknown",
            };
            println!("  {} phone: {}", type_name, phone.get_number()?.to_str()?);
        }

        match person.get_employment().which() {
            Ok(person::employment::Unemployed(())) => {
                println!("  unemployed");
            }
            Ok(person::employment::Employer(e)) => {
                println!("  employer: {}", e?.to_str()?);
            }
            Ok(person::employment::School(s)) => {
                println!("  student at: {}", s?.to_str()?);
            }
            Ok(person::employment::SelfEmployed(())) => {
                println!("  self-employed");
            }
            Err(capnp::NotInSchema(_)) => {}
        }
    }

    Ok(())
}`}</CodeBlock>

      <h2>Hello World RPC</h2>
      <p>
        A minimal RPC example with client and server.
      </p>

      <h3>Schema</h3>
      <CodeBlock language="capnp" filename="hello.capnp">{`@0x9663f4dd604afa35;

interface HelloWorld {
    struct HelloRequest {
        name @0 :Text;
    }

    struct HelloReply {
        message @0 :Text;
    }

    sayHello @0 (request: HelloRequest) -> (reply: HelloReply);
}`}</CodeBlock>

      <h3>Server</h3>
      <CodeBlock filename="server.rs">{`use capnp_rpc::{rpc_twoparty_capnp, twoparty, RpcSystem};
use futures::AsyncReadExt;
use std::rc::Rc;

capnp::generated_code!(pub mod hello_world_capnp);
use hello_world_capnp::hello_world;

struct HelloWorldImpl;

impl hello_world::Server for HelloWorldImpl {
    async fn say_hello(
        self: Rc<Self>,
        params: hello_world::SayHelloParams,
        mut results: hello_world::SayHelloResults,
    ) -> Result<(), capnp::Error> {
        let request = params.get()?.get_request()?;
        let name = request.get_name()?.to_str()?;
        results.get().init_reply().set_message(format!("Hello, {}!", name));
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "127.0.0.1:8080";
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("Listening on {}", addr);

    let client: hello_world::Client = capnp_rpc::new_client(HelloWorldImpl);

    tokio::task::LocalSet::new()
        .run_until(async move {
            loop {
                let (stream, _) = listener.accept().await?;
                stream.set_nodelay(true)?;

                let (reader, writer) =
                    tokio_util::compat::TokioAsyncReadCompatExt::compat(stream).split();

                let network = twoparty::VatNetwork::new(
                    futures::io::BufReader::new(reader),
                    futures::io::BufWriter::new(writer),
                    rpc_twoparty_capnp::Side::Server,
                    Default::default(),
                );

                let rpc = RpcSystem::new(Box::new(network), Some(client.clone().client));
                tokio::task::spawn_local(rpc);
            }
        })
        .await
}`}</CodeBlock>

      <h3>Client</h3>
      <CodeBlock filename="client.rs">{`use capnp_rpc::{rpc_twoparty_capnp, twoparty, RpcSystem};
use futures::AsyncReadExt;

capnp::generated_code!(pub mod hello_world_capnp);
use hello_world_capnp::hello_world;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "127.0.0.1:8080";
    let name = std::env::args().nth(1).unwrap_or_else(|| "World".into());

    tokio::task::LocalSet::new()
        .run_until(async move {
            let stream = tokio::net::TcpStream::connect(addr).await?;
            stream.set_nodelay(true)?;

            let (reader, writer) =
                tokio_util::compat::TokioAsyncReadCompatExt::compat(stream).split();

            let network = Box::new(twoparty::VatNetwork::new(
                futures::io::BufReader::new(reader),
                futures::io::BufWriter::new(writer),
                rpc_twoparty_capnp::Side::Client,
                Default::default(),
            ));

            let mut rpc = RpcSystem::new(network, None);
            let client: hello_world::Client =
                rpc.bootstrap(rpc_twoparty_capnp::Side::Server);

            tokio::task::spawn_local(rpc);

            let mut request = client.say_hello_request();
            request.get().init_request().set_name(&name);

            let reply = request.send().promise.await?;
            let message = reply.get()?.get_reply()?.get_message()?.to_str()?;
            println!("{}", message);

            Ok(())
        })
        .await
}`}</CodeBlock>

      <h2>Async File Processing</h2>
      <p>
        Reading and writing Cap'n Proto messages with async file I/O.
      </p>
      <CodeBlock>{`use capnp_futures::serialize;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader, BufWriter};
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

async fn write_to_file(path: &str, name: &str) -> capnp::Result<()> {
    let file = File::create(path).await.map_err(|e| capnp::Error::failed(e.to_string()))?;
    let writer = BufWriter::new(file).compat_write();

    let mut message = capnp::message::Builder::new_default();
    message.init_root::<person::Builder>().set_name(name);

    serialize::write_message(writer, &message).await
}

async fn read_from_file(path: &str) -> capnp::Result<String> {
    let file = File::open(path).await.map_err(|e| capnp::Error::failed(e.to_string()))?;
    let reader = BufReader::new(file).compat();

    let message = serialize::read_message(reader, capnp::message::ReaderOptions::new()).await?;
    let person = message.get_root::<person::Reader>()?;

    Ok(person.get_name()?.to_str()?.to_string())
}`}</CodeBlock>

      <h2>no_std Example</h2>
      <p>
        Using Cap'n Proto in embedded or WASM environments without std.
      </p>
      <CodeBlock language="toml" filename="Cargo.toml">{`[dependencies]
capnp = { version = "0.25", default-features = false, features = ["alloc"] }`}</CodeBlock>

      <CodeBlock>{`#![no_std]
extern crate alloc;

use alloc::vec::Vec;
use capnp::message::{Builder, ReaderOptions};
use capnp::serialize;

fn roundtrip(data: &[u8]) -> capnp::Result<Vec<u8>> {
    // Read
    let reader = serialize::read_message_from_flat_slice(
        &mut &*data,
        ReaderOptions::new(),
    )?;

    let person = reader.get_root::<person::Reader>()?;

    // Write
    let mut message = Builder::new_default();
    message.set_root(person)?;

    let mut output = Vec::new();
    serialize::write_message(&mut output, &message)?;

    Ok(output)
}`}</CodeBlock>
    </Layout>
  )
}
