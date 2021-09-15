console.clear();

// imports --------------------
import { placeholderImage } from './placeholder';
import { API_KEY } from './api-key';
import { ChangeTypes, LayerNameSuffix, SuffixSpecial, TextHasPlaceholders, UrlData, UrlDataType } from './models';
import { layerNamePrefix, selectDebug } from './variables';



// local storage --------------------

// local storage: api url
const lsApiUrl = 'apiUrl';



// global vars --------------------

// global vars: window size
let appWindowDefaultWidth = 380;
let appWindowDefaultHeight = 494;
let appWindowBigWidth = 750;
let appWindowBigHeight = 700;
let appWindowWidth = appWindowDefaultWidth;
let appWindowHeight = appWindowDefaultHeight;

// set figma plugin on inspector at start
figma.root.setRelaunchData({
  open: '',
});

// placeholder image
let placeholderImageFill: any[];

// variable for random-save type
let randomSaveNumber: number;



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
      ];
    }
  }

  // set input with local storage url
  if (msg.type === 'input-set') {
    figma.root.setPluginData(lsApiUrl, msg.value);
  }

  // get data from url
  if (msg.type === 'get-data') {
    let urlData: UrlData;
    let msgType: string;

    if (msg.isCheckUrl) {
      urlData = getSpreadsheetData(msg.url, UrlDataType.SHEET);
      msgType = 'get-api-data-sheet';
    } else {
      urlData = getSpreadsheetData(msg.url, UrlDataType.VALUES);
      msgType = 'get-api-data-values';
    }

    figma.ui.postMessage({
      type: msgType,
      url: urlData.url,
      dataType: urlData.type,
      isPreview: msg.isPreview,
      isCheckUrl: msg.isCheckUrl,
      spreadsheetData: msg.spreadsheetData || null,
    });
  }

  // parse spreadsheet data and process layers
  if (msg.type === 'spreadsheet-data') {
    const data = JSON.parse(msg.data);
    // console.log('data:', data);
    // const authorEmail = data.feed.author[0].email.$t;
    // const authorName = data.feed.author[0].name.$t;
    // const dateUpdated = data.feed.updated.$t; // '2021-04-20T16:56:11.878Z'
    // const sheetTitle = data.feed.title.$t; //  'Sheet1'
    const rowsData: any[] = spreadsheetDataToJson(data.values);

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

  if (msg.type === 'table-elem-click') {
    const selection = figma.currentPage.selection;
    const countSelection = figma.currentPage.selection.length;
    let singleNamingLayer;

    if (countSelection === 1) {
      selection.forEach(selectedNode => {
        if (!msg.isShift) {
          selectedNode.name = msg.value;
          singleNamingLayer = msg.value;
        } else {
          const layerName = changeLayerNameMultiple(selectedNode.name, msg.value);
          selectedNode.name = layerName;
          singleNamingLayer = layerName;
        }
      });
    } else {
      // error: only 1 layer selected
    }

    figma.ui.postMessage({ type: 'update-table-selected', layerNames: [singleNamingLayer], layerCount: countSelection });
  }

  if (msg.type === 'open-preview') {
    figma.ui.postMessage({ type: 'open-advance-preview' });
    figma.ui.resize(appWindowBigWidth, appWindowBigHeight);
  }

  if (msg.type === 'close-preview') {
    figma.ui.postMessage({ type: 'close-advance-preview' });
    figma.ui.resize(appWindowDefaultWidth, appWindowDefaultHeight);
  }
};



// functions --------------------

