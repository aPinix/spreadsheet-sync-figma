import { ChangeTypes, RequestMessage, RequestType, WindowSize } from './models';
import { isStringType } from './regex-types';
import './ui.scss';
import { appWindowMinSize, appWindowMinSizeAdvancedMode } from './variables';

// sheet is public
let sheetIsPublic = false;

// layer selection count
let layerSelectionCount: number = 0;
let layerSelectionNames: string[];

// if on advanced mode window
let isAdvancedMode: boolean = false;

// elems
const buttonReCheck = document.getElementById('btn-re-check-link') as HTMLButtonElement;
const cornerResize = document.getElementById('corner-resize');
const btnCopy = document.getElementById('btn-copy-to-clipboard') as HTMLTextAreaElement;


// message --------------------

window.onmessage = async (event) => {
  if (event.data?.pluginMessage?.type) {
    if (event.data.pluginMessage.type === 'process-image') {
      let imageUrl = event.data.pluginMessage.imageUrl;

      await fetch(imageUrl)
        .then((r) => r.arrayBuffer())
        .then((data) => {
          parent.postMessage(
            {
              pluginMessage: {
                type: 'image-ready',
                image: new Uint8Array(data),
                nodeId: event.data.pluginMessage.nodeId || null,
                isPlaceholder: event.data.pluginMessage.isPlaceholder
              },
            },
            '*'
          );
        });
    }

    if (event.data.pluginMessage.type === 'sync-dev') {
      setTimeout(() => {
        document.getElementById('sync').click();
      }, 100);
    }

    if (event.data.pluginMessage.type === 'set-input-url') {
      const inputUrl = document.getElementById('api-url') as HTMLInputElement;
      inputUrl.value = event.data.pluginMessage.value;

      updateInputUrl();
      checkUrlPublic();
      updatePreviewButton(event.data.pluginMessage.value);
    }

    if (event.data.pluginMessage.type === 'layers') {
      const sectionMessage = document.getElementById('section-message');
      const sectionSync = document.getElementById('section-sync');
      const titleElem = document.querySelector('#title') as HTMLElement;
      const countElem = document.querySelector('#title .count') as HTMLElement;
      const messageElem = document.querySelector('#title .message') as HTMLElement;
      const subtitleElem = document.querySelector('#subtitle') as HTMLElement;
      const buttonSync = document.querySelector('#sync') as HTMLButtonElement;

      layerSelectionNames = event.data.pluginMessage.layerNames;
      layerSelectionCount = event.data.pluginMessage.layerCount;

      updateTableSelection();

      removeClsStartingWith([sectionMessage, countElem, sectionSync], 'bg-');

      removeCls(titleElem, ['text-success', 'text-warning', 'text-error']);
      addCls([subtitleElem, countElem], 'hidden');

      if (event.data.pluginMessage.color === 'success') {
        buttonSync.disabled = false;
        addCls([sectionMessage, sectionSync], 'bg-success');
        addCls(countElem, 'bg-success-full');
        addCls(titleElem, 'text-success');
        removeCls([subtitleElem, countElem], 'hidden');
      }

      if (event.data.pluginMessage.color === 'warning') {
        buttonSync.disabled = true;
        addCls([sectionMessage, sectionSync], 'bg-warning');
        addCls(countElem, 'bg-warning-full');
        addCls(titleElem, 'text-warning');
        removeCls([subtitleElem, countElem], 'hidden');
      }

      if (event.data.pluginMessage.color === 'error') {
        buttonSync.disabled = true;
        addCls([sectionMessage, sectionSync], 'bg-error');
        addCls(countElem, 'bg-error-full');
        addCls(titleElem, 'text-error');
        removeCls([subtitleElem, countElem], 'hidden');
      }
      countElem.innerText = event.data.pluginMessage.layerCount;
      messageElem.innerText = event.data.pluginMessage.message;
      if (event.data.pluginMessage.description) {
        subtitleElem.innerText = event.data.pluginMessage.description;
      }
    }

    if (event.data.pluginMessage.type === 'update-table-selected') {
      layerSelectionNames = event.data.pluginMessage.layerNames;
      layerSelectionCount = event.data.pluginMessage.layerCount;
      updateTableSelection();
    }

    if (event.data.pluginMessage.type === 'populate-json-preview') {
      document.getElementById('code-preview').innerHTML =
        event.data.pluginMessage.json;
      (document.getElementById('code-to-copy') as HTMLTextAreaElement).value =
        JSON.stringify(event.data.pluginMessage.jsonRaw, undefined, 2);
      togglePreview();
    }

    if (event.data.pluginMessage.type === 'close-advance-preview') {
      togglePreview(true);
    }

    if (event.data.pluginMessage.type === 'get-api-data-sheet') {
      fetchData(event.data)
        .then((data) => {
          const parsedData = JSON.parse(data);
          const spreadsheetTitle = parsedData.properties.title;
          const spreadsheetSheetsInfo = parsedData.sheets.map(sheet => {
            return {
              title: sheet.properties.title,
              rowCount: sheet.properties.rowCount,
              columnCount: sheet.properties.columnCount,
            }
          });
          const spreadsheetData = {
            properties: spreadsheetTitle,
            sheets: spreadsheetSheetsInfo
          };

          if (!event.data.pluginMessage.isCheckUrl) {
            const inputValue = getInputUrlValue();
            window.parent.postMessage({ pluginMessage: { type: 'get-data', url: inputValue, isPreview: false, isCheckUrl: false, spreadsheetData }}, '*');
          }
        })
        .catch((error) => {
          console.log('ERROR:', error);
        })
    }

    if (event.data.pluginMessage.type === 'get-api-data-values') {
      const previewSection = document.querySelector('#preview-section') as HTMLElement;
      if (event.data.pluginMessage.isPreview && !previewSection.classList.contains('accordion-collapsed')) {
        window.parent.postMessage({ pluginMessage: { type: 'close-preview' } }, '*');
        toggleAdvancedMode();
        return; // prevents further code (required)
      } else if (event.data.pluginMessage.isPreview && previewSection.classList.contains('accordion-collapsed')) {
        window.parent.postMessage({ pluginMessage: { type: 'open-preview' } }, '*');
        toggleAdvancedMode();
      }

      fetchData(event.data)
        .then((data) => {
          if (!event.data.pluginMessage.isCheckUrl) {
            createTable(JSON.parse(data).values);

            window.parent.postMessage(
              {
                pluginMessage: {
                  type: 'spreadsheet-data',
                  data,
                  isPreview: event.data.pluginMessage.isPreview,
                  isCheckUrl: event.data.pluginMessage.isCheckUrl,
                  spreadsheetData: event.data.pluginMessage.spreadsheetData
                },
              },
              '*'
            );
          }
        })
        .catch((error) => {
          console.log('ERROR:', error);
        })
    }
  }
}



