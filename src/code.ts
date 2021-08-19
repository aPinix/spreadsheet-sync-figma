// imports --------------------
import { placeholderImage } from './placeholder';
import { API_KEY } from './api-key';



// local storage --------------------

// local storage: api url
const lsApiUrl = 'apiUrl';



// global vars --------------------

// global vars: window size
let appWindowWidth = 380;
let appWindowHeight = 494;

// set figma plugin on inspector at start
figma.root.setRelaunchData({
  open: '',
});

// placeholder image
let placeholderImageFill: any[];

// variable for random-save type
let randomSaveLocalStorage: number;



// enums --------------------

// enums: layer types
export const enum ChangeTypes {
  TEXT = 'text',
  COLOR = 'color',
  SHOW_HIDE = 'show-hide',
  IMAGE = 'image',
}



// layer types --------------------

// layer types: types (only if layer is type)
const layerTextTypes = ['TEXT'];
const layerColorFillTypes = ['FRAME', 'VECTOR', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON', 'RECTANGLE', 'TEXT'];
// const layerColorStrokeTypes = ['FRAME', 'VECTOR', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON', 'RECTANGLE', 'TEXT'];
const layerShowHideTypes = ['FRAME', 'GROUP', 'COMPONENT_SET', 'COMPONENT', 'INSTANCE', 'BOOLEAN_OPERATION', 'VECTOR', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON', 'RECTANGLE', 'TEXT'];
const layerImageTypes = ['FRAME', 'INSTANCE', 'VECTOR', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON', 'RECTANGLE'];
// 'SLICE' | 'FRAME' | 'GROUP' | 'COMPONENT_SET' | 'COMPONENT' | 'INSTANCE' | 'BOOLEAN_OPERATION' | 'VECTOR' | 'STAR' | 'LINE' | 'ELLIPSE' | 'POLYGON' | 'RECTANGLE' | 'TEXT'



// init --------------------

// init: create ui
figma.showUI(__html__, {
  width: appWindowWidth,
  height: appWindowHeight,
});

// init: starting point
init();

function init() {
  // check if has user has layers selected
  checkForUserSelections();

  // get local storage for previously entered url
  const instanceId = figma.root.getPluginData(lsApiUrl);
  if (instanceId) { figma.ui.postMessage({ type: 'set-input-url', value: instanceId });
  } else { figma.ui.postMessage({ type: 'set-input-url', value: '' }); }

  generateImagePlaceholder();
}

// figma.on('currentpagechange', () => {
//   console.log('currentpagechange');
// });

// detect selection changes
figma.on('selectionchange', () => {
  checkForUserSelections();
});

// message receive
figma.ui.onmessage = async (msg) => {
  // if image is ready to be put into the design
  if (msg.type === 'image-ready') {
    const image = msg.image as Uint8Array;
    const imageHash = figma.createImage(new Uint8Array(image)).hash;

    if (!msg.isPlaceholder) {
      const nodeFills = figma.getNodeById(msg.nodeId);
      nodeFills['fills'] = [
        { type: 'IMAGE', scaleMode: 'FILL', imageHash },
      ];
    } else {
      placeholderImageFill = [
        { type: 'IMAGE', scaleMode: 'FILL', imageHash },
      ];;
    }
  }

  // set input with local storage url
  if (msg.type === 'input-set') {
    figma.root.setPluginData(lsApiUrl, msg.value);
  }

  // get data from url
  if (msg.type === 'get-data') {
    const url = getSpreadsheetAsApi(msg.url);

    figma.ui.postMessage({
      type: 'get-api-data',
      url,
      isPreview: msg.isPreview,
      isCheckUrl: msg.isCheckUrl,
    });
  }

  // parse spreadsheet data and process layers
  if (msg.type === 'spreadsheet-data') {
    const data = JSON.parse(msg.data);
    // const authorEmail = data.feed.author[0].email.$t;
    // const authorName = data.feed.author[0].name.$t;
    // const dateUpdated = data.feed.updated.$t; // '2021-04-20T16:56:11.878Z'
    // const sheetTitle = data.feed.title.$t; //  'Sheet1'
    const rowsData: any[] = spreadsheetToJson(data.values);
    // console.log('rowsData:', rowsData);

    if (msg.isPreview) {
      let prettyJson = syntaxHighlight(rowsData);

      // add little square color to the json preview
      const regexColor = /(\"\/\#)(.*)(\")/gi;
      prettyJson = prettyJson.replace(
        regexColor,
        `<span class="icon-color"><span class="color-square" style="background-color: #${'$2'};"></span>"/#${'$2'}"</span>`
      );

      // add little eye (show) icon to the json preview
      const regexBoolShow = /\"\/Show\"/g;
      prettyJson = prettyJson.replace(
        regexBoolShow,
        '<span class="icon-visible">"/Show"</span>'
      );

      // add little eye (hide) icon to the json preview
      const regexBoolHide = /\"\/Hide\"/g;
      prettyJson = prettyJson.replace(
        regexBoolHide,
        '<span class="icon-invisible">"/Hide"</span>'
      );

      // add image links
      const regexImage = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
      prettyJson = prettyJson.replace(
        regexImage,
        (url) => {
          return `<a class="preview-link" target="_blank" href="${url}">${url}</a>`;
        }
      );

      figma.ui.postMessage({ type: 'populate-json-preview', json: prettyJson, jsonRaw: rowsData });
    } else {
      figmaPopulateSheetSync(rowsData);
    }
  }

  if (msg.type === 'close-preview') {
    figma.ui.postMessage({ type: 'close-json-preview' });
  }
};



// functions --------------------

function figmaPopulateSheetSync(data: any[]): void {
  const selection = figma.currentPage.selection;
  const clonedSelection = Object.assign([], selection);
  const jsonTypes = getJsonWithTypes(data);

  const countSelection = figma.currentPage.selection.length;
  let indexData = 0;
  let countLayersChanged = 0;

  for (let indexSelection in clonedSelection) {
    const index: number = parseInt(indexSelection);
    const frame = clonedSelection[index] as FrameNode;

    randomSaveLocalStorage = Math.floor(Math.random() * (jsonTypes.length));

    if (jsonTypes[indexData] === undefined) {
      indexData = 0;
    }

    if (frame.children) {
      const sheetColNames = Object.keys(jsonTypes[indexData]).map((key) => {
        const name = `#${formatName(key)}`;
        return name;
      });
      const sheetColTypes = Object.keys(jsonTypes[indexData]).map((key) => {
        return jsonTypes[indexData][key].type;
      });
      const sheetColValues = Object.keys(jsonTypes[indexData]).map((key) => {
        return jsonTypes[indexData][key].value;
      });

      const frame = clonedSelection[index] as FrameNode;

      frame.findAll((node) => {
        const name = formatName(node.name);

        // check if name has more than 1 '#' (column)
        const nameArray = name.split('#').filter((str: string) => str !== '').map((str: string) => `#${str}`);

        if (nameArray.length > 1) {
          nameArray.map((nameStr, i) => {
            const layerName = formatLayerName(nameStr);
            const replaceByType = getNameReplaceByType(nameArray[i]);

            if (sheetColNames.includes(layerName)) {
              countLayersChanged++;
              const idx = sheetColNames.indexOf(layerName);
              const type = sheetColTypes[idx];
              const value = getValueReplace(replaceByType, jsonTypes, layerName) || sheetColValues[idx];
              changeLayers(node, index, type, value);
            }
          });
        } else {
          const layerName = formatLayerName(name);
          const replaceByType = getNameReplaceByType(nameArray[0]);

          if (sheetColNames.includes(layerName)) {
            countLayersChanged++;
            const idx = sheetColNames.indexOf(layerName);
            const type = sheetColTypes[idx];
            const value = getValueReplace(replaceByType, jsonTypes, layerName) || sheetColValues[idx];
            changeLayers(node, index, type, value);
          }
        }

        return null;
      });

      // if last element notify
      if (index === clonedSelection.length - 1) {
        figma.notify(
          `Sync Complete ✅ - [${countLayersChanged}] layer${countLayersChanged > 1 ? 's' : ''} changed based on [${countSelection}] selection${countSelection > 0 ? 's' : '' }`,
          { timeout: 5000 }
        );
        // figma.closePlugin();
      }
    }

    indexData++;
  }
}

function formatLayerName(name: string): string {
  if (name.includes('.')) {
    return name.split('.')[0];
  } else {
    return name;
  }
}

function getNameReplaceByType(name: string): string | number {
  const regexRandom = /\.rand$/g;
  const regexRandomResult = name.match(regexRandom);
  if (regexRandomResult) {
    return 'random';
  }

  const regexRandomSave = /\.randsave$/g;
  const regexRandomSaveResult = name.match(regexRandomSave);
  if (regexRandomSaveResult) {
    return 'random-save';
  }

  const regexNumber = /\.[0-9]*/g;
  const regexNumberResult = name.match(regexNumber);
  if (regexNumberResult) {
    const stringToNumber = regexNumberResult[0].replace('.', '');
    return +stringToNumber;
  }

  return '';
}

function getValueReplace(type: string | number, data: any, layerName: string): string {
  layerName = layerName.replace('#', '');

  if (typeof type === 'string' && type === 'random') {
    const positionIndex = Math.floor(Math.random() * (data.length));
    const value = data[positionIndex][layerName];
    return value?.value || value;
  }

  if (typeof type === 'string' && type === 'random-save') {
    const positionIndex = randomSaveLocalStorage;
    const value = data[positionIndex][layerName];
    return value?.value || value;
  }

  if (typeof type === 'number') {
    const positionIndex = type - 1 > data.length ? data.length - 1 : type - 1;
    const value = data[positionIndex][layerName];
    return value?.value || value;
  }

  return null;
}

async function changeLayers(node: any, index: number, type: any, value: any): Promise<void> {
  // is text
  if (layerTextTypes.includes(node.type) && type === ChangeTypes.TEXT) {
    const placeholder = hasPlaceholders(node.characters);
    let phrase = placeholder.phrase;

    await figma.loadFontAsync(node.fontName as FontName);

    // // reset text
    // const textLength = node.characters.length;
    // node.deleteCharacters(0, textLength - 1);

    if (placeholder.hasPlaceholders) {
      placeholder.placeholders.map((ph: string) => {
        phrase = phrase.replace(ph, value);
      });
      node.characters = phrase;
    } else {
      node.characters = value;
    }
  }

  // is color (fill)
  if (layerColorFillTypes.includes(node.type) && type === ChangeTypes.COLOR) {
    if ('fills' in node) {
      if (
        Array.isArray(node.fills) &&
        node.fills.length &&
        node.fills[0].type !== 'IMAGE'
      ) {
        const fills = JSON.parse(JSON.stringify(node.fills));
        const newColor = getRGB(hexToRgb(value));
        fills[0].color = newColor;
        node.fills = fills;
      }
    }
  }

  // is color (stroke)
  // if (layerColorStrokeTypes.includes(node.type) && type === ChangeTypes.COLOR) {
  // }

  // is show/hide
  if (
    layerShowHideTypes.includes(node.type) &&
    type === ChangeTypes.SHOW_HIDE
  ) {
    if (value === 'show') {
      node.visible = true;
    } else if (value === 'hide') {
      node.visible = false;
    }
  }

  // is image
  if (layerImageTypes.includes(node.type) && type === ChangeTypes.IMAGE) {
    if ('fills' in node) {
      if (Array.isArray(node.fills) && node.fills.length) {
        // while fetching image
        // node.fills = placeholderImageFill;

        // actual image
        figma.ui.postMessage({
          type: 'process-image',
          imageUrl: value,
          nodeId: node.id,
          index,
          isPlaceholder: false
        });
      }
    }
  }
}

function checkForUserSelections(): boolean {
  if (figma.currentPage.selection.length > 0) {
    const selection = figma.currentPage.selection;
    const clonedSelection = Object.assign([], selection);
    const shildrenArray = [];
    for (let index in clonedSelection) {
      const frame = clonedSelection[index] as FrameNode;
      shildrenArray.push(frame.children);
    }

    // if all selections have children (to process)
    const allSelectionsHaveChildren = shildrenArray.every(child => child !== undefined);

    const count = figma.currentPage.selection.length;
    if (allSelectionsHaveChildren) {
      figma.ui.postMessage({
        type: 'layers',
        message: `${count > 1 ? 'layers' : 'layer'} selected`,
        message2: `Ready to sync!`,
        color: 'success',
        layers: count,
      });
    } else {
      figma.ui.postMessage({
        type: 'layers',
        message: `${count > 1 ? 'layers' : 'layer'} selected`,
        message2: `Select only layers that have children.`,
        color: 'warning',
        layers: count,
      });
    }

    // figma.root.setRelaunchData({ relaunch: '' });
  } else {
    figma.ui.postMessage({
      type: 'layers',
      message: `layers selected`,
      message2: `Select at least 1 layer!`,
      color: 'error',
      layers: 0,
    });

    // figma.root.setRelaunchData({});
  }
  return;
}



// spreadsheet --------------------

function getSpreadsheetId(sheetUrl: string): string {
  return new RegExp('/spreadsheets/d/([a-zA-Z0-9-_]+)').exec(sheetUrl)[1];
}

function getSpreadsheetAsApi(url: string): string {
  const sheetUrlPrefix = 'https://sheets.googleapis.com/v4/spreadsheets/';
  const sheetId = getSpreadsheetId(url);
  const sheetRange = 'A1:ZZZ100000000';
  const jsonUrl = `${sheetUrlPrefix}${sheetId}/values/${sheetRange}?alt=json&key=${API_KEY}`;

  return jsonUrl;
}

function spreadsheetToJson(data) {
  const headers = data[0];
  return data
    .map((item, index) => {
      if (index > 0) {
        let obj = {};
        item.map((value, idx) => {
          let key = headers[idx];
          if (key === '') {
            const uid = Math.random()
              .toString(36)
              .slice(2);
            key = uid;
          }
          return (obj[key] = value || '');
        });
        return obj;
      }
    })
    .filter(item => item);
}



// format data --------------------

function getJsonWithTypes(data: any): any {
  const jsonData = [];

  data.map((node) => {
    let nodeData = {};
    Object.keys(node).map((key) => {
      // is color
      if ((node[key], node[key].startsWith('/#'))) {
        nodeData = {
          ...nodeData,
          ...{
            [key]: {
              type: ChangeTypes.COLOR,
              value: node[key].replace('/#', '#'),
            },
          },
        };
      }

      // is show/hide
      else if (
        (node[key],
        node[key].startsWith('/Show') || node[key].startsWith('/Hide'))
      ) {
        nodeData = {
          ...nodeData,
          ...{
            [key]: {
              type: ChangeTypes.SHOW_HIDE,
              value: node[key].replace(/^\//, '').toLowerCase(),
            },
          },
        };
      }

      // is image
      else if (
        (node[key],
        node[key].startsWith('https://') || node[key].startsWith('http://'))
      ) {
        nodeData = {
          ...nodeData,
          ...{ [key]: { type: ChangeTypes.IMAGE, value: node[key] } },
        };
      }

      // is text
      else {
        nodeData = {
          ...nodeData,
          ...{ [key]: { type: ChangeTypes.TEXT, value: node[key] } },
        };
      }
    });
    jsonData.push(nodeData);
  });

  return jsonData.map(item => {
    return Object.keys(item).reduce((c, k) => (c[formatName(k.toLowerCase())] = item[k], c), {});
  });
}



// utils --------------------

function hasPlaceholders(str: string): { hasPlaceholders, placeholders, phrase } {
  const placeholders = [];
  let hasPlaceholders = false;
  const phrase = str.replace(/\{(.+?)\}/g, (inclusive, exclusive) => {
    // console.log(inclusive);
    // console.log(exclusive);
    const match = formatName(inclusive);
    hasPlaceholders = true;
    placeholders.push(match);
    return match;
  });

  return {
    hasPlaceholders,
    placeholders,
    phrase
  }
}

function formatName(str: string): string {
  return str.toLowerCase().replace(/\s/g, '').replace('-', '').replace('_', '');
}

function getRGB({ r, g, b }): { r: number, g: number, b: number } {
  const rgbColorArray = [r, g, b].map((channel) => channel / 255);
  return {
    r: rgbColorArray[0],
    g: rgbColorArray[1],
    b: rgbColorArray[2],
  };
}

function generateImagePlaceholder(): void {
  figma.ui.postMessage({
    type: 'process-image',
    imageUrl: placeholderImage,
    isPlaceholder: true
  });
}

function hexToRgb(hex: string): { r: number, g: number, b: number } {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

function syntaxHighlight(json: string | object): string {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match: string) => {
      var cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    }
  );
}
