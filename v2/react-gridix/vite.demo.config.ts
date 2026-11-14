import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev playground: `npm run dev` serves ./demo using the library source directly.
export default defineConfig({
  root: "demo",
  plugins: [react()],
});
