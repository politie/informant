import commonjs from 'rollup-plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import resolve from 'rollup-plugin-node-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';
import visualizer from 'rollup-plugin-visualizer';
import pkg from './package.json';

export default [
    // browser-friendly UMD build, mainly for StackBlitz support.
    {
        input: 'dist/index.js',
        output: {
            file: pkg.browser,
            format: 'umd',
            name: 'informant',
            sourcemap: true,
        },
        plugins: [
            sourcemaps(),
            commonjs({
                namedExports: {
                    'verror': ['errorForEach', 'errorFromList', 'info', 'fullStack', 'hasCauseWithName', 'findCauseByName', 'VError']
                }
            }),
            globals(),
            builtins(),
            resolve(),
            visualizer({ filename: `dist/stats.umd.html` }),
        ],
    },

    // CommonJS (for Node) and ES module (for bundlers) build.
    {
        input: 'dist/index.js',
        external: ['util', 'tslib', 'assert', 'stream', 'core-util-is'],
        output: [
            { sourcemap: true, file: pkg.main, format: 'cjs' },
            { sourcemap: true, file: pkg.module, format: 'es' }
        ],

        plugins: [
            sourcemaps(),
            commonjs({
                namedExports: {
                    'verror': ['errorForEach', 'errorFromList', 'info', 'fullStack', 'hasCauseWithName', 'findCauseByName', 'VError']
                }
            }),
            resolve(),
            visualizer({ filename: `dist/stats.html` }),
        ],
    }
];
