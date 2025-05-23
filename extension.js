const vscode = require('vscode');
const { wmsToShp2img } = require('./src/wmsUtils');

const parseCache = new WeakMap();

function getParsed(document) {
    if (!parseCache.has(document)) {
        parseCache.set(document, parseMapfile(document));
    }
    return parseCache.get(document);
}

function isLineOnlyKeyword(text, keyword) {
    // Rimuove tutti i commenti di tipo /* ... */ (possono anche essere multilinea, ma qui guardiamo una riga sola)
    const noBlockComments = text.replace(/\/\*.*?\*\//g, '');
    // Rimuove tutto dopo un commento lineare con #
    const noInlineComments = noBlockComments.split('#')[0];
    // Controlla che resti solo la keyword (e spazi)
    const pattern = new RegExp(`^\\s*${keyword}\\s*$`, 'i');
    return pattern.test(noInlineComments);
}

function parseMapfile(document) {
    const edits = [];
    const colors = [];
    const symbols = [];
    const stack = [];

    let indentLevel = 0;
    const tabSize = vscode.workspace.getConfiguration('editor', document.uri).get('tabSize', 2);
    const insertSpaces = vscode.workspace.getConfiguration('editor', document.uri).get('insertSpaces', true);
    const indentChar = insertSpaces ? ' ' : '\t';
    const indentString = indentChar.repeat(tabSize);

    const language = document.languageId;

    for (let i = 0; i < document.lineCount; i++) {
        const lineObj = document.lineAt(i);
        const text = lineObj.text.trim();

        // FORMATTING
        if (/^END\b/i.test(text)) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        if (text.length > 0) {
            const indentation = indentString.repeat(indentLevel);
            const formattedText = indentation + text;
            if (formattedText !== lineObj.text) {
                edits.push(vscode.TextEdit.replace(lineObj.range, formattedText));
            }
        }


        if (language === 'symbolset') {
            if (/^(SYMBOL)\b/i.test(text) &&
                !/(^|\s)END(\s|$)/i.test(text)) {
                indentLevel++;
            }
        } else if (language === 'mapserver') {
            if (/^(CLASS|CLUSTER|COMPOSITE|CONNECTIONOPTIONS|FEATURE|GRID|JOIN|LABEL|LAYER|LEADER|LEGEND|MAP|METADATA|OUTPUTFORMAT|PATTERN|POINTS|PROJECTION|QUERYMAP|REFERENCE|SCALEBAR|SCALETOKEN|STYLE|VALIDATION|WEB)\b/i.test(text) &&
                !/(^|\s)END(\s|$)/i.test(text)) {
                indentLevel++;
            } else if (isLineOnlyKeyword(text, "SYMBOL")) {
                indentLevel++;
            }
        }

        // COLOR DECORATOR - RGB
        const rgbPatterns = [
            { pattern: /\bCOLOR\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/, prefix: "COLOR" },
            { pattern: /\bOUTLINECOLOR\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/, prefix: "OUTLINECOLOR" },
            { pattern: /\bBACKGROUNDCOLOR\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/, prefix: "BACKGROUNDCOLOR" },
            { pattern: /\bSHADOWCOLOR\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/, prefix: "SHADOWCOLOR" }
        ];

        for (const { pattern } of rgbPatterns) {
            let match;
            let searchText = lineObj.text;
            let offset = 0;
            while ((match = pattern.exec(searchText)) !== null) {
                const startPos = new vscode.Position(i, offset + match.index);
                const endPos = new vscode.Position(i, offset + match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);
                const r = parseInt(match[1], 10) / 255;
                const g = parseInt(match[2], 10) / 255;
                const b = parseInt(match[3], 10) / 255;
                colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, 1)));
                offset += match.index + match[0].length;
                searchText = searchText.substring(offset);
            }
        }

        // COLOR DECORATOR - HEX
        const hexPatterns = [/'#([0-9A-Fa-f]{6})'/, /"#([0-9A-Fa-f]{6})"/];
        for (const pattern of hexPatterns) {
            let match;
            let searchText = lineObj.text;
            let offset = 0;
            while ((match = pattern.exec(searchText)) !== null) {
                const hexColor = match[1];
                const startPos = new vscode.Position(i, offset + match.index + match[0].indexOf('#'));
                const endPos = new vscode.Position(i, startPos.character + hexColor.length + 1);
                const range = new vscode.Range(startPos, endPos);
                const r = parseInt(hexColor.substr(0, 2), 16) / 255;
                const g = parseInt(hexColor.substr(2, 2), 16) / 255;
                const b = parseInt(hexColor.substr(4, 2), 16) / 255;
                colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, 1)));
                offset += match.index + match[0].length;
                searchText = searchText.substring(offset);
            }
        }

        /// SYMBOLS / BREADCRUMBS
        const blockKeywords = new Set([
            'MAP', 'LAYER', 'CLASS', 'STYLE', 'LABEL', 'PROJECTION',
            'METADATA', 'OUTPUTFORMAT', 'WEB', 'LEADER',
            'SCALEBAR', 'REFERENCE', 'QUERYMAP', 'CLUSTER', 'COMPOSITE',
            'CONNECTIONOPTIONS', 'GRID', 'JOIN', 'LEGEND', 'FEATURE', 'PATTERN',
            'POINTS', 'SYMBOL', 'SCALETOKEN', 'VALIDATION'
        ]);

        const nameRegex = /^\s*NAME\s+["']([^"']+)["']/i;

        if (/^\s*END\b/i.test(text) && stack.length > 0) {
            const current = stack.pop();
            const endPos = new vscode.Position(i, lineObj.text.length);
            current.symbol.range = new vscode.Range(
                new vscode.Position(current.startLine, 0),
                endPos
            );
        } else {
            const match = text.match(/^(\w+)\b/i);
            if (match) {
                const blockType = match[1].toUpperCase();
                if (blockKeywords.has(blockType)) {
                    const isStandalone = isLineOnlyKeyword(lineObj.text, blockType);

                    if (isStandalone) {
                        const startPos = new vscode.Position(i, 0);
                        const symbolKind =
                            blockType === 'CLASS' ? vscode.SymbolKind.Method :
                                blockType === 'STYLE' || blockType === 'LABEL' ? vscode.SymbolKind.Struct :
                                    vscode.SymbolKind.Class;

                        const symbol = new vscode.DocumentSymbol(
                            blockType, '', symbolKind,
                            new vscode.Range(startPos, startPos),
                            new vscode.Range(startPos, startPos)
                        );

                        if (stack.length > 0) {
                            const parent = stack[stack.length - 1];
                            parent.symbol.children.push(symbol);
                        } else {
                            symbols.push(symbol);
                        }

                        stack.push({
                            type: blockType,
                            startLine: i,
                            symbol
                        });
                    }
                }
            }
            const nameMatch = text.match(nameRegex);
            if (nameMatch && nameMatch[1] && stack.length > 0) {
                for (let j = stack.length - 1; j >= 0; j--) {
                    const item = stack[j];
                    if (item.symbol.name === item.type) {
                        item.symbol.name = `${item.type}: ${nameMatch[1]}`;
                        break;
                    }
                }
            }
        }
    }
    return { edits, colors, symbols };
}

