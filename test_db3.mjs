import Database from 'better-sqlite3';
const db = new Database('./artifacts/api-server/data/pos.db');
const row = db.prepare("PRAGMA table_info(travel_bus_bookings)").all();
console.log(row.filter(r => r.notnull).map(r => r.name));
