import sourcemaps from 'rollup-plugin-sourcemaps';
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
        ...(process.version.startsWith('v6') ? [] : [require('rollup-plugin-visualizer')({ filename: `dist/stats.html` })]),
    ],
};