// listeners --------------------

// listeners: add input url listeners
document.getElementById('api-url').addEventListener('input', () => { debounce(checkUrlPublic()); updateInputUrl(); }, false);
document.getElementById('api-url').addEventListener('focus', (event) => { (event.target as HTMLInputElement).select(); updateInputUrl(); });

// listeners: sync
document.getElementById('sync').addEventListener('click', () => {
  const inputValue = getInputUrlValue();
  window.parent.postMessage(
    { pluginMessage: { type: 'get-data', url: inputValue, isPreview: false, isCheckUrl: false } },
    '*'
  );
});

// listeners: preview-data
document.getElementById('preview-data').onclick = () => {
  const inputValue = getInputUrlValue();
  window.parent.postMessage(
    { pluginMessage: { type: 'get-data', url: inputValue, isPreview: true, isCheckUrl: false } },
    '*'
  );
};

// listeners: open more info modal
document.getElementById('more-info').onclick = () => {
  const modalInfo = (document.getElementById('more-info-modal') as HTMLElement);

  modalInfo.style.display = 'block';
  modalInfo.classList.remove('out');
};

// listeners: close more info modal
[document.getElementById('close-modal'), document.getElementById('modal-overlay')].forEach(item => {
  item.addEventListener('click', event => {
    const modalInfo = (document.getElementById('more-info-modal') as HTMLElement);

    modalInfo.classList.add('out');

    const modalOverlay = modalInfo.querySelector('.modal-overlay');
    const style = getComputedStyle(modalOverlay, 'animation');
    const styleAnimationDuration = parseFloat(style.animationDuration);
    const styleAnimationDurationNumber = styleAnimationDuration * 1000;

    setTimeout(() => {
      modalInfo.style.display = 'none';
      modalInfo.classList.remove('out');
    }, styleAnimationDurationNumber);
  })
});

