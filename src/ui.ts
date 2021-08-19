import './ui.scss';

// sheet is public
let sheetIsPublic = false;

let buttonReCheck = document.getElementById('btn-re-check-link') as HTMLButtonElement;

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
                index: event.data.pluginMessage.index || null,
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
      countElem.innerText = event.data.pluginMessage.layers;
      messageElem.innerText = event.data.pluginMessage.message;
      if (event.data.pluginMessage.message2) {
        subtitleElem.innerText = event.data.pluginMessage.message2;
      }
    }

    if (event.data.pluginMessage.type === 'populate-json-preview') {
      document.getElementById('code-preview').innerHTML =
        event.data.pluginMessage.json;
      (document.getElementById('code-to-copy') as HTMLTextAreaElement).value =
        JSON.stringify(event.data.pluginMessage.jsonRaw, undefined, 2);
      togglePreview();
    }

    if (event.data.pluginMessage.type === 'close-json-preview') {
      togglePreview(true);
    }

    if (event.data.pluginMessage.type === 'get-api-data') {
      const previewSection = document.querySelector('#preview-section') as HTMLElement;

      if (event.data.pluginMessage.isPreview && !previewSection.classList.contains('accordion-collapsed')) {
        window.parent.postMessage(
          {
            pluginMessage: {
              type: 'close-preview'
            },
          },
          '*'
        );
        return;
      }

      const sectionHowTo = document.getElementById('section-how-to') as HTMLElement;
      const publishedStatus = document.getElementById('publish-status') as HTMLElement;

      removeCls(publishedStatus, ['text-success', 'text-error']);
      addCls(publishedStatus, 'hidden');

      const request = new XMLHttpRequest();
      request.open('GET', event.data.pluginMessage.url);
      request.responseType = 'text';
      request.onerror = () => {
        removeClsStartingWith(sectionHowTo, 'bg-');
        addCls(sectionHowTo, 'bg-error');
        addCls(publishedStatus, 'text-error');
        removeCls(publishedStatus, 'hidden');
        publishedStatus.innerText = '⛔️ Invalid link or bad request';
        toggleReCheckButton(false);
      };
      request.onload = () => {
        const jsonParsed = JSON.parse(request.response);

        if (jsonParsed.error) {
          sheetIsPublic = false;
          updatePreviewButton(getInputUrlValue());
          removeClsStartingWith(sectionHowTo, 'bg-');
          addCls(sectionHowTo, 'bg-error');
          addCls(publishedStatus, 'text-error');
          removeCls(publishedStatus, 'hidden');
          publishedStatus.innerText = '⛔️ Sheet is not Public';
        } else {
          sheetIsPublic = true;
          updatePreviewButton(getInputUrlValue());
          removeClsStartingWith(sectionHowTo, 'bg-');
          addCls(sectionHowTo, 'bg-success');
          addCls(publishedStatus, 'text-success');
          removeCls(publishedStatus, 'hidden');
          publishedStatus.innerText = '✅ Sheet is Public';

          if (!event.data.pluginMessage.isCheckUrl) {
            const data = request.response;
            window.parent.postMessage(
              {
                pluginMessage: {
                  type: 'spreadsheet-data',
                  data,
                  isPreview: event.data.pluginMessage.isPreview,
                  isCheckUrl: event.data.pluginMessage.isCheckUrl
                },
              },
              '*'
            );
          }
        }

        toggleReCheckButton(false);
      };
      request.send();
    }

    // console.log('event.data.pluginMessage.type:', event.data.pluginMessage.type);
    // if (event.data.pluginMessage.type === 'get-api-data') {
    //   if (event.data?.googleLoginData) {
    //     console.log(event.data.googleLoginData);
    //   }
    //   // const data = JSON.parse(event.data);
    //   // const googleLoginData = data.googleLoginData;

    //   // if (googleLoginData) {
    //   //   console.log('OUT:', googleLoginData);
    //   // }
    // }
  }
  // console.log('MSG:', event.data);
};



// listeners --------------------

