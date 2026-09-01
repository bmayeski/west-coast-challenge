// supabaseClient.js
// Use the ESM (ES Module) CDN link for Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://lzridmgajncsntnuyrrw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cmlkbWdham5jc250bnV5cnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjUzOTIsImV4cCI6MjEwMjkwMTM5Mn0.e5T5N1NauSB1rHT0IGqSuqB-CO2nuWpJn8On2o8Nvko';

export const supabase = createClient(supabaseUrl, supabaseKey);