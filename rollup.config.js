import builtins from 'rollup-plugin-node-builtins';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import pkg from './package.json';

export default [
    // browser-friendly UMD build
    {
        input: 'dist/index.js',
        output: {
            file: pkg.browser,
            format: 'umd'
        },
        name: '@politie/informant',
        sourcemap: true,
        plugins: [
            sourcemaps(),
            builtins(),
            resolve(),
            commonjs({
                namedExports: {
                    'verror': ['errorForEach', 'errorFromList', 'info', 'fullStack', 'hasCauseWithName', 'findCauseByName', 'VError']
                }
            })
        ],
    },

    // CommonJS (for Node) and ES module (for bundlers) build.
    {
        input: 'dist/index.js',
        external: ['util', 'tslib', 'verror', 'marky'],
        output: [
            { file: pkg.main, format: 'cjs' },
            { file: pkg.module, format: 'es' }
        ],
        sourcemap: true,
        plugins: [
            sourcemaps(),
        ],
    }
];
