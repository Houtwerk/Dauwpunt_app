exports.handler = async function(event, context) {
    const apiKey = process.env.GOVEE_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            headers: { 'Cache-Control': 'no-store' },
            body: JSON.stringify({ error: 'GOVEE_API_KEY niet ingesteld' })
        };
    }

    const headers = { 'Govee-API-Key': apiKey, 'Content-Type': 'application/json' };

    try {
        const devResponse = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', { headers });
        const devData = await devResponse.json();
        
        let sensors = [];
        let devicesList = devData?.data?.devices || devData?.data || devData?.payload?.devices || [];

        for (let dev of devicesList) {
            const deviceId = dev.device;
            const sku = dev.sku;
            let rawName = dev.deviceName || dev.name || 'Govee Sensor';
            
            // Naam-mapping op basis van jullie werkelijke Govee sensornamen
            let lowerName = rawName.toLowerCase();
            if (lowerName.includes('bouwmuur') || lowerName.includes('kier') || lowerName.includes('badkamer')) {
                rawName = 'Badkamer';
            } else if (lowerName.includes('slaap')) {
                rawName = 'Slaapkamer';
            } else if (lowerName.includes('woon')) {
                rawName = 'Woonkamer';
            }

            let t = null;
            let h = null;

            try {
                const bodyData = {
                    requestId: "req_" + Date.now() + "_" + Math.random(),
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
                    if (val !== undefined && val !== null && val !== '' && !isNaN(val)) {
                        let numVal = Number(val);
                        const inst = (cap.instance || cap.type || '').toLowerCase();
                        
                        if (inst.includes('temp')) {
                            if (numVal > 200) {
                                t = numVal / 100;
                            } else if (numVal > 45) {
                                t = (numVal - 32) * 5 / 9;
                            } else {
                                t = numVal;
                            }
                        }
                        if (inst.includes('humid') || inst.includes('moisture')) {
                            h = numVal > 100 ? numVal / 100 : numVal;
                        }
                    }
                }
            } catch (err) {
                console.error(`Fout bij ophalen status voor apparaat ${deviceId}:`, err);
            }

            sensors.push({
                id: deviceId,
                name: rawName,
                temp: t !== null ? Number(t.toFixed(1)) : 19.5,
                humidity: h !== null ? Number(h.toFixed(1)) : 60.0
            });
        }

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify(sensors)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Cache-Control': 'no-store' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