// listeners: copy json to clipboard
btnCopy.onclick = (event) => {
  const textarea = document.getElementById('code-to-copy') as HTMLTextAreaElement;

  textarea.select();
  document.execCommand('copy');

  addCls(btnCopy, 'copied');
  setTimeout(() => {
    removeCls(btnCopy, 'copied');
  }, 1500);
};

// listeners: re-check link
buttonReCheck.onclick = () => {
  checkUrlPublic();

  toggleReCheckButton(true);
};

// listeners: resize window (only when on advanced mode)
function resizeWindow(event) {
  const size: WindowSize = {
    w: Math.max(isAdvancedMode ? appWindowMinSizeAdvancedMode.w : appWindowMinSize.w, Math.floor(event.clientX + 5)),
    h: Math.max(isAdvancedMode ? appWindowMinSizeAdvancedMode.h : appWindowMinSize.h, Math.floor(event.clientY + 5))
  };
  parent.postMessage( { pluginMessage: { type: 'window-resize', size: size }}, '*');
}
cornerResize.onpointerdown = (event) => {
  cornerResize.onpointermove = resizeWindow;
  cornerResize.setPointerCapture(event.pointerId);
};
cornerResize.onpointerup = (event) => {
  cornerResize.onpointermove = null;
  cornerResize.releasePointerCapture(event.pointerId);
};

// listeners: add body class when SHIFT key is down
const body = document.querySelector('body');
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'shift') {
    addCls(body, 'shift-pressed');
  }
});
window.addEventListener('keyup', (event) => {
  if (event.key.toLowerCase() === 'shift') {
    removeCls(body, 'shift-pressed');
  }
});

// listeners: when mouse enters the plugin window gove it focus
document.querySelector('.wrapper').addEventListener('mouseenter', () => {
  window.focus();
});



// input --------------------

// input: get clean input value
function getInputUrlValue() {
  const textbox = document.getElementById('api-url') as HTMLInputElement;
  return textbox.value.trim();
}

// input: set input value local storage
function updateInputUrl() {
  const url = getInputUrlValue();
  const sectionSheetsUrl = document.getElementById('section-sheets-url') as HTMLElement;
  const urlValidStatus = document.getElementById('sheet-url-valid') as HTMLElement;

  removeClsStartingWith(sectionSheetsUrl, 'bg-');
  removeCls(urlValidStatus, ['text-success', 'text-warning', 'text-error']);
  addCls(urlValidStatus, 'hidden');

  if (url !== '') {
    const urlValid = checkUrlIsValid(url);

    if (urlValid) {
      sectionSheetsUrl.classList.add('bg-success');
      urlValidStatus.innerText = '✅ Url valid';
      addCls(urlValidStatus, 'text-success');
      removeCls(urlValidStatus, 'hidden');
    } else {
      sectionSheetsUrl.classList.add('bg-error');
      urlValidStatus.innerText = '⛔️ Url invalid';
      addCls(urlValidStatus, 'text-error');
      removeCls(urlValidStatus, 'hidden');
    }
  } else {
    sectionSheetsUrl.classList.add('bg-warning');
    urlValidStatus.innerText = '⚠️ Url not entered';
    addCls(urlValidStatus, 'text-warning');
    removeCls(urlValidStatus, 'hidden');
  }

  window.parent.postMessage(
    { pluginMessage: { type: 'input-set', value: url } },
    '*'
  );

  updatePreviewButton(url);
}



// helpers --------------------

function togglePreview(collapse: boolean = false): void {
  const previewDataBtn = document.getElementById('preview-data');
  const previewSection = document.querySelector('#preview-section') as HTMLElement;
  previewSection.classList.toggle('accordion-collapsed');
  previewSection.classList.toggle('accordion-expanded');
  previewDataBtn.classList.toggle('invisible');

  // if is opened add tooltip listeners to images
  if (!collapse) {
    imageTooltipListeners('code-preview');
  }
}

