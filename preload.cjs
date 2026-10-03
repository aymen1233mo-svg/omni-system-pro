// artifacts/pos-system/src/main/preload.js
var { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  savePdf: (options) => ipcRenderer.invoke("save-pdf", options),
  printHtml: (options) => ipcRenderer.invoke("print-html", options),
  openPath: (filePath) => ipcRenderer.invoke("open-path", filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke("show-item-in-folder", filePath),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  printSilent: (printerName) => ipcRenderer.invoke("print-silent", printerName)
});