function figmaPopulateSheetSync(data: any[]): void {
  const selection = figma.currentPage.selection;
  const selectionCount = figma.currentPage.selection.length;

  let countLayersChanged = 0;

  // for each selection populate children with values from spreadsheet
  selection.map((nodeMain: any, index: number) => {
    randomSaveNumber = Math.floor(Math.random() * (data.length));

    if (nodeMain.children) {
      nodeMain.findAll((node: any) => {
        if (node.name.startsWith(layerNamePrefix)) {
          const nameArray = node.name.split('#').filter((str: string) => str !== '').map((str: string) => `${layerNamePrefix}${str}`);

          const prepareToChangeLayers = (node: any, name: string) => {
            const layerSuffix: LayerNameSuffix = getLayerNameSuffix(name);
            const layerValue = getValueFromLayerName(layerSuffix, data, name, index);

            changeLayers(node, layerValue);
          }

          if (nameArray.length > 1) {
            nameArray.map(layerName => {
              prepareToChangeLayers(node, layerName);
            });
          } else {
            prepareToChangeLayers(node, node.name);
          }
          countLayersChanged++;
        }
      });

      // if last element notify
      if (index === selection.length - 1) {
        figma.notify(
          `Sync Complete ✅ - [${countLayersChanged}] layer${countLayersChanged > 1 ? 's' : ''} changed based on [${selectionCount}] selection${selectionCount > 0 ? 's' : '' }`,
          { timeout: 5000 }
        );
        // figma.closePlugin();
      }
    }
  });
}

function getChangeCateoryBasedOnNodeTypeAndValue(type: NodeType, value: string): ChangeTypes {
  // is color fill
  if (
    value.startsWith('/#') &&                                  // starts with '/#'
    !value.includes('|')                                       // doesn't include the '|' character
  ) { return ChangeTypes.COLOR_FILL }

  // is color stroke
  else if (
    value.includes('|') &&                                     // includes the '|' character
    value.match(new RegExp(`^\/([0-9]+)?\|#`, 'g'))            // starts with '/|#' or '/2|#'
  ) { return ChangeTypes.COLOR_STROKE }

  // is show/hide
  else if (
    value.toLowerCase().startsWith('/show') ||                 // starts with '/show' or '/Show'
    value.toLowerCase().startsWith('/hide')                    // starts with '/hide' or '/Hide'
  ) { return ChangeTypes.SHOW_HIDE }

  // is image
  else if (
    value.toLowerCase().match(new RegExp(`^http(s)?://`, 'g')) // starts with 'http://' or 'https://'
  ) { return ChangeTypes.IMAGE }

  // is variant
  else if (
    type === 'INSTANCE' &&                                     // if type is instance
    value.includes('=')                                        // includes the '=' character
  ) { return ChangeTypes.VARIANT }

  // is text (fallback)
  else if (
    type === 'TEXT'                                            // if type is text
  ) { return ChangeTypes.TEXT }

  else {
    return null;
  }
}

