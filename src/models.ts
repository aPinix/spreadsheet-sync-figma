// --------------------------------------------------
// #TYPES
// --------------------------------------------------

// layer --------------------

export type LayerNameSuffix = string | number | null;



// spreadsheet --------------------

export type SpreadsheetSheetsData = string[][][];
export type SpreadsheetSingleSheetData = string[][];





// --------------------------------------------------
// #ENUMS
// --------------------------------------------------

// change --------------------

export const enum ChangeTypes {
  COLOR_FILL = 'color-fill',
  COLOR_STROKE = 'color-stroke',
  SHOW_HIDE = 'show-hide',
  IMAGE = 'image',
  VARIANT = 'variant',
  TEXT = 'text',
}

export const enum SuffixSpecial {
  RANDOM = 'rand',
  RANDOM_SAVE = 'randsave',
}



// url --------------------

export const enum UrlDataType {
  SHEET = 'sheet',
  VALUES = 'values',
}



// message --------------------

export const enum RequestType {
  SUCCESS = 'success',
  ERROR = 'error',
  RESET = 'reset',
}

export const enum RequestMessage {
  INVALID_LINK = '⛔️ Invalid link or bad request',
  SHEET_NOT_PUBLIC = '⛔️ Sheet is not Public',
  SHEET_PUBLIC = '✅ Sheet is Public',
  ERROR_GENERIC = '⛔️ Something went wrong!',
}



// tooltip --------------------

export const enum TooltipTheme {
  DEFAULT = 'default',
  SUCCESS = 'success',
  ERROR = 'error',
}



// log --------------------

export const enum LoggerType {
  CODE = 'code',
  UI = 'ui',
}





// --------------------------------------------------
// #INTERFACES
// --------------------------------------------------

// spreadsheet --------------------

export interface SpreadsheetDataSheetsInfo {
  title: string;
  rowCount: number;
  columnCount: number;
  selected: boolean;
}

export interface SpreadsheetDataProperties {
  title: string;
}

export interface SpreadsheetData {
  properties: SpreadsheetDataProperties;
  sheets: SpreadsheetDataSheetsInfo[];
}



// data --------------------

export interface DataProcess {
  json: string;
  data: SpreadsheetSheetsData;
}



// url --------------------

export interface UrlData {
  url: string;
  type: UrlDataType;
}



// nodes --------------------

export interface TextHasPlaceholders {
  hasPlaceholders: boolean;
  placeholders: any[];
  phrase: string;
}

export interface SelectedNode {
  index: number;
  node: any;
  type: NodeType;
  layerChanges: number;
}

export interface SelectedNodeType {
  count: number;
  type: NodeType;
}

export interface SelectedNodesInfo {
  nodes: SelectedNode[];
  typesQuantity: SelectedNodeType[];
  totalLayerChanges: number;
}

export interface NodeRowRand {
  node: SceneNode;
  rowIndex: number[];
  randomSaveNumber: number[];
}

export interface layerChangesInfoTotal {
  totalChanges: number;
  layers: layerChangesInfo[];
}

export interface layerChangesInfo {
  type: NodeType;
  layerChanges: number;
}



// output --------------------

export interface OutputVars {
  totalNodes: number;
  selectionCount: number;
  nodeNumber: number;
  layersChangeNumber: number;
}

export interface OutputNodeError {
  type: NodeType;
  name: string;
  value: string;
}



// window --------------------

export interface WindowSize {
  w: number;
  h: number;
}
