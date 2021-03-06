'use strict';
const ew = require('./errorWarning.js');
const sharp = require('sharp');
var IMAGE_MAGNIFICATION = 1;
const $ = require('jquery');
const fs = require('fs');
const gjd = require('./getJsonData');
const path = require('path');
var { shell } = require('electron');

const DEFAULT_CHARS_IMG =
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAB4UlEQVR4nO1XAW7CQAw79qo9r6/ZN7shaOVGdi653tEyinRiCm7OjpPAyjzPJXnm7595eW3ia7CUWyDe5bQ8RAVA7PwCkFONqCPsPQQ48UvAI+Vf0uWYD27sMxU/6pRpmr7u1bm/P/9eiS5VYxVF7JKDVRrybp7x8OwOhS8ApA9YAUgIY4ALExJOrsW0BWX5N8oiDjCxiwDlWKZAWT7yghohJoBVyCOk8Bk+cgbwYkXIusLwtRnY7QD2G6uQmgHlgIfP5o/gQ72uKmFjHl452eL8Jj8AQ72IeEvSw2eGO7mdfAfYBVgkW+UeAhgfzB1ywBu+t3BAKfYE0Ap1nAEpoHUbYGz0tpH42le9qhw6UPsi69VarFOkNUqA91Oil4BMQauKewjwCA0VkHFA4VscyPDpOgNIKkJoTbJXQOs2sAKGbpvsbyF0he11u0axotFKZ51nzqQfQLwVkOl1xJ5GgCLEHHiJgBqhiANqvbYIQE6Qv/6vI5uBqIAWBzL4XdsAY6O3jcR7ltXiwhWLH3q6CVC9fpgANRsK68zSeAHCehqPiD2FAxFnbEwUYqwANfWRuML+KwHZ+OkEmMsuAacXwHJ5eV8uIEDowwS09l5jv3Zft4eQvgQc1UJDCnQ0gY8X8AstyTSRWjs+KQAAAABJRU5ErkJggg==';
const HOTBAR_COUNT = 9;
// var UNIT_OF_CHAR_WIDTH = 6;
// var UNIT_OF_CHAR_HEIGHT = 6;
const HOTBAR_UNIT_WIDTH = 20;
const BASE_STANDARD_WIDTH = 256;
const BASE_STANDARD_HEIGHT = 256;
const DEFAULT_WIDGETS_CHARA_JSON = require('../defaultChars.json');

//TODO chars.jsonにないものがkey configにあった場合の処理
module.exports = async function convertProcess(basePath, charsPath, charsJson, keyOption, outputPath) {
  //ew.resetConvertMessage();
  var test = await checkArgs(basePath, charsPath, charsJson, keyOption, outputPath);
  console.log(`args testing:`, test);
  if (test == false) {
    console.log('引数に問題がありました');
    return;
  }
  console.log('引数に問題がありませんでした');
  var options = keyOption.split(',');
  //文字のサイズをjsonから取得
  //charsがデフォルトの時用にここでsharpオブジェクトを作っておく
  var imgBuf = Buffer.from(DEFAULT_CHARS_IMG, 'base64');
  var charsSharpObj = charsPath == 'default_widgetsChars.png' ? sharp(imgBuf) : sharp(charsPath);
  var jsonObject = charsJson == 'default_widgetsChars.json' ? DEFAULT_WIDGETS_CHARA_JSON : require(charsJson);
  console.log(jsonObject, jsonObject.unit.width, jsonObject.unit.height);
  makeCharBuffer(options, charsSharpObj, charsJson, jsonObject.unit.width, jsonObject.unit.height).then((results) => {
    var base = sharp(basePath);
    //images作成
    var compositeObject = new Array();
    console.log('make char buf results:', results);
    for (let index = 0; index < HOTBAR_COUNT; index++) {
      console.log(results[index]);
      if (results[index] == '') continue;
      var compositeObj = {
        input: results[index],
        top: 1 * IMAGE_MAGNIFICATION,
        left: 1 + index * HOTBAR_UNIT_WIDTH * IMAGE_MAGNIFICATION,
      };
      compositeObject.push(compositeObj);
    }
    console.log('composite object:', compositeObject);
    base.composite(compositeObject).toFile(outputPath, (err, info) => {
      if (err) {
        $('#convertError').text(
          'ファイル出力失敗（特にエラーメッセージが出ていない場合はバグなのでgithub issueにて報告していただけると助かります）'
        );
        console.log(err);
      } else {
        setSuccessMessage(outputPath);
        console.log(info);
      }
    });
  });
};