function toggleAdvancedMode(): void {
  const sectionHowTo = document.querySelector('#section-how-to') as HTMLElement;
  isAdvancedMode = !isAdvancedMode;

  cornerResize.classList.toggle('hidden');
  sectionHowTo.classList.toggle('accordion-collapsed');
  sectionHowTo.classList.toggle('accordion-expanded');
}

function imageTooltipListeners(parentElem: HTMLElement | string): void {
  let elem: HTMLElement;

  if (typeof parentElem === 'string') {
    elem = document.getElementById(parentElem) as HTMLElement;
  } else {
    elem = parentElem;
  }

  if (elem) {
    const imageLinks = elem.querySelectorAll('.preview-link');
    const imageTooltip = document.getElementById('img-tooltip') as HTMLElement;

    Array.from(imageLinks).map(link => {

      link.addEventListener('mousemove', (event: MouseEvent) => {
        const imgUrl = (event.target as HTMLImageElement).getAttribute('href');

        imageTooltip.innerHTML = `<img src="${imgUrl}">`;
        imageTooltip.style.left = `${event.pageX + 10}px`;
        imageTooltip.style.top = `${event.pageY + 10}px`;
      });

      link.addEventListener('mouseover', (e) => {
        imageTooltip.style.opacity = '1';
      });
      link.addEventListener('mouseout', (e) => {
        imageTooltip.style.opacity = '0';
      });
    });
  }
}



// url --------------------

// url: check if url is a google spreadsheet valid url
function checkUrlIsValid(url: string): boolean {
  var validLink = new RegExp(/^(ftp|http|https):\/\/[^ "]+$/);
  const urlValid = validLink.test(url.trim());
  const urlPrefix = 'https://docs.google.com/spreadsheets';

  return urlValid && url.startsWith(urlPrefix);
}

// url: check if google spreadsheet is public
function checkUrlPublic() {
  const url = getInputUrlValue();

  updatePreviewButton(url);

  if (checkUrlIsValid(url)) {
    window.parent.postMessage(
      { pluginMessage: { type: 'get-data', url, isPreview: false, isCheckUrl: true } },
      '*'
    );
  } else {
    setUrlRequestStatus(RequestType.RESET);
  }
}



// data --------------------

function fetchData(data: any): Promise<any> {
  setUrlRequestStatus(RequestType.RESET);

  const dataFetch = new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', data.pluginMessage.url);
    request.responseType = 'text';
    request.onerror = () => {
      setUrlRequestStatus(RequestType.ERROR, RequestMessage.INVALID_LINK);
      reject(RequestMessage.ERROR_GENERIC);
    }
    request.onload = () => {
      const jsonParsed = JSON.parse(request.response);

      if (jsonParsed) {
        if (jsonParsed.error) {
          sheetIsPublic = false;
          updatePreviewButton(getInputUrlValue());
          setUrlRequestStatus(RequestType.ERROR, RequestMessage.SHEET_NOT_PUBLIC);
          reject(RequestMessage.ERROR_GENERIC);
        } else {
          sheetIsPublic = true;
          updatePreviewButton(getInputUrlValue());
          setUrlRequestStatus(RequestType.SUCCESS, RequestMessage.SHEET_PUBLIC);

          resolve(request.response);
        }
      }

      toggleReCheckButton(false);
    };
    request.send();
  });

  return dataFetch;
}

function setUrlRequestStatus(requestType: RequestType, message: RequestMessage = null): void {
  const sectionHowTo = document.getElementById('section-how-to') as HTMLElement;
  const publishedStatus = document.getElementById('publish-status') as HTMLElement;

  if (requestType === RequestType.RESET) {
    removeClsStartingWith(sectionHowTo, 'bg-');
    removeCls(publishedStatus, ['text-success', 'text-error']);
    addCls(publishedStatus, 'hidden');
  }

  if (requestType === RequestType.ERROR) {
    removeClsStartingWith(sectionHowTo, 'bg-');
    addCls(sectionHowTo, 'bg-error');
    addCls(publishedStatus, 'text-error');
    removeCls(publishedStatus, 'hidden');
    publishedStatus.innerText = message;
    toggleReCheckButton(false);
  }

  if (requestType === RequestType.SUCCESS) {
    removeClsStartingWith(sectionHowTo, 'bg-');
    addCls(sectionHowTo, 'bg-success');
    addCls(publishedStatus, 'text-success');
    removeCls(publishedStatus, 'hidden');
    publishedStatus.innerText = message;
  }
}

