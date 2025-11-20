# Rust Bitcoin Miner + Electron Dashboard

A functional Bitcoin mining engine written in Rust, with a real-time monitoring dashboard built using Electron + Node.js.

## Features
- Double SHA-256 hashing engine
- Difficulty target + nonce scanning
- Fake-block mining (education mode)
- Real Stratum pool mining (future phase)
- WebSocket + HTTP API
- Electron dashboard UI for:
  - Hashrate charts
  - Logs
  - Start/Stop mining
  - Worker stats

## Project
```
rust-bitcoin-miner/
├─ backend/ # Rust mining engine
├─ dashboard/ # Electron UI
├─ docs/ # Architecture & notes
└─ README.md
```

## Roadmap
1. Basic mining engine (Rust)
2. Real difficulty + metrics
3. Multithreaded hashing
4. WebSocket/HTTP API layer
5. Electron dashboard (real-time)
6. Stratum mining support
7. Wallet generator (BIP39/secp256k1)