// listeners: add input url listeners
document.getElementById('api-url').addEventListener('input', debounce(checkUrlPublic));
document.getElementById('api-url').addEventListener('paste', debounce(checkUrlPublic));
document.getElementById('api-url').addEventListener('input', updateInputUrl);
document.getElementById('api-url').addEventListener('focus', updateInputUrl);
document.getElementById('api-url').addEventListener('focus', (event) => { (event.target as HTMLInputElement).select(); });
document.getElementById('api-url').addEventListener('blur', updateInputUrl);
document.getElementById('api-url').addEventListener('paste', updateInputUrl);

// listeners: button sync
document.getElementById('sync').addEventListener('click', () => {
  const inputValue = getInputUrlValue();
  window.parent.postMessage(
    { pluginMessage: { type: 'get-data', url: inputValue, isPreview: false, isCheckUrl: false } },
    '*'
  );
});

// listeners: button preview-data
document.getElementById('preview-data').onclick = () => {
  const inputValue = getInputUrlValue();
  window.parent.postMessage(
    { pluginMessage: { type: 'get-data', url: inputValue, isPreview: true, isCheckUrl: false } },
    '*'
  );
};

document.getElementById('btn-copy-to-clipboard').onclick = () => {
  const textarea = (document.getElementById('code-to-copy') as HTMLTextAreaElement);
  textarea.select();
  document.execCommand('copy');
};

buttonReCheck.onclick = (event) => {
  checkUrlPublic();

  toggleReCheckButton(true);
};



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
    const urlValid = checkUrl(url);

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



// url --------------------

function togglePreview(collapse: boolean = false) {
  const previewDataBtn = document.getElementById('preview-data');
  const previewSection = document.querySelector('#preview-section') as HTMLElement;
  previewSection.classList.toggle('accordion-collapsed');
  previewSection.classList.toggle('accordion-expanded');
  previewDataBtn.classList.toggle('invisible');

  // if is opened add tooltip listeners to images
  if (!collapse) {
    tooltipListeners();
  }
}

function tooltipListeners() {
  const pre = document.getElementById('code-preview') as HTMLPreElement;

  if (pre) {
    const imageLinks = pre.querySelectorAll('.preview-link');
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
function checkUrl(url: string) {
  var regex = new RegExp(/^(ftp|http|https):\/\/[^ "]+$/);
  const urlValid = regex.test(url.trim());
  const urlPrefix = 'https://docs.google.com/spreadsheets';

  return urlValid && url.startsWith(urlPrefix);
}

// url: check if google spreadsheet is public
function checkUrlPublic() {
  const url = getInputUrlValue();

  updatePreviewButton(url);

  if (checkUrl(url)) {
    window.parent.postMessage(
      { pluginMessage: { type: 'get-data', url, isPreview: false, isCheckUrl: true } },
      '*'
    );
  }
}



// buttons --------------------

// buttons: preview btn disabled state
function updatePreviewButton(url: string) {
  const buttonPreviewData = document.querySelector('#preview-data') as HTMLButtonElement;

  if (checkUrl(url) && sheetIsPublic) {
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



// methods --------------------

// methods: debounce
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



// utils --------------------

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



// slider --------------------

// const slider = document.getElementById('slider');
// let isDown = false;
// let startX;
// let scrollLeft;
// const dragSpeed = 3;

// slider.addEventListener('mousedown', (e) => {
//   isDown = true;
//   slider.classList.add('active');
//   startX = e.pageX - slider.offsetLeft;
//   scrollLeft = slider.scrollLeft;
// });
// slider.addEventListener('mouseleave', () => {
//   isDown = false;
//   slider.classList.remove('active');
// });
// slider.addEventListener('mouseup', () => {
//   isDown = false;
//   slider.classList.remove('active');
// });
// slider.addEventListener('mousemove', (e) => {
//   if(!isDown) return;
//   e.preventDefault();
//   const x = e.pageX - slider.offsetLeft;
//   const walk = (x - startX) * dragSpeed; // scroll-fast
//   slider.scrollLeft = scrollLeft - walk;
// });
