
async function verify() {
  const serviceId = 'cmkiejqgy000bs8drtbzrmocj';
  const date = '2026-01-24';
  const url = `http://localhost:3000/public/catalog/services/${serviceId}/availability?date=${date}`;

  try {
    console.log('Fetching availability from:', url);
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.log('FAILED to fetch availability:', response.status, data);
      return;
    }

    const targetSlot = data.find((s: any) => s.startAt.startsWith('2026-01-24T11:00:00'));
    
    if (targetSlot) {
      console.log('Target Slot found:');
      console.log(JSON.stringify(targetSlot, null, 2));
      if (targetSlot.availableSeats === 0) {
        console.log('✅ SUCCESS: Slot is correctly marked as UNAVAILABLE (0 seats).');
      } else {
        console.log(`❌ FAILURE: Slot still shows ${targetSlot.availableSeats} available seats.`);
      }
    } else {
      console.log('❌ FAILURE: Target slot 11:00 AM not found in response.');
    }
  } catch (error: any) {
    console.log('ERROR:', error.message);
  }
}

verify();