function activate(context) {
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(['mapserver', 'symbolset'], {
            provideDocumentFormattingEdits(document) {
                return getParsed(document).edits;
            }
        })
    );

    context.subscriptions.push(
        vscode.languages.registerColorProvider(['mapserver', 'symbolset'], {
            provideDocumentColors(document) {
                return getParsed(document).colors;
            },
            provideColorPresentations(color, context) {
                const originalText = context.document.getText(context.range);
                const r = Math.round(color.red * 255);
                const g = Math.round(color.green * 255);
                const b = Math.round(color.blue * 255);

                const hex = `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
                if (originalText.includes("SHADOWCOLOR")) {
                    return [new vscode.ColorPresentation(`SHADOWCOLOR ${r} ${g} ${b}`)];
                } else if (originalText.includes("OUTLINECOLOR")) {
                    return [new vscode.ColorPresentation(`OUTLINECOLOR ${r} ${g} ${b}`)];
                } else if (originalText.includes("BACKGROUNDCOLOR")) {
                    return [new vscode.ColorPresentation(`BACKGROUNDCOLOR ${r} ${g} ${b}`)];
                } else if (originalText.includes("COLOR")) {
                    return [new vscode.ColorPresentation(`COLOR ${r} ${g} ${b}`)];
                } else {
                    return [new vscode.ColorPresentation(`#${hex}`)];
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider({ language: 'mapserver' }, {
            provideDocumentSymbols(document) {
                return getParsed(document).symbols;
            }
        })
    );

    vscode.workspace.onDidChangeTextDocument(e => {
        parseCache.delete(e.document);
    });
    let disposable = vscode.commands.registerCommand('chicoff.convertWmsToShp2img', async function() {
        try {
            // Ask user to enter the WMS URL
            const wmsUrl = await vscode.window.showInputBox({
                placeHolder: 'Enter the WMS URL to convert',
                prompt: 'WMS URL to convert to map2img command'
            });
            
            if (!wmsUrl) {
                return; // User cancelled
            }
            
            // Convert URL to shp2img command
            const shp2imgCmd = wmsToShp2img(wmsUrl);
            
            // Show the result
            const action = await vscode.window.showInformationMessage(
                `Converted command:\n${shp2imgCmd}`, 
                'Copy to clipboard', 'Insert into editor', 'Run command'
            );
            
            // Handle selected action
            if (action === 'Copy to clipboard') {
                await vscode.env.clipboard.writeText(shp2imgCmd);
            } else if (action === 'Insert into editor') {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    editor.edit((editBuilder) => {
                        editBuilder.insert(editor.selection.active, shp2imgCmd);
                    });
                }
            } else if (action === 'Run command') {
                // Create a terminal and run the command
                const terminal = vscode.window.createTerminal('MapServer Debug');
                terminal.show();
                terminal.sendText(shp2imgCmd);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });
    
    context.subscriptions.push(disposable);
    
    // Optionally add a command to convert selected text
    let convertSelectionCmd = vscode.commands.registerTextEditorCommand(
        'chicoff.convertSelectedWmsToShp2img', 
        function(textEditor, edit) {
            const selection = textEditor.selection;
            const text = textEditor.document.getText(selection);
            
            if (!text) {
                vscode.window.showInformationMessage('Select a WMS URL before using this command');
                return;
            }
            
            try {
                const shp2imgCmd = wmsToShp2img(text);
                // Replace selection with generated command
                edit.replace(selection, shp2imgCmd);
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            }
        }
    );
    
    context.subscriptions.push(convertSelectionCmd);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
