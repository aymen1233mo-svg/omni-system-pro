import fetch from 'node-fetch';
const run = async () => {
  const res = await fetch('http://localhost:3000/api/travel/bus-bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: "",
      customer_name: 'Test',
      company_id: "",
      company_name: "Test Company",
      selling_price: "",
      cost_price: "20",
    })
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Data:", data);
};
run();