function setSuccessMessage(outputPath) {
  $('#convertMessage').append(`ファイル出力成功(<a id="fileOutputSuccessPath">${path.basename(outputPath)}</a>)`);
  $('#fileOutputSuccessPath').on('click', () => {
    console.log(outputPath);
    shell.showItemInFolder(outputPath);
  });
}

//chars画像,base画像,key optionそれぞれ問題がないか
//問題なし:true
async function checkArgs(basePath, charsPath, charsJson, keyOption, outputPath) {
  var json = DEFAULT_WIDGETS_CHARA_JSON;
  if (!checkInputtedValue(basePath, charsPath, charsJson, keyOption, outputPath)) return false;
  if (basePath === outputPath) {
    ew.duplicatedBasePathAndOutputPath();
    return false;
  }
  const jsonPathTest = checkJsonPath(charsJson);
  if (!jsonPathTest) return false;
  if (charsJson != 'default_widgetsChars.json') {
    json = require(charsJson);
  }
  const charsPathTest = await checkCharsPath(charsPath, json.unit.width, json.unit.height);
  const basePathTest = await checkBasePath(basePath);
  const keyOptionTest = keyOption.split(',').length == HOTBAR_COUNT;
  if (charsPathTest == false && charsJson === 'default_widgetsChars.json') ew.charsJsonPngMismatch();
  const outputPathTest = checkOutputPath(outputPath);
  const ans = charsPathTest && basePathTest && jsonPathTest && keyOptionTest && outputPathTest;
  return ans;
}

function checkInputtedValue(basePath, charsPath, charsJson, keyOption, outputPath) {
  var isBaseEmpty = basePath == '';
  if (isBaseEmpty) ew.emptyPath('base');
  var isChrasPathEmpty = charsPath == '';
  if (isChrasPathEmpty) ew.emptyPath('chars');
  var isCharsJsonEmpty = charsJson == '';
  if (isCharsJsonEmpty) ew.emptyPath('json');
  var isKeyOptionEmpty = keyOption == '';
  if (isKeyOptionEmpty) ew.emptyPath('options');
  var isOutputPathEmpty = outputPath == '';
  if (isOutputPathEmpty) ew.emptyPath('output');
  return !(isBaseEmpty || isChrasPathEmpty || isCharsJsonEmpty || isKeyOptionEmpty || isOutputPathEmpty);
}

//chars画像が加工をする上で問題がないか
//問題なし:true
async function checkCharsPath(charsPath, unitWidth, unitHeight) {
  if (!fs.existsSync(charsPath) && charsPath != 'default_widgetsChars.png') {
    ew.invalidPath('chars');
  } else {
    var imgBuf;
    var chars;
    if (charsPath == 'default_widgetsChars.png') {
      imgBuf = Buffer.from(DEFAULT_CHARS_IMG, 'base64');
      chars = await sharp(imgBuf);
    } else chars = await sharp(charsPath);
    const { format: charsFormat, width: charsWidth, height: charsHeight } = await chars.metadata();
    var isPng = charsFormat == 'png';
    var isWidthUnitTimes = charsWidth % unitWidth == 0;
    var isHeightUnitTimes = charsHeight % unitHeight == 0;
    if (isPng && isWidthUnitTimes && isHeightUnitTimes) {
      IMAGE_MAGNIFICATION = IMAGE_MAGNIFICATION < charsWidth / unitWidth ? IMAGE_MAGNIFICATION : charsWidth / unitWidth;
      return true;
    } else {
      var conditions = [isPng, isWidthUnitTimes, isHeightUnitTimes];
      ew.selectedRightnessNotImageChars(conditions);
    }
  }
  return false;
}

//base画像が加工をする上で問題がないか
//問題なし:true
async function checkBasePath(basePath) {
  if (!fs.existsSync(basePath)) {
    ew.invalidPath('base');
  } else {
    const base = await sharp(basePath);
    const { format: baseFormat, width: baseWidth, height: baseHeight } = await base.metadata();
    var isPng = baseFormat == 'png';
    var isWidth256NTimes = baseWidth % BASE_STANDARD_WIDTH == 0;
    var isHeight256NTimes = baseHeight % BASE_STANDARD_HEIGHT == 0;
    var widthWithHeightSameIs = baseWidth == baseHeight;
    if (isPng && isWidth256NTimes && isHeight256NTimes && widthWithHeightSameIs) {
      IMAGE_MAGNIFICATION =
        IMAGE_MAGNIFICATION < baseWidth / BASE_STANDARD_WIDTH ? IMAGE_MAGNIFICATION : baseWidth / BASE_STANDARD_WIDTH;
      return true;
    } else {
      var conditions = [isPng, isWidth256NTimes, isHeight256NTimes, widthWithHeightSameIs];
      ew.selectedRightnessNotImageBase(conditions);
    }
  }
  return false;
}

