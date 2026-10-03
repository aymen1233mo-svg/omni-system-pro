import fetch from 'node-fetch';
const run = async () => {
  const res = await fetch('http://localhost:3000/api/travel/visas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: 1,
      passenger_name: 'Test Visa Guest',
      destination: 'UK',
      selling_price: 500,
      cost_price: 350,
    })
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Data:", data);
};
run();
