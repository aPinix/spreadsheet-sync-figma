console.clear();

// imports --------------------
import { placeholderImage } from './placeholder';
import { API_KEY } from './api-key';
import { ChangeTypes, DataProcess, layerChangesInfoTotal, LayerNameSuffix, LoggerType, NodeRowRand, OutputNodeError, OutputVars, SelectedNodesInfo, SelectedNode, SpreadsheetData, SpreadsheetSheetsData, SuffixSpecial, TextHasPlaceholders, UrlData, UrlDataType, WindowSize, SelectedNodeType } from './models';
import { appWindowBigStartSize, appWindowMinSize, layerNamePrefix, debugSelectedNodes } from './variables';
import { logger, loggerGetTime, loggerTimeStamp } from './logger';
import { formatDataFillEmpty, formatMsToTime, showLoadingNotification } from './functions';
import { loadFontsAsync } from './load-fonts-async';



// local storage --------------------

// local storage: api url
const lsApiUrl = 'apiUrl';



// set figma plugin on inspector at start
figma.root.setRelaunchData({
  open: '',
});

// placeholder image
let placeholderImageFill: ImagePaint[];

// // loading notification
// let loadingNotification: () => void;

// node error output
let layerNodeErrors: OutputNodeError[];

let selectedNodesInfo: SelectedNodesInfo;

let layerProcessedCount: number;
let outputVars: OutputVars = {
  totalNodes: 0,
  selectionCount: 0,
  nodeNumber: 0,
  layersChangeNumber: 0,
};

let dateNowErrorProcess: Date;



// init --------------------

