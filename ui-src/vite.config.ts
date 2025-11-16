import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import path from 'path';

export default defineConfig({
    plugins: [preact()],
    build: {
        outDir: path.resolve(__dirname, "../html"),
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            react: "preact/compat",
            "react-dom": "preact/compat",
            "react-dom/test-utils": "preact/test-utils",
            "react/jsx-runtime": "preact/jsx-runtime",
        },
    },
    css: {
        // preprocessorOptions: {
        //     scss: {
        //         additionalData: `@use "./src/styles/global.scss" as *;\n`
        //     }
        // }
    }
})
