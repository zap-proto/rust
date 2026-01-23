import Layout from '@/components/Layout'
import CodeBlock from '@/components/CodeBlock'

export default function Installation() {
  return (
    <Layout>
      <h1>Installation</h1>
      <p>
        This guide covers installing capnp-rust crates and the Cap'n Proto compiler.
      </p>

      <h2>Prerequisites</h2>
      <p>
        You need the <code>capnp</code> CLI tool to compile schema files. Install it for your platform:
      </p>

      <h3>macOS</h3>
      <CodeBlock language="bash">{`brew install capnp`}</CodeBlock>

      <h3>Ubuntu/Debian</h3>
      <CodeBlock language="bash">{`apt-get install capnproto`}</CodeBlock>

      <h3>Fedora</h3>
      <CodeBlock language="bash">{`dnf install capnproto`}</CodeBlock>

      <h3>From Source</h3>
      <CodeBlock language="bash">{`curl -O https://capnproto.org/capnproto-c++-1.0.2.tar.gz
tar zxf capnproto-c++-1.0.2.tar.gz
cd capnproto-c++-1.0.2
./configure
make -j$(nproc)
sudo make install`}</CodeBlock>

      <h2>Rust Dependencies</h2>
      <p>Add crates using <code>cargo add</code>:</p>

      <h3>Basic Serialization</h3>
      <CodeBlock language="bash">{`cargo add capnp
cargo add capnpc --build`}</CodeBlock>

      <h3>Async I/O</h3>
      <CodeBlock language="bash">{`cargo add capnp capnp-futures
cargo add capnpc --build`}</CodeBlock>

      <h3>RPC</h3>
      <CodeBlock language="bash">{`cargo add capnp capnp-rpc
cargo add capnpc --build`}</CodeBlock>

      <h2>Cargo.toml Example</h2>
      <CodeBlock language="toml" filename="Cargo.toml">{`[package]
name = "my-app"
version = "0.1.0"
edition = "2021"

[dependencies]
capnp = "0.25"
capnp-futures = "0.25"  # for async
capnp-rpc = "0.25"      # for RPC

[build-dependencies]
capnpc = "0.25"`}</CodeBlock>

      <h2>Feature Flags</h2>
      <p>The <code>capnp</code> crate provides several feature flags:</p>
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>std</code></td>
            <td>Yes</td>
            <td>Enable standard library support</td>
          </tr>
          <tr>
            <td><code>alloc</code></td>
            <td>Yes</td>
            <td>Enable heap allocation (required for message building)</td>
          </tr>
          <tr>
            <td><code>sync_reader</code></td>
            <td>No</td>
            <td>Make readers <code>Sync</code> using atomic operations</td>
          </tr>
          <tr>
            <td><code>unaligned</code></td>
            <td>No</td>
            <td>Relax alignment requirements (performance cost on some targets)</td>
          </tr>
        </tbody>
      </table>

      <h3>no_std Configuration</h3>
      <CodeBlock language="toml">{`[dependencies]
capnp = { version = "0.25", default-features = false }`}</CodeBlock>

      <h3>no_std with alloc</h3>
      <CodeBlock language="toml">{`[dependencies]
capnp = { version = "0.25", default-features = false, features = ["alloc"] }`}</CodeBlock>

      <h2>Verify Installation</h2>
      <CodeBlock language="bash">{`# Check capnp CLI
capnp --version

# Check Rust crates compile
cargo check`}</CodeBlock>
    </Layout>
  )
}