async function changeLayers(node: any, value: any): Promise<void> {
  const type: ChangeTypes = getChangeCateoryBasedOnNodeTypeAndValue(node.type, value);
  // console.log('type:', type);
  // console.log('node:', node);
  // console.log('name:', node.name);
  // console.log('value:', value);
  // console.log('--------------------');

  if (type) {
    // change text
    if (type === ChangeTypes.TEXT) {
      await figma.loadFontAsync(node.fontName as FontName);

      // reset text
      const layerOriginalName = getOriginalTextIfInsideInstanceComponent(node);
      if (layerOriginalName) {
        if (stringHasPlaceholdersInsideText(layerOriginalName).hasPlaceholders) {
          node.characters = layerOriginalName;
        }
      }

      const placeholder = stringHasPlaceholdersInsideText(node.characters);
      let phrase = placeholder.phrase;
      if (placeholder.hasPlaceholders) {
        placeholder.placeholders.map((ph: string) => {
          phrase = phrase.replace(ph, value);
        });
        node.characters = phrase;
      } else {
        node.characters = value;
      }
    }

    // change color fill
    if (type === ChangeTypes.COLOR_FILL) {
      if (node?.fills) {
        const colorHex = getColorHexFromValue(value);
        const colorRgba = convertColoHexToRgba(colorHex);
        const color: RGB = getFigmaColorRGB(colorRgba);
        const fills = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: colorRgba.a }];
        // const fills = {
        //   type: 'SOLID',
        //   visible: true,
        //   opacity: color.a,
        //   blendMode: 'NORMAL',
        //   color: {
        //     r: color.r,
        //     g: color.g,
        //     b: color.b
        //   }
        // }
        node.fills = fills;
      }
    }

    // change color stroke
    if (type === ChangeTypes.COLOR_STROKE) {
      if (node?.strokes) {
        let strokeWeight = value.match(new RegExp(`^\/(?:[0-9]+)(\|#)`, 'g'));
        if (strokeWeight) strokeWeight = strokeWeight[0].match(new RegExp(`[0-9]+`, 'g'))[0];
        const colorHex = getColorHexFromValue(value);
        const colorRgba = convertColoHexToRgba(colorHex);
        const color: RGB = getFigmaColorRGB(colorRgba);
        const strokes = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: colorRgba.a }];
        // const strokes = {
        //   type: 'SOLID',
        //   visible: true,
        //   opacity: color.a,
        //   blendMode: 'NORMAL',
        //   color: {
        //     r: color.r,
        //     g: color.g,
        //     b: color.b
        //   }
        // }
        node.strokes = strokes;
        node.strokeAlign = 'INSIDE'; // 'INSIDE' | 'OUTSIDE' | 'CENTER'
        if (strokeWeight) node.strokeWeight = +strokeWeight;
      }
    }

    // change variant
    if (type === ChangeTypes.VARIANT) {
      const variantSet = node?.mainComponent?.parent;
      if (variantSet && variantSet.type === 'COMPONENT_SET') {
        const variant = variantSet.findChild(n => n.name === value)
        node.swapComponent(variant);
      }
    }

    // change show/hide
    if (type === ChangeTypes.SHOW_HIDE) {
      const formattedValue = value.toLowerCase().replace('/', '');

      if (formattedValue === 'show') {
        node.visible = true;
      } else if (formattedValue === 'hide') {
        node.visible = false;
      }
    }

    // change image
    if (type === ChangeTypes.IMAGE) {
      if (node?.fills) {
        // while fetching image use placeholder
        node.fills = placeholderImageFill;

        // actual image
        figma.ui.postMessage({
          type: 'process-image',
          imageUrl: value,
          nodeId: node.id,
          isPlaceholder: false
        });
      }
    }
  }
}

function getValueFromLayerName(layerSuffix: LayerNameSuffix, data: any, layerName: string, row: number): string {
  layerName = getLayerNameWithoutPrefixAndSuffix(layerName);

  if (layerSuffix) {
    if (typeof layerSuffix === 'string' && layerSuffix === SuffixSpecial.RANDOM) {
      const positionIndex = Math.floor(Math.random() * (data.length));
      const value = data[positionIndex][layerName];
      return value;
    }

    if (typeof layerSuffix === 'string' && layerSuffix === SuffixSpecial.RANDOM_SAVE) {
      const positionIndex = randomSaveNumber;
      const value = data[positionIndex][layerName];
      return value;
    }

    if (typeof layerSuffix === 'number') {
      const positionIndex = layerSuffix > data.length - 1 ? data.length - 1 : layerSuffix - 1;
      const value = data[positionIndex][layerName];
      return value;
    }
  } else {
    const positionIndex = row;
    const value = data[positionIndex][layerName];
    return value;
  }
}

function getOriginalTextIfInsideInstanceComponent(textNode: TextNode): string {
  // const mainNodeSelectedId = mainNodeSelected.id;
  const textNodeId = textNode.id;
  const textNodeIdArray = textNodeId.split(';');
  const textNodeIdCleanArray = textNodeIdArray.map(name => name.replace(/([a-z]|[A-Z])/g, ''));
  const textNodeSingleId = textNodeIdArray[textNodeIdArray.length - 1];
  let nodeTextCharacters;

  if (textNodeIdArray.length > 1) {
    const instanceId = textNodeIdCleanArray[textNodeIdCleanArray.length - 2];
    const mainComponent = (figma.getNodeById(instanceId) as InstanceNode).mainComponent as ComponentNode;

    mainComponent.findAll(node => {
      if (node.type === 'TEXT' && node.id === textNodeSingleId) {
        nodeTextCharacters = (node as TextNode).characters;
      }
      return null;
    });
  }

  return nodeTextCharacters;
}

