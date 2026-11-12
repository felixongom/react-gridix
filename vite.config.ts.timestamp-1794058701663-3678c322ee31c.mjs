// vite.config.ts
import { defineConfig } from "file:///D:/APPS/TEST%20%20APP/react-ui-kit/node_modules/vite/dist/node/index.js";
import react from "file:///D:/APPS/TEST%20%20APP/react-ui-kit/node_modules/@vitejs/plugin-react/dist/index.js";
import dts from "file:///D:/APPS/TEST%20%20APP/react-ui-kit/node_modules/vite-plugin-dts/dist/index.mjs";
import { resolve } from "node:path";
var __vite_injected_original_dirname = "D:\\APPS\\TEST  APP\\react-ui-kit";
var vite_config_default = defineConfig({
  plugins: [react(), dts({ include: ["src"], rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__vite_injected_original_dirname, "src/index.ts"),
      name: "ReactUIKit",
      formats: ["es", "cjs"],
      fileName: (format) => `react-gridix.${format === "es" ? "js" : "cjs"}`
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxBUFBTXFxcXFRFU1QgIEFQUFxcXFxyZWFjdC11aS1raXRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXEFQUFNcXFxcVEVTVCAgQVBQXFxcXHJlYWN0LXVpLWtpdFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovQVBQUy9URVNUJTIwJTIwQVBQL3JlYWN0LXVpLWtpdC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgZHRzIGZyb20gXCJ2aXRlLXBsdWdpbi1kdHNcIjtcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBkdHMoeyBpbmNsdWRlOiBbXCJzcmNcIl0sIHJvbGx1cFR5cGVzOiB0cnVlIH0pXSxcbiAgYnVpbGQ6IHtcbiAgICBsaWI6IHtcbiAgICAgIGVudHJ5OiByZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvaW5kZXgudHNcIiksXG4gICAgICBuYW1lOiBcIlJlYWN0VUlLaXRcIixcbiAgICAgIGZvcm1hdHM6IFtcImVzXCIsIFwiY2pzXCJdLFxuICAgICAgZmlsZU5hbWU6IChmb3JtYXQpID0+IGByZWFjdC1ncmlkaXguJHtmb3JtYXQgPT09IFwiZXNcIiA/IFwianNcIiA6IFwiY2pzXCJ9YCxcbiAgICB9LFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGV4dGVybmFsOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0L2pzeC1ydW50aW1lXCJdLFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBd1IsU0FBUyxvQkFBb0I7QUFDclQsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sU0FBUztBQUNoQixTQUFTLGVBQWU7QUFIeEIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sR0FBRyxJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssR0FBRyxhQUFhLEtBQUssQ0FBQyxDQUFDO0FBQUEsRUFDL0QsT0FBTztBQUFBLElBQ0wsS0FBSztBQUFBLE1BQ0gsT0FBTyxRQUFRLGtDQUFXLGNBQWM7QUFBQSxNQUN4QyxNQUFNO0FBQUEsTUFDTixTQUFTLENBQUMsTUFBTSxLQUFLO0FBQUEsTUFDckIsVUFBVSxDQUFDLFdBQVcsZ0JBQWdCLFdBQVcsT0FBTyxPQUFPLEtBQUs7QUFBQSxJQUN0RTtBQUFBLElBQ0EsZUFBZTtBQUFBLE1BQ2IsVUFBVSxDQUFDLFNBQVMsYUFBYSxtQkFBbUI7QUFBQSxJQUN0RDtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
