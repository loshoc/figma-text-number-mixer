// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { width: 300, height: 530 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'resize') {
    figma.ui.resize(300, msg.height); // Assuming the width is 300px, adjust if different
  }
  if (msg.type === 'get-fonts') {
    const fonts = await figma.listAvailableFontsAsync();
    const fontFamilies = ['Inter', 'Times New Roman', ...new Set(fonts.map(font => font.fontName.family).filter(f => f !== 'Inter' && f !== 'Times New Roman'))];
    figma.ui.postMessage({ type: 'fonts-list', fontFamilies });
  } else if (msg.type === 'get-font-weights') {
    const { fontFamily, fontSelectId } = msg;
    const fonts = await figma.listAvailableFontsAsync();
    const weights = fonts
      .filter(font => font.fontName.family === fontFamily)
      .map(font => font.fontName.style);
    figma.ui.postMessage({ type: 'font-weights', weights, fontSelectId });
  } else if (msg.type === 'apply-styles') {
    try {
      const selection = figma.currentPage.selection;
      
      for (const node of selection) {
        if (node.type === "TEXT") {
          try {
            const currentFontSize = node.fontSize as number;

            // Load all fonts used in the text node
            const uniqueFonts = new Set<string>();
            for (const run of node.getRangeAllFontNames(0, node.characters.length)) {
              uniqueFonts.add(JSON.stringify(run));
            }
            await Promise.all(Array.from(uniqueFonts).map((fontStr: string) => 
              figma.loadFontAsync(JSON.parse(fontStr) as FontName)
            ));

            // Load new fonts
            await figma.loadFontAsync({ family: msg.englishFont, style: msg.englishWeight });
            await figma.loadFontAsync({ family: msg.numberFont, style: msg.numberWeight });
            
            // Load Chinese font only if it's included in the message
            if (msg.chineseFont && msg.chineseWeight) {
              await figma.loadFontAsync({ family: msg.chineseFont, style: msg.chineseWeight });
            }

            const safeParseNumber = (value: any, fallback: number): number => {
              if (value === undefined || value === 'current') return fallback;
              const parsed = parseFloat(value);
              return isNaN(parsed) ? fallback : parsed;
            };

            const keepCurrentSize = msg.keepCurrentSize !== false;
            const englishSize = keepCurrentSize ? currentFontSize : safeParseNumber(msg.englishSize, currentFontSize);
            const numberSize = keepCurrentSize ? currentFontSize : safeParseNumber(msg.numberSize, currentFontSize);
            const chineseSize = msg.chineseSize ? (keepCurrentSize ? currentFontSize : safeParseNumber(msg.chineseSize, currentFontSize)) : englishSize;

            let text = node.characters;
            
            // Apply auto spacing first if enabled
            if (msg.autoSpacing) {
              text = applyAutoSpacing(text);
            }

            // Update the node's characters
            node.characters = text;

            // Function to apply style to a range
            const applyStyle = (start: number, end: number, isEnglish: boolean, isChinese: boolean, isNumber: boolean) => {
              if (isEnglish) {
                node.setRangeFontName(start, end, { family: msg.englishFont, style: msg.englishWeight });
                setRangeFontSize(node, start, end, englishSize);
              } else if (isChinese && msg.chineseFont && msg.chineseWeight) {
                node.setRangeFontName(start, end, { family: msg.chineseFont, style: msg.chineseWeight });
                setRangeFontSize(node, start, end, chineseSize);
              } else if (isNumber) {
                node.setRangeFontName(start, end, { family: msg.numberFont, style: msg.numberWeight });
                setRangeFontSize(node, start, end, numberSize);
              }
            };

            // Regex for different types
            const englishRegex = /[a-zA-Z]+/g;
            const chineseRegex = /[\u4e00-\u9fa5]+/g;
            const numberRegex = /\d+/g;

            // Apply styles for each type
            [
              { regex: chineseRegex, isEnglish: false, isChinese: true, isNumber: false },
              { regex: englishRegex, isEnglish: true, isChinese: false, isNumber: false },
              { regex: numberRegex, isEnglish: false, isChinese: false, isNumber: true }
            ].forEach(({ regex, isEnglish, isChinese, isNumber }) => {
              let match;
              while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                applyStyle(start, end, isEnglish, isChinese, isNumber);
              }
            });

            console.log('Styles applied to node:', node.name);
          } catch (error) {
            console.error('Error processing node:', error);
            figma.notify(`Error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      figma.notify('Styles applied successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      figma.notify('Error applying styles: ' + errorMessage, {error: true});
    }
  }
};

function setRangeFontSize(node: TextNode, start: number, end: number, fontSize: number) {
  try {
    if (node.parent && node.parent.type === 'INSTANCE') {
      console.warn('Text node is inside a symbol instance. Cannot modify directly.');
      return;
    }
    node.setRangeFontSize(start, end, fontSize);
  } catch (error) {
    console.error('Error in setRangeFontSize:', error);
  }
}

// Add this function to handle auto spacing
function applyAutoSpacing(text: string): string {
  return text.replace(/([a-zA-Z])([\u4e00-\u9fa5])/g, '$1 $2') // English and Chinese
             .replace(/([\u4e00-\u9fa5])([a-zA-Z])/g, '$1 $2') // Chinese and English
             .replace(/([a-zA-Z])(\d)/g, '$1 $2') // English and numbers
             .replace(/(\d)([a-zA-Z])/g, '$1 $2') // Numbers and English
             .replace(/([\u4e00-\u9fa5])(\d)/g, '$1 $2') // Chinese and numbers
             .replace(/(\d)([\u4e00-\u9fa5])/g, '$1 $2') // Numbers and Chinese
             .replace(/([^\u4e00-\u9fa5\w\s])([^\s])/g, '$1 $2') // Half-width punctuation and other characters
             .replace(/(\d)(?=[a-zA-Z\u4e00-\u9fa5])/g, '$1 ') // Numbers and units
             .replace(/([^\u4e00-\u9fa5\w\s])([^\s])/g, '$1$2') // No space between full-width punctuation and other characters
             .replace(/(\d)\s(?=[a-zA-Z\u4e00-\u9fa5])/g, '$1') // Remove space between numbers and units
             .replace(/([^\u4e00-\u9fa5\w\s])\s([^\s])/g, '$1$2') // Remove space between full-width punctuation and other characters
             .replace(/\s([^\u4e00-\u9fa5\w\s])/g, '$1') // Remove space before half-width punctuation marks
             .replace(/([^\u4e00-\u9fa5\w\s])([^\s])/g, '$1 $2') // Add space only after half-width punctuation marks
             .replace(/([a-zA-Z\u4e00-\u9fa5])([^\u4e00-\u9fa5\w\s])/g, '$1$2') // Ensure punctuation matches the style of preceding text
             .replace(/([^\u4e00-\u9fa5\w\s])([a-zA-Z\u4e00-\u9fa5])/g, '$1$2'); // Ensure punctuation matches the style of preceding text
}

figma.on('selectionchange', () => {
  figma.ui.postMessage({ type: 'selection-changed' });
});