// init: create ui
figma.showUI(__html__, {
  width: appWindowMinSize.w,
  height: appWindowMinSize.h
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

  figma.ui.postMessage({ type: 'init' });
}

// figma.on('currentpagechange', () => {
//   console.log('currentpagechange');
// });

// detect selection changes
figma.on('selectionchange', () => {
  checkForUserSelections();
});

figma.on('close', () => {
  // if (loadingNotification) {
  //   loadingNotification();
  // }
});

// message receive
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'window-resize') {
    figma.ui.resize(msg.size.w, msg.size.h);
    // save size
    figma.clientStorage.setAsync('window-size', msg.size)
      .catch(error => {
        console.error('ERROR:', error);
      });
  }

  // if image is ready to be put into the design
  if (msg.type === 'image-ready') {
    const image: Uint8Array = msg.image;
    const imageHash: string = figma.createImage(new Uint8Array(image)).hash;

    if (!msg.isPlaceholder && msg.nodeId) {
      const nodeFills: any = figma.getNodeById(msg.nodeId);
      if (nodeFills?.fills) {
        nodeFills.fills = [
          { type: 'IMAGE', scaleMode: 'FILL', imageHash },
        ];
      }
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
    logger(LoggerType.CODE, 'get-data');
    let urlData: UrlData;
    let msgType: string;

    if (msg.isCheckUrl) {
      urlData = getSpreadsheetData(msg.url, UrlDataType.SHEET);
      msgType = 'get-api-data-sheet';
    } else {
      urlData = getSpreadsheetData(msg.url, UrlDataType.VALUES, msg.spreadsheetData);
      msgType = 'get-api-data-values';
    }

    figma.ui.postMessage({
      type: msgType,
      url: urlData.url,
      dataType: urlData.type,
      isPreview: msg.isPreview,
      isCheckUrl: msg.isCheckUrl,
      spreadsheetData: msg.spreadsheetData,
    });
  }

  // parse spreadsheet data and process layers
  if (msg.type === 'spreadsheet-data') {
    const data = JSON.parse(msg.data);
    let tableValues: SpreadsheetSheetsData;

    if (data?.values) { // spreadsheet with only one tab (sheet)
      tableValues = [data.values];
    } else if (data?.valueRanges) { // spreadsheet with multiple tabs (sheets)
      tableValues = data.valueRanges.map(sheet => sheet.values);
    }

    const dataProcessArray: DataProcess[] = [];
    tableValues = formatDataFillEmpty(tableValues);

    tableValues.map(sheet => {
      const rowsData: SpreadsheetSheetsData = spreadsheetDataToJson(sheet);

      if (msg.isPreview) {
        let prettyJson = syntaxHighlight(rowsData);

        // add little square color to the json preview
        const regexColor = /(?:\")(\/#([0-9a-fA-F]{3,8}))(?:\")/g;
        prettyJson = prettyJson.replace(
          regexColor,
          `<span class="icon-color"><span class="color-square" style="background-color: #${'$2'};"></span><span class="color-square-after">"${'$1'}"</span></span>`
        );

        // add little square color to the json preview
        const regexStrokeWithColor = /(?:\")((?:\/|)([0-9]+?|)(\|)#([0-9a-fA-F]{3,8}))(?:\")/g;
        prettyJson = prettyJson.replace(
          regexStrokeWithColor,
          `<span class="icon-color"><span class="color-square" data-stroke-width="${'$1'}" style="background-color: #${'$2'};"></span><span class="color-square-after">"${'$1'}"</span></span>`
        );

        // add little eye (show) icon to the json preview
        const regexBoolShow = /\"(\/(S|s)how)\"/g;
        prettyJson = prettyJson.replace(
          regexBoolShow,
          (match) => `<span class="icon-visible">${match}</span>`
        );

        // add little eye (hide) icon to the json preview
        const regexBoolHide = /\"(\/(H|h)ide)\"/g;
        prettyJson = prettyJson.replace(
          regexBoolHide,
          (match) => `<span class="icon-invisible">${match}</span>`
        );

        // add image links
        const regexImage = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        prettyJson = prettyJson.replace(
          regexImage,
          (url) => `<a class="preview-link" target="_blank" href="${url}" data-image="${url}">${url}</a>`
        );

        dataProcessArray.push({
          json: prettyJson,
          data: rowsData
        });
      } else {
        dataProcessArray.push({
          json: null,
          data: rowsData
        });
      }
    });

    if (msg.isPreview) {
      figma.ui.postMessage({ type: 'populate-json-preview', data: dataProcessArray });
    } else {
      figmaPopulateSheetSync(dataProcessArray);
    }
  }

  if (msg.type === 'table-elem-click') {
    const selection = figma.currentPage.selection;
    const selectionCount = figma.currentPage.selection.length;
    let namingLayerArray: string[] = [];

    const renameSingle = (node) => {
      node.name = msg.value;
      namingLayerArray.push(msg.value);
    }

    const renameMultiple = (node, newName = node.name) => {
      const layerName = changeLayerNameMultiple(newName, msg.value);
      node.name = layerName;
      namingLayerArray.push(layerName);
    }

    const renameLayer = (node) => {
      if (!msg.isShift) {
        renameSingle(node);
      } else {
        if (node.name.includes(layerNamePrefix)) {
          if (node.name.startsWith(layerNamePrefix)) {
            renameMultiple(node);
          } else {
            const newName = `${layerNamePrefix}${node.name.split(layerNamePrefix).splice(1).join(layerNamePrefix)}`;
            renameMultiple(node, newName);
          }
        } else {
          renameSingle(node);
        }
      }
    }

    selection.forEach(node => {
      renameLayer(node);
    });

    figma.ui.postMessage({ type: 'update-table-selected', layerNames: namingLayerArray, layerCount: selectionCount });
  }

  if (msg.type === 'open-preview') {
    // restore previous size
    figma.clientStorage.getAsync('window-size')
      .then((size: WindowSize) => {
        figma.ui.resize(size ? size.w : appWindowBigStartSize.w, size ? size.h : appWindowBigStartSize.h);
      })
      .catch(error => {
        console.error('ERROR:', error);
      });
  }

  if (msg.type === 'close-preview') {
    figma.ui.resize(appWindowMinSize.w, appWindowMinSize.h);
  }
};



// functions --------------------

function figmaPopulateSheetSync(data: DataProcess[]): void {
  loggerTimeStamp('SYNC START');
  // loadingNotification = showLoadingNotification(`Running...`);

  const dataArray = data.map(sheet => sheet.data);

  const selection = figma.currentPage.selection.slice();
  const selectionCount = figma.currentPage.selection.length;

  // start index for each sheet
  let rowIndex: number[] = [];
  dataArray.map(sheet => rowIndex.push(0));

  // reset layer node errors
  layerNodeErrors = [];

  layerProcessedCount = 0;

  // set output vars
  outputVars = {...outputVars, ...{
    totalNodes: 0,
    selectionCount,
    nodeNumber: 0,
  }};

  // all nodes
  const nodesArray: NodeRowRand[] = [];

  // for each selection populate children with values from spreadsheet
  selection.map((nodeSelected: any) => {
    // reset randomSaveNumber for each sheet
    const randomSaveNumber: number[] = [];

    data.map((sheet, index) => {
      // add a random save row for each sheet
      randomSaveNumber.push(Math.floor(Math.random() * (sheet.data.length)))

      // if selection > sheet rows reset to start loop
      if (rowIndex[index] === sheet.data.length) rowIndex[index] = 0;
    });

    if (nodeSelected.children) {
      nodeSelected.findAll((node: SceneNode) => {
        if (node.name.startsWith(layerNamePrefix)) {
          nodesArray.push({ node, rowIndex, randomSaveNumber });
        }
      });
    }

    // increment row number for each sheet
    rowIndex = rowIndex.map((_, idx) => rowIndex[idx] + 1);
  });

  // figma.ui.postMessage({ type: 'start-loading', totalNodes: nodesArray.length });

  // // get text nodes to process load fonts
  // const textNodes = nodesArray.map(n => n.node.type === 'TEXT' ? n.node: null).filter(n => n !== null);

  // // load and cache fonts for each text node
  // const t1 = loggerGetTime();
  // await loadFontsAsync(textNodes);
  // const t2 = loggerGetTime();
  // logger(LoggerType.CODE, `Fonts took ${formatMsToTime(t2 - t1)} to load for all TextNodes!`, true);

  // nodesArray.map((obj: any) => {
  //   const nameArray = obj.node.name.split(layerNamePrefix).filter((str: string) => str !== '').map((str: string) => `${layerNamePrefix}${str}`);
  //   outputVars.layersChangeNumber = outputVars.layersChangeNumber + nameArray.length;
  // });

  outputVars.totalNodes = nodesArray.length;

  nodesArray.map((obj: any, index: number) => {
    const nameArray = obj.node.name.split(layerNamePrefix).filter((str: string) => str !== '').map((str: string) => `${layerNamePrefix}${str}`);
    outputVars.nodeNumber = index + 1;

    const prepareToChangeLayers = (node: any, name: string) => {
      const layerSuffix: LayerNameSuffix = getLayerNameSuffix(name);
      const layerValue = getValueFromLayerName(data, name, layerSuffix, obj.rowIndex, obj.randomSaveNumber);

      if (layerValue) {
        changeLayers(node, layerValue, outputVars);
      } else {
        layerProcessedCount++;
        checkIfFinished(outputVars, false);
        nodeProcessedError(node, layerValue, `No column found with name`);
        console.warn('VALUE NOT FOUND FOR NODE:', node);
      }
    }

    if (nameArray.length > 1) {
      nameArray.map(layerName => {
        prepareToChangeLayers(obj.node, layerName);
      });
    } else {
      prepareToChangeLayers(obj.node, obj.node.name);
    }
  });
}

function checkIfFinished(outputVars: OutputVars, processed: boolean = true): void {
  if (layerProcessedCount === outputVars.layersChangeNumber) {
    finishSyncing(outputVars);
  }
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
    // regexMatch(value, ChangeTypes.IMAGE, true)                 // starts with 'http://' or 'https://'
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

function nodeProcessedError(node: any, value: string, message: string = '', timeout: number = 1500): void {
  const now = new Date();
  layerNodeErrors.push({ type: node.type, name: node.name, value });

  const logError = () => {
    if (message) message = ` - ${message}.`;
    figma.notify(`⛔️ [${node.name}]${message}`, { timeout });
  }

  if (dateNowErrorProcess === undefined) {
    dateNowErrorProcess = new Date();
    logError();
  }

  // if more than 2secs past since last error notify
  if (now.getTime() - dateNowErrorProcess.getTime() > 2000) {
    logError();
  }
}

async function changeLayers(node: any, value: string, outputVars: OutputVars): Promise<void> {
  const changeType: ChangeTypes = getChangeCateoryBasedOnNodeTypeAndValue(node.type, value);
  // console.log('type:', type);
  // console.log('node:', node);
  // console.log('name:', node.name);
  // console.log('value:', value);
  // console.log('--------------------');

  if (changeType) {
    // change text
    if (changeType === ChangeTypes.TEXT) {
      // prevent text node that has multiple mixed text styles
      if (typeof node.fontName === 'symbol') {
        nodeProcessedError(node, value, 'Has mixed fonts');
        return;
      }

      // have to use this always0
      await figma.loadFontAsync(node.fontName as FontName); // it's faster loading font for each node here and doesn't hog the memory for a longperiod of time

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
    if (changeType === ChangeTypes.COLOR_FILL) {
      if (node?.fills) {
        const colorHex: string = getColorHexFromValue(value);
        const colorRgba: RGBA = convertColoHexToRgba(colorHex);
        const color: RGB = getFigmaColorRGB(colorRgba);
        const fills: Paint[] = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: colorRgba.a }];
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
    if (changeType === ChangeTypes.COLOR_STROKE) {
      if (node?.strokes) {
        // console.log('node:', node);
        // console.log('STROKE:', node.strokeAlign);
        let strokeWeight: string | RegExpMatchArray = value.match(new RegExp(`^\/(?:[0-9]+)(\|#)`, 'g'));
        if (strokeWeight) strokeWeight = strokeWeight[0].match(new RegExp(`[0-9]+`, 'g'))[0];
        const colorHex: string = getColorHexFromValue(value);
        const colorRgba: RGBA = convertColoHexToRgba(colorHex);
        const color: RGB = getFigmaColorRGB(colorRgba);
        const strokes: Paint[] = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: colorRgba.a }];
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
        if (!node.strokeAlign) {
          node.strokeAlign = 'INSIDE'; // 'INSIDE' | 'OUTSIDE' | 'CENTER'
        }
        if (strokeWeight) node.strokeWeight = +strokeWeight;
      }
    }

    // change variant
    if (changeType === ChangeTypes.VARIANT) {
      const variantSet: ComponentSetNode = node?.mainComponent?.parent;
      if (variantSet?.type === 'COMPONENT_SET') {
        const variant = variantSet.findChild(n => n.name === value);

        if (variant) {
          // required otherwise gives error when main variant layer name is something like '#Variant.randsave'
          const originalName = node.name;
          node.name = 'temp_name';
          setTimeout(() => {
            node.swapComponent(variant);
            node.name = originalName;
          }, 10);
        }
      }
    }

    // change show/hide
    if (changeType === ChangeTypes.SHOW_HIDE) {
      const formattedValue: string = value.toLowerCase().replace('/', '');

      if (formattedValue === 'show') {
        node.visible = true;
      } else if (formattedValue === 'hide') {
        node.visible = false;
      }
    }

    // change image
    if (changeType === ChangeTypes.IMAGE) {
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

  layerProcessedCount++;
  checkIfFinished(outputVars);
  // figma.ui.postMessage({ type: 'update-node-loading', nodesCount: outputVars.nodeNumber });
}

function getValueFromLayerName(data: DataProcess[], layerName: string, layerSuffix: LayerNameSuffix, row: number[], randomSaveNumber: number[]): string {
  let dataRow;
  let value: string;
  let positionIndex: number;

  layerName = getLayerNameWithoutPrefixAndSuffix(layerName);

  data.map((sheet, index) => {
    sheet.data.map(row => {
      if (row.hasOwnProperty(layerName)) {
        // get sheet from where layerName matches column name
        if (dataRow === undefined) dataRow = index;
      }
    });
  });

  if (layerSuffix) {
    if (typeof layerSuffix === 'string') {
      if (layerSuffix === SuffixSpecial.RANDOM) {
        positionIndex = Math.floor(Math.random() * (data[dataRow].data.length));
      }

      if (layerSuffix === SuffixSpecial.RANDOM_SAVE) {
        positionIndex = randomSaveNumber[dataRow];
      }
    }

    if (typeof layerSuffix === 'number') {
      positionIndex = layerSuffix >= data[dataRow].data.length - 1 ? data[dataRow].data.length - 1 : layerSuffix - 1;
    }
  } else {
    positionIndex = row[dataRow];
    value = layerName;
  }

  if (dataRow === undefined || positionIndex === undefined) {
    value = null;
  } else {
    if (data[dataRow].data[positionIndex][layerName]) {
      value = data[dataRow].data[positionIndex][layerName];
    } else {
      value = null;
    }
  }

  return value;
}

function getOriginalTextIfInsideInstanceComponent(textNode: TextNode): string {
  // const mainNodeSelectedId = mainNodeSelected.id;
  const textNodeId: string = textNode.id;
  const textNodeIdArray: string[] = textNodeId.split(';');
  const textNodeIdCleanArray: string[] = textNodeIdArray.map(name => name.replace(/([a-z]|[A-Z])/g, ''));
  const textNodeSingleId: string = textNodeIdArray[textNodeIdArray.length - 1];
  let nodeTextCharacters: string;

  if (textNodeIdArray.length > 1) {
    const instanceId = textNodeIdCleanArray[textNodeIdCleanArray.length - 2];
    const mainComponent = (figma.getNodeById(instanceId) as InstanceNode)?.mainComponent as ComponentNode;

    if (mainComponent) {
      mainComponent.findAll(node => {
        if (node.type === 'TEXT' && node.id === textNodeSingleId) {
          nodeTextCharacters = (node as TextNode).characters;
        }
        return null;
      });
    } else {
      return null;
    }
  }

  return nodeTextCharacters;
}

function checkForUserSelections(): void {
  const layerSelction = figma.currentPage.selection;
  const layerSelctionCount = layerSelction.length;

  const layerNamesArray = getLayerNames();

  // get all nodes to process
  const nodesArray: SelectedNode[] = [];
  let totalLayerChanges: number = 0;

  layerSelction.map((nodeSelected: any, index: number) => {
    if (nodeSelected.children) {
      nodeSelected.findAll((node: SceneNode) => {
        if (node.name.startsWith(layerNamePrefix)) {
          const nameArray = node.name.split(layerNamePrefix).filter((str: string) => str !== '').map((str: string) => `${layerNamePrefix}${str}`);
          totalLayerChanges = totalLayerChanges + nameArray.length;
          nodesArray.push({ index, node: node, type: node.type, layerChanges: nameArray.length });
        }
      });
    }
  });

  // get how much of each nodes to process
  const nodeTypesArray: SelectedNodeType[] = [];
  nodesArray.map(layer => {
    if (!nodeTypesArray.some(t => t.type === layer.type)) {
      nodeTypesArray.push({ type: layer.type, count: 1 });
    } else {
      const index = nodeTypesArray.findIndex(obj => obj.type === layer.type);
      const count = nodeTypesArray[index].count;
      nodeTypesArray[index].count = count + 1;
    }
  });

  selectedNodesInfo = {
    nodes: nodesArray,
    typesQuantity: nodeTypesArray,
    totalLayerChanges
  }

  outputVars.layersChangeNumber = totalLayerChanges;

  figma.ui.postMessage({ type: 'update-nodes-count', selectedNodesInfo });

  if (layerSelctionCount > 0) {
    // if all selections have children (to process)
    const allSelectionsHaveChildren = layerSelction.every(node => (node as FrameNode).children);

    if (debugSelectedNodes) layerSelction.map(node => console.log(node));

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

function finishSyncing(outputVars: OutputVars): void {
  // if (loadingNotification) {
  //   loadingNotification();
  // }

  // time thet took the plugin to process
  const timeNow = loggerTimeStamp('SYNC END');
  const timeSuffix = `${formatMsToTime(timeNow - loggerGetTime('start'))}`;

  const getLayerSingularPlural = (count, naming: string = 'Layer') => {
    return `${naming}${count > 1 ? 's' : ''}`;
  }

  // notify node changes
  const msgPrefix = `Sync Complete: `;
  const totalFailed = outputVars.totalNodes == layerNodeErrors.length;
  const msgLayersSuccess = `${totalFailed ? '' : `✅ [${outputVars.totalNodes - layerNodeErrors.length}] `}`;
  const msgLayersError = `${totalFailed ? '' : 'and '}⛔️ [${layerNodeErrors.length}] `;
  const msgSuffix = `based on ✏️ [${outputVars.selectionCount}] ${getLayerSingularPlural(outputVars.selectionCount, 'selection')} `;
  let notification: string;
  if (outputVars.totalNodes > 0) {
    notification = `${msgPrefix} ${msgLayersSuccess}${msgLayersError}${msgSuffix} - ${timeSuffix}`;
  } else {
    notification = `${msgPrefix} No changes were made ${msgSuffix}`;
  }

  // figma.ui.postMessage({ type: 'end-loading' });

  // if (layerNodeErrors.length) {
  //   figma.notify(`⛔️ [${layerNodeErrors[0].name}] - Has mixed fonts.`, { timeout: 3000 });
  // }

  figma.notify(
    notification,
    { timeout: layerNodeErrors.length > 0 ? 6500 : 5000 }
  );
  // figma.closePlugin();
}



// spreadsheet --------------------

function getSpreadsheetId(sheetUrl: string): string {
  return new RegExp('/spreadsheets/d/([a-zA-Z0-9-_]+)').exec(sheetUrl)[1];
}

function getSpreadsheetData(url: string, type: UrlDataType, spreadsheetData: SpreadsheetData = null): UrlData {
  const sheetUrlPrefix: string = 'https://sheets.googleapis.com/v4/spreadsheets/';
  const sheetUrlSuffix: string = `alt=json&key=${API_KEY}`;
  const sheetId: string = getSpreadsheetId(url);
  const sheetRange: string = 'A1:ZZZ100000000'; // https://developers.google.com/sheets/api/guides/concepts#a1_notation
  let dataUrl: string = `${sheetUrlPrefix}${sheetId}/values`;
  let dataType: UrlDataType;

  if (type === UrlDataType.SHEET) {
    dataUrl = `${sheetUrlPrefix}${sheetId}?alt=json&key=${API_KEY}`;
    dataType = UrlDataType.SHEET;
  }

  if (type === UrlDataType.VALUES) {
    if (spreadsheetData?.sheets.length > 1) {
      dataUrl = `${dataUrl}:batchGet`;
      spreadsheetData?.sheets?.map((sheet, index) => dataUrl = `${dataUrl}${index === 0 ? '?' : '&'}ranges=${encodeURI(sheet.title)}`);
      dataUrl = `${dataUrl}&${sheetUrlSuffix}`;
    } else {
      dataUrl = `${dataUrl}/${sheetRange}?${sheetUrlSuffix}`;
    }
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

  return null;
}

function getLayerNameWithoutSpacesAndSpecialChars(str: string): string {
  return str.toLowerCase().replace(/\s/g, '').replace('-', '').replace('_', '');
}

function getLayerNames(): string[] {
  return figma.currentPage.selection.length > 0 ? figma.currentPage.selection.map(node => node.name) : [];
}

function changeLayerNameMultiple(layerNameOld, layerNameNew): string {
  const layerNameOldArray = layerNameOld.split(layerNamePrefix).filter(str => str !== '').map(str => `${layerNamePrefix}${str}`);
  const layerNameOldArrayNoSuffix = layerNameOldArray.map(str => getLayerNameWithoutSuffix(str));
  const layerNameNewNoSuffix = getLayerNameWithoutSuffix(layerNameNew);

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
