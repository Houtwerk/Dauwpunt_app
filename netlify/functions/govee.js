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
            const deviceId = dev.device || dev.sku;
            const sku = dev.sku;
            
            try {
                const stateUrl = `https://openapi.api.govee.com/router/api/v1/user/devices/state?device=${deviceId}&sku=${sku}`;
                const stateResponse = await fetch(stateUrl, { headers });
                const stateData = await stateResponse.json();
                
                let t = 20, h = 50;
                
                // Zoek op alle mogelijke plekken naar capabilities
                let capabilities = [];
                if (stateData?.payload?.capabilities) capabilities = stateData.payload.capabilities;
                else if (stateData?.data?.capabilities) capabilities = stateData.data.capabilities;
                else if (Array.isArray(stateData?.capabilities)) capabilities = stateData.capabilities;

                for (let cap of capabilities) {
                    let val = undefined;
                    if (cap?.state?.value !== undefined) val = cap.state.value;
                    else if (cap?.value !== undefined) val = cap.value;
                    else if (cap?.parameters?.value !== undefined) val = cap.parameters.value;

                    if (val !== undefined) {
                        const inst = (cap.instance || cap.type || '').toLowerCase();
                        if (inst.includes('temperature') || inst.includes('sensortemperature')) {
                            t = val > 60 ? val / 100 : val;
                        }
                        if (inst.includes('humidity') || inst.includes('sensorhumidity')) {
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
                    humidity: h
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
