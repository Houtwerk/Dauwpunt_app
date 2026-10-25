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
            let rawName = dev.deviceName || dev.name || 'Govee Sensor';
            if (rawName.toLowerCase().includes('bouwmuur') || rawName.toLowerCase().includes('kier')) {
                rawName = 'Badkamer';
            }

            let t = 20; // Standaard fallback
            let h = 50; // Standaard fallback

            try {
                const bodyData = {
                    requestId: "req_" + Date.now(),
                    payload: {
                        sku: sku,
                        device: deviceId
                    }
                };

                const stateResponse = await fetch('https://openapi.api.govee.com/router/api/v1/device/state', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(bodyData)
                });
                const stateData = await stateResponse.json();
                
                let capabilities = stateData?.payload?.capabilities || stateData?.data?.capabilities || stateData?.capabilities || [];

                for (let cap of capabilities) {
                    let val = cap?.state?.value ?? cap?.value ?? cap?.parameters?.value;
                    if (val !== undefined && val !== null && val !== '') {
                        const inst = (cap.instance || cap.type || '').toLowerCase();
                        if (inst.includes('temp')) {
                            // Alleen delen door 100 als het een groot getal is (zoals 2000), anders direct gebruiken
                            t = Number(val) > 200 ? Number(val) / 100 : Number(val);
                        }
                        if (inst.includes('humid') || inst.includes('moisture')) {
                            h = Number(val) > 100 ? Number(val) / 100 : Number(val);
                        }
                    }
                }
            } catch (err) {
                console.error(`Fout bij ophalen status voor apparaat ${deviceId}:`, err);
            }

            sensors.push({
                id: deviceId,
                name: rawName,
                temp: typeof t === 'number' && !isNaN(t) ? t : 20,
                humidity: typeof h === 'number' && !isNaN(h) ? h : 50
            });
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
