import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qnrojyamcrvikbezkzwk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucm9qeWFtY3J2aWtiZXprendrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyNjg5NiwiZXhwIjoyMDY3NjAyODk2fQ.V_Y0bwLkOhkqgE5sqhk5aqsIdltDzBlEzaCdoK4Dr10';

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
      console.log('User already exists. Let\'s get the user and update password.');
      // Update the user
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users.users.find(u => u.email === 'master@inpsytorder.com');
      if (existing) {
        await supabase.auth.admin.updateUserById(existing.id, {
          password: '961115',
          user_metadata: { name: '김건우' },
          app_metadata: { role: 'master' }
        });
        
        // Also ensure user_profile exists
        const { error: profileError } = await supabase.from('user_profiles').upsert({
          id: existing.id,
          email: 'master@inpsytorder.com',
          name: '김건우',
          role: 'master'
        });
        if (profileError) console.error('Profile error:', profileError);
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
