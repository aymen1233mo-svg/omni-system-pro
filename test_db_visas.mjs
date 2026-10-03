import Database from 'better-sqlite3';
const db = new Database('./artifacts/api-server/data/pos.db');
const row = db.prepare("PRAGMA table_info(travel_visas)").all();
console.log(row.map(r => r.name + (r.notnull ? ' NOT NULL' : '')));
