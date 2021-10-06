// code from (https://github.com/yuanqing/create-figma-plugin)
export async function loadFontsAsync(nodes: Array<TextNode>): Promise<void> {
  const result: Record<string, FontName> = {};
  nodes.map(textNode => collectFontsUsedInNode(textNode, result));
  // console.log(Object.values(result).length);

  await Promise.all(
    Object.values(result).map((font: FontName): Promise<void> => {
      return figma.loadFontAsync(font);
    })
  );
}

function collectFontsUsedInNode(node: TextNode, result: Record<string, FontName>): void {
  if (typeof node.fontName === 'symbol') {
    return;
  } else {
    const fontName = node.fontName as FontName;
    const key = createKey(fontName);
    if (key in result) {
      return;
    }
    result[key] = fontName;
  }
}

function createKey(fontName: FontName): string {
  return `${fontName.family}-${fontName.style}`;
}
