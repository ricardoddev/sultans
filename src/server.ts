import { compose } from "./composition-root.js";
import { loadEnv } from "./shared/env.js";

const env = loadEnv();
const app = compose(env);

app.listen(env.PORT, (error) => {
  if (error) throw error;
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
