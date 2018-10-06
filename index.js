#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const program = require('commander');
const download = require('download-git-repo');
const inquirer = require('inquirer');
const handlebars = require('handlebars');
const ora = require('ora');
const chalk = require('chalk');
const symbols = require('log-symbols');

const ANSWER_TEMPLATE_PATH = './answer.template.txt';

// DFS遍历获取code目录
const getCodeDir = (rootPath) => {
  const currCode = path.join(rootPath, 'code');
  let result = null;
  if (fs.existsSync(currCode)) {
    return rootPath;
  }

  const currPaths = fs.readdirSync(rootPath);
  currPaths.forEach(currPath => {
    if (currPath.indexOf('.') !== 0) {
      const nextPath = path.join(rootPath, currPath);
      if (!result && fs.statSync(nextPath).isDirectory()) {
        result = getCodeDir(nextPath);
      }
    }
  });
  return result;
}

// 获取时间前缀
const getCurrTimePrefix = () => {
  const currTime = new Date();
  const currYear = currTime.getFullYear().toString().slice(-2);
  const currMonth = `0${currTime.getMonth() + 1}`.slice(-2);
  const currDay = `0${currTime.getDate()}`.slice(-2);
  const currHours = `0${currTime.getHours()}`.slice(-2);
  const currMinus = `0${currTime.getMinutes()}`.slice(-2);
  const currSec = `0${currTime.getSeconds()}`.slice(-2);
  return currYear + currMonth + currDay + currHours + currMinus + currSec
}

const renderTemplate = ({ dirName, codeDir, meta }) => {
  const content = fs.readFileSync(path.resolve(__dirname, ANSWER_TEMPLATE_PATH)).toString();
  const result = handlebars.compile(content)(meta);
  const questionDir = path.resolve(codeDir, 'code', dirName);
  fs.mkdirSync(questionDir);
  fs.writeFileSync(path.resolve(questionDir, 'answer.js'), result);
  fs.writeFileSync(path.resolve(questionDir, 'data.txt'), '');
  console.log(`创建的目录为：${questionDir}`);
}

program.version('1.0.3', '-v, --version')
  .command('init')
  .action(() => {
    inquirer.prompt([{
      name: 'path',
      message: 'rootPath: (./ofer)'
    }]).then((answers) => {
      const rootPath = answers.path || 'ofer';
      if (fs.existsSync(path.resolve(__dirname, rootPath))) {
        console.log(symbols.error, chalk.red(`文件路径已经存在: ${path.resolve(__dirname, rootPath)}`));
      } else {
        const spinner = ora('正在下载模板...');
        spinner.start();
        download('github:tuanzijiang/ofer', `${rootPath}`, function (err) {
          if (err) {
            spinner.fail();
            console.log(symbols.error, chalk.red('项目创建失败'));
          } else {
            spinner.succeed();
            console.log(symbols.success, chalk.green('项目创建成功'));
          }
        })
      }
    });
  })

program.command('start')
  .action(() => {
    console.log(process.cwd());
    const codeDir = getCodeDir(process.cwd())
    if (!codeDir) {
      console.log(symbols.error, chalk.red('不存在code文件夹'));
    } else {
      inquirer.prompt([
        {
          name: 'platform',
          message: `运行的平台:[nowcoder(牛客网), leetcode(领扣)]\nplatform: (leetcode)`
        }, {
          name: 'questionName',
          message: '问题的标题(optional):'
        }
      ]).then((answers) => {
        const dirName = answers.questionName ?
          `${getCurrTimePrefix()}-${answers.questionName}` :
          `${getCurrTimePrefix()}`;
        const currPlatform = answers.platform || 'leetcode';
        let dataType = null;
        let fnName = null;
        switch (currPlatform) {
          case 'leetcode': {
            inquirer.prompt([{
              name: 'dataType',
              message: '输入的参数类型，详情请参照README.md\ndataType: (DEFAULT)'
            }, {
              name: 'fnName',
              message: '导出的函数名称, 题目要求的函数名: '
            }]).then((answers) => {
              dataType = answers.dataType || 'DEFAULT';
              fnName = answers.fnName
              const meta = {
                dataType,
                fnName
              }
              renderTemplate({ meta, dirName, codeDir });
            })
            break;
          }
          case 'nowcoder': {
            dataType = 'READ'
            renderTemplate({ meta, dirName, codeDir });
            break;
          }
          default: {
            dataType = 'DEFAULT';
            renderTemplate({ meta, dirName, codeDir });
            break;
          }
        }
      });
    }
  })

program.parse(process.argv);