function checkForUserSelections(): void {
  const layerSelction = figma.currentPage.selection;
  const layerSelctionCount = layerSelction.length;

  const layerNamesArray = getLayerNames();

  if (layerSelctionCount > 0) {
    // if all selections have children (to process)
    const allSelectionsHaveChildren = layerSelction.every(node => (node as FrameNode).children);

    if (selectDebug) {
      layerSelction.map(node => console.log( node));
    }

    if (allSelectionsHaveChildren) {
      figma.ui.postMessage({
        type: 'layers',
        message: `${layerSelctionCount > 1 ? 'layers' : 'layer'} selected`,
        description: `Ready to sync!`,
        color: 'success',
        layerNames: layerNamesArray,
        layerCount: layerSelctionCount,
      });
    } else {
      figma.ui.postMessage({
        type: 'layers',
        message: `${layerSelctionCount > 1 ? 'layers' : 'layer'} selected`,
        description: `Select only layers that have children.`,
        color: 'warning',
        layerNames: layerNamesArray,
        layerCount: layerSelctionCount,
      });
    }

    // figma.root.setRelaunchData({ relaunch: '' });
  } else {
    figma.ui.postMessage({
      type: 'layers',
      message: `layers selected`,
      description: `Select at least 1 layer!`,
      color: 'error',
      layerNames: layerNamesArray,
      layerCount: 0,
    });

    // figma.root.setRelaunchData({});
  }
}



// spreadsheet --------------------

function getSpreadsheetId(sheetUrl: string): string {
  return new RegExp('/spreadsheets/d/([a-zA-Z0-9-_]+)').exec(sheetUrl)[1];
}

function getSpreadsheetData(url: string, type: UrlDataType): UrlData {
  const sheetUrlPrefix: string = 'https://sheets.googleapis.com/v4/spreadsheets/';
  const sheetId: string = getSpreadsheetId(url);
  const sheetRange: string = 'A1:ZZZ100000000'; // https://developers.google.com/sheets/api/guides/concepts#a1_notation
  let dataUrl: string;
  let dataType: UrlDataType;

  if (type === UrlDataType.SHEET) {
    dataUrl = `${sheetUrlPrefix}${sheetId}?alt=json&key=${API_KEY}`;
    dataType = UrlDataType.SHEET;
  }

  if (type === UrlDataType.VALUES) {
    dataUrl = `${sheetUrlPrefix}${sheetId}/values/${sheetRange}?alt=json&key=${API_KEY}`;
    dataType = UrlDataType.VALUES;
  }

  return {
    url: dataUrl,
    type: dataType
  }
}

