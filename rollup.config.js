import commonjs from 'rollup-plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import resolve from 'rollup-plugin-node-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';
import pkg from './package.json';

export default [
    // browser-friendly UMD build, mainly for StackBlitz support.
    {
        input: 'dist/index.js',
        output: {
            file: pkg.browser,
            format: 'umd'
        },
        name: 'informant',
        sourcemap: true,
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
        ],
    },

    // CommonJS (for Node) and ES module (for bundlers) build.
    {
        input: 'dist/index.js',
        external: ['util', 'tslib', 'assert', 'stream'],
        output: [
            { file: pkg.main, format: 'cjs' },
            { file: pkg.module, format: 'es' }
        ],
        sourcemap: true,
        plugins: [
            sourcemaps(),
            commonjs({
                namedExports: {
                    'verror': ['errorForEach', 'errorFromList', 'info', 'fullStack', 'hasCauseWithName', 'findCauseByName', 'VError']
                }
            }),
            resolve(),
        ],
    }
];
