use sha2::{Sha256, Digest};
use std::sync::Arc;
use tokio::sync::RwLock;
use axum::{
    extract::{State, ws::{WebSocket, WebSocketUpgrade, Message}},
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use futures_util::SinkExt;

// Mining state
#[derive(Clone, Debug, Serialize)]
struct MiningStats {
    hash_rate: f64,
    total_hashes: u64,
    current_difficulty: u32,
    is_mining: bool,
}

#[derive(Clone)]
struct AppState {
    stats: Arc<RwLock<MiningStats>>,
    mining_active: Arc<RwLock<bool>>,
}

// API request/response types
#[derive(Deserialize)]
struct MineRequest {
    target_difficulty: u32,
}

#[derive(Serialize)]
struct MineResponse {
    block_header: String,
    nonce: u64,
    hash: String,
    iterations: u64,
}

// SHA-256d (double SHA-256) implementation
fn sha256d(data: &[u8]) -> Vec<u8> {
    let first_hash = Sha256::digest(data);
    let second_hash = Sha256::digest(&first_hash);
    second_hash.to_vec()
}

// Check if hash meets difficulty (leading zeros)
fn check_difficulty(hash: &[u8], difficulty: u32) -> bool {
    let required_zeros = difficulty / 8;
    let remaining_bits = difficulty % 8;
    
    // Check full bytes
    for i in 0..required_zeros as usize {
        if hash[i] != 0 {
            return false;
        }
    }
    
    // Check remaining bits
    if remaining_bits > 0 {
        let mask = 0xFF << (8 - remaining_bits);
        if hash[required_zeros as usize] & mask != 0 {
            return false;
        }
    }
    
    true
}

// Core mining function with nonce loop
async fn mine_block(
    block_header: &str,
    difficulty: u32,
    state: AppState,
) -> MineResponse {
    let mut nonce: u64 = 0;
    let max_nonce = u64::MAX;
    
    let start_time = std::time::Instant::now();
    let mut last_update = start_time;
    
    loop {
        // Construct block data with nonce
        let data = format!("{}{}", block_header, nonce);
        let hash = sha256d(data.as_bytes());
        
        // Update stats periodically
        if nonce % 10000 == 0 {
            let elapsed = last_update.elapsed().as_secs_f64();
            if elapsed >= 1.0 {
                let hash_rate = 10000.0 / elapsed;
                let mut stats = state.stats.write().await;
                stats.hash_rate = hash_rate;
                stats.total_hashes += 10000;
                last_update = std::time::Instant::now();
            }
        }
        
        // Check if we found a valid hash
        if check_difficulty(&hash, difficulty) {
            let total_time = start_time.elapsed().as_secs_f64();
            let final_hash_rate = nonce as f64 / total_time;
            
            let mut stats = state.stats.write().await;
            stats.hash_rate = final_hash_rate;
            stats.total_hashes += nonce % 10000;
            stats.is_mining = false;
            
            return MineResponse {
                block_header: block_header.to_string(),
                nonce,
                hash: hex::encode(&hash),
                iterations: nonce,
            };
        }
        
        // Check if mining was stopped
        if !*state.mining_active.read().await {
            let mut stats = state.stats.write().await;
            stats.is_mining = false;
            
            return MineResponse {
                block_header: block_header.to_string(),
                nonce,
                hash: hex::encode(&hash),
                iterations: nonce,
            };
        }
        
        nonce += 1;
        
        if nonce >= max_nonce {
            break;
        }
    }
    
    // No valid hash found
    let mut stats = state.stats.write().await;
    stats.is_mining = false;
    
    MineResponse {
        block_header: block_header.to_string(),
        nonce: 0,
        hash: String::from("No valid hash found"),
        iterations: max_nonce,
    }
}

// HTTP handlers
async fn get_stats(State(state): State<AppState>) -> Json<MiningStats> {
    let stats = state.stats.read().await;
    Json(stats.clone())
}

async fn start_mining(
    State(state): State<AppState>,
    Json(payload): Json<MineRequest>,
) -> Json<MineResponse> {
    let mut mining_active = state.mining_active.write().await;
    *mining_active = true;
    
    let mut stats = state.stats.write().await;
    stats.is_mining = true;
    stats.current_difficulty = payload.target_difficulty;
    stats.total_hashes = 0;
    drop(stats);
    drop(mining_active);
    
    // Simple block header for demonstration
    let block_header = "00000000000000000000000000000000";
    
    let result = mine_block(block_header, payload.target_difficulty, state).await;
    Json(result)
}

async fn stop_mining(State(state): State<AppState>) -> Json<serde_json::Value> {
    let mut mining_active = state.mining_active.write().await;
    *mining_active = false;
    
    let mut stats = state.stats.write().await;
    stats.is_mining = false;
    
    Json(serde_json::json!({ "status": "stopped" }))
}

// WebSocket handler
async fn ws_handler(
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    // Send stats updates every second
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(1));
    
    loop {
        interval.tick().await;
        
        let stats = state.stats.read().await;
        let stats_json = serde_json::to_string(&*stats).unwrap();
        
        if socket.send(Message::Text(stats_json)).await.is_err() {
            break;
        }
    }
}

#[tokio::main]
async fn main() {
    // Initialize state
    let state = AppState {
        stats: Arc::new(RwLock::new(MiningStats {
            hash_rate: 0.0,
            total_hashes: 0,
            current_difficulty: 0,
            is_mining: false,
        })),
        mining_active: Arc::new(RwLock::new(false)),
    };
    
    // Build router with HTTP and WebSocket routes
    let app = Router::new()
        .route("/api/stats", get(get_stats))
        .route("/api/mine", post(start_mining))
        .route("/api/stop", post(stop_mining))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);
    
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Bitcoin Miner API listening on http://{}", addr);
    println!("WebSocket endpoint: ws://{}/ws", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

