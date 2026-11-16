const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const outputFile = path.resolve(__dirname, '..', 'supabase', 'complete_schema_and_seed.sql');

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log('Found migration files:', files);

let combined = `-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Unified Database Schema & Complete Seed Data
-- ============================================================================
-- Note: This script resets and rebuilds the clean public schema.
-- Copy and paste this ENTIRE file into Supabase SQL Editor and click "Run".
-- ============================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Ensure senior_mufti is allowed in roles table check constraint
  if (file === '001_academic_schema.sql') {
    content = content.replace(
      "CHECK (name IN ('admin', 'office_staff', 'teacher', 'student', 'mufti'))",
      "CHECK (name IN ('admin', 'office_staff', 'teacher', 'student', 'mufti', 'senior_mufti'))"
    );
  }

  combined += `\n\n-- ============================================================================\n`;
  combined += `-- MIGRATION: ${file}\n`;
  combined += `-- ============================================================================\n\n`;
  combined += content.trim();
  combined += '\n';
}

fs.writeFileSync(outputFile, combined, 'utf8');
console.log('Successfully written to:', outputFile);
console.log('File size:', fs.statSync(outputFile).size, 'bytes');
