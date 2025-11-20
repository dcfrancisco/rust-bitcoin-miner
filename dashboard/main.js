const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let launcherWindow;
let mainWindow;
let ws = null;

// Create the launcher window
function createLauncher() {
  launcherWindow = new BrowserWindow({
    width: 600,
    height: 550,
    resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  launcherWindow.loadFile("launcher.html");

  launcherWindow.on("closed", () => {
    launcherWindow = null;
    // If main window is not open, quit the app
    if (!mainWindow) {
      app.quit();
    }
  });
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("index.html");

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    if (ws) {
      ws.close();
    }
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createLauncher();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncher();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC Handlers

// Check backend status
ipcMain.handle("check-backend", async () => {
  const results = {
    engine: false,
    api: false,
    websocket: false,
  };

  try {
    // Check API endpoint
    const response = await fetch("http://localhost:3000/api/stats");
    if (response.ok) {
      results.api = true;
      results.engine = true;
      results.websocket = true; // If API is up, WebSocket should be available
    }
  } catch (error) {
    // Backend is not running
  }

  return results;
});

// Open dashboard from launcher
ipcMain.handle("open-dashboard", async () => {
  if (!mainWindow) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  return { success: true };
});

// Close launcher
ipcMain.handle("close-launcher", async () => {
  if (launcherWindow) {
    launcherWindow.close();
  }
  return { success: true };
});

// Quit application
ipcMain.handle("quit", async () => {
  app.quit();
  return { success: true };
});

// Connect to WebSocket
ipcMain.handle("connect-ws", async (event, url) => {
  try {
    const WebSocket = require("ws");
    ws = new WebSocket(url || "ws://localhost:3000/ws");

    ws.on("open", () => {
      mainWindow.webContents.send("ws-status", { connected: true });
    });

    ws.on("message", (data) => {
      try {
        const stats = JSON.parse(data.toString());
        mainWindow.webContents.send("mining-stats", stats);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("error", (error) => {
      mainWindow.webContents.send("ws-status", {
        connected: false,
        error: error.message,
      });
    });

    ws.on("close", () => {
      mainWindow.webContents.send("ws-status", { connected: false });
      ws = null;
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Disconnect WebSocket
ipcMain.handle("disconnect-ws", async () => {
  if (ws) {
    ws.close();
    ws = null;
    return { success: true };
  }
  return { success: false, error: "Not connected" };
});

// Start mining
ipcMain.handle("start-mining", async (event, difficulty) => {
  try {
    const response = await fetch("http://localhost:3000/api/mine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_difficulty: difficulty }),
    });
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop mining
ipcMain.handle("stop-mining", async () => {
  try {
    const response = await fetch("http://localhost:3000/api/stop", {
      method: "POST",
    });
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get current stats
ipcMain.handle("get-stats", async () => {
  try {
    const response = await fetch("http://localhost:3000/api/stats");
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
