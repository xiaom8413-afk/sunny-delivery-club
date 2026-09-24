// Optional packaging only. The game itself does not require Node or a build step.
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const html = read('index.html')
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>' + read('style.css') + '</style>')
  .replace('<script src="engine.js"></script>', () => '<script>' + read('engine.js') + '</script>')
  .replace('<script src="game.js"></script>', () => '<script>' + read('game.js') + '</script>');
const output = path.join(__dirname, '晴空派送局.html');
fs.writeFileSync(output, html);
console.log('已生成独立离线游戏：' + output + ' (' + Buffer.byteLength(html) + ' bytes)');
