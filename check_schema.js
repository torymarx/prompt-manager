const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://appotqrphjcaashnchcv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcG90cXJwaGpjYWFzaG5jaGN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEwMzAwMCwiZXhwIjoyMDg3Njc5MDAwfQ.F1w7smBqxD7886kyLtlIqr9b9s2VXxTPbfaGb-Zv1b8');

async function check() {
  const { data: cols, error } = await client.from('prompts').select('*').limit(1);
  if (error) {
    console.log('ERROR:', error.message);
  } else if (cols && cols.length > 0) {
    console.log('COLUMNS:', Object.keys(cols[0]));
    console.log('IMAGE_URL TYPE:', typeof cols[0].image_url);
  } else {
    // If no data, try to get columns from another way
    const { data: info } = await client.rpc('get_table_schema', { table_name: 'prompts' }).catch(() => ({ data: null }));
    console.log('INFO:', info || 'No data in table');
  }
}
check();
