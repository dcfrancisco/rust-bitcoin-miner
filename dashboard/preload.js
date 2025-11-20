const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Launcher operations
  checkBackend: () => ipcRenderer.invoke("check-backend"),
  openDashboard: () => ipcRenderer.invoke("open-dashboard"),
  closeLauncher: () => ipcRenderer.invoke("close-launcher"),
  quit: () => ipcRenderer.invoke("quit"),

  // WebSocket connection
  connectWs: (url) => ipcRenderer.invoke("connect-ws", url),
  disconnectWs: () => ipcRenderer.invoke("disconnect-ws"),

  // Mining operations
  startMining: (difficulty) => ipcRenderer.invoke("start-mining", difficulty),
  stopMining: () => ipcRenderer.invoke("stop-mining"),
  getStats: () => ipcRenderer.invoke("get-stats"),

  // Event listeners
  onMiningStats: (callback) => {
    ipcRenderer.on("mining-stats", (event, stats) => callback(stats));
  },
  onWsStatus: (callback) => {
    ipcRenderer.on("ws-status", (event, status) => callback(status));
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
