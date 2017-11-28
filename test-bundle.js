console.log('Testing bundle...');

const informant = require('./dist/informant.cjs');
informant.registerLogHandler(informant.consoleHandler);

const logger = informant.Logger.get('test-bundle');

logger.info('Bundle ok.');
