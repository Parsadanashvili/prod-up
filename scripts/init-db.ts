#!/usr/bin/env bun
// Database initialization script
// Run with: bun run scripts/init-db.ts

import { initializeDatabase } from '../lib/db/client';

async function main() {
  console.log('Initializing database...');
  try {
    await initializeDatabase();
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

main();

