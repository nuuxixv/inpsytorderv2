import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const statusText = fs.readFileSync('../.claude/worktrees/laughing-pascal/status.txt', 'utf16le');
const keyMatch = statusText.match(/service_role key:\s+(eyJ[a-zA-Z0-9_.\-]+)/);

if (!keyMatch) {
  console.error('Service role key not found in status.txt');
  process.exit(1);
}

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = keyMatch[1];

console.log('Using local Supabase URL:', supabaseUrl);
console.log('Extracted key starts with:', supabaseServiceKey.substring(0, 15) + '...');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMaster() {
  console.log('Creating master user...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'master@inpsytorder.com',
    password: '961115',
    email_confirm: true,
    user_metadata: { name: '김건우' },
    app_metadata: { role: 'master' }
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('User already exists in Auth. Updating...');
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users.users.find(u => u.email === 'master@inpsytorder.com');
      if (existing) {
        await supabase.auth.admin.updateUserById(existing.id, {
          password: '961115',
          user_metadata: { name: '김건우' },
          app_metadata: { role: 'master' }
        });
        
        const { error: profileError } = await supabase.from('user_profiles').upsert({
          id: existing.id,
          email: 'master@inpsytorder.com',
          name: '김건우',
          role: 'master'
        });
        if (profileError) console.error('Profile update error:', profileError);
        else console.log('Successfully updated master user.');
      }
    } else {
      console.error('Auth Error:', authError);
    }
    return;
  }

  const user = authData.user;
  console.log('Auth user created:', user.id);

  const { error: profileError } = await supabase.from('user_profiles').upsert({
    id: user.id,
    email: 'master@inpsytorder.com',
    name: '김건우',
    role: 'master'
  });

  if (profileError) {
    console.error('Profile Error:', profileError);
  } else {
    console.log('Successfully created master user and profile.');
  }
}

createMaster();
