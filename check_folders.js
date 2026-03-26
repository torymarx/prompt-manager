const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://appotqrphjcaashnchcv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcG90cXJwaGpjYWFzaG5jaGN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEwMzAwMCwiZXhwIjoyMDg3Njc5MDAwfQ.F1w7smBqxD7886kyLtlIqr9b9s2VXxTPbfaGb-Zv1b8');

async function checkFolders() {
  const { data, error } = await client.from('folders').select('id, name, sort_order');
  if (error) {
    console.log('ERROR:', error.message);
  } else {
    console.log('FOLDERS:', data);
  }
}
checkFolders();
