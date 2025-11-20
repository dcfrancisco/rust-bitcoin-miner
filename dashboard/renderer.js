// DOM elements
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const hashRate = document.getElementById("hashRate");
const totalHashes = document.getElementById("totalHashes");
const difficulty = document.getElementById("difficulty");
const miningStatus = document.getElementById("miningStatus");
const logContainer = document.getElementById("logContainer");
const difficultyInput = document.getElementById("difficultyInput");
const connectBtn = document.getElementById("connectBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

let isConnected = false;
let isMining = false;

// Logging function
function addLog(message, type = "info") {
  const logEntry = document.createElement("div");
  logEntry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  logEntry.textContent = `[${timestamp}] ${message}`;
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Format numbers
function formatHashRate(rate) {
  if (rate >= 1000000) {
    return `${(rate / 1000000).toFixed(2)} MH/s`;
  } else if (rate >= 1000) {
    return `${(rate / 1000).toFixed(2)} KH/s`;
  }
  return `${rate.toFixed(2)} H/s`;
}

function formatNumber(num) {
  return num.toLocaleString();
}

// Update UI with stats
function updateStats(stats) {
  hashRate.textContent = formatHashRate(stats.hash_rate);
  totalHashes.textContent = formatNumber(stats.total_hashes);
  difficulty.textContent = stats.current_difficulty;
  miningStatus.textContent = stats.is_mining ? "Mining" : "Idle";
}

// Connect button
connectBtn.addEventListener("click", async () => {
  if (!isConnected) {
    const result = await window.electronAPI.connectWs("ws://localhost:3000/ws");
    if (result.success) {
      addLog("Connecting to WebSocket...", "info");
    } else {
      addLog(`Connection failed: ${result.error}`, "error");
    }
  } else {
    const result = await window.electronAPI.disconnectWs();
    if (result.success) {
      addLog("Disconnected from WebSocket", "info");
      isConnected = false;
      updateConnectionStatus(false);
    }
  }
});

// Start mining button
startBtn.addEventListener("click", async () => {
  const targetDifficulty = parseInt(difficultyInput.value);
  if (targetDifficulty < 1 || targetDifficulty > 32) {
    addLog("Difficulty must be between 1 and 32", "error");
    return;
  }

  addLog(`Starting mining with difficulty ${targetDifficulty}...`, "info");
  startBtn.disabled = true;
  stopBtn.disabled = false;
  isMining = true;

  const result = await window.electronAPI.startMining(targetDifficulty);

  if (result.success) {
    addLog(`Mining completed! Nonce: ${result.data.nonce}`, "success");
    addLog(`Hash: ${result.data.hash}`, "success");
    addLog(`Iterations: ${formatNumber(result.data.iterations)}`, "success");
  } else {
    addLog(`Mining failed: ${result.error}`, "error");
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  isMining = false;
});

// Stop mining button
stopBtn.addEventListener("click", async () => {
  addLog("Stopping mining...", "info");
  const result = await window.electronAPI.stopMining();

  if (result.success) {
    addLog("Mining stopped", "info");
  } else {
    addLog(`Failed to stop: ${result.error}`, "error");
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  isMining = false;
});

// Update connection status
function updateConnectionStatus(connected) {
  isConnected = connected;
  if (connected) {
    statusIndicator.classList.add("connected");
    statusText.textContent = "Connected";
    connectBtn.textContent = "Disconnect";
    connectBtn.className = "btn-danger";
    startBtn.disabled = false;
  } else {
    statusIndicator.classList.remove("connected");
    statusText.textContent = "Disconnected";
    connectBtn.textContent = "Connect";
    connectBtn.className = "btn-success";
    startBtn.disabled = true;
    stopBtn.disabled = true;
  }
}

// Listen for WebSocket status updates
window.electronAPI.onWsStatus((status) => {
  if (status.connected) {
    addLog("Connected to mining engine", "success");
    updateConnectionStatus(true);
  } else {
    addLog("Disconnected from mining engine", "error");
    updateConnectionStatus(false);
  }
});

// Listen for mining stats updates
window.electronAPI.onMiningStats((stats) => {
  updateStats(stats);
});

// Initialize
addLog(
  "Dashboard ready. Start the Rust backend with: cd backend/miner && cargo run",
  "info"
);
