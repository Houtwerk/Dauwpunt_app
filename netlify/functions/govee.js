exports.handler = async function(event, context) {
    const apiKey = process.env.GOVEE_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'GOVEE_API_KEY niet ingesteld' })
        };
    }

    const headers = { 'Govee-API-Key': apiKey, 'Content-Type': 'application/json' };

    try {
        const devResponse = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', { headers });
        const devData = await devResponse.json();
        
        let sensors = [];
        let devicesList = devData?.data || devData?.payload?.devices || [];

        for (let dev of devicesList) {
            const deviceId = dev.device;
            const sku = dev.sku;
            
            try {
                const bodyData = {
                    requestId: "req_" + Date.now(),
                    payload: {
                        sku: sku,
                        device: deviceId
                    }
                };

                const stateResponse = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices/state', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(bodyData)
                });
                const stateData = await stateResponse.json();
                
                let t = 20, h = 50;
                let capabilities = stateData?.payload?.capabilities || stateData?.data?.capabilities || stateData?.capabilities || [];

                for (let cap of capabilities) {
                    let val = cap?.state?.value ?? cap?.value ?? cap?.parameters?.value;
                    if (val !== undefined) {
                        const inst = (cap.instance || cap.type || '').toLowerCase();
                        if (inst.includes('temp')) {
                            t = val > 60 ? val / 100 : val;
                        }
                        if (inst.includes('humid') || inst.includes('moisture')) {
                            h = val > 100 ? val / 100 : val;
                        }
                    }
                }

                let rawName = dev.deviceName || dev.name || 'Govee Sensor';
                if (rawName.toLowerCase().includes('bouwmuur') || rawName.toLowerCase().includes('kier')) {
                    rawName = 'Badkamer';
                }

                sensors.push({
                    id: deviceId,
                    name: rawName,
                    temp: t,
                    humidity: h,
                    rawState: stateData // Dit voegt de ruwe Govee-data toe om te kunnen bekijken
                });
            } catch (err) {
                console.error(`Fout bij ophalen status voor apparaat ${deviceId}:`, err);
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
