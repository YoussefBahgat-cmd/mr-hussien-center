const SUPABASE_URL = 'https://aknhxrhlahusgfpiknau.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BFsu6iC-nWsKfdKQgoXimQ_dNmbgxTj';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const GROUPS = ['س ث 1:30','س ث 5','ح ع 12','ح ع 3','ث خ 1:30','ث خ 3','ث خ 5','ث خ 6:30'];
const paymentMonth = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
