project/
└── web/
    ├── webpack/
    │   ├── package.json
    │   ├── webpack.config.js
    │   └── node_modules/
    ├── assets/
    │   ├── styles/
    │   │   └── index.css    ← главный (импортирует остальные)
    │   └── fonts/           ← шрифты
    └── dist/                ← результат (создастся после сборки)
        ├── main.[hash].min.css
        └── fonts/

Установите зависимости
npm install --save-dev webpack webpack-cli css-loader mini-css-extract-plugin css-minimizer-webpack-plugin copy-webpack-plugin
npm install --save-dev postcss postcss-loader postcss-url
npm run build