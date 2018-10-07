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
const { execSync, exec } = require('child_process');

const ANSWER_TEMPLATE_PATH = './answer.template.txt';

// DFS遍历获取code目录
const getDir = (rootPath, targetDir) => {
  const currCode = path.join(rootPath, targetDir);
  let result = null;
  if (fs.existsSync(currCode)) {
    return rootPath;
  }

  const currPaths = fs.readdirSync(rootPath);
  currPaths.forEach(currPath => {
    if (currPath.indexOf('.') !== 0) {
      const nextPath = path.join(rootPath, currPath);
      if (!result && fs.statSync(nextPath).isDirectory()) {
        result = getDir(nextPath, targetDir);
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

// 根据模版渲染
const renderTemplate = ({ dirName, oferDir, meta }) => {
  const content = fs.readFileSync(path.resolve(__dirname, ANSWER_TEMPLATE_PATH)).toString();
  const result = handlebars.compile(content)(meta);
  const questionDir = path.resolve(oferDir, 'code', dirName);
  fs.mkdirSync(questionDir);
  fs.writeFileSync(path.resolve(questionDir, 'answer.js'), result);
  fs.writeFileSync(path.resolve(questionDir, 'data.txt'), '');
  console.log(`创建的目录为：${questionDir}`);
}

// 获取ofer的配置
const getOferConfig = (oferDir) => {
  const rootDir = process.cwd();
  global.__rootname = rootDir;
  const injectConfigPath = path.resolve(oferDir, 'config.json');
  const getConfigPath = path.resolve(oferDir, '.ofer/config.js');
  if (!fs.existsSync(injectConfigPath)) {
    console.log(`不存在配置文件：${injectConfigPath}`);
    return null;
  }
  if (!fs.existsSync(getConfigPath)) {
    console.log(`不存在配置文件：${getConfigPath}`);
    return null;
  }
  const injectConfig = require(path.resolve(oferDir, 'config.json'));
  const { getConfig } = require(path.resolve(oferDir, '.ofer/config.js'));

  if (Object.prototype.toString.call(getConfig) !== '[object Function]') {
    console.log(`配置文件解析出错${getConfigPath}`);
    return null;
  }

  return getConfig(injectConfig);
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
    const oferDir = getDir(process.cwd(), 'code');
    const config = getOferConfig(oferDir);
    if (!config) {
      return null;
    }
    if (!oferDir) {
      console.log(symbols.error, chalk.red('不存在code文件夹'));
      return null;
    }
    const platformMsg = `请选择平台：[${config.platform.reduce((prev, curr, idx) => {
      return idx ?
        `${prev},${curr}(${config.platformEntities[curr]['zh-CN']})` :
        `${prev}${curr}(${config.platformEntities[curr]['zh-CN']})`
    }, '')}]`
    inquirer.prompt([{
      type: 'list',
      name: 'platform',
      message: platformMsg,
      choices: config.platform
    }, {
      type: 'input',
      name: 'questionName',
      message: '题目的名称（可不填）:'
    }]).then((answers) => {
      const platformEntity = config.platformEntities[answers.platform];
      const dirName = answers.questionName ?
        `${getCurrTimePrefix()}-${answers.questionName}` :
        `${getCurrTimePrefix()}`;
      const dataTypes = Object.entries(config.DATA_TYPE_ENUM).map(([curr]) => curr);
      const dataTypeMsg = `data传入answer的方式有:\n${dataTypes.reduce((prev, curr, idx) => {
        return idx ?
          `${prev}\n${idx + 1}.${curr}(${config.DATA_TYPE_ENUM_ENTITIES[curr].description})` :
          `${prev}${idx + 1}.${curr}(${config.DATA_TYPE_ENUM_ENTITIES[curr].description})`;
      }, '')}`
      const inquirerArr = [{
        type: 'list',
        name: 'type',
        message: `${dataTypeMsg}\n请选择: `,
        default: platformEntity.defaultType,
        choices: dataTypes
      }];
      if (platformEntity.fnNameIsNeed) {
        inquirerArr.push({
          type: 'input',
          name: 'fnName',
          message: '请输入导出时，answer函数的函数名(请保持和做题平台统一)'
        })
      }
      inquirer.prompt(inquirerArr).then((answers) => {
        const dataType = answers.type;
        const fnName = answers.fnName;
        const meta = {
          dataType,
          fnName
        };
        renderTemplate({ meta, dirName, oferDir });
      });
    })
  })

program.command('update-ofer')
  .action(() => {
    const oferDir = getDir(process.cwd(), 'code');
    if (!oferDir) {
      console.log(symbols.error, chalk.red('不存在code文件夹'));
      return null;
    }
    if (fs.existsSync(path.resolve(oferDir, '.ofer')) || fs.existsSync(path.resolve(oferDir, '.ofer-tmp'))) {
      execSync('rm -rf .ofer && rm -rf .ofer-tmp', {
        cwd: path.resolve(oferDir),
      });
    }
    const spinner = ora('正在更新ofer...');
    spinner.start();
    execSync('mkdir .ofer-tmp', {
      cwd: path.resolve(oferDir),
    });
    exec(`git init && mkdir .git/info && 
git config core.sparsecheckout true &&
git remote add origin -f https://github.com/tuanzijiang/ofer.git &&
echo '.ofer' >> .git/info/sparse-checkout &&
git pull origin master`, {
      cwd: path.resolve(oferDir, '.ofer-tmp'),
    }, (err) => {
      if (err) {
        console.log(err);
        execSync('rm -rf .ofer-tmp', {
          cwd: path.resolve(oferDir),
        })
        spinner.text = '更新失败';
        spinner.fail();
      } else {
        execSync('cp -r .ofer-tmp/.ofer .ofer && rm -rf .ofer-tmp', {
          cwd: path.resolve(oferDir),
        });
        spinner.text = '更新成功';
        spinner.succeed();
      }
    })
  })


program.parse(process.argv);
