import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dbPath = path.resolve(process.cwd(), 'naafay_academic.db');
const db = new Database(dbPath);

async function syncTable(tableName, transformRow = (r) => r) {
  try {
    const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
    if (rows.length === 0) {
      console.log(`ℹ️ [${tableName}] No rows in SQLite, skipping.`);
      return;
    }

    const transformed = rows.map(transformRow);
    const { data, error } = await supabase.from(tableName).upsert(transformed, { onConflict: 'id' });
    if (error) {
      console.warn(`⚠️ [${tableName}] Supabase upsert error:`, error.message);
    } else {
      console.log(`✅ [${tableName}] Successfully synced ${transformed.length} rows to Supabase.`);
    }
  } catch (err) {
    console.warn(`⚠️ [${tableName}] Failed:`, err.message);
  }
}

async function runSync() {
  console.log('🚀 Starting sync from SQLite to Supabase (' + supabaseUrl + ')...');

  // Verify connection
  const { error: pingErr } = await supabase.from('profiles').select('id').limit(1);
  if (pingErr && pingErr.code === 'PGRST205') {
    console.error('\n❌ ERROR: Supabase tables have not been created yet!');
    console.error('👉 Please open Supabase SQL Editor and execute `supabase/complete_schema_and_seed.sql` first.\n');
    process.exit(1);
  }

  // Sync in foreign key order
  await syncTable('roles');
  await syncTable('profiles');
  await syncTable('user_roles');
  await syncTable('academic_years');
  await syncTable('classes');
  await syncTable('batches');
  await syncTable('subjects');
  await syncTable('books');
  await syncTable('attendance_sessions');
  await syncTable('teachers');
  await syncTable('teacher_assignments');
  await syncTable('students');
  await syncTable('guardians');
  await syncTable('student_guardians');
  await syncTable('enrollments');
  await syncTable('attendance_records');
  await syncTable('study_logs');
  await syncTable('portal_settings');

  console.log('\n🎉 All local SQLite data has been synchronized with Supabase cloud database!');
}

runSync().catch(console.error);