//chars jsonが加工をする上で問題ないか
function checkJsonPath(jsonPath) {
  //デフォルトのjsonが指定されていた場合は絶対に問題がないため即trueを返す
  if (jsonPath == 'default_widgetsChars.json') return true;
  if (!fs.existsSync(jsonPath)) {
    ew.invalidPath('json');
    return false;
  }
  var json;
  json = fs.readFileSync(jsonPath);
  if (isValidJson(json) == false) {
    ew.illegalJSONPassed();
    return false;
  }
  var jsonObject = JSON.parse(json);
  var isUnitNormal = unitPropertyTest(jsonObject);
  var isSupportKeyNormal = supportKeyPropertyTest(jsonObject);
  return isUnitNormal && isSupportKeyNormal;
}

function checkOutputPath(outputPath) {
  if (!fs.existsSync(path.dirname(outputPath))) {
    ew.invalidPath('output');
    return false;
  }
  return true;
}

//jsonObjにunitがあり、それが正しいかどうか
function unitPropertyTest(jsonObj) {
  if (Object.prototype.hasOwnProperty.call(jsonObj, 'unit') == false) {
    //unitがない
    ew.noUnit();
    return false;
  } else if (
    (Object.prototype.hasOwnProperty.call(jsonObj.unit, 'width') &&
      Object.prototype.hasOwnProperty.call(jsonObj.unit, 'height')) == false
  ) {
    ew.unitPropertyIsIllegal();
    return false;
  } else if (!(jsonObj.unit.width >= 1 && jsonObj.unit.width <= 20)) {
    ew.unitWidthIsInvalid();
    return false;
  } else if (!(jsonObj.unit.height >= 1 && jsonObj.unit.height <= 20)) {
    ew.unitHeightIsInvalid();
    return false;
  }
  console.log('width:', jsonObj.unit.width, ',height:', jsonObj.unit.height);
  return true;
}

//jsonObjにsupport keyがあり、それが正しいかどうか
function supportKeyPropertyTest(jsonObj) {
  if (Object.prototype.hasOwnProperty.call(jsonObj, 'support_key_list') == false) {
    ew.noSupportKey();
    return false;
  }
  Reflect.ownKeys(jsonObj.support_key_list).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(gjd.getSupportKeyList, key)) {
      ew.unsupportedKeyIsExists(key);
      return false;
    }
  });
  return true;
}

//渡された文字列がjsonに変換できるかどうか
function isValidJson(value) {
  try {
    JSON.parse(value);
  } catch (e) {
    return false;
  }
  return true;
}

//hotbarにつかうchar.pngを生成しBufferの配列を返す
function makeCharBuffer(keyOptionList, charsSharpObj, jsonPath, unitWidth, unitHeight) {
  console.log(keyOptionList, charsSharpObj, jsonPath);
  var extractList = getExtractList(keyOptionList, jsonPath);
  var promises = [];
  for (const option of keyOptionList.entries()) {
    console.log(option[1]);
    console.log(extractList);
    if (!(isNaN(extractList.get(option[1]).top) || isNaN(extractList.get(option[1]).left))) {
      var extractObject = {
        top: extractList.get(option[1]).top * unitHeight * IMAGE_MAGNIFICATION,
        left: extractList.get(option[1]).left * unitWidth * IMAGE_MAGNIFICATION,
        width: unitWidth * IMAGE_MAGNIFICATION,
        height: unitHeight * IMAGE_MAGNIFICATION,
      };
      promises.push(charsSharpObj.extract(extractObject).png().toBuffer());
    } else
      promises.push(
        new Promise((resolve) => {
          resolve('');
        })
      );
  }
  return Promise.all(promises)
    .then(function (results) {
      return results;
    })
    .catch(function () {
      throw Error('make char buf error');
    });
}

//{ option: {top: n,left:n} }のリストを返す
//key option list にない場合は''を返す
function getExtractList(keyOptionList, jsonPath) {
  console.log(`getExtractList(${keyOptionList},${jsonPath})`);
  var allExtractObjList;
  if (jsonPath == 'default_widgetsChars.json') allExtractObjList = DEFAULT_WIDGETS_CHARA_JSON.support_key_list;
  else allExtractObjList = JSON.parse(fs.readFileSync(jsonPath)).support_key_list;
  var extract = new Map();
  keyOptionList.forEach((option) => {
    if (Object.prototype.hasOwnProperty.call(allExtractObjList, option)) extract.set(option, allExtractObjList[option]);
    else {
      ew.charsByNotSupportedKeySelected();
      extract.set(option, '');
    }
  });
  return extract;
}
