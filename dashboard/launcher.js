// DOM elements
const engineIndicator = document.getElementById("engineIndicator");
const engineStatus = document.getElementById("engineStatus");
const apiIndicator = document.getElementById("apiIndicator");
const apiStatus = document.getElementById("apiStatus");
const wsIndicator = document.getElementById("wsIndicator");
const wsStatus = document.getElementById("wsStatus");
const launchBtn = document.getElementById("launchBtn");
const launchText = document.getElementById("launchText");
const errorMessage = document.getElementById("errorMessage");

let engineReady = false;
let apiReady = false;
let wsReady = false;

// Check backend status
async function checkBackendStatus() {
  try {
    const result = await window.electronAPI.checkBackend();

    // Update engine status
    if (result.engine) {
      engineIndicator.classList.add("ready");
      engineStatus.textContent = "Ready";
      engineReady = true;
    } else {
      engineStatus.textContent = "Not Running";
      showError(
        "Mining engine is not running. Start it with: cd backend/miner && cargo run"
      );
    }

    // Update API status
    if (result.api) {
      apiIndicator.classList.add("ready");
      apiStatus.textContent = "Online";
      apiReady = true;
    } else {
      apiStatus.textContent = "Offline";
    }

    // Update WebSocket status
    if (result.websocket) {
      wsIndicator.classList.add("ready");
      wsStatus.textContent = "Available";
      wsReady = true;
    } else {
      wsStatus.textContent = "Unavailable";
    }

    // Enable launch button if all services are ready
    updateLaunchButton();
  } catch (error) {
    console.error("Error checking backend:", error);
    showError("Failed to check backend status: " + error.message);
    engineStatus.textContent = "Error";
    apiStatus.textContent = "Error";
    wsStatus.textContent = "Error";
  }
}

function updateLaunchButton() {
  if (engineReady && apiReady && wsReady) {
    launchBtn.disabled = false;
    launchText.textContent = "Launch Dashboard";
  } else {
    launchBtn.disabled = false; // Allow launching anyway
    launchText.textContent = "Launch Dashboard (Limited)";
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add("show");
}

// Launch dashboard
launchBtn.addEventListener("click", async () => {
  launchText.innerHTML = '<span class="spinner"></span> Launching...';
  launchBtn.disabled = true;

  try {
    await window.electronAPI.openDashboard();
    // Close launcher after successful launch
    await window.electronAPI.closeLauncher();
  } catch (error) {
    console.error("Error launching dashboard:", error);
    showError("Failed to launch dashboard: " + error.message);
    launchText.textContent = "Launch Dashboard";
    launchBtn.disabled = false;
  }
});

// Check backend status on load
setTimeout(() => {
  checkBackendStatus();
}, 500);

// Keyboard shortcut
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "q") {
    window.electronAPI.quit();
  }
});
