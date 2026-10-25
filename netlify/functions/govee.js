const https = require('https');

function get(url, headers) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } 
                catch (e) { resolve(data); }
            });
        });
        req.on('error', err => reject(err));
    });
}

exports.handler = async function(event, context) {
    const apiKey = process.env.GOVEE_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'API key niet ingesteld op server' }) };
    }

    const headers = { 'Govee-API-Key': apiKey };

    try {
        const devData = await get('https://openapi.api.govee.com/router/api/v1/user/devices', headers);
        
        let results = [];
        if (devData && devData.data) {
            for (let dev of devData.data) {
                const stateData = await get(`https://openapi.api.govee.com/router/api/v1/user/devices/state?device=${dev.device}&sku=${dev.sku}`, headers);
                results.push({ device: dev, state: stateData });
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results)
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
