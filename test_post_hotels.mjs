import fetch from 'node-fetch';
const run = async () => {
  const res = await fetch('http://localhost:3000/api/travel/hotels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: 1,
      guest_name: 'Test Hotel Guest',
      hotel_name: 'Test Hotel',
      selling_price: 1000,
      cost_price: 800,
    })
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Data:", data);
};
run();
