import { createApp } from "./app.js";
import { loadEnv } from "./shared/env.js";

const env = loadEnv();
const app = createApp();

app.listen(env.PORT, (error) => {
  if (error) throw error;
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
