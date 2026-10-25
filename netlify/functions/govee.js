exports.handler = async function(event, context) {
    const apiKey = process.env.GOVEE_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'GOVEE_API_KEY niet ingesteld' })
        };
    }

    const headers = { 'Govee-API-Key': apiKey };

    try {
        const devResponse = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', { headers });
        const devData = await devResponse.json();
        
        let sensors = [];
        if (devData && devData.data) {
            for (let dev of devData.data) {
                try {
                    const stateUrl = `https://openapi.api.govee.com/router/api/v1/user/devices/state?device=${dev.device}&sku=${dev.sku}`;
                    const stateResponse = await fetch(stateUrl, { headers });
                    const stateData = await stateResponse.json();
                    
                    let t = 20, h = 50;
                    const capabilities = stateData?.payload?.capabilities || stateData?.data?.capabilities || [];
                    
                    for (let cap of capabilities) {
                        const val = cap.state?.value !== undefined ? cap.state.value : cap.value;
                        if (val !== undefined) {
                            if (cap.instance === 'sensorTemperature' || cap.instance === 'temperature') {
                                t = val > 60 ? val / 100 : val;
                            }
                            if (cap.instance === 'sensorHumidity' || cap.instance === 'humidity') {
                                h = val > 100 ? val / 100 : val;
                            }
                        }
                    }

                    let rawName = dev.deviceName || 'Govee Sensor';
                    if (rawName.toLowerCase().includes('bouwmuur') || rawName.toLowerCase().includes('kier')) {
                        rawName = 'Badkamer';
                    }

                    sensors.push({
                        id: dev.device,
                        name: rawName,
                        temp: t,
                        humidity: h
                    });
                } catch (err) {
                    console.error(`Fout bij sensor ${dev.device}:`, err);
                }
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sensors)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
