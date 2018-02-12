import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';
import visualizer from 'rollup-plugin-visualizer';
import pkg from './package.json';

// CommonJS (for Node) and ES module (for bundlers) build.
export default {
    input: 'dist/index.js',
    external: ['util', 'tslib', 'assert', 'stream'],
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
};
