import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  console.log('Test log function invoked!');
  return new Response('Hello from test log function!', {
    headers: { 'Content-Type': 'text/plain' },
  });
});
