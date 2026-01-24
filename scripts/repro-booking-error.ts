
async function reproduce() {
  const url = 'http://localhost:3000/public/bookings';
  const payload = {
    serviceId: "cmkiejqgy000bs8drtbzrmocj",
    startAt: "2026-01-24T11:00:00.000Z",
    seatId: "cmkfa9jkv0024sb0fdizfv8kr",
    customerName: "Ellis 0too",
    customerPhone: "0540328284"
  };

  try {
    console.log('Sending request to:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (response.ok) {
      console.log('SUCCESS:', response.status, JSON.stringify(data, null, 2));
    } else {
      console.log('FAILED with status:', response.status);
      console.log('Error Data:', JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.log('ERROR:', error.message);
  }
}

reproduce();

