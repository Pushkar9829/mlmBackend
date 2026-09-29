import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { connectDb } from "./config/db.js";

const app = createApp();

connectDb()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`API listening on ${config.port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