function createTable(data: string[][]): void {
  const table = document.getElementById('data-table') as HTMLTableElement;
  const layerNamePrefix = '#';
  const extraActions = (layerName) => `
    <span class="cell-actions">
      <div class="button-holder" tooltip="${layerNamePrefix}${layerName}.rand">
        <button data-type="rand" class="icon-only random"></button>
      </div>
      <div class="button-holder" tooltip="${layerNamePrefix}${layerName}.randsave">
        <button data-type="randsave" class="icon-only random-save"></button>
      </div>
    </span>
  `;

  let tableHTML = '';
  data.map((elem, index) => {
    if (index === 0) {
      tableHTML += `
        <thead>
          <tr>
            <th class="cell-count"></th>
      `;

      elem.map((th, idx) => tableHTML += `
        <th>
          <div class="cell-inner">
            <div class="cell-name-holder" tooltip="${layerNamePrefix}${th}">
              <span class="cell-name">${th}</span>
            </div>
            ${extraActions(th)}
          </div>
        </th>`);
      tableHTML += '</tr></thead>';
    } else {
      tableHTML += `
        <tbody>
          <tr>
            <td class="cell-count">${index}</td>
      `;

      elem.map((td, idx) => tableHTML += `
        <td>
          <div class="cell-inner">
            <div class="cell-name-holder" tooltip="${layerNamePrefix}${data[0][idx]}.${index}">
              <span class="cell-name">${isStringImage(td) ? `<a class="preview-link" target="_blank" href="${td}">${td}</a>` : td}</span>
            </div>
          </div>
        </td>`);
      tableHTML += '</tr>';

      if (index === data.length - 1) {
        tableHTML += '</tbody>';
      }
    }
  });
  table.innerHTML = tableHTML;

  // create tooltip for cells with images
  imageTooltipListeners(table);

  // add listeners
  const rows = document.querySelectorAll('tr');
  const rowsArray = Array.from(rows);

  table.addEventListener('click', (event) => {
    let target = event.target as HTMLElement;
    const labelNamePrefix = '#';
    let labelNameSuffix = '';
    if (target.tagName.toLowerCase() === 'button') {
      labelNameSuffix = `.${target.getAttribute('data-type')}`;
      target = target.closest('th').querySelector('.cell-name');
    }

    const rowIndex = rowsArray.findIndex(row => row.contains(target));
    if (rowsArray[rowIndex]) {
      const columns = Array.from(rowsArray[rowIndex].querySelectorAll('th, td'));
      const columnIndex = columns.findIndex(column => {
        const colName = column.closest('th, td').querySelector('.cell-name');
        const targetName = target.parentElement.closest('th, td').querySelector('.cell-name');

        return colName === targetName;
      });
      const columnTite = data[0][columnIndex - 1];
      let value = '';

      if (rowIndex === 0) {
        value = `${labelNamePrefix}${columnTite}${labelNameSuffix}`;
      } else {
        value = `${labelNamePrefix}${columnTite}.${rowIndex}`;
      }
      // console.log(columnIndex, rowIndex, value);

      window.parent.postMessage(
        { pluginMessage: { type: 'table-elem-click', rowIndex, columnIndex, value, layerSelectionCount, isShift: event.shiftKey } },
        '*'
      );
    }
  });

  updateTableSelection();
}