function spreadsheetDataToJson(data) {
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



// utils --------------------

function stringHasPlaceholdersInsideText(str: string): TextHasPlaceholders {
  const placeholders = [];
  let hasPlaceholders = false;
  const phrase = str.replace(/\{(.+?)\}/g, (inclusive, exclusive) => {
    // console.log(inclusive);
    // console.log(exclusive);
    const match = getLayerNameWithoutSpacesAndSpecialChars(inclusive);
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

function getLayerNameWithoutPrefixAndSuffix(name: string): string {
  return getLayerNameWithoutSuffix(getLayerNameWithoutPrefix(name));
}

function getLayerNameWithoutPrefix(name: string): string {
  return name.replace(layerNamePrefix, '');
}

function getLayerNameWithoutSuffix(name: string): string {
  return name.includes('.') ? name.split('.')[0] : name;
}

function getLayerNameSuffix(name: string): LayerNameSuffix {
  const regexRandom = new RegExp(`\.${SuffixSpecial.RANDOM}$`, 'g');
  if (name.match(regexRandom)) {
    return SuffixSpecial.RANDOM;
  }

  const regexRandomSave = new RegExp(`\.${SuffixSpecial.RANDOM_SAVE}$`, 'g');
  if (name.match(regexRandomSave)) {
    return SuffixSpecial.RANDOM_SAVE;
  }

  const regexNumber = /\.[0-9]*/g;
  const regexNumberResult = name.match(regexNumber);
  if (regexNumberResult) {
    const stringToNumber = regexNumberResult[0].replace('.', '');
    return +stringToNumber;
  }

  return '';
}

function getLayerNameWithoutSpacesAndSpecialChars(str: string): string {
  return str.toLowerCase().replace(/\s/g, '').replace('-', '').replace('_', '');
}

function getLayerNames(): string[] {
  return figma.currentPage.selection.length > 0 ? figma.currentPage.selection.map(node => node.name) : [];
}

function changeLayerNameMultiple(layerNameOld, layerNameNew): string {
  const layerNameOldArray = layerNameOld.split('#').filter(str => str !== '').map(str => `#${str}`);
  const layerNameOldArrayNoSuffix = layerNameOldArray.map(str => str.split('.')[0]);
  const layerNameNewNoSuffix = layerNameNew.split('.')[0];

  if (layerNameOldArrayNoSuffix.includes(layerNameNewNoSuffix)) {
    let layerNameCurrent: string;
    const layerNameOldIndex = layerNameOldArrayNoSuffix.indexOf(layerNameNewNoSuffix);
    const layerNameOldMatch = layerNameOldArray[layerNameOldIndex];

    if (layerNameOldMatch === layerNameNew) {
      if (layerNameOldArray.length > 1) {
        layerNameOldArray.splice(layerNameOldIndex, 1);
      }
    } else {
      layerNameOldArray[layerNameOldIndex] = layerNameNew;
    }

    layerNameCurrent = layerNameOldArray.join('');

    return layerNameCurrent;
  } else {
    return `${layerNameOld}${layerNameNew}`;
  }
}



// colors --------------------

function getColorHexFromValue(value): string {
  const regexColorHex = new RegExp(`(#[0-9a-fA-F]+)`, 'g');
  return value.match(regexColorHex)[0] || null;
}

function convertColoHexToRgba(hex: string, alpha: number = 1): RGBA {
  const isValidHex = (hex) => /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex);
  const getChunksFromString = (st, chunkSize) => st.match(new RegExp(`.{${chunkSize}}`, 'g'));
  const convertHexUnitTo256 = (hexStr) => parseInt(hexStr.repeat(2 / hexStr.length), 16);
  const getAlphafloat = (a, alpha) => {
    if (typeof a !== 'undefined') return a / 255;
    if (typeof alpha != 'number' || alpha < 0 || alpha > 1) return 1;
    return alpha;
  }

  if (!isValidHex(hex)) return null;

  const chunkSize = Math.floor((hex.length - 1) / 3);
  const hexArr = getChunksFromString(hex.slice(1), chunkSize);
  const [r, g, b, a] = hexArr.map(convertHexUnitTo256);
  alpha = getAlphafloat(a, alpha);
  return { r, g, b, a: alpha }
}

function getFigmaColorRGB({ r, g, b, a }: RGBA): RGB {
  const rgbColorArray = [r, g, b].map((channel) => channel / 255);

  return {
    r: rgbColorArray[0],
    g: rgbColorArray[1],
    b: rgbColorArray[2],
  };
}



// images --------------------

function generateImagePlaceholder(): void {
  figma.ui.postMessage({
    type: 'process-image',
    imageUrl: placeholderImage,
    isPlaceholder: true
  });
}




// code highlight --------------------

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
