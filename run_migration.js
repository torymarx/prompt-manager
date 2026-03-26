const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://appotqrphjcaashnchcv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcG90cXJwaGpjYWFzaG5jaGN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEwMzAwMCwiZXhwIjoyMDg3Njc5MDAwfQ.F1w7smBqxD7886kyLtlIqr9b9s2VXxTPbfaGb-Zv1b8');

async function migrate() {
  console.log('Starting migration...');
  // We can't run arbitrary SQL easily via JS client if not defined as RPC.
  // But we can check if it already failed due to missing image_urls.
  // If we can't run SQL, we must rely on code-level fallback for now and ask user to run SQL.
  
  try {
    const { data, error } = await client.from('prompts').select('image_urls').limit(1);
    if (error && error.code === '42P1') {
      console.log('image_urls column is missing. Please run the SQL migration.');
    } else {
      console.log('image_urls column exists or other error:', error?.message);
    }
  } catch (e) {
    console.log('Exception:', e.message);
  }
}
migrate();
