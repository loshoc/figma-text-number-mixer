"use strict";
// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).
// This shows the HTML page in "ui.html".
figma.showUI(__html__, { width: 280, height: 420 });
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'get-fonts') {
        const fonts = yield figma.listAvailableFontsAsync();
        const fontFamilies = ['Inter', 'Times New Roman', ...new Set(fonts.map(font => font.fontName.family).filter(f => f !== 'Inter' && f !== 'Times New Roman'))];
        figma.ui.postMessage({ type: 'fonts-list', fontFamilies });
    }
    else if (msg.type === 'get-font-weights') {
        const { fontFamily, fontSelectId } = msg;
        const fonts = yield figma.listAvailableFontsAsync();
        const weights = fonts
            .filter(font => font.fontName.family === fontFamily)
            .map(font => font.fontName.style);
        figma.ui.postMessage({ type: 'font-weights', weights, fontSelectId });
    }
    else if (msg.type === 'apply-styles') {
        try {
            const selection = figma.currentPage.selection;
            for (const node of selection) {
                if (node.type === "TEXT") {
                    try {
                        // Use 'Inter' as the default font
                        const textFont = msg.textFont || 'Inter';
                        const textWeight = msg.textWeight || 'Regular';
                        const numberFont = msg.numberFont || 'Inter';
                        const numberWeight = msg.numberWeight || 'Regular';
                        // Load fonts
                        yield figma.loadFontAsync({ family: textFont, style: textWeight });
                        yield figma.loadFontAsync({ family: numberFont, style: numberWeight });
                        // Apply text styles to the entire layer
                        node.fontName = { family: textFont, style: textWeight };
                        const currentFontSize = node.fontSize;
                        // Function to safely parse number or return fallback
                        const safeParseNumber = (value, fallback) => {
                            if (value === 'current')
                                return fallback;
                            const parsed = parseFloat(value);
                            return isNaN(parsed) ? fallback : parsed;
                        };
                        if (!msg.keepCurrentSize) {
                            const textSize = safeParseNumber(msg.textSize, currentFontSize);
                            node.fontSize = textSize;
                        }
                        // Find and style number segments
                        const text = node.characters;
                        const numberRegex = /\d+/g;
                        let match;
                        while ((match = numberRegex.exec(text)) !== null) {
                            const start = match.index;
                            const end = start + match[0].length;
                            node.setRangeFontName(start, end, { family: numberFont, style: numberWeight });
                            if (!msg.keepCurrentSize) {
                                const numberSize = safeParseNumber(msg.numberSize, currentFontSize);
                                node.setRangeFontSize(start, end, numberSize);
                            }
                        }
                        console.log('Styles applied to node:', node.name);
                    }
                    catch (error) {
                        console.error('Error processing node:', error);
                        figma.notify(`Error: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
            // After applying styles, show a notification but don't close the plugin
            figma.notify('Styles applied successfully!');
        }
        catch (error) {
            // If there's an error, show an error notification
            const errorMessage = error instanceof Error ? error.message : String(error);
            figma.notify('Error applying styles: ' + errorMessage, { error: true });
        }
    }
});
figma.on('selectionchange', () => {
    figma.ui.postMessage({ type: 'selection-changed' });
});
