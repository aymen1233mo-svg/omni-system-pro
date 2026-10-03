const { app } = require('electron');
const path = require('path');
process.env.NODE_ENV = 'production';
process.env.PORT = '3001'; // try a different port just in case
process.env.APP_ROOT = __dirname;
try {
  require('./dist/server.cjs');
} catch (e) {
  console.error("REQUIRE ERROR:", e);
  app.quit();
}
