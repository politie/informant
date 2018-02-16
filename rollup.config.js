import sourcemaps from 'rollup-plugin-sourcemaps';
import visualizer from 'rollup-plugin-visualizer';
import pkg from './package.json';

// CommonJS (for Node) and ES module (for bundlers) build.
export default {
    input: 'dist/index.js',
    external: ['tslib'],
    output: [
        { sourcemap: true, file: pkg.main, format: 'cjs' },
        { sourcemap: true, file: pkg.module, format: 'es' }
    ],

    plugins: [
        sourcemaps(),
        visualizer({ filename: `dist/stats.html` }),
    ],
};
