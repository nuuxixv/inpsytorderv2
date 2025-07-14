CREATE TRIGGER on_order_status_paid
AFTER UPDATE ON orders
FOR EACH ROW WHEN (NEW.status = 'paid' AND OLD.status != 'paid')
EXECUTE FUNCTION supabase_functions.http_request(
    'http://localhost:5173/functions/v1/send-order-email',
    'POST',
    '{"Content-Type":"application/json"}',
    '{}',
    '1000'
);