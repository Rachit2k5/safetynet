const BASE_URL = 'http://localhost:3001';

async function runLiveDemo() {
  console.log('=== SafeRoute Live API Verification Demo (Port 3001) ===\n');

  // 1. Create Profile
  console.log('1. Creating User Profile ("rachit verma")...');
  const userRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'rachit verma' })
  });
  const user = await userRes.json();
  console.log('   ✓ User Created:', user);
  const token = user.sessionToken;

  // 2. Add Trusted Contact
  console.log('\n2. Adding Trusted Contact ("Bob")...');
  const contactRes = await fetch(`${BASE_URL}/api/users/${user.id}/contacts`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: 'Bob', email: 'bob@example.com', phone: '+1234567890' })
  });
  const contact = await contactRes.json();
  console.log('   ✓ Contact Added:', contact);

  // 3. Test Risk Scoring Engine
  console.log('\n3. Testing AI Risk Scoring Engine at 2:00 AM...');
  const routeRes = await fetch(`${BASE_URL}/api/routes/score`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      hour: 2,
      routes: [
        {
          name: 'Main Street Route (Lit)',
          waypoints: [{ lat: 28.6139, lng: 77.2090 }]
        },
        {
          name: 'Dark Alley Route (High Risk Area)',
          waypoints: [{ lat: 28.6140, lng: 77.2095 }]
        }
      ]
    })
  });
  const routeScore = await routeRes.json();
  console.log('   ✓ Route Safety Analysis Results:');
  console.dir(routeScore, { depth: null });

  // 4. Start Safety Trip
  console.log('\n4. Starting a Safety Trip...');
  const tripRes = await fetch(`${BASE_URL}/api/trips`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      origin: 'Campus Library',
      destination: 'West Hostel',
      origin_lat: 28.6139,
      origin_lng: 77.2090,
      dest_lat: 28.6180,
      dest_lng: 77.2150,
      expected_arrival: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      checkin_interval_ms: 60000 // 1 min for demo
    })
  });
  const trip = await tripRes.json();
  console.log('   ✓ Trip Started:', trip);

  // 5. Test Check-in with Distress Parsing
  console.log('\n5. Performing Check-in with Latent Distress Message ("I am safe but someone is following me")...');
  const checkinRes = await fetch(`${BASE_URL}/api/trips/${trip.id}/checkin`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'safe',
      message: 'I am safe but someone is following me please hurry',
      lat: 28.6150,
      lng: 77.2100
    })
  });
  const checkinResult = await checkinRes.json();
  console.log('   ✓ Distress Sentiment Parsing Result:', checkinResult);

  // 6. Test Contact Shared Link View
  console.log('\n6. Fetching Public Contact View via Share Token...');
  const statusRes = await fetch(`${BASE_URL}/api/trips/${trip.id}/status/${trip.shareToken}`);
  const statusData = await statusRes.json();
  console.log('   ✓ Contact Status View Data:', statusData);

  // 7. Trigger Panic Alert
  console.log('\n7. Triggering Emergency Panic Button...');
  const panicRes = await fetch(`${BASE_URL}/api/trips/${trip.id}/panic`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      lat: 28.6155,
      lng: 77.2105
    })
  });
  const panicResult = await panicRes.json();
  console.log('   ✓ Panic Alert Broadcasted:', panicResult);

  console.log('\n=== Live API Demo Complete! All Systems Nominal ===');
}

runLiveDemo().catch(console.error);
