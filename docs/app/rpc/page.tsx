import Layout from '@/components/Layout'
import CodeBlock from '@/components/CodeBlock'

export default function RPC() {
  return (
    <Layout>
      <h1>RPC</h1>
      <p>
        The <code>capnp-rpc</code> crate implements Cap'n Proto's object-capability RPC protocol.
        It supports promise pipelining, capability passing, and "level 1" features.
      </p>

      <h2>Dependencies</h2>
      <CodeBlock language="toml" filename="Cargo.toml">{`[dependencies]
capnp = "0.25"
capnp-rpc = "0.25"
futures = "0.3"
tokio = { version = "1", features = ["full"] }
tokio-util = { version = "0.7", features = ["compat"] }

[build-dependencies]
capnpc = "0.25"`}</CodeBlock>

      <h2>Schema Definition</h2>
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

      <h2>Server Implementation</h2>
      <p>
        Implement the generated <code>Server</code> trait for your interface:
      </p>
      <CodeBlock filename="server.rs">{`use capnp_rpc::{rpc_twoparty_capnp, twoparty, RpcSystem};
use crate::hello_world_capnp::hello_world;
use futures::AsyncReadExt;
use std::rc::Rc;

struct HelloWorldImpl;

impl hello_world::Server for HelloWorldImpl {
    async fn say_hello(
        self: Rc<Self>,
        params: hello_world::SayHelloParams,
        mut results: hello_world::SayHelloResults,
    ) -> Result<(), capnp::Error> {
        let request = params.get()?.get_request()?;
        let name = request.get_name()?.to_str()?;
        let message = format!("Hello, {}!", name);

        results.get().init_reply().set_message(message);
        Ok(())
    }
}

pub async fn run_server(addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind(addr).await?;
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

                let rpc_system = RpcSystem::new(
                    Box::new(network),
                    Some(client.clone().client),
                );

                tokio::task::spawn_local(rpc_system);
            }
        })
        .await
}`}</CodeBlock>

      <h2>Client Implementation</h2>
      <CodeBlock filename="client.rs">{`use capnp_rpc::{rpc_twoparty_capnp, twoparty, RpcSystem};
use crate::hello_world_capnp::hello_world;
use futures::AsyncReadExt;

pub async fn run_client(addr: &str, name: &str) -> Result<String, Box<dyn std::error::Error>> {
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

            let mut rpc_system = RpcSystem::new(network, None);
            let client: hello_world::Client =
                rpc_system.bootstrap(rpc_twoparty_capnp::Side::Server);

            tokio::task::spawn_local(rpc_system);

            // Make the RPC call
            let mut request = client.say_hello_request();
            request.get().init_request().set_name(name);

            let reply = request.send().promise.await?;
            let message = reply.get()?.get_reply()?.get_message()?.to_str()?;

            Ok(message.to_string())
        })
        .await
}`}</CodeBlock>

      <h2>Capability Passing</h2>
      <p>
        Interfaces can return other interfaces, enabling capability-based security:
      </p>
      <CodeBlock language="capnp">{`interface Calculator {
    add @0 (a :Float64, b :Float64) -> (result :Float64);

    # Returns a capability to track computation history
    getHistory @1 () -> (history :History);
}

interface History {
    getEntries @0 () -> (entries :List(Text));
    clear @1 () -> ();
}`}</CodeBlock>

      <CodeBlock>{`// Server returns a capability
impl calculator::Server for CalculatorImpl {
    async fn get_history(
        self: Rc<Self>,
        _params: calculator::GetHistoryParams,
        mut results: calculator::GetHistoryResults,
    ) -> Result<(), capnp::Error> {
        let history_client: history::Client =
            capnp_rpc::new_client(HistoryImpl::new(self.entries.clone()));
        results.get().set_history(history_client);
        Ok(())
    }
}

// Client uses the returned capability
let history = calculator.get_history_request().send().promise.await?;
let history_client = history.get()?.get_history()?;
let entries = history_client.get_entries_request().send().promise.await?;`}</CodeBlock>

      <h2>Promise Pipelining</h2>
      <p>
        Cap'n Proto supports promise pipelining - calling methods on results before they arrive:
      </p>
      <CodeBlock>{`// Without pipelining: 2 round trips
let result1 = service.get_foo_request().send().promise.await?;
let foo = result1.get()?.get_foo()?;
let result2 = foo.bar_request().send().promise.await?;

// With pipelining: 1 round trip
let foo = service.get_foo_request().send().pipeline.get_foo();
let result = foo.bar_request().send().promise.await?;`}</CodeBlock>

      <h2>Error Handling</h2>
      <CodeBlock>{`impl my_service::Server for MyServiceImpl {
    async fn risky_operation(
        self: Rc<Self>,
        params: my_service::RiskyOperationParams,
        mut results: my_service::RiskyOperationResults,
    ) -> Result<(), capnp::Error> {
        let input = params.get()?.get_input()?;

        if input.is_empty() {
            return Err(capnp::Error::failed("input cannot be empty".into()));
        }

        // Process...
        Ok(())
    }
}`}</CodeBlock>

      <h2>Cancellation</h2>
      <p>
        RPC calls are automatically cancelled when the future is dropped:
      </p>
      <CodeBlock>{`use tokio::time::{timeout, Duration};

// Cancel if not complete within 5 seconds
match timeout(Duration::from_secs(5), request.send().promise).await {
    Ok(result) => handle_result(result?),
    Err(_) => println!("request timed out"),
}`}</CodeBlock>

      <h2>VatNetwork Options</h2>
      <CodeBlock>{`use capnp_rpc::twoparty::VatNetwork;

let options = capnp_rpc::rpc::Options {
    // Maximum message size (default: no limit)
    message_size_limit: Some(64 * 1024 * 1024),
    ..Default::default()
};

let network = VatNetwork::new(
    reader,
    writer,
    rpc_twoparty_capnp::Side::Server,
    options,
);`}</CodeBlock>

      <h2>LocalSet Requirement</h2>
      <p>
        <code>capnp-rpc</code> uses <code>Rc</code> for efficiency, requiring <code>LocalSet</code>:
      </p>
      <CodeBlock>{`#[tokio::main]
async fn main() {
    // RPC must run in a LocalSet
    tokio::task::LocalSet::new()
        .run_until(async {
            // RPC code here
        })
        .await;
}`}</CodeBlock>
    </Layout>
  )
}
