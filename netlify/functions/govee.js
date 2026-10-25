export async function handler(event, context) {
    const apiKey = process.env.GOVEE_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'GOVEE_API_KEY niet ingesteld in Netlify omgevingsvariabelen' })
        };
    }

    const headers = { 'Govee-API-Key': apiKey };

    try {
        // Haal apparaten op via Govee API
        const devResponse = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', { headers });
        const devData = await devResponse.json();
        
        let results = [];
        if (devData && devData.data) {
            for (let dev of devData.data) {
                try {
                    const stateUrl = `https://openapi.api.govee.com/router/api/v1/user/devices/state?device=${dev.device}&sku=${dev.sku}`;
                    const stateResponse = await fetch(stateUrl, { headers });
                    const stateData = await stateResponse.json();
                    results.push({ device: dev, state: stateData });
                } catch (err) {
                    console.error(`Fout bij ophalen status voor apparaat ${dev.device}:`, err);
                }
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results)
        };
    } catch (error) {
        console.error('Fout in Govee serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
}
