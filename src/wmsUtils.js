/**
 * Converte un URL WMS in un comando shp2img
 * @param {string} wmsUrl - URL WMS da convertire
 * @returns {string} - Comando shp2img equivalente
 */
function wmsToShp2img(wmsUrl) {
    // Se l'URL non inizia con http o https, aggiungiamo un prefisso fittizio
    if (!wmsUrl.startsWith('http')) {
        wmsUrl = 'http://example.com/?' + wmsUrl;
    }
    
    try {
        // Parse URL parameters
        const urlObj = new URL(wmsUrl);
        const searchParams = urlObj.searchParams;
        
        // Funzione per ottenere un parametro in modo case insensitive
        function getParamCaseInsensitive(params, paramName) {
            paramName = paramName.toLowerCase();
            for (const [key, value] of params.entries()) {
                if (key.toLowerCase() === paramName) {
                    return value;
                }
            }
            return '';
        }
        
        // Estrai i parametri in modo case insensitive
        const mapFile = getParamCaseInsensitive(searchParams, 'map') || '';
        const layers = getParamCaseInsensitive(searchParams, 'layers') || '';
        const bbox = getParamCaseInsensitive(searchParams, 'bbox') || '';
        const width = getParamCaseInsensitive(searchParams, 'width') || '';
        const height = getParamCaseInsensitive(searchParams, 'height') || '';
        
        // Split BBOX into coordinates
        const bboxCoords = bbox.split(',');
        
        if (bboxCoords.length !== 4) {
            throw new Error('Invalid BBOX format');
        }
        
        // Costruisci il comando shp2img
        return `map2img -m ${mapFile} -l ${layers} -e ${bboxCoords[0]} ${bboxCoords[1]} ${bboxCoords[2]} ${bboxCoords[3]} -s ${width} ${height}`;
    } catch (error) {
        throw new Error(`Error parsing WMS URL: ${error.message}`);
    }
}

module.exports = {
    wmsToShp2img
};