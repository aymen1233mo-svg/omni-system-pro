import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  on: (channel: string, func: (...args: any[]) => void) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  savePdf: (options: any) => ipcRenderer.invoke("save-pdf", options),
  printHtml: (options: any) => ipcRenderer.invoke("print-html", options),
  openPath: (filePath: string) => ipcRenderer.invoke("open-path", filePath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke("show-item-in-folder", filePath),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  printSilent: (printerName: string) => ipcRenderer.invoke("print-silent", printerName),
});