function updateTableSelection(): void {
  const table = document.getElementById('data-table');
  const tableInfo = document.getElementById('table-info');

  const tableToggleSelected = (onlyRemove: boolean): void => {
    const layerNamesArray = layerSelectionNames.map(name => name.split('#').filter(str => str !== '').map(str => `#${str}`));
    let selectedArrayCount = 0;

    table.querySelectorAll('[tooltip]').forEach(elem => {
      const cell = elem.closest('th, td');
      const cellButtons = cell.querySelectorAll('.button-holder');
      if (cellButtons.length > 0) {
        cellButtons.forEach(btn => removeCls(btn, 'selected'));
      }

      if (cell.classList.contains('selected')) {
        removeCls(cell, 'selected');
      }

      if (!onlyRemove) {
        setTimeout(() => {
          const cellName = elem.getAttribute('tooltip');
          layerNamesArray.map(name => {
            if (name.includes(cellName)) {
              addCls(elem.closest('th, td'), 'selected')

              if (elem.classList.contains('button-holder')) {
                addCls(elem, 'selected')
              }

              selectedArrayCount++;
            }
          });

          if (selectedArrayCount === 0) {
            removeCls(table, 'selected-multiple');
            removeCls(table, 'selected-single');
          } else if (selectedArrayCount === 1) {
            removeCls(table, 'selected-multiple');
            addCls(table, 'selected-single');
          } else if (selectedArrayCount > 1) {
            addCls(table, 'selected-multiple');
            removeCls(table, 'selected-single');
          }
        });
      }
    });
  }

  if (layerSelectionCount === 1) {
    removeCls(tableInfo, 'has-selection');
    addCls(tableInfo, 'has-selection');

    if (table.children.length > 0) {
      if (layerSelectionCount === 1) {
        removeCls(table, 'selected-multiple');
        addCls(table, 'selected-multiple');

        tableToggleSelected(false);
      }
    }
  } else if (layerSelectionCount === 0 || layerSelectionCount > 1) {
    removeCls(tableInfo, 'has-selection');

    tableToggleSelected(true);
  }
}



// buttons --------------------

// buttons: preview btn disabled state
function updatePreviewButton(url: string) {
  const buttonPreviewData = document.querySelector('#preview-data') as HTMLButtonElement;

  if (checkUrlIsValid(url) && sheetIsPublic) {
    buttonPreviewData.disabled = false;
  } else {
    buttonPreviewData.disabled = true;
  }
}

function toggleReCheckButton(check: boolean): void {
  if (check) {
    buttonReCheck.disabled = check;
    addCls(buttonReCheck, 'checking');
  } else {
    buttonReCheck.disabled = check;
    removeCls(buttonReCheck, 'checking');
  }
}



// utils --------------------

function debounce(func, wait = 1000, immediate = false) {
  var timeout;
  return function() {
      var context = this, args = arguments;
      var later = function() {
          timeout = null;
          if (!immediate) { func.apply(context, args); }
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) { func.apply(context, args); }
  };
}

function isStringImage(str: string): boolean {
  return str.toLowerCase().match(new RegExp(`^http(s)?://`, 'g')) ? true : false;
}

function removeClsStartingWith(elem: any | any[], strCls: string = 'bg-'): void {
  if (Array.isArray(elem)) {
    elem.map((item) => {
      Array.from(item.classList).map((cls: string) => {
        if (cls.startsWith(strCls)) {
          item.classList.remove(cls);
        }
      });
    });
  } else {
    Array.from(elem.classList).map((cls: string) => {
      if (cls.startsWith(strCls)) {
        elem.classList.remove(cls);
      }
    });
  }
}



// class --------------------

function addCls(elem: any | any[], cls: string | string[]): void {
  if (Array.isArray(elem)) {
    elem.map((item) => {
      if (Array.isArray(cls)) {
        cls.map((strCls) => {
          item.classList.add(strCls);
        });
      } else {
        item.classList.add(cls);
      }
    });
  } else {
    if (Array.isArray(cls)) {
      cls.map((strCls) => {
        elem.classList.add(strCls);
      });
    } else {
      elem.classList.add(cls);
    }
  }
}

function removeCls(elem: any | any[], cls: string | string[]): void {
  if (Array.isArray(elem)) {
    elem.map((item) => {
      if (Array.isArray(cls)) {
        cls.map((strCls) => {
          item.classList.remove(strCls);
        });
      } else {
        item.classList.remove(cls);
      }
    });
  } else {
    if (Array.isArray(cls)) {
      cls.map((strCls) => {
        elem.classList.remove(strCls);
      });
    } else {
      elem.classList.remove(cls);
    }
  }
}
