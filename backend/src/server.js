const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');
const { startScheduler } = require('./jobs/overdueJob');

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('[db] connected');
  // Make sure the per-tenant unique contract-number index exists before taking traffic.
  await require('./models').RentalContract.syncIndexes();
  app.listen(config.port, () => console.log(`[api] BatiRent listening on :${config.port}`));
  startScheduler();
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
