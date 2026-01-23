import Layout from '@/components/Layout'
import CodeBlock from '@/components/CodeBlock'

export default function AsyncPatterns() {
  return (
    <Layout>
      <h1>Async/Await Patterns</h1>
      <p>
        The <code>capnp-futures</code> crate provides async message serialization
        compatible with the Rust async ecosystem. It builds on <code>futures</code>
        traits for interoperability with Tokio, async-std, and other runtimes.
      </p>

      <h2>Dependencies</h2>
      <CodeBlock language="toml" filename="Cargo.toml">{`[dependencies]
capnp = "0.25"
capnp-futures = "0.25"
futures = "0.3"
tokio = { version = "1", features = ["full"] }`}</CodeBlock>

      <h2>Async Message Reading</h2>
      <CodeBlock>{`use capnp_futures::serialize;
use capnp::message::ReaderOptions;

async fn read_message<R>(reader: R) -> capnp::Result<String>
where
    R: futures::AsyncRead + Unpin,
{
    let message = serialize::read_message(reader, ReaderOptions::new()).await?;
    let person = message.get_root::<person::Reader>()?;
    Ok(person.get_name()?.to_str()?.to_string())
}`}</CodeBlock>

      <h2>Async Message Writing</h2>
      <CodeBlock>{`use capnp_futures::serialize;
use capnp::message;

async fn write_message<W>(writer: W, name: &str) -> capnp::Result<()>
where
    W: futures::AsyncWrite + Unpin,
{
    let mut msg = message::Builder::new_default();
    let mut person = msg.init_root::<person::Builder>();
    person.set_name(name);

    serialize::write_message(writer, &msg).await
}`}</CodeBlock>

      <h2>TCP Stream Example</h2>
      <CodeBlock>{`use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncReadCompatExt;
use capnp_futures::serialize;
use capnp::message::ReaderOptions;

async fn handle_connection(stream: TcpStream) -> capnp::Result<()> {
    // Convert Tokio stream to futures-compatible
    let (reader, writer) = stream.compat().split();

    // Read a message
    let message = serialize::read_message(reader, ReaderOptions::new()).await?;
    let request = message.get_root::<request::Reader>()?;

    // Process and respond
    let mut response = capnp::message::Builder::new_default();
    {
        let mut resp = response.init_root::<response::Builder>();
        resp.set_status(200);
    }

    serialize::write_message(writer, &response).await
}`}</CodeBlock>

      <h2>Message Streaming</h2>
      <p>
        For protocols that send multiple messages, use a loop with the async reader:
      </p>
      <CodeBlock>{`use futures::AsyncReadExt;

async fn read_messages<R>(mut reader: R) -> capnp::Result<Vec<String>>
where
    R: futures::AsyncRead + Unpin,
{
    let mut results = Vec::new();
    let options = ReaderOptions::new();

    loop {
        match serialize::try_read_message(&mut reader, options).await? {
            Some(message) => {
                let item = message.get_root::<item::Reader>()?;
                results.push(item.get_name()?.to_str()?.to_string());
            }
            None => break, // EOF
        }
    }

    Ok(results)
}`}</CodeBlock>

      <h2>Packed Format</h2>
      <CodeBlock>{`use capnp_futures::serialize_packed;

// Read packed message
let message = serialize_packed::read_message(reader, options).await?;

// Write packed message
serialize_packed::write_message(writer, &message).await?;`}</CodeBlock>

      <h2>Buffered I/O</h2>
      <p>
        For better performance, wrap streams in buffered readers/writers:
      </p>
      <CodeBlock>{`use futures::io::{BufReader, BufWriter};

let reader = BufReader::new(stream_reader);
let writer = BufWriter::new(stream_writer);

let message = serialize::read_message(reader, options).await?;
serialize::write_message(writer, &response).await?;`}</CodeBlock>

      <h2>Error Handling Pattern</h2>
      <CodeBlock>{`use capnp::Error;

async fn process_request<R, W>(reader: R, writer: W) -> Result<(), Box<dyn std::error::Error>>
where
    R: futures::AsyncRead + Unpin,
    W: futures::AsyncWrite + Unpin,
{
    let message = serialize::read_message(reader, ReaderOptions::new())
        .await
        .map_err(|e| format!("read failed: {}", e))?;

    let request = message
        .get_root::<request::Reader>()
        .map_err(|e| format!("invalid request: {}", e))?;

    // Process...

    Ok(())
}`}</CodeBlock>

      <h2>Timeout Pattern</h2>
      <CodeBlock>{`use tokio::time::{timeout, Duration};

async fn read_with_timeout<R>(reader: R) -> capnp::Result<capnp::message::Reader<capnp::serialize::OwnedSegments>>
where
    R: futures::AsyncRead + Unpin,
{
    match timeout(
        Duration::from_secs(30),
        serialize::read_message(reader, ReaderOptions::new())
    ).await {
        Ok(result) => result,
        Err(_) => Err(capnp::Error::failed("read timeout".into())),
    }
}`}</CodeBlock>

      <h2>Concurrent Processing</h2>
      <CodeBlock>{`use futures::stream::{self, StreamExt};

async fn process_batch(items: Vec<Vec<u8>>) -> Vec<capnp::Result<String>> {
    stream::iter(items)
        .map(|data| async move {
            let message = serialize::read_message(
                &mut data.as_slice(),
                ReaderOptions::new()
            ).await?;
            let item = message.get_root::<item::Reader>()?;
            Ok(item.get_name()?.to_str()?.to_string())
        })
        .buffer_unordered(10) // Process up to 10 concurrently
        .collect()
        .await
}`}</CodeBlock>

      <h2>Integration with Tokio</h2>
      <CodeBlock>{`use tokio::net::TcpListener;
use tokio_util::compat::TokioAsyncReadCompatExt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;

    loop {
        let (socket, _) = listener.accept().await?;
        tokio::spawn(async move {
            let (reader, writer) = socket.compat().split();
            if let Err(e) = handle_client(reader, writer).await {
                eprintln!("client error: {}", e);
            }
        });
    }
}`}</CodeBlock>
    </Layout>
  )
}
