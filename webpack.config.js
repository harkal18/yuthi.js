const path = require('path');

module.exports = [{
    entry: './src/server/__yuthi_sw__.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'server/__yuthi_sw__.js',
        path: path.resolve(__dirname, 'lib'),
    },
}];
